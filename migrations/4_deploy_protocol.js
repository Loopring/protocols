var TradeDelegate = artifacts.require("./impl/TradeDelegate");
var TokenRegistry = artifacts.require("./impl/TokenRegistry");
var SymbolRegistry = artifacts.require("./impl/SymbolRegistry");
var BrokerRegistry = artifacts.require("./impl/BrokerRegistry");
var OrderRegistry = artifacts.require("./impl/OrderRegistry");
var MinerRegistry = artifacts.require("./impl/MinerRegistry");
var Exchange = artifacts.require("./impl/Exchange");
var FeeHolder = artifacts.require("./impl/FeeHolder");

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
      ]);
    }).then((contracts) => {
      var [symbolRegistry] = contracts;
      return Promise.all([
        BrokerRegistry.new(),
        BrokerRegistry.new(),
        symbolRegistry.getAddressBySymbol("LRC"),
      ]);
    }).then(addresses => {
      var [orderBrokerRegistry, minerBrokerRegistry, lrcAddr] = addresses;
      return deployer.deploy(
        Exchange,
        lrcAddr,
        TokenRegistry.address,
        TradeDelegate.address,
        orderBrokerRegistry.address,
        minerBrokerRegistry.address,
        OrderRegistry.address,
        MinerRegistry.address,
        FeeHolder.address,
      );
    });

  }
};
