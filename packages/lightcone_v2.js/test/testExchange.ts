// Hack: Failed to import src files directly.
import { exchange } from "../src";
import ethereum from "../src/lib/wallet/ethereum";
import * as fm from "../src/lib/wallet/common/formatter";
import { fromPrivateKey } from "../src/lib/wallet/ethereum/walletAccount";
import assert = require("assert");

// MUST DONE FIRST: docker run -p 8545:8545 kongliangzhong/loopringv3-contracts-beta2-prepared:0.9
describe("eddsa sign test", function() {
  this.timeout(1000);

  before(async () => {
    exchange.init("http://localhost:8545");
  });

  let pk = "0x923a8a6b3e00af1ea8668c6842b7ecc028c5d40646189557bd5d2a948a44aaad";

  it("create account", async function() {
    let account = fromPrivateKey(pk);
    let rawTx = await exchange.createOrUpdateAccount(account, "Abc!12345", 10);
    const expected = {
      address: "0xf5090a0c79ec3cF9edEA0E8FA335a0b0c73cA257",
      publicKeyX:
        "9223856795057146310699220315969357381019144849462477190724191810772919863812",
      publicKeyY:
        "9938971823544967276063251639870625926547610178778748892093521779598861254692",
      secretKey: "804979129"
    };
    assert.strictEqual(account.getAddress(), expected.address);
    assert.strictEqual(rawTx.keyPair.publicKeyX, expected.publicKeyX);
    assert.strictEqual(rawTx.keyPair.publicKeyY, expected.publicKeyY);
    assert.strictEqual(rawTx.keyPair.secretKey, expected.secretKey);

    let response = await ethereum.utils.getAccountBalance(account.getAddress());
    let balance = fm.toNumber(response["result"]).toString(10);
    assert.strictEqual(balance, "1e+26");
  });
});
