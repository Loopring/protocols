// Hack: Failed to import src files directly.
import { generateKeyPair } from "../src/lib/sign/eddsa";
import { exchange } from "../src/sign/exchange";
import * as fm from "../src/lib/wallet/common/formatter";
import { OrderInfo } from "../src/model/types";
import assert = require("assert");

const babyJub = require("../src/lib/sign_1/babyjub");

function toByteArray(x) {
  var hexString = x.toString(16);
  if (hexString.length % 2 > 0) hexString = "0" + hexString;
  var byteArray = [];
  for (var i = 0; i < hexString.length; i += 2) {
    byteArray.push(parseInt(hexString.slice(i, i + 2), 16));
  }
  return byteArray;
}

describe("generate key_pair test", function() {
  this.timeout(100000);
  before(async () => {});

  it("Sign a single 10 bytes from 0 to 9", async () => {
    console.log(generateKeyPair(""));
  });
});

describe("eddsa sign message test", function() {
  this.timeout(100000);

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

    let signedOrder = exchange.signOrder(order);
    console.log(signedOrder);
  });
});
