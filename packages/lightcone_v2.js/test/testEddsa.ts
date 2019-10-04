// Hack: Failed to import src files directly.
import { exchange } from "../src/sign/exchange";
import * as eddsa from "../src/lib/sign/eddsa";
import * as fm from "../src/lib/wallet/common/formatter";
import { OrderInfo } from "../src/model/types";
import { BitArray } from "../src/lib/sign/bitarray";
import { bigInt } from "snarkjs";
import assert = require("assert");

describe("eddsa sign test", function() {
  this.timeout(1000);

  before(async () => {});

  it("sign order", function(done) {
    const order = new OrderInfo();
    order.accountId = 14;
    order.exchangeId = 1;
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

  it("sign and verify", function(done) {
    const keyPair = {
      publicKeyX:
        "15030727036724168751212480282500540869268142725392913493575803542173309367534",
      publicKeyY:
        "21709653362655094841217318150615954140561437115749994376567240539798473592233",
      secretKey: "1268930117"
    };

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
    order.tradingPrivKey = keyPair.secretKey;
    order.dualAuthPubKeyX =
      "8809204123973366120824088099131781443029836489874324209184159313707575442374";
    order.dualAuthPubKeyY =
      "13988417089423714365999155658785932995359651021112875121671679566610495100815";
    //sign
    let signedOrder = exchange.signOrder(order);

    const message = new BitArray();
    message.addNumber(order.exchangeId, 32);
    message.addNumber(order.orderId, 20);
    message.addNumber(order.accountId, 20);
    message.addString(order.dualAuthPubKeyX, 254);
    message.addString(order.dualAuthPubKeyY, 254);
    message.addNumber(order.tokenSId, 8);
    message.addNumber(order.tokenBId, 8);
    message.addBN(order.amountSInBN, 96);
    message.addBN(order.amountBInBN, 96);
    message.addNumber(order.allOrNone ? 1 : 0, 1);
    message.addNumber(order.validSince, 32);
    message.addNumber(order.validUntil, 32);
    message.addNumber(order.maxFeeBips, 6);
    message.addNumber(order.buy ? 1 : 0, 1);

    let signature = {
      R8: [bigInt(signedOrder.signature.Rx), bigInt(signedOrder.signature.Ry)],
      s: bigInt(signedOrder.signature.s)
    };

    console.log(signature.R8);
    console.log(signature.s);
    let A = [bigInt(keyPair.publicKeyX), bigInt(keyPair.publicKeyY)];
    //verify
    assert(eddsa.verify(message.getBits(), signature, A));
    done();
  });

  it("verify python gen sig", function(done) {
    const message = new BitArray();
    message.addNumber(1, 32);
    message.addNumber(30, 20);
    message.addNumber(6, 20);
    message.addString(
      "20427978695829389921027882814288154063458566858893427861603715087273059264885",
      254
    );
    message.addString(
      "20427978695829389921027882814288154063458566858893427861603715087273059264885",
      254
    );
    message.addNumber(0, 8);
    message.addNumber(2, 8);
    message.addBN(fm.toBN(fm.toBig(800 * 10 ** 18)), 96);
    message.addBN(fm.toBN(fm.toBig(800 * 10 ** 18)), 96);
    message.addNumber(1, 1);
    message.addNumber(1569476553, 32);
    message.addNumber(1579476553, 32);
    message.addNumber(20, 6);
    message.addNumber(1, 1);

    let clientSign = {
      R8: [
        bigInt(
          "17030527664407589396701168086694886223163130801378978144425389988506378468486"
        ),
        bigInt(
          "4125759102455440095806065625081309680934915590735580926889415692762392863169"
        )
      ],
      s: bigInt(
        "12013987941634518696990689491094080253727653924663277534601309960862716891927"
      )
    };

    let A = [
      bigInt(
        "19343708027612854918166866988841354925333666232229854846138521648858100244632"
      ),
      bigInt(
        "5425150093519370500493292654313769581651392454571357715388642612171707322463"
      )
    ];

    assert(eddsa.verify(message.getBits(), clientSign, A));
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
