// Boolean algebra for the Digital Logic Lab: expression parsing, truth tables,
// Quine-McCluskey minimization with don't-cares, K-map layout and gate-level forms.

export const MAX_VARIABLES = 8;
const MAX_EXPRESSION_LENGTH = 500;
const EXACT_COVER_LIMIT = 40;

/**
 * Parse a Boolean expression. Variables are a letter optionally followed by digits
 * (A, b, X1). Operators: NOT as prefix ! ~ ¬ or postfix ' ; AND as & * · . or
 * juxtaposition (AB); XOR as ^ ⊕; OR as + |. Constants 0 and 1. Precedence:
 * NOT > AND > XOR > OR.
 */
export function parseExpression(text) {
  if (typeof text !== 'string' || !text.trim()) throw new TypeError('Enter a Boolean expression such as AB + A\'C.');
  if (text.length > MAX_EXPRESSION_LENGTH) throw new RangeError(`Expressions are limited to ${MAX_EXPRESSION_LENGTH} characters.`);
  const tokens = tokenize(text);
  let position = 0;
  const peek = () => tokens[position];
  const take = (type) => { const token = tokens[position]; if (!token || (type && token.type !== type)) throw new SyntaxError(`Expected ${type === ')' ? 'a closing parenthesis' : 'an operand'} at position ${token ? token.index + 1 : text.length + 1}.`); position += 1; return token; };
  const startsOperand = (token) => token && ['var', 'const', '(', 'not'].includes(token.type);
  const parseOr = () => { const args = [parseXor()]; while (peek()?.type === 'or') { take(); args.push(parseXor()); } return args.length === 1 ? args[0] : { op: 'or', args }; };
  const parseXor = () => { const args = [parseAnd()]; while (peek()?.type === 'xor') { take(); args.push(parseAnd()); } return args.length === 1 ? args[0] : { op: 'xor', args }; };
  const parseAnd = () => {
    const args = [parseUnary()];
    while (peek()?.type === 'and' || startsOperand(peek())) { if (peek().type === 'and') take(); args.push(parseUnary()); }
    return args.length === 1 ? args[0] : { op: 'and', args };
  };
  const parseUnary = () => {
    if (peek()?.type === 'not') { take(); return { op: 'not', arg: parseUnary() }; }
    let node = parsePrimary();
    while (peek()?.type === 'postfix') { take(); node = { op: 'not', arg: node }; }
    return node;
  };
  const parsePrimary = () => {
    const token = peek();
    if (!token) throw new SyntaxError('Expression ends unexpectedly.');
    if (token.type === 'var') { take(); return { op: 'var', name: token.value }; }
    if (token.type === 'const') { take(); return { op: 'const', value: token.value }; }
    if (token.type === '(') { take(); const inner = parseOr(); take(')'); return inner; }
    throw new SyntaxError(`Unexpected "${token.text}" at position ${token.index + 1}.`);
  };
  const tree = parseOr();
  if (position < tokens.length) throw new SyntaxError(`Unexpected "${tokens[position].text}" at position ${tokens[position].index + 1}.`);
  const variables = [...new Set(collectVariables(tree))].sort(compareVariables);
  if (variables.length > MAX_VARIABLES) throw new RangeError(`Expressions are limited to ${MAX_VARIABLES} variables.`);
  return { tree, variables };
}

function tokenize(text) {
  const tokens = [];
  for (let index = 0; index < text.length;) {
    const character = text[index];
    if (/\s/.test(character)) { index += 1; continue; }
    const variable = text.slice(index).match(/^[A-Za-z][0-9]*/);
    if (variable) { tokens.push({ type: 'var', value: variable[0], text: variable[0], index }); index += variable[0].length; continue; }
    const kinds = { '0': 'const', '1': 'const', '(': '(', ')': ')', '!': 'not', '~': 'not', '¬': 'not', "'": 'postfix', '’': 'postfix', '&': 'and', '*': 'and', '·': 'and', '.': 'and', '∧': 'and', '+': 'or', '|': 'or', '∨': 'or', '^': 'xor', '⊕': 'xor' };
    const type = kinds[character];
    if (!type) throw new SyntaxError(`Unsupported character "${character}" at position ${index + 1}.`);
    tokens.push({ type, value: type === 'const' ? Number(character) : character, text: character, index });
    index += 1;
  }
  return tokens;
}

