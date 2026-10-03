// Lexer and recursive-descent parser for a synthesizable + testbench subset of Verilog-2001.

export class VerilogError extends Error {
  constructor(message, line = null) { super(line ? `line ${line}: ${message}` : message); this.line = line; }
}

const KEYWORDS = new Set(['module', 'endmodule', 'input', 'output', 'inout', 'wire', 'reg', 'integer', 'signed', 'parameter', 'localparam', 'assign', 'always', 'initial', 'begin', 'end', 'if', 'else', 'case', 'casez', 'casex', 'endcase', 'default', 'for', 'while', 'repeat', 'forever', 'posedge', 'negedge', 'or', 'function', 'endfunction', 'task', 'endtask', 'genvar', 'generate', 'endgenerate', 'tri', 'supply0', 'supply1', 'time', 'automatic']);
const OPERATORS = ['<<<', '>>>', '===', '!==', '**', '<=', '>=', '==', '!=', '&&', '||', '<<', '>>', '~&', '~|', '~^', '^~', '+:', '-:', '->'];

export function tokenize(source) {
  const tokens = [];
  let i = 0, line = 1;
  const text = source.replace(/\r/g, '');
  while (i < text.length) {
    const c = text[i];
    if (c === '\n') { line += 1; i += 1; continue; }
    if (/\s/.test(c)) { i += 1; continue; }
    if (text.startsWith('//', i)) { while (i < text.length && text[i] !== '\n') i += 1; continue; }
    if (text.startsWith('/*', i)) { const end = text.indexOf('*/', i + 2); if (end < 0) throw new VerilogError('unterminated comment', line); for (let k = i; k < end; k += 1) if (text[k] === '\n') line += 1; i = end + 2; continue; }
    if (c === '`') { while (i < text.length && text[i] !== '\n') i += 1; continue; } // compiler directives (`timescale, …) are ignored
    if (c === '"') {
      let j = i + 1, value = '';
      while (j < text.length && text[j] !== '"') {
        if (text[j] === '\\') { const n = text[j + 1]; value += n === 'n' ? '\n' : n === 't' ? '\t' : n === '\\' ? '\\' : n === '"' ? '"' : n; j += 2; } else { value += text[j]; j += 1; }
      }
      tokens.push({ type: 'string', value, line }); i = j + 1; continue;
    }
    const number = text.slice(i).match(/^(\d[\d_]*)?\s*'\s*[sS]?[bBoOdDhH]\s*[0-9a-fA-FxXzZ?_]+|^\d[\d_]*(\.\d+)?/);
    if (number && (/\d/.test(c) || c === "'")) { tokens.push({ type: 'number', value: number[0].replace(/\s+/g, ''), line }); i += number[0].length; continue; }
    const ident = text.slice(i).match(/^[A-Za-z_][A-Za-z0-9_$]*/);
    if (ident) { tokens.push({ type: KEYWORDS.has(ident[0]) ? 'keyword' : 'id', value: ident[0], line }); i += ident[0].length; continue; }
    const system = text.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_$]*/);
    if (system) { tokens.push({ type: 'system', value: system[0], line }); i += system[0].length; continue; }
    const op = OPERATORS.find((candidate) => text.startsWith(candidate, i));
    if (op) { tokens.push({ type: 'op', value: op, line }); i += op.length; continue; }
    if ('+-*/%&|^~!<>=?:;,.()[]{}#@'.includes(c)) { tokens.push({ type: 'op', value: c, line }); i += 1; continue; }
    throw new VerilogError(`unexpected character '${c}'`, line);
  }
  tokens.push({ type: 'eof', value: '<end of file>', line });
  return tokens;
}

const BINARY = [
  ['||'], ['&&'], ['|'], ['^', '~^', '^~'], ['&'], ['==', '!=', '===', '!=='], ['<', '<=', '>', '>='], ['<<', '>>', '<<<', '>>>'], ['+', '-'], ['*', '/', '%'], ['**'],
];

