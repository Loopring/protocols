// Hack: Failed to import src files directly.
import config from "../src/lib/wallet/config";
import assert = require("assert");

describe("config test", function() {
  this.timeout(1000);

  before(async () => {});

  it("signOrder", function(done) {
    assert.strictEqual(config.getChainId(), 1);
    assert.strictEqual(
      config.getGasLimitByType("depositTo").gasLimit,
      "0x7a1200"
    );
    assert.strictEqual(
      config.getFeeByType("deposit").feeInWEI,
      "100000000000000"
    );
    done();
  });
});
