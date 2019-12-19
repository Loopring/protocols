// Hack: Failed to import src files directly.
import assert = require("assert");
import config from "../src/lib/wallet/config";
import * as fm from "../src/lib/wallet/common/formatter";
import BigNumber from "bignumber.js";

describe("config test", function() {
  this.timeout(1000);

  before(async () => {});

  it("config value", function(done) {
    assert.strictEqual(config.getMaxFeeBips(), 20);

    let tokens = config.getTokens();
    assert.strictEqual(tokens.length, 4);

    // ETH
    let eth = config.getTokenBySymbol("ETH");
    assert.strictEqual(eth.symbol, "ETH");
    assert.strictEqual(eth.name, "Ether");
    assert.strictEqual(eth.digits, 18);
    assert.strictEqual(
      eth.address,
      "0x0000000000000000000000000000000000000000"
    );
    assert.strictEqual(eth.unit, "ETH");
    assert.strictEqual(eth.website, "https://ethereum.org");
    assert.strictEqual(eth.allowance, "1000000000000000000000");
    assert.strictEqual(eth.allowanceWarn, "500000000000000000000");
    assert.strictEqual(eth.precision, 6);
    assert.strictEqual(eth.minTradeValue, 0.001);

    let markets = config.getMarkets();
    assert.strictEqual(markets.length, 2);
    let market = config.getMarketBySymbol("LRC", "ETH");
    assert.strictEqual(market.pricePrecision, 6);

    assert.strictEqual(config.getGasLimitByType("depositTo").gasInWEI, 1000000);
    assert.strictEqual(
      config.getFeeByType("deposit").feeInWEI,
      10000000000000000
    );
    done();
  });

  it("convert from wei & to wei", function(done) {
    let fromWEI = config.fromWEI("LRC", 1e19);
    assert.notStrictEqual(fromWEI, fm.toBig("10.0000"));
    fromWEI = config.fromWEI("LRC", 1e19);
    assert.notStrictEqual(fromWEI, fm.toBig("10.00"));
    let toWEI = config.toWEI("LRC", 10);
    assert.notStrictEqual(toWEI, fm.toBig("1e+19"));
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
