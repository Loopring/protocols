declare module 'bn.js';
declare module 'ethereumjs-abi';
declare module 'es6-promisify';

// Truffle injects the following into the global scope
declare var web3: any;
declare var artifacts: any;
declare var contract: any;
declare var before: any;
declare var beforeEach: any;
declare var describe: any;
declare var it: any;
declare var assert: any;

declare module 'ethereumjs-util' {
  function bufferToHex(value: Buffer): string;
  function ecrecover(msgHash: Buffer, v: number, r: Buffer, s: Buffer): Buffer;
  function fromRpcSig(sig: string): {v: number, r: Buffer, s: Buffer};
  function hashPersonalMessage(hash: Buffer): Buffer;
  function isHexString(value: any): boolean;
  function pubToAddress(pubKey: Buffer, sanitize?: boolean): Buffer;
  function setLength(a: Buffer, length: number): Buffer;
  function setLengthLeft(a: Buffer, length: number): Buffer;
  function sha3(a: Buffer|string|number, bits?: number): Buffer;
  function toBuffer(value: any): Buffer;
  function isValidAddress(address: string): boolean;

  export = {
    bufferToHex,
    ecrecover,
    fromRpcSig,
    hashPersonalMessage,
    isHexString,
    pubToAddress,
    setLength,
    setLengthLeft,
    sha3,
    toBuffer,
    isValidAddress,
  };
}
