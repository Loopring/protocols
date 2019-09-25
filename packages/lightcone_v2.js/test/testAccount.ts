// Hack: Failed to import src files directly.
import assert = require("assert");
import ethereum from "../src/lib/wallet/ethereum";
import config from "../src/lib/wallet/config";
import { Account } from "../src";

describe("config test", function() {
  this.timeout(10000);

  let privateKeyAccount;

  beforeEach(() => {
    privateKeyAccount = ethereum.account.fromPrivateKey(
      "0x7c71142c72a019568cf848ac7b805d21f2e0fd8bc341e8314580de11c6a397bf"
    );
  });

  it("unlock wallet", function(done) {
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
    let wallet = new Account(privateKeyAccount);
    let signed = await wallet.depositTo("LRC", "10", 10, 10);
    const expected =
      "0xf8b10a8502540be400830f4240941d307532a97879b866a6fe33bf4a517bd28de854872386f26fc10000b8443ae50b730000000000000000000000009032dbf5669341c3d95bc02b4bde90e4e051db350000000000000000000000000000000000000000000000008ac7230489e8000025a0a89745dbfedb7160f7ed4702b0f88a6c4abfb4b7daa0e3b24a21177ea9816412a0025af9a36a9966a8a35fc3567125d6e5e58b3d8db24a0cd74c8659ac222c176f";
    assert.strictEqual(signed, expected);
  });

  it("account sign approve", async function() {
    let wallet = new Account(privateKeyAccount);
    let signed = wallet.approve("LRC", 10, 10);
    const expected =
      "0xf8aa0a8502540be400830186a0949032dbf5669341c3d95bc02b4bde90e4e051db3580b844095ea7b30000000000000000000000001d307532a97879b866a6fe33bf4a517bd28de854ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff25a071af95d2a3eb01bb11f84d9c66d09924d97a2b3ce38e0079a2d56dfb13035df0a07404b3a48c40cc3e7b9893d88512ef526a67bf3c274548ec09f94386e0062fc2";
    assert.strictEqual(signed, expected);
  });
});
