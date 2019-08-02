import BN = require("bn.js");

export class BitArray {
  private data: number[];

  constructor(initialData: number[] = []) {
    this.data = initialData;
  }

  public addBN(value: BN, length: number) {
    const res = new Array(length);
    for (let i = 0; i < length; i++) {
      res[i] = value.testn(i) ? 1 : 0;
    }
    this.data.push(...res);
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
