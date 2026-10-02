import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { aesDecryptBlock, aesEncrypt, aesEncryptBlock, aesKeyExpansion, blocksToText, bytesToHex, caesar, crackCaesar, crackVigenere, crt, desBlock, desSubkeys, diffieHellman, discreteLog, extendedEuclid, generateRsa, hexToBytes, hill, hillInverse, hmacSha256, indexOfCoincidence, isPrimitiveRoot, millerRabin, modInverse, modPow, playfair, railFence, rsaDecrypt, rsaEncrypt, rsaKey, SBOX, sha256, SHA256_K, textToBlocks, vigenere } from '../packages/cryptolab/src/index.mjs';

const des = JSON.parse(readFileSync(new URL('./fixtures/cryptolab/des-pycryptodome.json', import.meta.url), 'utf8')).des;

test('classical ciphers reproduce the textbook examples', () => {
  assert.equal(caesar('Hello, World', 3), 'Khoor, Zruog');
  const english = 'Engineering students learn signals, circuits and communication systems every single semester';
  assert.equal(crackCaesar(caesar(english, 11))[0].key, 11);
  assert.equal(vigenere('ATTACKATDAWN', 'LEMON').output, 'LXFOPVEFRNHR');
  assert.equal(vigenere('LXFOPVEFRNHR', 'LEMON', true).output, 'ATTACKATDAWN');
  const long = vigenere('It was the best of times it was the worst of times it was the age of wisdom it was the age of foolishness it was the epoch of belief it was the epoch of incredulity it was the season of light', 'ENTC').output;
  assert.equal(crackVigenere(long, 4).key, 'ENTC');
  assert.ok(indexOfCoincidence(english).ic > 0.055);
  const pf = playfair('hide the gold in the tree stump', 'playfair example');
  assert.equal(pf.output, 'BMODZBXDNABEKUDMUIXMMOUVIF');
  assert.equal(playfair(pf.output, 'playfair example', true).output, 'HIDETHEGOLDINTHETREXESTUMP');
  assert.equal(hill('HELP', [[3, 3], [2, 5]]).output, 'HIAT');
  assert.equal(hill('HIAT', [[3, 3], [2, 5]], true).output, 'HELP');
  assert.equal(hill('ACT', [[6, 24, 1], [13, 16, 10], [20, 17, 15]]).output, 'POH');
  assert.deepEqual(hillInverse([[6, 24, 1], [13, 16, 10], [20, 17, 15]]).inverse, [[8, 5, 10], [21, 8, 21], [21, 12, 8]]);
  assert.throws(() => hill('AB', [[2, 4], [6, 8]]), /not invertible/);
  assert.equal(railFence('WEAREDISCOVEREDFLEEATONCE', 3).output, 'WECRLTEERDSOEEFEAOCAIVDEN');
  assert.equal(railFence('WECRLTEERDSOEEFEAOCAIVDEN', 3, true).output, 'WEAREDISCOVEREDFLEEATONCE');
});

test('number theory: Euclid, inverses, square-and-multiply, Miller–Rabin, CRT', () => {
  const euclid = extendedEuclid(240, 46);
  assert.equal(euclid.gcd, 2n); assert.equal(240n * euclid.x + 46n * euclid.y, 2n);
  assert.equal(modInverse(17, 3120).inverse, 2753n);
  assert.throws(() => modInverse(6, 9), /no inverse/);
  const power = modPow(4, 13, 497);
  assert.equal(power.result, 445n); assert.equal(power.steps.length, 4);
  for (const [base, exp, m] of [[7n, 560n, 561n], [123456789n, 98765432123n, 1000000007n]]) {
    let expected = 1n, b = base % m, e = exp; while (e > 0n) { if (e & 1n) expected = expected * b % m; b = b * b % m; e >>= 1n; }
    assert.equal(modPow(base, exp, m).result, expected);
  }
  assert.equal(millerRabin(561).prime, false, 'Carmichael number');
  assert.equal(millerRabin(2147483647).prime, true, 'Mersenne prime 2³¹ − 1');
  assert.equal(millerRabin(3215031751n).prime, false, 'strong pseudoprime to bases 2, 3, 5, 7');
  assert.equal(millerRabin((1n << 127n) - 1n).prime, true, 'M127');
  assert.deepEqual(crt([2, 3, 2], [3, 5, 7]).x, 23n);
});

test('RSA: Wikipedia example, CRT decryption, text blocks and generated keys', () => {
  const key = rsaKey(61, 53, 17);
  assert.equal(key.n, 3233n); assert.equal(key.phi, 3120n); assert.equal(key.d, 2753n);
  assert.equal(rsaEncrypt(65, key).result, 2790n);
  const back = rsaDecrypt(2790, key);
  assert.equal(back.plain, 65n); assert.equal(back.crt.m, 65n);
  assert.throws(() => rsaKey(61, 53, 15), /gcd/);
  assert.throws(() => rsaKey(60, 53, 17), /not prime/);
  const big = generateRsa(512, 5);
  assert.ok(big.bits >= 511 && big.bits <= 512);
  assert.equal((big.e * big.d) % ((big.p - 1n) * (big.q - 1n)), 1n);
  const message = 'Namaste from OpenENTC — RSA works on UTF-8 too ✓';
  const { blocks, blockBytes, lastBytes } = textToBlocks(message, big.n);
  const decrypted = blocks.map((m) => rsaDecrypt(rsaEncrypt(m, big).result, big).crt.m);
  assert.equal(blocksToText(decrypted, blockBytes, lastBytes), message);
  assert.deepEqual(generateRsa(256, 9).n, generateRsa(256, 9).n, 'seeded');
});

