
declare module '*.json' {
    const json: any;
    /* tslint:disable */
    export default json;
    /* tslint:enable */
}

// Truffle injects the following into the global scope
declare var web3: any; 
declare var artifacts: any;
declare var contract: any;
declare var before: any;
declare var beforeEach: any;
declare var describe: any;
declare var it: any;
declare var assert: any;

