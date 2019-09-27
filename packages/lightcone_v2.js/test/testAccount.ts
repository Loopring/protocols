// Hack: Failed to import src files directly.
import assert = require("assert");
import ethereum from "../src/lib/wallet/ethereum";
import config from "../src/lib/wallet/config";
import { Account } from "../src";

describe("account test", function() {
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

  it("account sign create account", async function() {
    let wallet = new Account(privateKeyAccount);
    let signed = await wallet.createOrUpdateAccount("Abc!12345", 10, 10);
    const expected = {
      signedTx:
        "0xf8f10a8502540be400830f4240941d307532a97879b866a6fe33bf4a517bd28de8548727147114878000b884b4bf7618213b170bbd3cdecfb7885ebfb9cc4272f9ac40da01fea8698d78daddcee274ee2fff3a75d20db0719655fe1fe2f65dce28e5aae723d429c67dab896d7dd8cda90000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000026a0f8d13027c691b7d477d3daf3fdec9568333912b1a37de4de13d0913e2041b8f1a0346888c55245298785b098ad99315ddc563c1c955e6a8b6ef13f9c8387ebc324",
      keyPair: {
        publicKeyX:
          "15030727036724168751212480282500540869268142725392913493575803542173309367534",
        publicKeyY:
          "21709653362655094841217318150615954140561437115749994376567240539798473592233",
        secretKey: "1268930117"
      }
    };
    assert.strictEqual(signed.signedTx, expected.signedTx);
    assert.strictEqual(signed.keyPair.publicKeyX, expected.keyPair.publicKeyX);
    assert.strictEqual(signed.keyPair.publicKeyY, expected.keyPair.publicKeyY);
    assert.strictEqual(signed.keyPair.secretKey, expected.keyPair.secretKey);
  });

  it("account sign deposit", async function() {
    let wallet = new Account(privateKeyAccount);
    let signedTx = await wallet.depositTo("LRC", "10", 10, 10);
    const expected =
      "0xf8b10a8502540be400830f4240941d307532a97879b866a6fe33bf4a517bd28de854872386f26fc10000b8443ae50b730000000000000000000000009032dbf5669341c3d95bc02b4bde90e4e051db350000000000000000000000000000000000000000000000008ac7230489e8000025a0a89745dbfedb7160f7ed4702b0f88a6c4abfb4b7daa0e3b24a21177ea9816412a0025af9a36a9966a8a35fc3567125d6e5e58b3d8db24a0cd74c8659ac222c176f";
    assert.strictEqual(signedTx, expected);
  });

  it("account sign approve", async function() {
    let wallet = new Account(privateKeyAccount);
    let signedTx = await wallet.approve("LRC", 10, 10);
    const expected =
      "0xf8aa0a8502540be400830186a0949032dbf5669341c3d95bc02b4bde90e4e051db3580b844095ea7b30000000000000000000000001d307532a97879b866a6fe33bf4a517bd28de854ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff25a071af95d2a3eb01bb11f84d9c66d09924d97a2b3ce38e0079a2d56dfb13035df0a07404b3a48c40cc3e7b9893d88512ef526a67bf3c274548ec09f94386e0062fc2";
    assert.strictEqual(signedTx, expected);
  });

  it("account sign withdraw", async function() {
    let wallet = new Account(privateKeyAccount);
    let signedTx = await wallet.withdrawFrom("LRC", "10", 10, 10);
    const expected =
      "0xf8b10a8502540be400830f4240941d307532a97879b866a6fe33bf4a517bd28de854872386f26fc10000b8448c8c3c9d0000000000000000000000009032dbf5669341c3d95bc02b4bde90e4e051db350000000000000000000000000000000000000000000000008ac7230489e8000025a0bab16f326c770ad08c4e21c4c67a727c1babf2fe3de4870e30bdc77371048b1da03a47e25c78d5137dc3f57e1764a66e11032e1ae361d220b38b6c338a4525af61";
    assert.strictEqual(signedTx, expected);
  });
});