test('Diffie–Hellman, man in the middle, primitive roots and discrete logs', () => {
  const dh = diffieHellman({ p: 23, g: 5, a: 6, b: 15, eveA: 3, eveB: 7 });
  assert.equal(dh.A, 8n); assert.equal(dh.B, 19n); assert.equal(dh.kAlice, 2n); assert.equal(dh.agree, true);
  assert.equal(dh.mitm.aliceKey, dh.mitm.eveWithAlice); assert.equal(dh.mitm.bobKey, dh.mitm.eveWithBob);
  assert.notEqual(dh.mitm.aliceKey, dh.mitm.bobKey);
  assert.equal(isPrimitiveRoot(5, 23), true); assert.equal(isPrimitiveRoot(2, 23), false);
  const p = 1000003n, g = 2n, x = 777777n;
  const h = modPow(g, x, p).result;
  assert.equal(modPow(g, discreteLog(g, h, p).x, p).result, h);
});

test('AES matches FIPS 197 and node:crypto for 128/192/256-bit keys', () => {
  assert.equal(bytesToHex(SBOX.slice(0, 4)), '637c777b'); assert.equal(SBOX[0x53], 0xed);
  const fips = [['000102030405060708090a0b0c0d0e0f', '69c4e0d86a7b0430d8cdb78070b4c55a'], ['000102030405060708090a0b0c0d0e0f1011121314151617', 'dda97ca4864cdfe06eaf70a0ec0d7191'], ['000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f', '8ea2b7ca516745bfeafc49904b496089']];
  for (const [key, cipher] of fips) {
    const result = aesEncryptBlock(hexToBytes('00112233445566778899aabbccddeeff'), hexToBytes(key));
    assert.equal(bytesToHex(result.output), cipher);
    assert.equal(bytesToHex(aesDecryptBlock(hexToBytes(cipher), hexToBytes(key)).output), '00112233445566778899aabbccddeeff');
  }
  // FIPS 197 appendix A.1: last round-key word w[43] = b6630ca6.
  assert.equal(bytesToHex(aesKeyExpansion(hexToBytes('2b7e151628aed2a6abf7158809cf4f3c')).words[43]), 'b6630ca6');
  // Appendix B: state after round 1 SubBytes begins d4 27 11 ae.
  assert.equal(bytesToHex(aesEncryptBlock(hexToBytes('3243f6a8885a308d313198a2e0370734'), hexToBytes('2b7e151628aed2a6abf7158809cf4f3c')).rounds[1].afterSub.slice(0, 4)), 'd42711ae');
  for (const [bytes, name] of [[16, 'aes-128'], [24, 'aes-192'], [32, 'aes-256']]) {
    for (let k = 0; k < 5; k += 1) {
      const key = randomBytes(bytes), iv = randomBytes(16), data = randomBytes(5 + 17 * k);
      const ecb = createCipheriv(`${name}-ecb`, key, null), cbc = createCipheriv(`${name}-cbc`, key, iv);
      assert.equal(bytesToHex(aesEncrypt(data, key)), Buffer.concat([ecb.update(data), ecb.final()]).toString('hex'));
      assert.equal(bytesToHex(aesEncrypt(data, key, { mode: 'cbc', iv })), Buffer.concat([cbc.update(data), cbc.final()]).toString('hex'));
      const block = randomBytes(16), decipher = createDecipheriv(`${name}-ecb`, key, null).setAutoPadding(false);
      assert.equal(bytesToHex(aesDecryptBlock(block, key).output), decipher.update(block).toString('hex'));
    }
  }
});

test('DES matches the classic worked example and PyCryptodome', () => {
  const result = desBlock(hexToBytes('0123456789abcdef'), hexToBytes('133457799bbcdff1'));
  assert.equal(bytesToHex(result.output), '85e813540f0ab405');
  assert.equal(result.rounds[0].subkey, '1b02effc7072', 'K1 = 000110 110000 001011 101111 111111 000111 000001 110010');
  assert.equal(desSubkeys(hexToBytes('133457799bbcdff1')).length, 16);
  for (const entry of des) {
    assert.equal(bytesToHex(desBlock(hexToBytes(entry.plain), hexToBytes(entry.key)).output), entry.cipher);
    assert.equal(bytesToHex(desBlock(hexToBytes(entry.cipher), hexToBytes(entry.key), true).output), entry.plain);
  }
});

test('SHA-256 and HMAC equal node:crypto', () => {
  assert.equal(SHA256_K[0], 0x428a2f98); assert.equal(SHA256_K[63], 0xc67178f2);
  for (const message of ['', 'abc', 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(1000), 'नमस्ते ENTC']) {
    assert.equal(sha256(message).digest, createHash('sha256').update(message).digest('hex'), JSON.stringify(message.slice(0, 20)));
  }
  const random = randomBytes(300);
  assert.equal(sha256(random).digest, createHash('sha256').update(random).digest('hex'));
  // For "abc" only W0 and W15 are non-zero, so W16 = W0 = 0x61626380.
  assert.equal(sha256('abc').blocks[0].w[16], 0x61626380);
  for (const key of ['key', 'k'.repeat(100), '']) assert.equal(hmacSha256(key, 'The quick brown fox'), createHmac('sha256', key).update('The quick brown fox').digest('hex'));
});
