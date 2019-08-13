import { exchange } from "../src";
import { PrivateKeyAccount } from "../src/lib/wallet/ethereum/walletAccount";

describe("generate key_pair test", function() {
  this.timeout(10000);
  before(async () => {});

  it("send tx using metamask", async () => {
    let privateKeyAccount = new PrivateKeyAccount(
      "4c5496d2745fe9cc2e0aa3e1aad2b66cc792a716decf707ddb3f92bd2d93ad24"
    );
    exchange.updateAccount(privateKeyAccount, 100000).then(() => {
      console.log();
    });
  });
});
