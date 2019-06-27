const BN = require("bn.js");
// const a = require("../lib/walletUtil/WalletUtils");

import {WalletUtils} from '../lib/wallet/WalletUtils';

describe("generate key_pair test", function () {
    this.timeout(100000);
    before( async () => {
    });

    it("send tx using metamask", async () => {
        let bn = new BN(20);
        console.log(bn.toString(16))
    });
});
