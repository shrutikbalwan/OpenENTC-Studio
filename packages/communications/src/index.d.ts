export interface SymbolPoint { i: number; q: number; }
export interface Constellation { kind: 'constellation'; modulation: 'QPSK'; bitsPerSymbol: 2; symbols: readonly SymbolPoint[]; sampleRate: number | null; units: 'normalized'; channel?: 'AWGN'; noiseSigma?: number; seed?: number; }
export interface BerResult { kind: 'ber'; errors: number; bits: number; rate: number; }
export declare function qpskModulate(bits: ArrayLike<0 | 1>): Constellation;
export declare function qpskDemodulate(constellation: Constellation): readonly (0 | 1)[];
export declare function addAwgn(constellation: Constellation, options?: { sigma?: number; seed?: number }): Constellation;
export declare function bitErrorRate(expected: ArrayLike<0 | 1>, actual: ArrayLike<0 | 1>): BerResult;