function collectVariables(node) {
  if (node.op === 'var') return [node.name];
  if (node.op === 'const') return [];
  if (node.op === 'not') return collectVariables(node.arg);
  return node.args.flatMap(collectVariables);
}

function compareVariables(left, right) {
  const a = left.match(/^([A-Za-z])(\d*)$/), b = right.match(/^([A-Za-z])(\d*)$/);
  return a[1] === b[1] ? Number(a[2] || -1) - Number(b[2] || -1) : a[1].localeCompare(b[1]);
}

export function evaluateExpression(node, assignment) {
  switch (node.op) {
    case 'var': return assignment[node.name] ? 1 : 0;
    case 'const': return node.value;
    case 'not': return evaluateExpression(node.arg, assignment) ? 0 : 1;
    case 'and': return node.args.every((arg) => evaluateExpression(arg, assignment)) ? 1 : 0;
    case 'or': return node.args.some((arg) => evaluateExpression(arg, assignment)) ? 1 : 0;
    case 'xor': return node.args.reduce((sum, arg) => sum ^ evaluateExpression(arg, assignment), 0);
    default: throw new TypeError(`Unknown expression node ${node.op}.`);
  }
}

/** Truth table rows in binary order; the first variable is the most significant bit. */
export function truthTable(expression) {
  const { tree, variables } = typeof expression === 'string' ? parseExpression(expression) : expression;
  const rows = [];
  for (let index = 0; index < 2 ** variables.length; index += 1) {
    const inputs = variables.map((_, bit) => (index >> (variables.length - 1 - bit)) & 1);
    rows.push({ index, inputs, output: evaluateExpression(tree, Object.fromEntries(variables.map((name, bit) => [name, inputs[bit]]))) });
  }
  return { variables, rows, minterms: rows.filter((row) => row.output).map((row) => row.index) };
}

function validateTerms(count, minterms, dontCares) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_VARIABLES) throw new RangeError(`Minimization supports 1 to ${MAX_VARIABLES} variables.`);
  const size = 2 ** count;
  for (const list of [minterms, dontCares]) if (!Array.isArray(list) || list.some((term) => !Number.isInteger(term) || term < 0 || term >= size)) throw new RangeError(`Minterms must be integers from 0 to ${size - 1}.`);
  const ones = [...new Set(minterms)].sort((a, b) => a - b);
  const cares = new Set(ones);
  return { ones, dontCares: [...new Set(dontCares)].filter((term) => !cares.has(term)).sort((a, b) => a - b) };
}

const toPattern = (term, count) => term.toString(2).padStart(count, '0');
export const patternCovers = (pattern, term) => [...toPattern(term, pattern.length)].every((bit, index) => pattern[index] === '-' || pattern[index] === bit);
const literalCount = (pattern) => [...pattern].filter((bit) => bit !== '-').length;

/** Prime implicants via Quine-McCluskey tabulation. */
export function primeImplicants(count, terms) {
  let current = [...new Set(terms.map((term) => toPattern(term, count)))];
  const primes = new Set();
  while (current.length) {
    const used = new Set(), next = new Set();
    for (let i = 0; i < current.length; i += 1) {
      for (let j = i + 1; j < current.length; j += 1) {
        const a = current[i], b = current[j];
        let difference = -1, differences = 0;
        for (let k = 0; k < count && differences < 2; k += 1) {
          if (a[k] === b[k]) continue;
          if (a[k] === '-' || b[k] === '-') { differences = 2; break; }
          difference = k; differences += 1;
        }
        if (differences === 1) { next.add(`${a.slice(0, difference)}-${a.slice(difference + 1)}`); used.add(a); used.add(b); }
      }
    }
    for (const pattern of current) if (!used.has(pattern)) primes.add(pattern);
    current = [...next];
  }
  return [...primes].sort();
}

