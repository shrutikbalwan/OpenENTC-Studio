export declare const ENGLISH_FREQUENCIES: readonly number[];
export declare function lettersOnly(text: string): string;
export declare function letterCounts(text: string): number[];
export declare function chiSquared(text: string): number;
export declare function caesar(text: string, shift: number): string;
export declare function crackCaesar(ciphertext: string): { key: number; plain: string; score: number }[];
export declare function vigenere(text: string, key: string, decrypt?: boolean): { output: string; steps: { input: string; key: string; output: string }[] };
export declare function indexOfCoincidence(text: string): { ic: number; friedman: number | null };
export declare function crackVigenere(ciphertext: string, keyLength: number): { key: string; plain: string };
export declare function playfairSquare(key: string): string[][];
export declare function playfairDigraphs(text: string): string[];
export declare function playfair(text: string, key: string, decrypt?: boolean): { square: string[][]; steps: { pair: string; out: string; rule: string }[]; output: string };
export declare function modInverseSmall(a: number, m: number): number | null;
export declare function hillInverse(matrix: number[][]): { det: number; detInverse?: number; inverse: number[][] | null; reason: string | null };
export declare function hill(text: string, matrix: number[][], decrypt?: boolean): { det: number; detInverse?: number; inverse: number[][] | null; blocks: { input: string; vector: number[]; product: number[]; result: number[]; output: string }[]; output: string };
export declare function railFence(text: string, rails: number, decrypt?: boolean): { grid: string[][]; output: string };

export type BigLike = bigint | number | string;
export declare function toBig(value: BigLike): bigint;
export interface EuclidRow { q: bigint | null; r: bigint; s: bigint; t: bigint }
export declare function extendedEuclid(a: BigLike, b: BigLike): { gcd: bigint; x: bigint; y: bigint; rows: EuclidRow[] };
export declare function modInverse(a: BigLike, m: BigLike): { inverse: bigint; rows: EuclidRow[] };
export declare function modPow(base: BigLike, exponent: BigLike, modulus: BigLike, options?: { record?: boolean }): { result: bigint; steps: { bit: number; squared: bigint; result: bigint }[]; bits?: string };
export declare function millerRabin(n: BigLike, bases?: bigint[]): { prime: boolean; witness: bigint | null; trace: { base: bigint; d?: bigint; s?: number; sequence?: bigint[]; passes?: boolean; divides?: boolean }[]; deterministic?: boolean };
export declare function crt(remainders: BigLike[], moduli: BigLike[]): { x: bigint; modulus: bigint; terms: { mi: bigint; Mi: bigint; inverse: bigint; term: bigint }[] };
export declare function randomPrime(bits: number, seed?: number): bigint;
export interface RsaKey { p: bigint; q: bigint; n: bigint; phi: bigint; e: bigint; d: bigint; dp: bigint; dq: bigint; qInverse: bigint; bits: number; euclid: EuclidRow[] }
export declare function rsaKey(p: BigLike, q: BigLike, e?: BigLike): RsaKey;
export declare function generateRsa(bits?: number, seed?: number, e?: bigint): RsaKey;
export declare function rsaEncrypt(m: BigLike, key: RsaKey): { result: bigint; steps: { bit: number; squared: bigint; result: bigint }[]; bits?: string };
export declare function rsaDecrypt(c: BigLike, key: RsaKey): { plain: bigint; crt: { m1: bigint; m2: bigint; h: bigint; m: bigint } };
export declare function textToBlocks(text: string, n: bigint): { blocks: bigint[]; blockBytes: number; lastBytes: number };
export declare function blocksToText(blocks: bigint[], blockBytes: number, lastBytes?: number): string;
export declare function factorize(n: BigLike, limit?: bigint): { prime: bigint; power: number; unverified?: boolean }[];
export declare function isPrimitiveRoot(g: BigLike, p: BigLike): boolean | null;
export declare function diffieHellman(options: { p: BigLike; g: BigLike; a: BigLike; b: BigLike; eveA?: BigLike | null; eveB?: BigLike | null }): { p: bigint; g: bigint; A: bigint; B: bigint; aliceSteps: { bit: number; squared: bigint; result: bigint }[]; kAlice: bigint; kBob: bigint; agree: boolean; primitive: boolean | null; mitm?: { E1: bigint; E2: bigint; aliceKey: bigint; bobKey: bigint; eveWithAlice: bigint; eveWithBob: bigint } };
export declare function discreteLog(g: BigLike, h: BigLike, p: BigLike): { x: bigint | null; m: bigint; operations: number };

export declare function hexToBytes(hex: string): Uint8Array;
export declare function bytesToHex(bytes: ArrayLike<number>): string;
export declare function gmul(a: number, b: number): number;
export declare const SBOX: Uint8Array;
export declare const INV_SBOX: Uint8Array;
export declare function aesKeyExpansion(key: ArrayLike<number>): { nr: number; words: number[][]; notes: { index: number; note: string }[] };
export interface AesRound { round: number; input?: number[]; start?: number[]; afterSub?: number[]; afterShift?: number[]; afterMix?: number[] | null; roundKey: number[]; end: number[] }
export declare function aesEncryptBlock(block: ArrayLike<number>, key: ArrayLike<number>): { output: Uint8Array; rounds: AesRound[]; keySchedule: { words: number[][]; notes: { index: number; note: string }[]; nr: number } };
export declare function aesDecryptBlock(block: ArrayLike<number>, key: ArrayLike<number>): { output: Uint8Array; rounds: { round: number; afterShift: number[]; afterSub: number[]; afterKey: number[]; end: number[] }[] };
export declare function aesEncrypt(data: ArrayLike<number>, key: ArrayLike<number>, options?: { mode?: 'ecb' | 'cbc'; iv?: ArrayLike<number>; pad?: boolean }): Uint8Array;
export declare function bitsToHex(bits: number[]): string;
export declare function desSubkeys(key: ArrayLike<number>): number[][];
export interface DesRound { round: number; left: string; right: string; subkey: string; expanded: string; sboxes: { box: number; input: string; row: number; col: number; value: number }[]; f: string; newRight: string }
export declare function desBlock(block: ArrayLike<number>, key: ArrayLike<number>, decrypt?: boolean): { output: Uint8Array; initialPermutation: string; rounds: DesRound[] };
export declare const SHA256_K: Uint32Array;
export declare const SHA256_H0: Uint32Array;
export declare function sha256(input: string | ArrayLike<number>, options?: { record?: boolean }): { digest: string; padded: Uint8Array; blocks: { w: number[]; rounds: number[][]; hash: number[] }[]; bitLength: number };
export declare function hmacSha256(key: string | ArrayLike<number>, message: string | ArrayLike<number>): string;
