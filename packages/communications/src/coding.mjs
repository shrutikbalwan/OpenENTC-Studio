// Error-control coding: Hamming codes, CRC and a rate-1/2 convolutional code with Viterbi decoding.

const bitsFrom = (text, label, maximum = 256) => {
  if (typeof text !== 'string' || !new RegExp(`^[01]{1,${maximum}}$`).test(text)) throw new SyntaxError(`${label} must be 1 to ${maximum} bits of 0 and 1.`);
  return [...text].map(Number);
};

/** Hamming(n, k) with parity bits at power-of-two positions (1-indexed), even parity. */
export function hammingEncode(dataText) {
  const data = bitsFrom(dataText, 'Data', 57);
  let parityCount = 0;
  while (2 ** parityCount < data.length + parityCount + 1) parityCount += 1;
  const length = data.length + parityCount;
  const code = new Array(length + 1).fill(0);
  for (let position = 1, next = 0; position <= length; position += 1) if (position & (position - 1)) code[position] = data[next++];
  for (let p = 0; p < parityCount; p += 1) {
    const mask = 2 ** p;
    code[mask] = code.reduce((sum, bit, position) => sum ^ (position && position !== mask && position & mask ? bit : 0), 0);
  }
  return { codeword: code.slice(1).join(''), n: length, k: data.length, parityPositions: Array.from({ length: parityCount }, (_, p) => 2 ** p) };
}

/** Decode a Hamming codeword: the syndrome is the 1-indexed position of a single-bit error. */
export function hammingDecode(codeText) {
  const code = [0, ...bitsFrom(codeText, 'Codeword', 63)];
  const length = code.length - 1;
  let syndrome = 0;
  for (let position = 1; position <= length; position += 1) if (code[position]) syndrome ^= position;
  const corrected = [...code];
  const correctable = syndrome > 0 && syndrome <= length;
  if (correctable) corrected[syndrome] ^= 1;
  const data = corrected.slice(1).filter((_, index) => (index + 1) & index).join('');
  return { syndrome, errorPosition: correctable ? syndrome : null, corrected: corrected.slice(1).join(''), data, detectedUncorrectable: syndrome > length };
}

export const CRC_POLYNOMIALS = Object.freeze({ 'CRC-4 (x⁴+x+1)': '10011', 'CRC-8 (x⁸+x²+x+1)': '100000111', 'CRC-16-CCITT': '10001000000100001', 'CRC-32': '100000100110000010001110110110111' });

/** CRC by polynomial long division (MSB first, zero initial value). Returns remainder, frame and steps. */
export function crcDivide(messageText, polynomialText) {
  const message = bitsFrom(messageText, 'Message', 256);
  const generator = bitsFrom(polynomialText, 'Generator polynomial', 33);
  if (generator[0] !== 1 || generator.length < 2) throw new SyntaxError('The generator must start with 1 and have degree of at least 1.');
  const degree = generator.length - 1;
  const register = [...message, ...new Array(degree).fill(0)];
  const steps = [];
  for (let index = 0; index <= register.length - generator.length; index += 1) {
    if (!register[index]) continue;
    for (let k = 0; k < generator.length; k += 1) register[index + k] ^= generator[k];
    if (steps.length < 40) steps.push({ shift: index, value: register.join('') });
  }
  const remainder = register.slice(-degree).join('');
  return { remainder, frame: `${messageText}${remainder}`, degree, steps };
}

export function crcCheck(frameText, polynomialText) {
  const generator = bitsFrom(polynomialText, 'Generator polynomial', 33);
  const frame = bitsFrom(frameText, 'Frame', 300);
  const register = [...frame];
  for (let index = 0; index <= register.length - generator.length; index += 1) if (register[index]) for (let k = 0; k < generator.length; k += 1) register[index + k] ^= generator[k];
  const remainder = register.slice(-(generator.length - 1)).join('');
  return { remainder, valid: !remainder.includes('1') };
}

// Rate-1/2, constraint length 3 code with generators 7 and 5 (octal): the textbook example.
const GENERATORS = [0b111, 0b101];
const parity = (value) => { let result = 0; for (let v = value; v; v >>= 1) result ^= v & 1; return result; };

export function convolutionalEncode(dataText) {
  const data = bitsFrom(dataText, 'Data', 128);
  let state = 0;
  const output = [];
  for (const bit of [...data, 0, 0]) { // two tail bits flush the encoder back to state 0
    const register = (bit << 2) | state;
    output.push(parity(register & GENERATORS[0]), parity(register & GENERATORS[1]));
    state = register >> 1;
  }
  return { encoded: output.join(''), rate: '1/2', constraintLength: 3, generators: ['7', '5'] };
}

/** Hard-decision Viterbi decoding over the 4-state trellis. */
export function viterbiDecode(receivedText) {
  const received = bitsFrom(receivedText, 'Received bits', 260);
  if (received.length % 2) throw new SyntaxError('Received bits must come in pairs for a rate-1/2 code.');
  const steps = received.length / 2;
  let metrics = [0, Infinity, Infinity, Infinity];
  const history = [];
  for (let step = 0; step < steps; step += 1) {
    const pair = [received[2 * step], received[2 * step + 1]];
    const next = [Infinity, Infinity, Infinity, Infinity], from = [0, 0, 0, 0], input = [0, 0, 0, 0];
    for (let state = 0; state < 4; state += 1) {
      if (!Number.isFinite(metrics[state])) continue;
      for (const bit of [0, 1]) {
        const register = (bit << 2) | state;
        const distance = (parity(register & GENERATORS[0]) ^ pair[0]) + (parity(register & GENERATORS[1]) ^ pair[1]);
        const target = register >> 1;
        if (metrics[state] + distance < next[target]) { next[target] = metrics[state] + distance; from[target] = state; input[target] = bit; }
      }
    }
    history.push({ from, input });
    metrics = next;
  }
  let state = 0;
  const bits = [];
  for (let step = steps - 1; step >= 0; step -= 1) { bits.unshift(history[step].input[state]); state = history[step].from[state]; }
  return { decoded: bits.slice(0, Math.max(0, bits.length - 2)).join(''), pathMetric: metrics[0], correctedErrors: metrics[0] };
}
