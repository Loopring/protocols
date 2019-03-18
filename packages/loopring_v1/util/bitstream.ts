import { BigNumber } from "bignumber.js";
import Web3 = require("web3");

export class Bitstream {
  private data: string;

  constructor() {
    this.data = "";
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
