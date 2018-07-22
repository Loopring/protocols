import { BigNumber } from "bignumber.js";

export class Bitstream {
  private data: string;

  constructor(private initialData: string = "") {
    this.data = initialData;
    if (this.data.startsWith("0x")) {
      this.data = this.data.slice(2);
    }
  }

  public getData() {
    if (this.data.length === 0) {
      return "0x0";
    } else {
      return "0x" + this.data;
    }
  }

  public addBigNumber(x: BigNumber, numBytes = 32) {
    this.data += this.padString(web3.toHex(x).slice(2), numBytes * 2);
  }

  public addNumber(x: number, numBytes = 4) {
    this.addBigNumber(new BigNumber(x), numBytes);
  }

  public addAddress(x: string, numBytes = 20) {
    this.data += this.padString(x.slice(2), numBytes * 2);
  }

  public addHex(x: string) {
    if (x.startsWith("0x")) {
      this.data += x.slice(2);
    } else {
      this.data += x;
    }
  }

  public addRawBytes(bs: string) {
    const bsHex = web3.toHex(bs);
    console.log("bsHex:", bsHex);
    this.data += bsHex.slice(2);
  }

  public extractUint8(index: number) {
    return parseInt(this.extractBytes1(index).toString("hex"), 16);
  }

  public extractBytes1(index: number) {
    return this.extractBytesX(index, 1);
  }

  public extractBytes32(index: number) {
    return this.extractBytesX(index, 32);
  }

  public extractBytesX(index: number, length: number) {
    const start = index * 2;
    const end = start + length * 2;
    return new Buffer(this.data.substring(start, end), "hex");
  }

  // Returns the number of bytes of data
  public length() {
    return this.data.length / 2;
  }

  private padString(x: string, targetLength: number) {
    if (x.length > targetLength) {
      throw Error("0x" + x + " is too big to fit in the requested length (" + targetLength + ")");
    }
    while (x.length < targetLength) {
      x = "0" + x;
    }
    return x;
  }

}
