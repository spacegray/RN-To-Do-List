-- Access rules and sync stamps for Daypad's phase 1 tables. Run with: npx supabase test db
-- Everything happens in a transaction that is rolled back, so the test users never persist.
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

-- Two users. Creating them fires handle_new_user (profile, settings and a "Tasks" list).
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ana@example.test', '{"full_name": "Ana"}'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.test', '{}');

select is((select count(*)::int from public.profiles), 2, 'sign-up creates a profile for each user');
select is((select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'Ana',
  'the profile takes the name from sign-up');
select is((select count(*)::int from public.lists where name = 'Tasks'), 2, 'sign-up creates a "Tasks" list for each user');
select is((select count(*)::int from public.settings), 2, 'sign-up creates settings for each user');

-- remember Ben's list id while we can still see every row
select set_config('test.ben_list', (select id::text from public.lists where user_id = '22222222-2222-2222-2222-222222222222'), true);

-- Ben adds a task and a note.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
insert into public.tasks (id, list_id, title)
  select '33333333-3333-3333-3333-333333333333', id, 'Ben''s task' from public.lists;
insert into public.notes (title) values ('Ben''s note');

-- Ana signs in.
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select is((select count(*)::int from public.lists), 1, 'a user sees only their own lists');
select is((select count(*)::int from public.tasks), 0, 'a user cannot see someone else''s tasks');
select is((select count(*)::int from public.notes), 0, 'a user cannot see someone else''s notes');

select lives_ok(
  $$ insert into public.tasks (id, list_id, title)
     select '44444444-4444-4444-4444-444444444444', id, 'Ana''s task' from public.lists $$,
  'a user can add a task to their own list');

select throws_ok(
  $$ insert into public.tasks (list_id, title)
     values (current_setting('test.ben_list')::uuid, 'sneaky') $$,
  '23503', null, 'a task cannot be added to someone else''s list');

select throws_ok(
  $$ insert into public.notes (user_id, title) values ('22222222-2222-2222-2222-222222222222', 'planted') $$,
  '42501', null, 'a user cannot create rows owned by someone else');

update public.tasks set title = 'hijacked' where id = '33333333-3333-3333-3333-333333333333';
reset role;
select is((select title from public.tasks where id = '33333333-3333-3333-3333-333333333333'), 'Ben''s task',
  'a user cannot edit someone else''s task');
set local role authenticated;

select throws_ok(
  $$ update public.profiles set role = 'super_admin' where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'a user cannot change their own role');

select throws_ok(
  $$ select public.set_user_role('11111111-1111-1111-1111-111111111111', 'admin') $$,
  '42501', null, 'only a super admin can change roles');

select lives_ok(
  $$ update public.profiles set display_name = 'Ana B.' where id = '11111111-1111-1111-1111-111111111111' $$,
  'a user can rename themselves');

-- Sync stamps: an edit made earlier than the stored one is ignored.
update public.tasks set title = 'newer', updated_at = now() + interval '1 minute'
  where id = '44444444-4444-4444-4444-444444444444';
update public.tasks set title = 'older', updated_at = now() - interval '1 hour'
  where id = '44444444-4444-4444-4444-444444444444';
select is((select title from public.tasks where id = '44444444-4444-4444-4444-444444444444'), 'newer',
  'a late, older edit does not overwrite a newer one');

select throws_ok(
  $$ update public.tasks set user_id = '22222222-2222-2222-2222-222222222222', updated_at = now() + interval '2 minutes'
     where id = '44444444-4444-4444-4444-444444444444' $$,
  '42501', null, 'a row cannot be handed to another user');

-- Signed-out visitors get nothing.
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok($$ select * from public.tasks $$, '42501', null, 'signed-out visitors cannot read tasks');

select * from finish();
rollback;
