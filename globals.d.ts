declare module 'bn.js';
declare module 'ethereumjs-abi';
declare module 'ethereumjs-util';
declare module 'es6-promisify';
declare module 'ethereum-tx-decoder';

// Truffle injects the following into the global scope
declare var web3: any;
declare var artifacts: any;
declare var contract: any;
declare var before: any;
declare var beforeEach: any;
declare var describe: any;
declare var it: any;
declare var assert: any;

declare module "*.json" {
  const value: any;
  export default value;
}
