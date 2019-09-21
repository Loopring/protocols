import BN = require("bn.js");

export function xor(s1: string, s2: string, numBytes: number) {
  const x1 = new BN(s1.slice(2), 16);
  const x2 = new BN(s2.slice(2), 16);
  const result = x1.xor(x2);
  return "0x" + result.toString(16, numBytes * 2);
}
