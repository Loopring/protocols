import assert = require("assert");
import ethereum from "../src/lib/wallet/ethereum";
import { Account } from "../src";
import { EdDSA } from "../src/lib/sign/eddsa";
import * as fm from "../src/lib/wallet/common/formatter";
import sha256 from "crypto-js/sha256";

describe("test account sign functions", function() {
  let pkAccount;
  this.timeout(1000);

  beforeEach(function() {
    pkAccount = ethereum.account.fromPrivateKey(
      "0x7c71142c72a019568cf848ac7b805d21f2e0fd8bc341e8314580de11c6a397bf"
    );
  });

  it("test sign submit withdrawal", function(done) {
    const account = new Account(pkAccount);
    const keyPair = EdDSA.generateKeyPair("random");
    const expected = {
      hash:
        "13447340968633292849744809768697639152007958543625205621754093851658339440411",
      Rx:
        "20724689164439364899811951535053096387655875062512277395403067123966729472896",
      Ry:
        "12064603129649318293203270337211327834026089320449986483258377348938645159770",
      s:
        "2481428860873269907943413163278165926509078391770619997899480798705895725490"
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
        "6073592097050814873731737817749622170390583424274322424418290055228687898486",
      Ry:
        "1033780540847765362040973214334501277637541782039011171375340799874150301045",
      s:
        "1980286804376671796856727591601895183849328963462001496056666795916073250"
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
        "11450728918688016820553215815825916881781389940276091038770023763196392069150",
      Ry:
        "4423837911786020120772281474699328459829332054248426289504280074000802153211",
      s:
        "2665194773000010994846485928892358272762238072179344499076751740352865146978"
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
        "1110613801524677782175386695772852418122570733827815846034025006215153940880",
      Ry:
        "3982749547116550095754172139343814599526362479451462019563906435375945190167",
      s:
        "969328294518143689671285432530365059721276999430554085065814670197361995261"
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
        "4907531144030082714673166788853625691094645218263800925571852359778817407478",
      Ry:
        "982596782634396073565790328328781534320554306331087434157994413941137814392",
      s:
        "2683292836712626470273132449382532439414473128760965656693941100220771190110"
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
