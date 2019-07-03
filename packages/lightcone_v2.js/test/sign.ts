const BN = require("bn.js");

describe("generate key_pair test", function () {
    this.timeout(100000);
    before( async () => {
    });

    it("send tx using metamask", async () => {
        let bn = new BN(20);
        console.log(bn.toString(16))
    });
});
