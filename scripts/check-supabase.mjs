// Checks that .env.local points at a reachable Supabase project: npm run supabase:check
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]),
);
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local');
  process.exit(1);
}
if (/service_role|sb_secret_/.test(key)) {
  console.error('That looks like a secret key. Use the publishable key instead, and rotate the secret one.');
  process.exit(1);
}
const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, { headers: { apikey: key } });
if (!res.ok) {
  console.error(`Supabase answered ${res.status}. Check the URL and key.`);
  process.exit(1);
}
const settings = await res.json();
const providers = Object.entries(settings.external ?? {}).filter(([, on]) => on).map(([name]) => name);
console.log(`Connected to ${new URL(url).host}. Sign-in providers on: ${providers.join(', ') || 'none yet'}.`);