export function parse(source) {
  const tokens = tokenize(source);
  let p = 0;
  const peek = (offset = 0) => tokens[p + offset];
  const at = (value) => tokens[p].value === value && tokens[p].type !== 'string';
  const next = () => tokens[p++];
  const expect = (value) => { if (!at(value)) throw new VerilogError(`expected '${value}' but found '${tokens[p].value}'`, tokens[p].line); return next(); };
  const accept = (value) => { if (at(value)) { next(); return true; } return false; };
  const identifier = () => { const token = next(); if (token.type !== 'id') throw new VerilogError(`expected a name but found '${token.value}'`, token.line); return token.value; };

  // ---- expressions ----
  function expression() {
    const condition = binary(0);
    if (accept('?')) { const whenTrue = expression(); expect(':'); const whenFalse = expression(); return { kind: 'ternary', condition, whenTrue, whenFalse }; }
    return condition;
  }
  function binary(level) {
    if (level >= BINARY.length) return unary();
    let left = binary(level + 1);
    while (BINARY[level].includes(tokens[p].value) && tokens[p].type === 'op') {
      const op = next().value;
      const right = level === BINARY.length - 1 ? binary(level) : binary(level + 1);
      left = { kind: 'binary', op, left, right, line: tokens[p - 1].line };
    }
    return left;
  }
  function unary() {
    const token = tokens[p];
    if (token.type === 'op' && ['+', '-', '!', '~', '&', '|', '^', '~&', '~|', '~^', '^~'].includes(token.value)) { next(); return { kind: 'unary', op: token.value, operand: unary() }; }
    return postfix(primary());
  }
  function postfix(node) {
    while (at('[')) {
      next();
      const first = expression();
      if (accept(':')) { const second = expression(); expect(']'); node = { kind: 'part', target: node, msb: first, lsb: second }; }
      else if (at('+:') || at('-:')) { const dir = next().value; const width = expression(); expect(']'); node = { kind: 'indexed', target: node, base: first, width, up: dir === '+:' }; }
      else { expect(']'); node = { kind: 'index', target: node, index: first }; }
    }
    return node;
  }
  function primary() {
    const token = next();
    if (token.type === 'number') return { kind: 'number', text: token.value };
    if (token.type === 'string') return { kind: 'string', value: token.value };
    if (token.type === 'id') {
      if (at('(')) { next(); const args = []; if (!at(')')) { do args.push(expression()); while (accept(',')); } expect(')'); return { kind: 'call', name: token.value, args, line: token.line }; }
      let name = token.value;
      while (at('.') && peek(1).type === 'id') { next(); name += `.${next().value}`; } // hierarchical reference
      return { kind: 'id', name, line: token.line };
    }
    if (token.type === 'system') {
      const args = [];
      if (accept('(')) { if (!at(')')) { do args.push(at(',') ? null : expression()); while (accept(',')); } expect(')'); }
      return { kind: 'system', name: token.value, args, line: token.line };
    }
    if (token.value === '(') { const inner = expression(); expect(')'); return inner; }
    if (token.value === '{') {
      const first = expression();
      if (at('{')) { next(); const parts = [expression()]; while (accept(',')) parts.push(expression()); expect('}'); expect('}'); return { kind: 'replicate', count: first, parts }; }
      const parts = [first];
      while (accept(',')) parts.push(expression());
      expect('}');
      return { kind: 'concat', parts };
    }
    throw new VerilogError(`unexpected '${token.value}' in an expression`, token.line);
  }

  // ---- statements ----
  function delayValue() { if (at('(')) { next(); const e = expression(); expect(')'); return e; } const token = next(); if (token.type === 'number') return { kind: 'number', text: token.value }; if (token.type === 'id') return { kind: 'id', name: token.value }; throw new VerilogError('expected a delay', token.line); }
  function eventControl() {
    // after '@'
    if (accept('*')) return { star: true };
    expect('(');
    if (accept('*')) { expect(')'); return { star: true }; }
    const events = [];
    do {
      let edge = null;
      if (at('posedge') || at('negedge')) edge = next().value;
      events.push({ edge, expr: expression() });
    } while (accept('or') || accept(','));
    expect(')');
    return { events };
  }
  function lvalueOrCall() {
    const start = tokens[p];
    if (start.type === 'system') { const call = primary(); accept(';'); return { kind: 'systask', name: call.name, args: call.args, line: start.line }; }
    if (start.type === 'id' && peek(1).value === '(' ) { const call = primary(); expect(';'); return { kind: 'taskcall', name: call.name, args: call.args, line: start.line }; }
    if (start.type === 'id' && peek(1).value === ';') { next(); next(); return { kind: 'taskcall', name: start.value, args: [], line: start.line }; }
    const target = at('{') ? primary() : postfix(primary());
    const op = next();
    if (op.value !== '=' && op.value !== '<=') throw new VerilogError(`expected '=' or '<=' but found '${op.value}'`, op.line);
    let delay = null;
    if (accept('#')) delay = delayValue();
    const value = expression();
    expect(';');
    return { kind: op.value === '=' ? 'blocking' : 'nonblocking', target, value, delay, line: start.line };
  }
  function statement() {
    const token = tokens[p];
    if (accept(';')) return { kind: 'null' };
    if (accept('begin')) {
      let name = null;
      if (accept(':')) name = identifier();
      const body = [];
      while (!at('end')) { if (tokens[p].type === 'eof') throw new VerilogError("missing 'end'", token.line); body.push(...blockItem()); }
      next();
      return { kind: 'block', body, name };
    }
    if (accept('if')) { expect('('); const condition = expression(); expect(')'); const then = statement(); const otherwise = accept('else') ? statement() : null; return { kind: 'if', condition, then, otherwise }; }
    if (at('case') || at('casez') || at('casex')) {
      const type = next().value; expect('('); const subject = expression(); expect(')');
      const items = [];
      while (!accept('endcase')) {
        if (tokens[p].type === 'eof') throw new VerilogError("missing 'endcase'", token.line);
        if (accept('default')) { accept(':'); items.push({ labels: null, body: statement() }); continue; }
        const labels = [expression()];
        while (accept(',')) labels.push(expression());
        expect(':');
        items.push({ labels, body: statement() });
      }
      return { kind: 'case', type, subject, items };
    }
    if (accept('for')) { expect('('); const init = forAssign(); expect(';'); const condition = expression(); expect(';'); const step = forAssign(); expect(')'); return { kind: 'for', init, condition, step, body: statement() }; }
    if (accept('while')) { expect('('); const condition = expression(); expect(')'); return { kind: 'while', condition, body: statement() }; }
    if (accept('repeat')) { expect('('); const count = expression(); expect(')'); return { kind: 'repeat', count, body: statement() }; }
    if (accept('forever')) return { kind: 'forever', body: statement() };
    if (accept('#')) { const amount = delayValue(); return { kind: 'delay', amount, body: statement() }; }
    if (accept('@')) { const control = eventControl(); return { kind: 'event', control, body: statement() }; }
    return lvalueOrCall();
  }
  function forAssign() { const target = postfix(primary()); expect('='); return { kind: 'blocking', target, value: expression() }; }
  // Declarations inside begin/end (named blocks) and function/task bodies.
  function blockItem() {
    if (at('reg') || at('integer') || at('time')) return [declaration()];
    return [statement()];
  }

  // ---- declarations ----
  function range() { if (!at('[')) return null; next(); const msb = expression(); expect(':'); const lsb = expression(); expect(']'); return { msb, lsb }; }
  function declaration(direction = null) {
    // reg/wire/integer [signed] [range] name [array] [= init], ...;
    let netType = null;
    if (at('wire') || at('reg') || at('integer') || at('tri') || at('time') || at('supply0') || at('supply1')) netType = next().value;
    const signed = accept('signed');
    const width = range();
    const names = [];
    do {
      const name = identifier();
      const array = range();
      let init = null;
      if (accept('=')) init = expression();
      names.push({ name, array, init });
    } while (accept(',') && tokens[p].type === 'id');
    if (tokens[p - 1].value !== ',') expect(';');
    return { kind: 'decl', direction, netType: netType ?? (direction ? 'wire' : 'wire'), signed: signed || netType === 'integer', width: netType === 'integer' ? { msb: { kind: 'number', text: '31' }, lsb: { kind: 'number', text: '0' } } : netType === 'time' ? { msb: { kind: 'number', text: '63' }, lsb: { kind: 'number', text: '0' } } : width, names };
  }
  function parameterList(local = false) {
    const params = [];
    accept('integer');
    accept('signed');
    range();
    do { const name = identifier(); expect('='); params.push({ name, value: expression(), local }); } while (accept(',') && tokens[p].type === 'id' && peek(1).value === '=');
    return params;
  }

  function moduleDecl() {
    const line = expect('module').line;
    const name = identifier();
    const module = { name, line, ports: [], params: [], items: [] };
    if (accept('#')) { expect('('); do { accept('parameter'); module.params.push(...parameterList()); } while (accept(',')); expect(')'); }
    if (accept('(')) {
      if (!at(')')) {
        do {
          if (at('input') || at('output') || at('inout')) {
            // ANSI style: direction [reg] [signed] [range] name {, name}
            const direction = next().value;
            let netType = 'wire';
            if (at('reg') || at('wire')) netType = next().value;
            const signed = accept('signed');
            const width = range();
            module.ports.push(identifier());
            module.items.push({ kind: 'decl', direction, netType, signed, width, names: [{ name: module.ports.at(-1), array: null, init: null }] });
            while (at(',') && peek(1).type === 'id' && !['input', 'output', 'inout'].includes(peek(1).value)) { next(); const extra = identifier(); module.ports.push(extra); module.items.push({ kind: 'decl', direction, netType, signed, width, names: [{ name: extra, array: null, init: null }] }); }
          } else module.ports.push(identifier());
        } while (accept(','));
      }
      expect(')');
    }
    expect(';');
    while (!accept('endmodule')) {
      const token = tokens[p];
      if (token.type === 'eof') throw new VerilogError(`missing 'endmodule' for ${name}`, line);
      if (at('input') || at('output') || at('inout')) { const direction = next().value; module.items.push(declaration(direction)); }
      else if (at('wire') || at('reg') || at('integer') || at('tri') || at('time') || at('supply0') || at('supply1')) module.items.push(declaration());
      else if (accept('parameter')) { module.params.push(...parameterList()); expect(';'); }
      else if (accept('localparam')) { module.params.push(...parameterList(true)); expect(';'); }
      else if (accept('genvar')) { do identifier(); while (accept(',')); expect(';'); }
      else if (accept('assign')) {
        if (accept('#')) delayValue();
        do { const target = at('{') ? primary() : postfix(primary()); expect('='); module.items.push({ kind: 'assign', target, value: expression(), line: token.line }); } while (accept(','));
        expect(';');
      } else if (accept('always')) module.items.push({ kind: 'always', body: statement(), line: token.line });
      else if (accept('initial')) module.items.push({ kind: 'initial', body: statement(), line: token.line });
      else if (at('function') || at('task')) module.items.push(subprogram());
      else if (token.type === 'id') module.items.push(instance());
      else throw new VerilogError(`unexpected '${token.value}' in module ${name}`, token.line);
    }
    return module;
  }
  function subprogram() {
    const kind = next().value; // function | task
    accept('automatic');
    let width = null, signed = false;
    if (kind === 'function') { if (accept('integer')) { signed = true; width = { msb: { kind: 'number', text: '31' }, lsb: { kind: 'number', text: '0' } }; } else { accept('reg'); signed = accept('signed'); width = range(); } }
    const name = identifier();
    const args = [], locals = [];
    if (accept('(')) {
      // ANSI-style argument list
      if (!at(')')) do { const direction = next().value; accept('reg'); const s = accept('signed'); const w = range(); args.push({ direction, signed: s, width: w, name: identifier() }); } while (accept(','));
      expect(')');
    }
    expect(';');
    const body = [];
    const endWord = kind === 'function' ? 'endfunction' : 'endtask';
    while (!accept(endWord)) {
      if (tokens[p].type === 'eof') throw new VerilogError(`missing '${endWord}'`);
      if (at('input') || at('output') || at('inout')) { const direction = next().value; const decl = declaration(direction); for (const entry of decl.names) args.push({ direction, signed: decl.signed, width: decl.width, name: entry.name }); }
      else if (at('reg') || at('integer') || at('time')) locals.push(declaration());
      else body.push(statement());
    }
    return { kind, name, width, signed, args, locals, body: { kind: 'block', body } };
  }
  function instance() {
    const module = identifier();
    const overrides = [];
    if (accept('#')) {
      expect('(');
      if (!at(')')) do { if (accept('.')) { const name = identifier(); expect('('); overrides.push({ name, value: expression() }); expect(')'); } else overrides.push({ name: null, value: expression() }); } while (accept(','));
      expect(')');
    }
    const instances = [];
    do {
      const name = identifier();
      expect('(');
      const connections = [];
      if (!at(')')) do {
        if (accept('.')) { const port = identifier(); expect('('); connections.push({ port, expr: at(')') ? null : expression() }); expect(')'); }
        else connections.push({ port: null, expr: expression() });
      } while (accept(','));
      expect(')');
      instances.push({ name, connections });
    } while (accept(','));
    expect(';');
    return { kind: 'instances', module, overrides, instances };
  }

  const modules = [];
  while (tokens[p].type !== 'eof') {
    if (at('module')) modules.push(moduleDecl());
    else throw new VerilogError(`expected 'module' but found '${tokens[p].value}'`, tokens[p].line);
  }
  return modules;
}
