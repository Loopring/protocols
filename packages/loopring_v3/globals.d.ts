declare module 'bn.js' {
import { Buffer } from 'buffer'

type Endianness = 'le'|'be'

class BN {
  constructor(number: number|string|number[]|Buffer, base?: number, endian?: Endianness)
    clone(): BN
    toString(base?: number, length?: number): string
    toNumber(): number
    toJSON(): string
    toArray(endian?: Endianness, length?: number): number[]
    toBuffer(endian?: Endianness, length?: number): Buffer
    bitLength(): number
    zeroBits(): number
    byteLength(): number
    isNeg(): boolean
    isEven(): boolean
    isOdd(): boolean
    isZero(): boolean
    cmp(b: any): number
    lt(b: any): boolean
    lte(b: any): boolean
    gt(b: any): boolean
    gte(b: any): boolean
    eq(b: any): boolean
    isBN(b: any): boolean

    neg(): BN
    abs(): BN
    add(b: BN): BN
    sub(b: BN): BN
    mul(b: BN): BN
    sqr(): BN
    pow(b: BN): BN
    div(b: BN): BN
    mod(b: BN): BN
    divRound(b: BN): BN

    or(b: BN): BN
    and(b: BN): BN
    xor(b: BN): BN
    setn(b: number): BN
    shln(b: number): BN
    shrn(b: number): BN
    testn(b: number): boolean
    maskn(b: number): BN
    bincn(b: number): BN
    notn(w: number): BN

    gcd(b: BN): BN
    egcd(b: BN): { a: BN, b: BN, gcd: BN }
    invm(b: BN): BN

    iadd(b: BN): BN
    isub(b: BN): BN
  }
  export = BN
}

declare module "ethereumjs-abi";
declare module "ethereumjs-util";
declare module "es6-promisify";
declare module "sha2";

// declare module 'protocol-simulator-core';

// Truffle injects the following into the global scope
declare var web3: any;
declare var artifacts: any;
declare var contract: any;
declare var assert: any;
