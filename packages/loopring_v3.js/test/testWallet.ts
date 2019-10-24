import assert = require("assert");
import ethereum from "../src/lib/wallet/ethereum";
import config from "../src/lib/wallet/config";
import { Account, exchange } from "../src";
import { DexAccount, KeyPair, OrderRequest } from "../src/model/types";
import { EdDSA } from "../src/lib/sign/eddsa";

describe("test unlock wallet", function() {
  let pkAccount;
  this.timeout(1000);

  beforeEach(function() {});

  it("test unlock wallet with private key", function(done) {
    pkAccount = ethereum.account.fromPrivateKey(
      "0x7c71142c72a019568cf848ac7b805d21f2e0fd8bc341e8314580de11c6a397bf"
    );
    assert.strictEqual(
      pkAccount.getAddress(),
      "0xE20cF871f1646d8651ee9dC95AAB1d93160b3467"
    );
    done();
  });

  it("test unlock wallet with mnemonic", function(done) {
    let wallets = config.getWallets();
    let mnemonic =
      "topple enroll absent vacant odor poverty obscure mango glove sadness pond gospel";
    let validate = ethereum.mnemonic.isValidateMnemonic(mnemonic);
    assert.strictEqual(validate, true);
    let mnemonicAccount = ethereum.account.fromMnemonic(
      mnemonic,
      wallets[0].path,
      "Shanghai500"
    );
    assert.strictEqual(
      mnemonicAccount.getAddress(),
      "0xBE4a1feCd69f3F507C1df7FbA7221623d034bF83"
    );
    done();
  });
});