/** Choose a minimum set of prime implicants covering every minterm (fewest terms, then fewest literals). */
function selectCover(primes, ones) {
  const covers = new Map(primes.map((prime) => [prime, ones.filter((term) => patternCovers(prime, term))]));
  const chosen = new Set();
  let remaining = new Set(ones);
  // Essential prime implicants are the only cover of some minterm.
  for (const term of ones) {
    const candidates = primes.filter((prime) => covers.get(prime).includes(term));
    if (candidates.length === 1) chosen.add(candidates[0]);
  }
  for (const prime of chosen) for (const term of covers.get(prime)) remaining.delete(term);
  let exact = true;
  if (remaining.size) {
    const candidates = primes.filter((prime) => !chosen.has(prime) && covers.get(prime).some((term) => remaining.has(term)));
    const cost = (set) => [set.length, set.reduce((sum, prime) => sum + literalCount(prime), 0)];
    let best = null;
    if (candidates.length <= EXACT_COVER_LIMIT) {
      const search = (index, picked, uncovered) => {
        if (!uncovered.size) { if (!best || compareCost(cost(picked), cost(best)) < 0) best = [...picked]; return; }
        if (best && picked.length >= best.length) return;
        const term = [...uncovered][0];
        for (const prime of candidates.filter((candidate) => covers.get(candidate).includes(term))) {
          const left = new Set([...uncovered].filter((value) => !covers.get(prime).includes(value)));
          search(index + 1, [...picked, prime], left);
        }
      };
      search(0, [], remaining);
    } else {
      exact = false;
      best = [];
      const uncovered = new Set(remaining);
      while (uncovered.size) {
        const prime = candidates.reduce((top, candidate) => covers.get(candidate).filter((term) => uncovered.has(term)).length > covers.get(top).filter((term) => uncovered.has(term)).length ? candidate : top);
        best.push(prime);
        for (const term of covers.get(prime)) uncovered.delete(term);
      }
    }
    for (const prime of best) chosen.add(prime);
  }
  return { implicants: [...chosen].sort((a, b) => b.localeCompare(a)), exact };
}

const compareCost = ([termsA, literalsA], [termsB, literalsB]) => termsA - termsB || literalsA - literalsB;

/** Minimal sum-of-products for the given minterms and don't-cares. */
export function minimize(count, minterms, dontCares = []) {
  const { ones, dontCares: free } = validateTerms(count, minterms, dontCares);
  if (!ones.length) return { implicants: [], primes: [], exact: true, constant: 0 };
  if (ones.length + free.length === 2 ** count) return { implicants: ['-'.repeat(count)], primes: ['-'.repeat(count)], exact: true, constant: 1 };
  const primes = primeImplicants(count, [...ones, ...free]);
  return { ...selectCover(primes, ones), primes, constant: null };
}

const literal = (name, bit, complemented = "'") => bit === '1' ? name : `${name}${complemented}`;

export function formatSop(implicants, variables) {
  if (!implicants.length) return '0';
  if (implicants.length === 1 && !implicants[0].includes('0') && !implicants[0].includes('1')) return '1';
  return implicants.map((pattern) => [...pattern].map((bit, index) => bit === '-' ? '' : literal(variables[index], bit)).join('')).join(' + ');
}

export function formatPos(implicantsOfComplement, variables) {
  if (!implicantsOfComplement.length) return '1';
  if (implicantsOfComplement.length === 1 && !/[01]/.test(implicantsOfComplement[0])) return '0';
  // Each implicant of F' becomes a sum term of F with every literal complemented.
  return implicantsOfComplement.map((pattern) => {
    const literals = [...pattern].map((bit, index) => bit === '-' ? null : literal(variables[index], bit === '1' ? '0' : '1')).filter(Boolean);
    return literals.length === 1 ? literals[0] : `(${literals.join(' + ')})`;
  }).join('');
}

const literalsOf = (pattern, variables, invert = false) => [...pattern].map((bit, index) => bit === '-' ? null : { name: variables[index], complemented: invert ? bit === '1' : bit === '0' }).filter(Boolean);
const showLiteral = ({ name, complemented }) => complemented ? `${name}'` : name;

/**
 * Two-level universal-gate realizations: NAND-NAND from the minimal SOP and NOR-NOR
 * from the minimal POS. A single-literal term feeds the output gate complemented, and
 * inverters (a NAND or NOR with tied inputs) supply complemented variables.
 */
