import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcReducer, initialCalc, displayValue, pendingExpr, tapeToText, type CalcAction, type CalcState } from '../src/lib/calc.ts';

const press = (keys: string, start: CalcState = initialCalc): CalcState =>
  [...keys.replace(/\s/g, '')].reduce<CalcState>((s, k) => {
    const map: Record<string, CalcAction> = {
      '+': { type: 'op', op: '+' }, '-': { type: 'op', op: '−' }, '*': { type: 'op', op: '×' }, '/': { type: 'op', op: '÷' },
      '=': { type: 'equals' }, '.': { type: 'decimal' }, '%': { type: 'percent' }, '~': { type: 'negate' },
      '<': { type: 'backspace' }, 'C': { type: 'clear' }, 'U': { type: 'undo' },
    };
    return calcReducer(s, map[k] ?? { type: 'digit', digit: k });
  }, start);

test('respects operator precedence', () => {
  assert.equal(displayValue(press('2+3*4=')), '14');
  assert.equal(displayValue(press('10-6/3=')), '8');
});

test('fixes floating point noise', () => {
  assert.equal(displayValue(press('.1+.2=')), '0.3');
  assert.equal(displayValue(press('1.1*3=')), '3.3');
});

test('groups thousands', () => {
  assert.equal(displayValue(press('1240*1000=')), '1,240,000');
});

test('divide by zero shows an error and recovers on the next digit', () => {
  const s = press('5/0=');
  assert.equal(displayValue(s), "Can't divide by zero");
  assert.equal(displayValue(press('7', s)), '7');
});

test('swaps a repeated operator instead of stacking it', () => {
  const s = press('8+*');
  assert.equal(pendingExpr(s), '8 ×');
  assert.equal(displayValue(press('2=', s)), '16');
});

test('percent of the left operand for + and −', () => {
  assert.equal(displayValue(press('200+10%=')), '220');
  assert.equal(displayValue(press('50%')), '0.5');
  assert.equal(displayValue(press('80*25%=')), '20');
});

test('negate and backspace', () => {
  assert.equal(displayValue(press('12~')), '-12');
  assert.equal(displayValue(press('123<')), '12');
  assert.equal(displayValue(press('7<')), '0');
  const s = press('12+');
  assert.equal(displayValue(press('<', s)), '12'); // operator removed, 12 editable again
  assert.equal(pendingExpr(press('<', s)), '');
});

test('chains from the previous result and records the tape', () => {
  const s = press('1240*.2=+1240=');
  assert.equal(displayValue(s), '1,488');
  assert.equal(tapeToText(s.tape), '1,240 × 0.2 = 248\n248 + 1,240 = 1,488');
});

test('a digit after equals starts a new calculation', () => {
  const s = press('2+2=5');
  assert.equal(displayValue(s), '5');
  assert.equal(pendingExpr(s), '');
});

test('undo steps back one key at a time', () => {
  const s = press('12+3');
  assert.equal(displayValue(press('U', s)), '12');
  assert.equal(pendingExpr(press('UU', s)), '');
  assert.equal(displayValue(press('UUU', s)), '1');
  assert.equal(press('UUUUUU', s).past.length, 0);
});

test('ignores a second decimal point and caps length', () => {
  assert.equal(displayValue(press('1.2.3')), '1.23');
  assert.equal(displayValue(press('9999999999999999999')).replace(/,/g, '').length, 15);
});
