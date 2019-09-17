// Hack: Failed to import src files directly.
import assert = require("assert");
import ethereum from "../src/lib/wallet/ethereum";
import config from "../src/lib/wallet/config";
import { Account } from "../src";

describe("config test", function() {
  this.timeout(10000);

  before(async () => {});

  it("unlock wallet", function(done) {
    let privateKeyAccount = ethereum.account.fromPrivateKey(
      "0x7c71142c72a019568cf848ac7b805d21f2e0fd8bc341e8314580de11c6a397bf"
    );
    assert.strictEqual(
      privateKeyAccount.getAddress(),
      "0xE20cF871f1646d8651ee9dC95AAB1d93160b3467"
    );

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

  it("account sign deposit", async function() {
    let privateKeyAccount = ethereum.account.fromPrivateKey(
      "0x7c71142c72a019568cf848ac7b805d21f2e0fd8bc341e8314580de11c6a397bf"
    );
    let wallet = new Account(privateKeyAccount);
    let signed = await wallet.depositTo("LRC", "10", 10, 10);
    const expected =
      "0xf8b10a8502540be400830f4240941d307532a97879b866a6fe33bf4a517bd28de854872386f26fc10000b8443ae50b730000000000000000000000009032dbf5669341c3d95bc02b4bde90e4e051db350000000000000000000000000000000000000000000000008ac7230489e8000025a0a89745dbfedb7160f7ed4702b0f88a6c4abfb4b7daa0e3b24a21177ea9816412a0025af9a36a9966a8a35fc3567125d6e5e58b3d8db24a0cd74c8659ac222c176f";
    assert.strictEqual(signed, expected);
  });
});
