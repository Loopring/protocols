// Hack: Failed to import src files directly.
import { exchange } from "../src";
import { EdDSA } from "../src/lib/sign/eddsa";
import { OrderInfo, DexAccount, KeyPair } from "../src/model/types";
const assert = require("assert");

describe("eddsa sign test", function() {
  this.timeout(1000);

  before(async () => {});

  it("generate key pair1", function(done) {
    const seed = "0xE20cF871f1646d8651ee9dC95AAB1d93160b3467" + "Abc!12345";
    let keyPair = EdDSA.generateKeyPair(seed);
    const expected = {
      publicKeyX:
        "15030727036724168751212480282500540869268142725392913493575803542173309367534",
      publicKeyY:
        "21709653362655094841217318150615954140561437115749994376567240539798473592233",
      secretKey: "1268930117"
    };
    assert.strictEqual(keyPair.publicKeyX, expected.publicKeyX);
    assert.strictEqual(keyPair.publicKeyY, expected.publicKeyY);
    assert.strictEqual(keyPair.secretKey, expected.secretKey);
    console.log("test generateKeyPair completed!");
    done();
  });

  it("sign order", async function() {
    const order = new OrderInfo();
    const account = new DexAccount();
    account.keyPair = new KeyPair();
    let keyPair = EdDSA.generateKeyPair("random");

    account.accountId = 14;
    account.keyPair.publicKeyX = keyPair.publicKeyX;
    account.keyPair.publicKeyY = keyPair.publicKeyY;
    account.keyPair.secretKey = keyPair.secretKey;

    order.account = account;
    order.orderId = 0;
    order.tokenS = "LRC";
    order.tokenB = "ETH";
    order.amountS = "10";
    order.amountB = "20";
    order.validSince = 1562889050;
    order.validUntil = 1562924050;

    const expected = {
      Rx:
        "1299843158293361816494180765502064378074664050652116731384737131300022134241",
      Ry:
        "2382943420401911198685981472933284811812862538646034571677480032550233611275",
      s:
        "1219066764927904832534260300367799151848936695869848084837086539401142048380"
    };
    let signedOrder = await exchange.setupOrder(order);
    assert.strictEqual(signedOrder.signature.Rx, expected.Rx);
    assert.strictEqual(signedOrder.signature.Ry, expected.Ry);
    assert.strictEqual(signedOrder.signature.s, expected.s);
  });

  it("verify signature", async function() {
    const order = new OrderInfo();
    const account = new DexAccount();
    account.keyPair = new KeyPair();
    let keyPair = EdDSA.generateKeyPair("random");

    account.accountId = 14;
    account.keyPair.publicKeyX = keyPair.publicKeyX;
    account.keyPair.publicKeyY = keyPair.publicKeyY;
    account.keyPair.secretKey = keyPair.secretKey;

    order.account = account;
    order.orderId = 0;
    order.tokenS = "LRC";
    order.tokenB = "ETH";
    order.amountS = "10";
    order.amountB = "20";
    order.validSince = 1562889050;
    order.validUntil = 1562924050;

    let signedOrder = await exchange.setupOrder(order);

    const success = EdDSA.verify(signedOrder.hash, signedOrder.signature, [
      account.keyPair.publicKeyX,
      account.keyPair.publicKeyY
    ]);

    assert.strictEqual(success, true);
  });
});
