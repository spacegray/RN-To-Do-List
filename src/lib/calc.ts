/**
 * Calculator engine: a pure reducer with no React or platform imports, so it
 * can be unit tested in Node and replayed for undo.
 *
 * Input is kept as a token list (numbers and operators) and evaluated with
 * operator precedence (× and ÷ before + and −) by a small shunting-yard pass,
 * never with eval(). Every "=" appends a line to the tape, so the whole
 * sequence of a calculation can be saved to a note.
 */

export type Op = '+' | '−' | '×' | '÷';
export type Token = { kind: 'num'; value: string } | { kind: 'op'; value: Op };

export type TapeLine = { expr: string; result: string };

export type CalcState = {
  tokens: Token[];        // committed tokens, e.g. [12, +, 3]
  entry: string;          // number being typed, '' when waiting for one
  tape: TapeLine[];       // finished calculations, oldest first
  justEvaluated: boolean; // last key was "=" (next digit starts fresh)
  error: string | null;
  past: Omit<CalcState, 'past'>[]; // undo stack
};

export type CalcAction =
  | { type: 'digit'; digit: string }
  | { type: 'decimal' }
  | { type: 'op'; op: Op }
  | { type: 'equals' }
  | { type: 'percent' }
  | { type: 'negate' }
  | { type: 'backspace' }
  | { type: 'clear' }
  | { type: 'clearTape' }
  | { type: 'undo' };

const MAX_UNDO = 60;
const MAX_DIGITS = 15;

export const initialCalc: CalcState = {
  tokens: [], entry: '0', tape: [], justEvaluated: false, error: null, past: [],
};

/** Round away floating point noise (0.1 + 0.2 → 0.3) and keep it readable. */
export function normalize(n: number): string {
  if (!Number.isFinite(n)) throw new Error('Not a number');
  if (Object.is(n, -0)) return '0';
  const rounded = Number.parseFloat(n.toPrecision(12));
  const abs = Math.abs(rounded);
  if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) return rounded.toExponential(6).replace(/\.?0+e/, 'e');
  return String(rounded);
}

/** Group thousands for display: 1234567.5 → 1,234,567.5 (keeps a trailing "."). */
export function formatNumber(raw: string): string {
  if (raw === '' || raw.includes('e')) return raw;
  const neg = raw.startsWith('-');
  const [int, frac] = (neg ? raw.slice(1) : raw).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + grouped + (frac !== undefined ? '.' + frac : '');
}

const prec: Record<Op, number> = { '+': 1, '−': 1, '×': 2, '÷': 2 };

function apply(a: number, b: number, op: Op): number {
  switch (op) {
    case '+': return a + b;
    case '−': return a - b;
    case '×': return a * b;
    case '÷':
      if (b === 0) throw new Error("Can't divide by zero");
      return a / b;
  }
}

/** Evaluate tokens with precedence. Throws on divide by zero. */
export function evaluate(tokens: Token[]): number {
  const out: number[] = [];
  const ops: Op[] = [];
  const reduce = () => {
    const b = out.pop()!; const a = out.pop()!; out.push(apply(a, b, ops.pop()!));
  };
  for (const t of tokens) {
    if (t.kind === 'num') out.push(Number(t.value));
    else {
      while (ops.length && prec[ops[ops.length - 1]] >= prec[t.value]) reduce();
      ops.push(t.value);
    }
  }
  while (ops.length) reduce();
  return out[0] ?? 0;
}

export function exprString(tokens: Token[]): string {
  return tokens.map((t) => (t.kind === 'num' ? formatNumber(t.value) : t.value)).join(' ');
}

/** What the display shows above the big number, e.g. "1,240 × 0.2". */
export function pendingExpr(s: CalcState): string {
  return exprString(s.tokens);
}

/** The big number: the entry, or the last operand while choosing an operator. */
export function displayValue(s: CalcState): string {
  if (s.error) return s.error;
  if (s.entry !== '') return formatNumber(s.entry);
  const lastNum = [...s.tokens].reverse().find((t) => t.kind === 'num');
  return formatNumber(lastNum?.value ?? '0');
}

function snapshot(s: CalcState): Omit<CalcState, 'past'> {
  const { past: _past, ...rest } = s;
  return rest;
}

function withHistory(prev: CalcState, next: Omit<CalcState, 'past'>): CalcState {
  return { ...next, past: [...prev.past, snapshot(prev)].slice(-MAX_UNDO) };
}

