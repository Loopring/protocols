import BN from "bn.js";
const abi = require("ethereumjs-abi");
const assert = require("assert");

export class Bitstream {
  private data: string;

  constructor(initialData: string = "") {
    this.data = initialData;
    if (this.data.startsWith("0x")) {
      this.data = this.data.slice(2);
    }
  }

  public getData() {
    if (this.data.length === 0) {
      return "0x";
    } else {
      return "0x" + this.data;
    }
  }

  public getBytes32Array() {
    if (this.data.length === 0) {
      return [];
    } else {
      assert.equal(
        this.length() % 32,
        0,
        "Bitstream not compatible with bytes32[]"
      );
      return this.data.match(/.{1,64}/g).map((element) => "0x" + element);
    }
  }

  public addBN(x: BN, numBytes = 32) {
    const formattedData = this.padString(x.toString(16), numBytes * 2);
    return this.insert(formattedData);
  }

  public addNumber(x: number, numBytes = 4) {
    // Check if we need to encode this number as negative
    if (x < 0) {
      const encoded = abi.rawEncode(["int256"], [x.toString(10)]);
      const hex = encoded.toString("hex").slice(-(numBytes * 2));
      return this.addHex(hex);
    } else {
      return this.addBN(new BN(x), numBytes);
    }
  }

  public addAddress(x: string, numBytes = 20) {
    const formattedData = this.padString(x.slice(2), numBytes * 2);
    return this.insert(formattedData);
  }

  public addHex(x: string) {
    if (x.startsWith("0x")) {
      return this.insert(x.slice(2));
    } else {
      return this.insert(x);
    }
  }

  public extractUint8(offset: number) {
    return parseInt(this.extractData(offset, 1), 16);
  }

  public extractUint16(offset: number) {
    return parseInt(this.extractData(offset, 2), 16);
  }

  public extractUint24(offset: number) {
    return parseInt(this.extractData(offset, 3), 16);
  }

  public extractUint32(offset: number) {
    return parseInt(this.extractData(offset, 4), 16);
  }

  public extractUint40(offset: number) {
    return parseInt(this.extractData(offset, 5), 16);
  }

  public extractUint48(offset: number) {
    return parseInt(this.extractData(offset, 6), 16);
  }

  public extractUint56(offset: number) {
    return new BN(this.extractData(offset, 7), 16);
  }

  public extractUint64(offset: number) {
    return new BN(this.extractData(offset, 8), 16);
  }

  public extractUint(offset: number) {
    return new BN(this.extractData(offset, 32), 16);
  }

  public extractAddress(offset: number) {
    return "0x" + this.extractData(offset, 20);
  }

  public extractBytes1(offset: number) {
    return this.extractBytesX(offset, 1);
  }

  public extractBytes32(offset: number) {
    return this.extractBytesX(offset, 32);
  }

  public extractBytesX(offset: number, length: number) {
    return Buffer.from(this.extractData(offset, length), "hex");
  }

  public extractChar(offset: number) {
    return this.extractData(offset, 1);
  }

  public extractData(offset: number, length: number) {
    const start = offset * 2;
    const end = start + length * 2;
    if (this.data.length < end) {
      throw new Error(
        "substring index out of range:[" + start + ", " + end + "]"
      );
    }
    return this.data.slice(start, end);
  }

  // Returns the number of bytes of data
  public length() {
    return this.data.length / 2;
  }

  private insert(x: string) {
    const offset = this.length();
    this.data += x;
    return offset;
  }

  private padString(x: string, targetLength: number) {
    if (x.length > targetLength) {
      throw Error(
        "0x" +
          x +
          " is too big to fit in the requested length (" +
          targetLength +
          ")"
      );
    }
    while (x.length < targetLength) {
      x = "0" + x;
    }
    return x;
  }
}
