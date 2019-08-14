import { exchange } from "../src";
import { PrivateKeyAccount } from "../src/lib/wallet/ethereum/walletAccount";

describe("sign transaction using private key", function() {
  this.timeout(10000);
  before(async () => {});

  it("send tx", async () => {
    await exchange.init("http://localhost:8545");
    let privateKeyAccount = new PrivateKeyAccount(
      "7C71142C72A019568CF848AC7B805D21F2E0FD8BC341E8314580DE11C6A397BF"
    );
    const updateAccountResponse = await exchange.updateAccount(
      privateKeyAccount,
      100
    );
  });
});
