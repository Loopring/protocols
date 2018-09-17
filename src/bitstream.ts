import { BigNumber } from "bignumber.js";
import abi = require("ethereumjs-abi");

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

  public getBytes32Array() {
    if (this.data.length === 0) {
      return [];
    } else {
      assert.equal(this.length() % 32, 0, "Bitstream not compatible with bytes32[]");
      return this.data.match(/.{1,64}/g).map((element) => "0x" + element);
    }
  }

  public addBigNumber(x: BigNumber, numBytes = 32) {
    this.data += this.padString(web3.toHex(x).slice(2), numBytes * 2);
  }

  public addNumber(x: number, numBytes = 4) {
    // Check if we need to encode this number as negative
    if (x < 0) {
        const encoded = abi.rawEncode(["int256"], [x.toString(10)]);
        const hex = encoded.toString("hex").slice(-(numBytes * 2));
        this.addHex(hex);
    } else {
      this.addBigNumber(new BigNumber(x), numBytes);
    }
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
    // console.log("bsHex:", bsHex);
    this.data += bsHex.slice(2);
  }

  public extractUint8(offset: number) {
    return parseInt(this.extractBytes1(offset).toString("hex"), 16);
  }

  public extractUint16(offset: number) {
    return parseInt(this.extractBytesX(offset, 2).toString("hex"), 16);
  }

  public extractUint(offset: number) {
    return new BigNumber(this.extractBytesX(offset, 32).toString("hex"), 16);
  }

  public extractAddress(offset: number) {
    return "0x" + this.extractBytesX(offset, 20).toString("hex");
  }

  public extractBytes1(offset: number) {
    return this.extractBytesX(offset, 1);
  }

  public extractBytes32(offset: number) {
    return this.extractBytesX(offset, 32);
  }

  public extractBytesX(offset: number, length: number) {
    const start = offset * 2;
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
