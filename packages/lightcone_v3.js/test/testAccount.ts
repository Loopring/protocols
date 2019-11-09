import assert = require("assert");
import ethereum from "../src/lib/wallet/ethereum";
import { Account } from "../src";
import { EdDSA } from "../src/lib/sign/eddsa";
import * as fm from "../src/lib/wallet/common/formatter";
import sha256 from "crypto-js/sha256";

describe("test account sign functions", function() {
  let pkAccount;
  let dexAccount;
  this.timeout(1000);

  beforeEach(function() {
    pkAccount = ethereum.account.fromPrivateKey(
      "0x7c71142c72a019568cf848ac7b805d21f2e0fd8bc341e8314580de11c6a397bf"
    );
    dexAccount = new Account(pkAccount);
  });

  it("create account", async function() {
    let rawTx = await dexAccount.createOrUpdateAccount("Abc!12345", 10, 10, "");
    const expected = {
      address: "0xE20cF871f1646d8651ee9dC95AAB1d93160b3467",
      publicKeyX:
        "6064106192659121165935187694018292342998565229978772232503494441331112788406",
      publicKeyY:
        "12446527916329966063164872854902057607244569109114077477859286062280172996970",
      secretKey: "339848432477505972274422023312873482243275195068738529496439822141587050935"
    };
    assert.strictEqual(pkAccount.getAddress(), expected.address);
    assert.strictEqual(rawTx.keyPair.publicKeyX, expected.publicKeyX);
    assert.strictEqual(rawTx.keyPair.publicKeyY, expected.publicKeyY);
    assert.strictEqual(rawTx.keyPair.secretKey, expected.secretKey);
  });

  it("generate key pair", function(done) {
    const password = "Abc!12345";
    let keyPair = dexAccount.generateKeyPair(password);
    const expected = {
      publicKeyX:
        "6064106192659121165935187694018292342998565229978772232503494441331112788406",
      publicKeyY:
        "12446527916329966063164872854902057607244569109114077477859286062280172996970",
      secretKey: "339848432477505972274422023312873482243275195068738529496439822141587050935"
    };
    assert.strictEqual(keyPair.publicKeyX, expected.publicKeyX);
    assert.strictEqual(keyPair.publicKeyY, expected.publicKeyY);
    assert.strictEqual(keyPair.secretKey, expected.secretKey);
    console.log("test generateKeyPair completed!");
    done();
  });

  it("verify password", function(done) {
    const seedA = "Abc!12345";
    const seedB = "Abc12345";
    let keyPair = dexAccount.generateKeyPair(seedA);
    let success = dexAccount.verifyPassword(
      keyPair.publicKeyX,
      keyPair.publicKeyY,
      seedA
    );
    let fail = dexAccount.verifyPassword(
      keyPair.publicKeyX,
      keyPair.publicKeyY,
      seedB
    );
    assert.strictEqual(success, true);
    assert.strictEqual(fail, false);
    console.log("test verify password completed!");
    done();
  });

  it("test sign submit withdrawal", function(done) {
    const account = new Account(pkAccount);
    const keyPair = EdDSA.generateKeyPair("random");
    const expected = {
      hash:
        "13447340968633292849744809768697639152007958543625205621754093851658339440411",
      Rx:
        "13973627370474120608359042399548717141617200250678168023803493325667071884926",
      Ry:
        "4787645386217065339537399485757857591467424869557774806413369411699915034692",
      s:
        "1167397211038478573659828627810583386207730580949277250760181135725651156982"
    };
    let signedWithdrawal = account.offchainWithdrawal(
      4,
      keyPair.publicKeyX,
      keyPair.publicKeyY,
      keyPair.secretKey,
      0,
      "LRC",
      "10",
      "LRC",
      "10"
    );
    assert.strictEqual(signedWithdrawal.hash, expected.hash);
    assert.strictEqual(signedWithdrawal.signature.Rx, expected.Rx);
    assert.strictEqual(signedWithdrawal.signature.Ry, expected.Ry);
    assert.strictEqual(signedWithdrawal.signature.s, expected.s);
    done();
  });

  it("test sign submit order", function(done) {
    const account = new Account(pkAccount);
    const keyPair = EdDSA.generateKeyPair("random");
    const expected = {
      Rx:
        "11180726486619836267527084083344896299415684537669796972812180058267661913957",
      Ry:
        "20521629163541286788802348578162769063239860363819216418918234908019436187366",
      s:
        "794350674770480616293063780547220428181919048539692511772783102530447754330"
    };
    let signedOrder = account.submitOrder(
      pkAccount.getAddress(),
      4,
      keyPair.publicKeyX,
      keyPair.publicKeyY,
      keyPair.secretKey,
      "LRC",
      "ETH",
      "10",
      "20",
      0,
      1562889050,
      1562924050
    );
    assert.strictEqual(signedOrder.signature.Rx, expected.Rx);
    assert.strictEqual(signedOrder.signature.Ry, expected.Ry);
    assert.strictEqual(signedOrder.signature.s, expected.s);
    done();
  });

  it("test sign cancel order", function(done) {
    const account = new Account(pkAccount);
    const keyPair = EdDSA.generateKeyPair("random");
    const expected = {
      Rx:
        "8457305489519159084452923762706653439094473314451872753723889804047261232217",
      Ry:
        "14584375644307892742610280417892286560630889911035799857243211513477239973411",
      s:
        "590543850364618069573819060355365824012350113563489860004732375614612443620"
    };
    let signedOrder = account.submitCancel(
      4,
      keyPair.publicKeyX,
      keyPair.publicKeyY,
      keyPair.secretKey,
      1,
      "LRC",
      0,
      "ETH",
      "0.01"
    );
    assert.strictEqual(signedOrder.signature.Rx, expected.Rx);
    assert.strictEqual(signedOrder.signature.Ry, expected.Ry);
    assert.strictEqual(signedOrder.signature.s, expected.s);
    done();
  });

  it("test sign flex cancel", function(done) {
    const account = new Account(pkAccount);
    const keyPair = EdDSA.generateKeyPair("random");
    const expected = {
      Rx:
        "4915222946457092952828414067797355812299876134222135095958434895517613518328",
      Ry:
        "10492157586807806385345921915216905679625113675467196191557785799444551686015",
      s:
        "1437339847387839007907439399109965452052951157347992074791423693673613601687"
    };

    let signed = null;
    assert.doesNotThrow(() => {
      signed = account.submitFlexCancel(
        4,
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        keyPair.secretKey,
        "17475261927243449585218510236711727843257822127256856388080295820288941991181",
        "17475261927243449585218510236711727843257822127256856388080295820288941991181"
      );
    });
    assert.strictEqual(signed.signature.Rx, expected.Rx);
    assert.strictEqual(signed.signature.Ry, expected.Ry);
    assert.strictEqual(signed.signature.s, expected.s);
    done();
  });

  it("test sign get API key", function(done) {
    const account = new Account(pkAccount);
    const keyPair = EdDSA.generateKeyPair("random");
    const expected = {
      Rx:
        "9078796496011826775259822130989641428368302865824165670228138554988827169692",
      Ry:
        "15396611866565891573383731510473372455387494801581871544408203159414209857725",
      s:
        "449067828659903159881478856524139099233855651992179006223396558727533743914"
    };

    let signed = null;
    assert.doesNotThrow(() => {
      signed = account.getApiKey(
        4,
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        keyPair.secretKey
      );
    });
    assert.strictEqual(signed.signature.Rx, expected.Rx);
    assert.strictEqual(signed.signature.Ry, expected.Ry);
    assert.strictEqual(signed.signature.s, expected.s);
    done();
  });

  it("test sign a random string", function(done) {
    const hash = fm.addHexPrefix(sha256("some string").toString());

    // Create signature
    const signature = EdDSA.sign("938285885", hash);
    console.log(signature.Rx);
    console.log(signature.Ry);
    console.log(signature.s);
    done();
  });
});
