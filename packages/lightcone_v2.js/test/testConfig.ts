// Hack: Failed to import src files directly.
import assert = require("assert");
import config from "../src/lib/wallet/config";

describe("config test", function() {
  this.timeout(1000);

  before(async () => {});

  it("signOrder", function(done) {
    assert.strictEqual(config.getChainId(), 1);
    assert.strictEqual(config.getMaxFeeBips(), 20);
    assert.strictEqual(
      config.getExchangeAddress(),
      "0x0a12284E50e0D8df909D84f41bcAdaf57722b947"
    );

    let tokens = config.getTokens();
    assert.strictEqual(tokens.length, 124);
    let lrc = config.getTokenBySymbol("LRC");
    assert.strictEqual(lrc.digits, 18);

    let markets = config.getMarkets();
    assert.strictEqual(markets.length, 43);
    let market = config.getMarketBySymbol("LRC", "ETH");
    assert.strictEqual(market.pricePrecision, 8);

    assert.strictEqual(config.getGasLimitByType("depositTo").gasInWEI, 1000000);
    assert.strictEqual(
      config.getFeeByType("deposit").feeInWEI,
      10000000000000000
    );
    done();
  });
});
