import { exchange } from "../src";
import { KeyAccount } from "../src/lib/wallet/ethereum/walletAccount";

describe("generate key_pair test", function() {
  this.timeout(100000);
  before(async () => {});

describe("generate key_pair test", function () {
    this.timeout(10000);
    before(async () => {
    });

    it("send tx using metamask", async () => {
        let keyAccount = new KeyAccount('ffd9b73fa766fe3a69d139c2cc39dfbb171d680222f07196a2c7b088e4139d75');
        exchange.updateAccount(keyAccount, 100000).then(() => {
            console.log()
        });
    });
  });
});
