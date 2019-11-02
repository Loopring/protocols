"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const bignumber_js_1 = require("bignumber.js");
const bn_js_1 = __importDefault(require("bn.js"));
const assert = require("assert");
const abi = require("ethereumjs-abi");
class Bitstream {
  constructor(initialData = "") {
    this.data = initialData;
    if (this.data.startsWith("0x")) {
      this.data = this.data.slice(2);
    }
  }
  getData() {
    if (this.data.length === 0) {
      return "0x";
    } else {
      return "0x" + this.data;
    }
  }
  getBytes32Array() {
    if (this.data.length === 0) {
      return [];
    } else {
      assert.equal(
        this.length() % 32,
        0,
        "Bitstream not compatible with bytes32[]"
      );
      return this.data.match(/.{1,64}/g).map(element => "0x" + element);
    }
  }
  addBigNumber(x, numBytes = 32) {
    const formattedData = this.padString(x.toString(16), numBytes * 2);
    return this.insert(formattedData);
  }
  addBN(x, numBytes = 32) {
    const formattedData = this.padString(x.toString(16), numBytes * 2);
    return this.insert(formattedData);
  }
  addNumber(x, numBytes = 4) {
    // Check if we need to encode this number as negative
    if (x < 0) {
      const encoded = abi.rawEncode(["int256"], [x.toString(10)]);
      const hex = encoded.toString("hex").slice(-(numBytes * 2));
      return this.addHex(hex);
    } else {
      return this.addBigNumber(new bignumber_js_1.BigNumber(x), numBytes);
    }
  }
  addAddress(x, numBytes = 20) {
    const formattedData = this.padString(x.slice(2), numBytes * 2);
    return this.insert(formattedData);
  }
  addHex(x) {
    if (x.startsWith("0x")) {
      return this.insert(x.slice(2));
    } else {
      return this.insert(x);
    }
  }
  extractUint8(offset) {
    return parseInt(this.extractData(offset, 1), 16);
  }
  extractUint16(offset) {
    return parseInt(this.extractData(offset, 2), 16);
  }
  extractUint24(offset) {
    return parseInt(this.extractData(offset, 3), 16);
  }
  extractUint32(offset) {
    return parseInt(this.extractData(offset, 4), 16);
  }
  extractUint40(offset) {
    return parseInt(this.extractData(offset, 5), 16);
  }
  extractUint48(offset) {
    return parseInt(this.extractData(offset, 6), 16);
  }
  extractUint56(offset) {
    return new bn_js_1.default(this.extractData(offset, 7), 16);
  }
  extractUint64(offset) {
    return new bn_js_1.default(this.extractData(offset, 8), 16);
  }
  extractUint(offset) {
    return new bn_js_1.default(this.extractData(offset, 32), 16);
  }
  extractAddress(offset) {
    return "0x" + this.extractData(offset, 20);
  }
  extractBytes1(offset) {
    return this.extractBytesX(offset, 1);
  }
  extractBytes32(offset) {
    return this.extractBytesX(offset, 32);
  }
  extractBytesX(offset, length) {
    return new Buffer(this.extractData(offset, length), "hex");
  }
  extractChar(offset) {
    return this.extractData(offset, 1);
  }
  extractData(offset, length) {
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
  length() {
    return this.data.length / 2;
  }
  static hashCode(s) {
    for (var i = 0, h = 0; i < s.length; i++)
      h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  insert(x) {
    const offset = this.length();
    this.data += x;
    return offset;
  }
  padString(x, targetLength) {
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
exports.Bitstream = Bitstream;
//# sourceMappingURL=bitstream.js.map
