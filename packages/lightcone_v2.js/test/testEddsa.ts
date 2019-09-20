// Hack: Failed to import src files directly.
import { exchange } from "../src";
import * as eddsa from "../src/lib/sign/eddsa";
import * as fm from "../src/lib/wallet/common/formatter";
import { OrderInfo } from "../src/model/types";
import assert = require("assert");

describe("eddsa sign test", function() {
  this.timeout(1000);

  before(async () => {});

  it("sign order", function(done) {
    const order = new OrderInfo();
    order.accountId = 14;
    order.exchangeId = 2;
    order.orderId = 0;
    order.tokenSId = 1;
    order.tokenBId = 3;

    let bigNumber = fm.toBig("100000000000000000000");
    order.amountSInBN = fm.toBN(bigNumber);
    bigNumber = fm.toBig("200000000000000000000");
    order.amountBInBN = fm.toBN(bigNumber);
    order.amountS = order.amountSInBN.toString(10);
    order.amountB = order.amountBInBN.toString(10);

    order.allOrNone = false;
    order.buy = true;
    order.validSince = 1562889050;
    order.validUntil = 1562924050;
    order.maxFeeBips = 20;
    order.tradingPrivKey = "1";
    order.dualAuthPubKeyX =
      "8809204123973366120824088099131781443029836489874324209184159313707575442374";
    order.dualAuthPubKeyY =
      "13988417089423714365999155658785932995359651021112875121671679566610495100815";

    const expected = {
      Rx:
        "7122635334927162986015367923980037101766714244725328513127295952534668914405",
      Ry:
        "2280257599939635471664376964047379401861626275301003552145483264241287733368",
      s:
        "16970772901820232512732011461786056089500078926541109484130046165312890585770"
    };
    let signedOrder = exchange.signOrder(order);
    assert.strictEqual(signedOrder.signature.Rx, expected.Rx);
    assert.strictEqual(signedOrder.signature.Ry, expected.Ry);
    assert.strictEqual(signedOrder.signature.s, expected.s);
    done();
  });

  it("generate key pair", function(done) {
    const seed = "0xE20cF871f1646d8651ee9dC95AAB1d93160b3467" + "Abc!12345";
    let keyPair = eddsa.generateKeyPair(seed);
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
});
