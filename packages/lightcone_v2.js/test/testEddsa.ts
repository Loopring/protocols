// Hack: Failed to import src files directly.
import { exchange } from "../src";
import * as eddsa from "../src/lib/sign/eddsa";
import * as fm from "../src/lib/wallet/common/formatter";
import { OrderInfo } from "../src/model/types";
import assert = require("assert");

describe("eddsa sign test", function() {
  this.timeout(1000);

  before(async () => {});

  it("signOrder", function(done) {
    const order = new OrderInfo();
    order.accountId = 14;
    order.exchangeId = 2;
    order.orderId = 0;
    order.tokenSId = 1;
    order.tokenBId = 3;
    order.amountB = fm.toBN("200000000000000000000");
    order.amountS = fm.toBN("100000000000000000000");
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

    const sig_expected = {
      Rx:
        "1392831638855767888909228525141486718535676115241474867106958028260154150299",
      Ry:
        "4442260899531951092081675440942248551719241132649342104195219900458764826357",
      s:
        "545409791028477278330913711954571584440372221933064557654064435480272401532",
      hash:
        "16897219267575501329660852240897644379269300600349974465189740126871955587001"
    };
    exchange.signOrder(order);
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
