// Hack: Failed to import src files directly.
import { exchange } from "../src";
import { EdDSA } from "../src/lib/sign/eddsa";
import {
  OrderInfo,
  DexAccount,
  KeyPair,
  WithdrawalRequest
} from "../src/model/types";
const assert = require("assert");

describe("eddsa sign test", function() {
  this.timeout(1000);

  before(async () => {});

  it("generate key pair", function(done) {
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

  it("sign withdrawal", function(done) {
    const withdrawal = new WithdrawalRequest();
    const account = new DexAccount();
    account.keyPair = new KeyPair();
    let keyPair = EdDSA.generateKeyPair("random");

    account.accountId = 14;
    account.nonce = 0;
    account.keyPair.publicKeyX = keyPair.publicKeyX;
    account.keyPair.publicKeyY = keyPair.publicKeyY;
    account.keyPair.secretKey = keyPair.secretKey;

    withdrawal.account = account;
    withdrawal.token = "ETH";
    withdrawal.amount = "10";

    const expected = {
      hash:
        "9082927133608456435392580906245595382897267089874121158509960306991979128069",
      Rx:
        "6986051336760886678025257987504758221214483685758443507283705146806089259925",
      Ry:
        "1036142663123672209259827850184147770942504250129743285250118147812752750238",
      s:
        "1003550105633923991392692516759607835743048124557466298159621476474267228123"
    };
    let signedWithdrawal = exchange.setupWithdrawal(withdrawal);
    assert.strictEqual(signedWithdrawal.hash, expected.hash);
    assert.strictEqual(signedWithdrawal.signature.Rx, expected.Rx);
    assert.strictEqual(signedWithdrawal.signature.Ry, expected.Ry);
    assert.strictEqual(signedWithdrawal.signature.s, expected.s);
    done();
  });

  it("verify withdrawal", function(done) {
    const withdrawal = new WithdrawalRequest();
    const account = new DexAccount();
    account.keyPair = new KeyPair();
    let keyPair = EdDSA.generateKeyPair("random");

    account.accountId = 14;
    account.nonce = 0;
    account.keyPair.publicKeyX = keyPair.publicKeyX;
    account.keyPair.publicKeyY = keyPair.publicKeyY;
    account.keyPair.secretKey = keyPair.secretKey;

    withdrawal.account = account;
    withdrawal.token = "ETH";
    withdrawal.amount = "10";

    let signed = exchange.setupWithdrawal(withdrawal);
    const success = EdDSA.verify(signed.hash, signed.signature, [
      account.keyPair.publicKeyX,
      account.keyPair.publicKeyY
    ]);
    assert.strictEqual(success, true);
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

    let signed = await exchange.setupOrder(order);

    const success = EdDSA.verify(signed.hash, signed.signature, [
      account.keyPair.publicKeyX,
      account.keyPair.publicKeyY
    ]);

    assert.strictEqual(success, true);
  });
});
