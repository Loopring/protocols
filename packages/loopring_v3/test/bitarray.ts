import BN = require("bn.js");

export class BitArray {
  private data: number[];

  constructor(initialData: number[] = []) {
    this.data = initialData;
  }

  public addBNWithoutLength(value: BN) {
    const strBits = Array.from(value.toString(2));
    const numBits = strBits.map(i => Number(i));
    this.data.push(...numBits);
  }

  public addBN(value: BN, length: number) {
    let bits = value.toString(2);
    if (length > bits.length) {
      bits = "0".repeat(length - bits.length) + bits;
    }
    const numBits = Array.from(bits).map(n => Number(n));
    this.data.push(...numBits);
  }

  public addNumber(value: number, length: number) {
    return this.addBN(new BN(value), length);
  }

  public addString(value: string, length: number, base: number = 10) {
    return this.addBN(new BN(value, base), length);
  }

  public getBits() {
    return this.data;
  }

}
