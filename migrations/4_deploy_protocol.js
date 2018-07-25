var TradeDelegate = artifacts.require("./impl/TradeDelegate");
var TokenRegistry = artifacts.require("./impl/TokenRegistry");
var BrokerRegistry = artifacts.require("./impl/BrokerRegistry");
var Exchange = artifacts.require("./impl/Exchange");

module.exports = function(deployer, network, accounts) {

  if (network === "live") {
    // ignore.
  } else {
    deployer.then(() => {
      return Promise.all([
        TokenRegistry.deployed(),
        TradeDelegate.deployed(),
        BrokerRegistry.deployed(),
      ]);
    }).then((contracts) => {
      var [tokenRegistry] = contracts;
      return Promise.all([
        BrokerRegistry.new(),
        BrokerRegistry.new(),
        tokenRegistry.getAddressBySymbol("LRC"),
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
      );
    });

  }
};
