// Hack: Failed to import src files directly.
import assert = require("assert");
import config from "../src/lib/wallet/config";
import * as fm from "../src/lib/wallet/common/formatter";
import BigNumber from "bignumber.js";

describe("config test", function() {
  this.timeout(1000);

  before(async () => {});

  it("config value", function(done) {
    assert.strictEqual(config.getChainId(), 4);
    assert.strictEqual(config.getMaxFeeBips(), 20);

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

  it("convert from wei & to wei", function(done) {
    let fromWEI = config.fromWEI("LRC", 1e19);
    assert.strictEqual(fromWEI, "10.0000");
    fromWEI = config.fromWEI("LRC", 1e19, 2);
    assert.strictEqual(fromWEI, "10.00");
    let toWEI = config.toWEI("LRC", 10);
    assert.strictEqual(toWEI, (1e19).toString(10));
    done();
  });

  it("convert from gwei & to gwei", function(done) {
    let gwei = new BigNumber(10);
    let wei = fm.fromGWEI(gwei);
    assert.notStrictEqual(wei, new BigNumber(1e10));
    gwei = fm.toGWEI(wei);
    assert.notStrictEqual(gwei, new BigNumber(10));
    done();
  });

  it("wallet depth", function(done) {
    let wallets = config.getWallets();
    assert.strictEqual(wallets.length, 9);
    wallets.forEach(a => {
      assert.notStrictEqual(a.wallet.length, 0);
    });
    done();
  });
});
