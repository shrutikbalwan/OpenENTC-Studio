// Cryptography workspace. Entry points: renderCrypto(state); bindCryptoEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { niceRange } from '../../core/circuit-plot.js';
import { aesDecryptBlock, aesEncryptBlock, blocksToText, bytesToHex, caesar, crackCaesar, crackVigenere, crt, desBlock, diffieHellman, discreteLog, ENGLISH_FREQUENCIES, extendedEuclid, generateRsa, hexToBytes, hill, hmacSha256, indexOfCoincidence, letterCounts, lettersOnly, millerRabin, modInverse, modPow, playfair, railFence, rsaDecrypt, rsaEncrypt, rsaKey, sha256, textToBlocks, toBig, vigenere } from '../../../packages/cryptolab/src/index.mjs';
import { fmt } from '../../shared/formatting.js';
import { readout } from '../../components/tables.js';
import { PLOT_COLORS, renderPlotFrame } from '../../components/plots.js';
import { groupField, labSelect, labTabs } from '../../components/forms.js';
import { labError, pageHeader } from '../../components/layout.js';
import { bindLabControls, makeLab } from '../../controllers/lab-controls.js';

const CRYPTO_TABS = [['classical', 'Classical ciphers'], ['numbers', 'Modular arithmetic'], ['rsa', 'RSA'], ['dh', 'Diffie–Hellman'], ['aes', 'AES'], ['des', 'DES'], ['sha', 'SHA-256 & HMAC']];
const cryptoLab = makeLab('crypto-lab', {
  tab: 'classical',
  classical: { cipher: 'playfair', mode: 'encrypt', text: 'hide the gold in the tree stump', key: 'playfair example', shift: 3, rails: 3, matrix: '3 3\n2 5', keyLength: 4 },
  numbers: { a: '240', b: '46', base: '4', exponent: '13', modulus: '497', prime: '561', remainders: '2 3 2', moduli: '3 5 7' },
  rsa: { source: 'manual', p: '61', q: '53', e: '17', bits: 512, seed: 1, message: 'HI ENTC', number: '65' },
  dh: { p: '23', g: '5', a: '6', b: '15', mitm: 'no', eveA: '3', eveB: '7' },
  aes: { key: '2b7e151628aed2a6abf7158809cf4f3c', block: '3243f6a8885a308d313198a2e0370734', round: 1 },
  des: { key: '133457799bbcdff1', block: '0123456789abcdef', round: 1, mode: 'encrypt' },
  sha: { message: 'abc', block: 0, hmacKey: 'key' },
});
const cryptoText = (path, label, value, rows = 0) => (rows ? `<label class="em-text">${label}<textarea rows="${rows}" spellcheck="false" data-cr-text="${path}">${esc(value)}</textarea></label>` : `<label>${label}<input type="text" spellcheck="false" data-cr-text="${path}" value="${esc(value)}"></label>`);
const cryptoField = (...args) => groupField('data-cr-field')(...args);
const big = (value) => esc(value.toString());
const hexByte = (b) => b.toString(16).padStart(2, '0');
const stateGrid = (bytes, title) => `<div class="aes-state"><span>${title}</span><table>${[0, 1, 2, 3].map((r) => `<tr>${[0, 1, 2, 3].map((c) => `<td>${hexByte(bytes[r + 4 * c])}</td>`).join('')}</tr>`).join('')}</table></div>`;
const shortBig = (value) => { const text = value.toString(); return text.length > 60 ? `${text.slice(0, 28)}…${text.slice(-28)} (${text.length} digits)` : text; };
const euclidTable = (rows) => `<table class="truth-table comm-table power-table"><thead><tr><th>q</th><th>r</th><th>s</th><th>t</th></tr></thead><tbody>${rows.slice(0, 40).map((row) => `<tr><td>${row.q === null ? '' : big(row.q)}</td><td>${esc(shortBig(row.r))}</td><td>${esc(shortBig(row.s))}</td><td>${esc(shortBig(row.t))}</td></tr>`).join('')}</tbody></table>`;
const powerTable = (steps, base) => `<table class="truth-table comm-table power-table"><thead><tr><th>Bit</th><th>Square</th><th>× ${esc(shortBig(base))}?</th><th>Result</th></tr></thead><tbody>${steps.slice(0, 64).map((step) => `<tr><td>${step.bit}</td><td>${esc(shortBig(step.squared))}</td><td>${step.bit ? 'yes' : '—'}</td><td>${esc(shortBig(step.result))}</td></tr>`).join('')}</tbody></table>${steps.length > 64 ? `<p class="field-help">First 64 of ${steps.length} steps.</p>` : ''}`;
function renderClassical(c) {
  const decrypt = c.mode === 'decrypt';
  const common = `${labSelect('data-cr-select', 'classical.cipher', 'Cipher', c.cipher, [['caesar', 'Caesar'], ['vigenere', 'Vigenère'], ['playfair', 'Playfair'], ['hill', 'Hill'], ['rail', 'Rail fence']])}${labSelect('data-cr-select', 'classical.mode', 'Direction', c.mode, [['encrypt', 'Encrypt'], ['decrypt', 'Decrypt']])}${cryptoText('classical.text', 'Text', c.text, 3)}`;
  if (c.cipher === 'caesar') {
    const output = caesar(c.text, decrypt ? -c.shift : c.shift);
    const ranked = crackCaesar(decrypt ? c.text : output).slice(0, 5);
    const counts = letterCounts(output), total = counts.reduce((s, v) => s + v, 0) || 1;
    const letters = Array.from({ length: 26 }, (_, i) => i);
    return { controls: `${common}${cryptoField('classical.shift', 'Shift', c.shift)}`, body: `<div class="power-grid"><div>${readout('Output', output)}${renderPlotFrame({ title: 'Letter frequencies of the output (bars) against English (dots)', series: [{ xs: letters, ys: counts.map((v) => v / total), color: PLOT_COLORS[0], stem: true }, { xs: letters, ys: ENGLISH_FREQUENCIES, color: '#f59e0b', stem: true }], xMin: 0, xMax: 25, xTicks: [0, 5, 10, 15, 20, 25].map((i) => ({ position: i / 25, text: String.fromCharCode(65 + i) })), yRange: niceRange(0, 0.15), formatY: (v) => `${fmt(v * 100, 2)} %` })}</div>
      <div><span class="panel-label">BREAKING IT: ALL 26 SHIFTS RANKED BY χ² AGAINST ENGLISH</span><table class="truth-table comm-table power-table"><thead><tr><th>Key</th><th>χ²</th><th>Plaintext guess</th></tr></thead><tbody>${ranked.map((r) => `<tr><td>${r.key}</td><td>${fmt(r.score, 4)}</td><td>${esc(r.plain.slice(0, 60))}</td></tr>`).join('')}</tbody></table></div></div>` };
  }
  if (c.cipher === 'vigenere') {
    const result = vigenere(c.text, c.key, decrypt);
    const ciphertext = decrypt ? c.text : result.output, ioc = indexOfCoincidence(ciphertext);
    const crack = lettersOnly(ciphertext).length >= 4 * c.keyLength ? crackVigenere(ciphertext, Math.max(1, Math.round(c.keyLength))) : null;
    return { controls: `${common}${cryptoText('classical.key', 'Key', c.key)}${cryptoField('classical.keyLength', 'Key length to try when breaking', c.keyLength)}`, body: `<div class="power-grid"><div>${readout('Output', result.output)}<table class="truth-table comm-table power-table"><thead><tr><th>Input</th>${result.steps.slice(0, 24).map((s) => `<th>${s.input}</th>`).join('')}</tr></thead><tbody><tr><td>Key</td>${result.steps.slice(0, 24).map((s) => `<td>${s.key}</td>`).join('')}</tr><tr><td>Output</td>${result.steps.slice(0, 24).map((s) => `<td>${s.output}</td>`).join('')}</tr></tbody></table></div>
      <div class="analysis-readouts">${readout('Index of coincidence of the ciphertext', `${fmt(ioc.ic, 5)} (English ≈ 0.0667, random ≈ 0.0385)`)}${readout('Friedman key-length estimate', ioc.friedman === null ? '—' : fmt(ioc.friedman, 3))}${crack ? readout(`Key found for length ${c.keyLength} (column-wise χ²)`, crack.key) : ''}${crack ? readout('Plaintext with that key', crack.plain.slice(0, 120)) : ''}</div></div>` };
  }
  if (c.cipher === 'playfair') {
    const result = playfair(c.text, c.key, decrypt);
    return { controls: `${common}${cryptoText('classical.key', 'Keyword', c.key)}`, body: `<div class="power-grid"><div><span class="panel-label">KEY SQUARE (I = J)</span><table class="playfair-grid">${result.square.map((row) => `<tr>${row.map((ch) => `<td>${ch}</td>`).join('')}</tr>`).join('')}</table>${readout('Output', result.output)}</div>
      <div><table class="truth-table comm-table power-table"><thead><tr><th>Pair</th><th>Rule</th><th>Result</th></tr></thead><tbody>${result.steps.map((s) => `<tr><td>${s.pair}</td><td>${s.rule}</td><td>${s.out}</td></tr>`).join('')}</tbody></table><p class="field-help">Same row: take the letter to the ${decrypt ? 'left' : 'right'}; same column: the letter ${decrypt ? 'above' : 'below'}; otherwise the corners of the rectangle on the same rows. Doubled letters are split with X.</p></div></div>` };
  }
  if (c.cipher === 'hill') {
    const matrix = String(c.matrix).trim().split('\n').map((line) => line.trim().split(/[\s,]+/).map(Number));
    const result = hill(c.text, matrix, decrypt);
    const showMatrix = (m) => `<table class="playfair-grid">${m.map((row) => `<tr>${row.map((v) => `<td>${v}</td>`).join('')}</tr>`).join('')}</table>`;
    return { controls: `${common}${cryptoText('classical.matrix', 'Key matrix (rows)', c.matrix, 3)}`, body: `<div class="power-grid"><div><div class="hill-row"><div><span class="panel-label">KEY K</span>${showMatrix(matrix)}</div><div><span class="panel-label">K⁻¹ MOD 26</span>${showMatrix(result.inverse)}</div></div>${readout('det K mod 26', `${result.det} (inverse ${result.detInverse})`)}${readout('Output', result.output)}</div>
      <div><table class="truth-table comm-table power-table"><thead><tr><th>Block</th><th>Vector</th><th>${decrypt ? 'K⁻¹' : 'K'}·v</th><th>mod 26</th><th>Out</th></tr></thead><tbody>${result.blocks.slice(0, 30).map((b) => `<tr><td>${b.input}</td><td>(${b.vector.join(', ')})</td><td>(${b.product.join(', ')})</td><td>(${b.result.join(', ')})</td><td>${b.output}</td></tr>`).join('')}</tbody></table></div></div>` };
  }
  const result = railFence(c.text, Math.max(1, Math.round(c.rails)), decrypt);
  return { controls: `${common}${cryptoField('classical.rails', 'Rails', c.rails)}`, body: `<div>${readout('Output', result.output)}<div class="gantt-scroll"><table class="rail-grid">${result.grid.map((row) => `<tr>${row.map((ch) => `<td>${esc(ch)}</td>`).join('')}</tr>`).join('')}</table></div><p class="field-help">The text is written in a zig-zag across the rails and read off rail by rail.</p></div>` };
}
function renderCryptoTab(config) {
  const c = config[config.tab];
  if (config.tab === 'classical') return renderClassical(c);
  if (config.tab === 'numbers') {
    const euclid = extendedEuclid(c.a, c.b);
    let inverse = null; try { inverse = modInverse(c.a, c.b).inverse; } catch { inverse = null; }
    const power = modPow(c.base, c.exponent, c.modulus);
    const mr = millerRabin(c.prime);
    const remainders = String(c.remainders).trim().split(/[\s,]+/), moduli = String(c.moduli).trim().split(/[\s,]+/);
    let chinese; try { chinese = crt(remainders, moduli); } catch (error) { chinese = { error: error.message }; }
    const controls = `${cryptoText('numbers.a', 'a', c.a)}${cryptoText('numbers.b', 'b (modulus for the inverse)', c.b)}${cryptoText('numbers.base', 'Base', c.base)}${cryptoText('numbers.exponent', 'Exponent', c.exponent)}${cryptoText('numbers.modulus', 'Modulus', c.modulus)}${cryptoText('numbers.prime', 'Primality test n', c.prime)}${cryptoText('numbers.remainders', 'CRT remainders', c.remainders)}${cryptoText('numbers.moduli', 'CRT moduli', c.moduli)}`;
    const body = `<div class="power-grid"><div><span class="panel-label">EXTENDED EUCLID (s·a + t·b = r ON EVERY ROW)</span>${euclidTable(euclid.rows)}${readout('gcd(a, b)', big(euclid.gcd))}${readout('Bézout', `${shortBig(euclid.x)}·${shortBig(BigInt(c.a))} + ${shortBig(euclid.y)}·${shortBig(BigInt(c.b))} = ${big(euclid.gcd)}`)}${readout('a⁻¹ mod b', inverse === null ? 'none (gcd ≠ 1)' : big(inverse))}
      <span class="panel-label">SQUARE-AND-MULTIPLY: ${esc(c.base)}^${esc(c.exponent)} MOD ${esc(c.modulus)} (EXPONENT ${esc(power.bits ?? '')}₂)</span>${powerTable(power.steps, BigInt(c.base))}${readout('Result', big(power.result))}</div>
      <div><span class="panel-label">MILLER–RABIN ON ${esc(c.prime)}</span>${readout('Verdict', mr.prime ? `probably prime${mr.deterministic ? ' (deterministic for this size)' : ''}` : `composite — witness ${mr.witness}`)}<table class="truth-table comm-table power-table"><thead><tr><th>Base a</th><th>a^d, then squarings</th><th>Passes</th></tr></thead><tbody>${mr.trace.map((t) => `<tr><td>${big(t.base)}</td><td>${t.divides ? 'divides n' : esc(t.sequence.map(shortBig).join(' → '))}</td><td>${t.divides ? 'no' : t.passes ? 'yes' : 'no'}</td></tr>`).join('')}</tbody></table><p class="field-help">n − 1 = 2^s·d with d odd. n passes for base a if a^d ≡ 1 or some a^(2^r·d) ≡ −1 (mod n).</p>
      <span class="panel-label">CHINESE REMAINDER THEOREM</span>${chinese.error ? `<p class="field-help">${esc(chinese.error)}</p>` : `<table class="truth-table comm-table power-table"><thead><tr><th>mᵢ</th><th>Mᵢ = M/mᵢ</th><th>Mᵢ⁻¹ mod mᵢ</th><th>rᵢ·Mᵢ·Mᵢ⁻¹</th></tr></thead><tbody>${chinese.terms.map((t) => `<tr><td>${big(t.mi)}</td><td>${big(t.Mi)}</td><td>${big(t.inverse)}</td><td>${big(t.term)}</td></tr>`).join('')}</tbody></table>${readout('x', `${big(chinese.x)} (mod ${big(chinese.modulus)})`)}`}</div></div>`;
    return { controls, body };
  }
  if (config.tab === 'rsa') {
    const key = c.source === 'generate' ? generateRsa(Math.min(2048, Math.max(32, Math.round(c.bits))), Math.round(c.seed)) : rsaKey(c.p, c.q, c.e);
    const small = key.n < 256n;
    const blocks = small ? { blocks: [toBig(c.number)], blockBytes: 0, lastBytes: 0 } : textToBlocks(c.message, key.n);
    const cipher = blocks.blocks.map((m) => rsaEncrypt(m, key));
    const plain = cipher.map((block) => rsaDecrypt(block.result, key));
    const recovered = small ? plain[0].plain.toString() : blocksToText(plain.map((p) => p.crt.m), blocks.blockBytes, blocks.lastBytes);
    const digest = toBig(`0x${sha256(c.message, { record: false }).digest}`) % key.n;
    const signature = modPow(digest, key.d, key.n, { record: false }).result, check = modPow(signature, key.e, key.n, { record: false }).result;
    const controls = `${labSelect('data-cr-select', 'rsa.source', 'Key', c.source, [['manual', 'Choose p, q, e'], ['generate', 'Generate']])}${c.source === 'generate' ? `${cryptoField('rsa.bits', 'Modulus size', c.bits, 'bits')}${cryptoField('rsa.seed', 'Seed', c.seed)}` : `${cryptoText('rsa.p', 'p', c.p)}${cryptoText('rsa.q', 'q', c.q)}${cryptoText('rsa.e', 'e', c.e)}`}${small ? cryptoText('rsa.number', 'Message number m < n', c.number) : cryptoText('rsa.message', 'Message text', c.message)}`;
    const body = `<div class="power-grid"><div><div class="analysis-readouts">${readout('n = p·q', `${shortBig(key.n)} (${key.bits} bits)`)}${readout('φ(n) = (p − 1)(q − 1)', shortBig(key.phi))}${readout('Public key (e, n)', `e = ${shortBig(key.e)}`)}${readout('Private exponent d = e⁻¹ mod φ(n)', shortBig(key.d))}${readout('CRT values dp, dq, q⁻¹ mod p', `${shortBig(key.dp)}, ${shortBig(key.dq)}, ${shortBig(key.qInverse)}`)}</div><span class="panel-label">FINDING d WITH EXTENDED EUCLID ON (e, φ)</span>${euclidTable(key.euclid)}</div>
      <div><span class="panel-label">ENCRYPTING ${small ? 'm' : 'BLOCK 1'}: c = m^e MOD n</span>${powerTable(cipher[0].steps, blocks.blocks[0])}<div class="analysis-readouts">${readout(small ? 'm' : `Message as ${blocks.blocks.length} block(s) of ${blocks.blockBytes} bytes`, blocks.blocks.map(shortBig).join(', '))}${readout('Ciphertext', cipher.map((block) => shortBig(block.result)).join(', '))}${readout('CRT decryption of block 1', `m₁ = ${shortBig(plain[0].crt.m1)}, m₂ = ${shortBig(plain[0].crt.m2)}, h = ${shortBig(plain[0].crt.h)} → m = ${shortBig(plain[0].crt.m)}`)}${readout('Recovered', recovered)}${readout('Signature s = H(m)^d mod n (H = SHA-256 mod n)', shortBig(signature))}${readout('Verify s^e mod n = H(m)', check === digest ? 'valid ✓' : 'invalid')}</div><p class="field-help">Textbook RSA without padding, for learning; real systems use OAEP/PSS padding and 2048-bit or larger keys.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'dh') {
    const result = diffieHellman({ p: c.p, g: c.g, a: c.a, b: c.b, eveA: c.mitm === 'yes' ? c.eveA : null, eveB: c.mitm === 'yes' ? c.eveB : null });
    let attack = null;
    try { if (result.p < 10n ** 12n) attack = discreteLog(result.g, result.A, result.p); } catch { attack = null; }
    const controls = `${cryptoText('dh.p', 'Prime p', c.p)}${cryptoText('dh.g', 'Generator g', c.g)}${cryptoText('dh.a', 'Alice secret a', c.a)}${cryptoText('dh.b', 'Bob secret b', c.b)}${labSelect('data-cr-select', 'dh.mitm', 'Man in the middle', c.mitm, [['no', 'No'], ['yes', 'Eve intercepts']])}${c.mitm === 'yes' ? `${cryptoText('dh.eveA', 'Eve secret e₁ (to Bob)', c.eveA)}${cryptoText('dh.eveB', 'Eve secret e₂ (to Alice)', c.eveB)}` : ''}`;
    const body = `<div class="power-grid"><div><div class="dh-flow"><div><b>Alice</b><span>secret a = ${esc(c.a)}</span><span>A = g^a mod p = ${big(result.A)}</span><span>K = B^a = ${big(result.kAlice)}</span></div><div class="dh-wire"><span>p = ${esc(shortBig(result.p))}, g = ${esc(c.g)}</span><span>A → ${result.mitm ? `(Eve swaps for ${big(result.mitm.E1)})` : ''}</span><span>← B ${result.mitm ? `(Eve swaps for ${big(result.mitm.E2)})` : ''}</span></div><div><b>Bob</b><span>secret b = ${esc(c.b)}</span><span>B = g^b mod p = ${big(result.B)}</span><span>K = A^b = ${big(result.kBob)}</span></div></div>
      <span class="panel-label">ALICE COMPUTES A = g^a MOD p</span>${powerTable(result.aliceSteps, result.g)}</div>
      <div class="analysis-readouts">${readout('Shared secret', result.agree ? `${shortBig(result.kAlice)} — both sides agree` : 'mismatch')}${readout('Is g a primitive root mod p?', result.primitive === null ? 'p − 1 too large to factor here' : result.primitive ? 'yes — g generates all of 1 … p − 1' : 'no — g generates a smaller subgroup')}${result.mitm ? `${readout('With Eve: Alice\'s key', `${shortBig(result.mitm.aliceKey)} = Eve's key with Alice ${shortBig(result.mitm.eveWithAlice)}`)}${readout('With Eve: Bob\'s key', `${shortBig(result.mitm.bobKey)} = Eve's key with Bob ${shortBig(result.mitm.eveWithBob)}`)}${readout('Lesson', 'unauthenticated DH lets Eve read and re-encrypt everything — sign the exchange')}` : ''}${attack ? readout('Eve recovers a from A by baby-step giant-step', `a = ${big(attack.x)} after ${attack.operations} multiplications (√p work) — use a large p`) : readout('Discrete-log attack', 'p too large for baby-step giant-step here')}</div></div>`;
    return { controls, body };
  }
  if (config.tab === 'aes') {
    const key = hexToBytes(c.key), block = hexToBytes(c.block);
    const result = aesEncryptBlock(block, key);
    const nr = result.keySchedule.nr, round = Math.min(nr, Math.max(0, Math.round(c.round))), r = result.rounds[round];
    const steps = round === 0 ? `${stateGrid(r.input, 'Plaintext')}${stateGrid(r.roundKey, '⊕ Round key 0')}${stateGrid(r.end, '= State')}` : `${stateGrid(r.start, 'Start')}${stateGrid(r.afterSub, 'SubBytes')}${stateGrid(r.afterShift, 'ShiftRows')}${r.afterMix ? stateGrid(r.afterMix, 'MixColumns') : ''}${stateGrid(r.roundKey, `Round key ${round}`)}${stateGrid(r.end, 'AddRoundKey')}`;
    const words = result.keySchedule.words;
    const controls = `${cryptoText('aes.key', `Key (hex, ${key.length * 8} bits)`, c.key)}${cryptoText('aes.block', 'Plaintext block (16 bytes hex)', c.block)}<label>Round ${round} of ${nr}<input type="range" min="0" max="${nr}" step="1" data-cr-range="aes.round" value="${round}"></label>`;
    const body = `<div class="power-grid"><div><span class="panel-label">ROUND ${round}${round === nr ? ' (NO MIXCOLUMNS IN THE LAST ROUND)' : ''}</span><div class="aes-steps">${steps}</div>${readout('Ciphertext', bytesToHex(result.output))}${readout('Decrypts back to', bytesToHex(aesDecryptBlock(result.output, key).output))}</div>
      <div><span class="panel-label">KEY EXPANSION (${words.length} WORDS)</span><div class="gantt-scroll aes-words"><table class="truth-table comm-table power-table"><thead><tr><th>i</th><th>w[i]</th><th>Note</th></tr></thead><tbody>${words.map((w, i) => `<tr class="${Math.floor(i / 4) === round ? 'active' : ''}"><td>${i}</td><td>${bytesToHex(w)}</td><td>${result.keySchedule.notes.find((n) => n.index === i)?.note ?? (i < key.length / 4 ? 'key' : '')}</td></tr>`).join('')}</tbody></table></div><p class="field-help">The state is filled column by column. Values match FIPS 197 appendix B and node:crypto.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'des') {
    const result = desBlock(hexToBytes(c.block), hexToBytes(c.key), c.mode === 'decrypt');
    const round = Math.min(16, Math.max(1, Math.round(c.round))), r = result.rounds[round - 1];
    const controls = `${cryptoText('des.key', 'Key (8 bytes hex)', c.key)}${cryptoText('des.block', 'Block (8 bytes hex)', c.block)}${labSelect('data-cr-select', 'des.mode', 'Direction', c.mode, [['encrypt', 'Encrypt'], ['decrypt', 'Decrypt']])}<label>Show S-boxes of round ${round}<input type="range" min="1" max="16" step="1" data-cr-range="des.round" value="${round}"></label>`;
    const body = `<div class="power-grid"><div><table class="truth-table comm-table power-table"><thead><tr><th>Round</th><th>L</th><th>R</th><th>Subkey K</th><th>f(R, K)</th><th>L ⊕ f</th></tr></thead><tbody>${result.rounds.map((row) => `<tr class="${row.round === round ? 'active' : ''}"><td>${row.round}</td><td>${row.left}</td><td>${row.right}</td><td>${row.subkey}</td><td>${row.f}</td><td>${row.newRight}</td></tr>`).join('')}</tbody></table>${readout('After initial permutation', result.initialPermutation)}${readout('Output (after swap and IP⁻¹)', bytesToHex(result.output))}</div>
      <div><span class="panel-label">ROUND ${round}: E(R) = ${r.expanded} ⊕ K → EIGHT S-BOXES</span><table class="truth-table comm-table power-table"><thead><tr><th>S-box</th><th>6 input bits</th><th>Row (outer bits)</th><th>Column (middle 4)</th><th>Output</th></tr></thead><tbody>${r.sboxes.map((s) => `<tr><td>S${s.box}</td><td>${s.input}</td><td>${s.row}</td><td>${s.col}</td><td>${s.value} = ${s.value.toString(2).padStart(4, '0')}</td></tr>`).join('')}</tbody></table><p class="field-help">The 32 S-box output bits go through P to give f. Decryption runs the same network with the subkeys reversed. Results match the classic worked example and PyCryptodome.</p></div></div>`;
    return { controls, body };
  }
  const result = sha256(c.message);
  const blockIndex = Math.min(result.blocks.length - 1, Math.max(0, Math.round(c.block))), b = result.blocks[blockIndex];
  const word = (v) => (v >>> 0).toString(16).padStart(8, '0');
  const controls = `${cryptoText('sha.message', 'Message (UTF-8)', c.message, 3)}${result.blocks.length > 1 ? `<label>Block ${blockIndex + 1} of ${result.blocks.length}<input type="range" min="0" max="${result.blocks.length - 1}" step="1" data-cr-range="sha.block" value="${blockIndex}"></label>` : ''}${cryptoText('sha.hmacKey', 'HMAC key', c.hmacKey)}`;
  const body = `<div class="power-grid"><div><div class="analysis-readouts">${readout('SHA-256', result.digest)}${readout('Message length', `${result.bitLength} bits → padded to ${result.padded.length * 8} bits (${result.padded.length / 64} block${result.padded.length > 64 ? 's' : ''})`)}${readout('HMAC-SHA-256(key, message)', hmacSha256(c.hmacKey, c.message))}</div>
    <span class="panel-label">PADDED MESSAGE (1 BIT, ZEROS, 64-BIT LENGTH)</span><div class="hex-dump">${bytesToHex(result.padded.slice(0, 256)).match(/.{1,32}/g).join('<br>')}</div>
    <span class="panel-label">MESSAGE SCHEDULE W[0…63] OF BLOCK ${blockIndex + 1}</span><div class="hex-dump">${b.w.map(word).join(' ')}</div></div>
    <div><span class="panel-label">COMPRESSION ROUNDS (a … h AFTER EACH ROUND)</span><div class="gantt-scroll aes-words"><table class="truth-table comm-table power-table sha-rounds"><thead><tr><th>t</th>${'abcdefgh'.split('').map((ch) => `<th>${ch}</th>`).join('')}</tr></thead><tbody>${b.rounds.map((row, t) => `<tr><td>${t}</td>${row.map((v) => `<td>${word(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="field-help">K and the initial H are the fractional parts of cube and square roots of the first primes. Digests match node:crypto.</p></div></div>`;
  return { controls, body };
}
export function renderCrypto(state) {
  const config = cryptoLab.configuration(state);
  let view;
  try { view = renderCryptoTab(config); } catch (error) { view = { controls: '', body: labError('cr', 'Cryptography', error) }; }
  return `<div class="page scroll-page power-page sigsys-page crypto-page">${pageHeader(modules.find((item) => item.id === 'crypto'), 'CRYPTOGRAPHY STEP BY STEP', '')}${labTabs(CRYPTO_TABS, config.tab, 'data-cr-tab')}<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div></div>`;
}
export function bindCryptoEvents() {
  bindLabControls('cr', cryptoLab, ['cipher', 'mode', 'source', 'mitm']);
  document.querySelectorAll('[data-cr-text]').forEach((input) => input.addEventListener('change', () => { const [group, key] = input.dataset.crText.split('.'); cryptoLab.persist((config) => { config[group][key] = input.value; }); }));
  document.querySelectorAll('[data-cr-range]').forEach((input) => input.addEventListener('change', () => { const [group, key] = input.dataset.crRange.split('.'); cryptoLab.persist((config) => { config[group][key] = Number(input.value); }); }));
}

// ---------------------------------------------------------------------------
// Wireless sensor networks.


// ---------------------------------------------------------------------------
// SDR flowgraph editor.