function universalForm(terms, kind) {
  if (!terms.length || terms.some((term) => !term.length)) return null;
  const join = kind === 'nand' ? '' : ' + ', outer = kind === 'nand' ? '·' : ' + ';
  if (terms.length === 1 && terms[0].length === 1) {
    const [only] = terms[0];
    return { expression: only.complemented ? `(${only.name})'` : only.name, gates: only.complemented ? 1 : 0 };
  }
  const inverted = new Set();
  const inputs = terms.map((term) => {
    if (term.length === 1) { if (!term[0].complemented) inverted.add(term[0].name); return term[0].complemented ? term[0].name : `${term[0].name}'`; }
    for (const item of term) if (item.complemented) inverted.add(item.name);
    return `(${term.map(showLiteral).join(join)})'`;
  });
  const expression = terms.length === 1 ? `(${inputs[0]})'` : `(${inputs.join(outer)})'`;
  return { expression, gates: inverted.size + terms.filter((term) => term.length > 1).length + 1 };
}

/** NAND-only (from SOP) and NOR-only (from POS) two-level realizations with gate counts. */
export function universalForms(sop, pos, variables) {
  return {
    nand: universalForm(sop.map((pattern) => literalsOf(pattern, variables)), 'nand'),
    nor: universalForm(pos.map((pattern) => literalsOf(pattern, variables, true)), 'nor'),
  };
}

/** Two-level gate counts for the SOP form. */
export function gateCount(implicants, variables) {
  const inverters = new Set(implicants.flatMap((pattern) => [...pattern].map((bit, index) => bit === '0' ? variables[index] : null).filter(Boolean))).size;
  const ands = implicants.filter((pattern) => literalCount(pattern) >= 2).length;
  return { inverters, and: ands, or: implicants.length > 1 ? 1 : 0, literals: implicants.reduce((sum, pattern) => sum + literalCount(pattern), 0) };
}

/** Gray-coded K-map layout for 2 to 4 variables (rows use the leading variables). */
export function karnaughLayout(variables) {
  const count = variables.length;
  if (count < 2 || count > 4) throw new RangeError('K-maps are drawn for 2 to 4 variables.');
  const gray = (bits) => bits === 1 ? ['0', '1'] : ['00', '01', '11', '10'];
  const rowBits = count === 4 ? 2 : 1, colBits = count - rowBits;
  const rows = gray(rowBits), cols = gray(colBits);
  return {
    rowVariables: variables.slice(0, rowBits), colVariables: variables.slice(rowBits), rows, cols,
    cells: rows.map((row) => cols.map((col) => parseInt(row + col, 2))),
  };
}

/** Everything the lab shows for a function: SOP, POS, universal forms, K-map and groups. */
export function analyzeFunction(variables, minterms, dontCares = []) {
  const count = variables.length;
  if (count === 0) {
    const value = minterms.includes(0) ? '1' : '0';
    return { variables, minterms: value === '1' ? [0] : [], dontCares: [], sop: value, sopImplicants: [], primes: [], exact: true, pos: value, posImplicants: [], gates: { inverters: 0, and: 0, or: 0, literals: 0 }, universal: { nand: null, nor: null }, karnaugh: null, groups: [], canonicalSop: value };
  }
  const sop = minimize(count, minterms, dontCares);
  const zeros = Array.from({ length: 2 ** count }, (_, index) => index).filter((term) => !minterms.includes(term) && !dontCares.includes(term));
  const pos = minimize(count, zeros, dontCares);
  return {
    variables, minterms: [...new Set(minterms)].sort((a, b) => a - b), dontCares: [...new Set(dontCares)].sort((a, b) => a - b),
    sop: formatSop(sop.implicants, variables), sopImplicants: sop.implicants, primes: sop.primes, exact: sop.exact && pos.exact,
    pos: formatPos(pos.implicants, variables), posImplicants: pos.implicants,
    gates: gateCount(sop.implicants, variables), universal: universalForms(sop.implicants, pos.implicants, variables),
    karnaugh: count >= 2 && count <= 4 ? karnaughLayout(variables) : null,
    groups: sop.implicants.map((pattern) => Array.from({ length: 2 ** count }, (_, index) => index).filter((term) => patternCovers(pattern, term))),
    canonicalSop: minterms.length ? `Σm(${[...new Set(minterms)].sort((a, b) => a - b).join(', ')})${dontCares.length ? ` + d(${[...new Set(dontCares)].sort((a, b) => a - b).join(', ')})` : ''}` : '0',
  };
}
