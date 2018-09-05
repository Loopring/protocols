var TradeDelegate = artifacts.require("./impl/TradeDelegate");
var TokenRegistry = artifacts.require("./impl/TokenRegistry");
var SymbolRegistry = artifacts.require("./impl/SymbolRegistry");
var BrokerRegistry = artifacts.require("./impl/BrokerRegistry");
var OrderRegistry = artifacts.require("./impl/OrderRegistry");
var MinerRegistry = artifacts.require("./impl/MinerRegistry");
var RingSubmitter = artifacts.require("./impl/RingSubmitter");
var RingCanceller = artifacts.require("./impl/RingCanceller");
var FeeHolder = artifacts.require("./impl/FeeHolder");
var OrderBook = artifacts.require("./impl/OrderBook");

module.exports = function(deployer, network, accounts) {

  if (network === "live") {
    // ignore.
  } else {
    deployer.then(() => {
      return Promise.all([
        SymbolRegistry.deployed(),
        TokenRegistry.deployed(),
        TradeDelegate.deployed(),
        BrokerRegistry.deployed(),
        OrderRegistry.deployed(),
        MinerRegistry.deployed(),
        FeeHolder.deployed(),
        OrderBook.deployed(),
      ]);
    }).then((contracts) => {
      var [symbolRegistry] = contracts;
      return Promise.all([
        BrokerRegistry.new(),
        BrokerRegistry.new(),
        symbolRegistry.getAddressBySymbol("LRC"),
        symbolRegistry.getAddressBySymbol("WETH"),
      ]);
    }).then(addresses => {
      var [orderBrokerRegistry, minerBrokerRegistry, lrcAddr, wethAddr] = addresses;
      return deployer.deploy(
        RingSubmitter,
        lrcAddr,
        wethAddr,
        TokenRegistry.address,
        TradeDelegate.address,
        orderBrokerRegistry.address,
        minerBrokerRegistry.address,
        OrderRegistry.address,
        MinerRegistry.address,
        FeeHolder.address,
        OrderBook.address,
      );
    }).then(() => {
      return deployer.deploy(RingCanceller, TradeDelegate.address);
    });

  }
};