export function calcReducer(s: CalcState, a: CalcAction): CalcState {
  if (a.type === 'undo') {
    if (!s.past.length) return s;
    const prev = s.past[s.past.length - 1];
    return { ...prev, past: s.past.slice(0, -1) };
  }

  const base = s.error ? { ...snapshot(s), tokens: [], entry: '0', error: null } : snapshot(s);

  switch (a.type) {
    case 'digit': {
      if (base.justEvaluated) return withHistory(s, { ...base, tokens: [], entry: a.digit, justEvaluated: false });
      const digits = base.entry.replace(/[-.]/g, '');
      if (digits.length >= MAX_DIGITS) return s;
      const entry = base.entry === '0' ? a.digit : base.entry === '-0' ? '-' + a.digit : base.entry + a.digit;
      return withHistory(s, { ...base, entry });
    }
    case 'decimal': {
      if (base.justEvaluated) return withHistory(s, { ...base, tokens: [], entry: '0.', justEvaluated: false });
      if (base.entry.includes('.')) return s;
      return withHistory(s, { ...base, entry: (base.entry === '' ? '0' : base.entry) + '.' });
    }
    case 'op': {
      let tokens = base.tokens;
      if (base.entry !== '') tokens = [...tokens, { kind: 'num', value: trimEntry(base.entry) }];
      else if (tokens.length && tokens[tokens.length - 1].kind === 'op') tokens = tokens.slice(0, -1); // swap operator
      if (!tokens.length) tokens = [{ kind: 'num', value: '0' }];
      return withHistory(s, { ...base, tokens: [...tokens, { kind: 'op', value: a.op }], entry: '', justEvaluated: false });
    }
    case 'equals': {
      let tokens = base.tokens;
      if (!tokens.length) return s;
      if (base.entry !== '') tokens = [...tokens, { kind: 'num', value: trimEntry(base.entry) }];
      else tokens = tokens.slice(0, -1); // "12 + =" → 12
      try {
        const result = normalize(evaluate(tokens));
        const line: TapeLine = { expr: exprString(tokens), result: formatNumber(result) };
        return withHistory(s, { ...base, tokens: [], entry: result, tape: [...base.tape, line], justEvaluated: true });
      } catch (e) {
        return withHistory(s, { ...base, tokens: [], entry: '', error: (e as Error).message, justEvaluated: true });
      }
    }
    case 'percent': {
      // 200 + 10 % → 200 + 20 (percent of the left operand); alone, 10 % → 0.1
      if (base.entry === '' || base.entry === '-') return s;
      const n = Number(base.entry);
      const ops = base.tokens;
      const lastOp = ops[ops.length - 1];
      const left = ops.length >= 2 ? Number((ops[ops.length - 2] as Token).value) : null;
      const value = lastOp?.kind === 'op' && (lastOp.value === '+' || lastOp.value === '−') && left !== null ? (left * n) / 100 : n / 100;
      return withHistory(s, { ...base, entry: normalize(value), justEvaluated: false });
    }
    case 'negate': {
      const e = base.entry === '' ? '0' : base.entry;
      const entry = e.startsWith('-') ? e.slice(1) : '-' + e;
      return withHistory(s, { ...base, entry, justEvaluated: false });
    }
    case 'backspace': {
      if (base.justEvaluated) return withHistory(s, { ...base, entry: '0', justEvaluated: false });
      if (base.entry === '') {
        // remove a trailing operator and bring the previous number back for editing
        if (!base.tokens.length) return s;
        const tokens = base.tokens.slice(0, -1);
        const last = tokens[tokens.length - 1];
        if (last?.kind === 'num') return withHistory(s, { ...base, tokens: tokens.slice(0, -1), entry: last.value });
        return withHistory(s, { ...base, tokens });
      }
      const entry = base.entry.length <= 1 || (base.entry.length === 2 && base.entry.startsWith('-')) ? '0' : base.entry.slice(0, -1);
      return withHistory(s, { ...base, entry });
    }
    case 'clear':
      return withHistory(s, { ...base, tokens: [], entry: '0', error: null, justEvaluated: false });
    case 'clearTape':
      return withHistory(s, { ...base, tape: [] });
  }
}

function trimEntry(e: string): string {
  if (e === '-' || e === '-0') return '0';
  return e.endsWith('.') ? e.slice(0, -1) : e;
}

/** Text for a note: the last line, or the whole tape. */
export function tapeToText(lines: TapeLine[]): string {
  return lines.map((l) => `${l.expr} = ${l.result}`).join('\n');
}
