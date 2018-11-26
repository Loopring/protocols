var TradeDelegate = artifacts.require("./impl/TradeDelegate");
var TradeHistory = artifacts.require("./impl/TradeHistory");
var BrokerRegistry = artifacts.require("./impl/BrokerRegistry");
var OrderRegistry = artifacts.require("./impl/OrderRegistry");
var FeeHolder = artifacts.require("./impl/FeeHolder");
var OrderBook = artifacts.require("./impl/OrderBook");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(BrokerRegistry);
  deployer.deploy(OrderRegistry);
  deployer.deploy(OrderBook);

  deployer.deploy(TradeDelegate).then(() => {
    return deployer.deploy(FeeHolder, TradeDelegate.address);
  });
  deployer.deploy(TradeHistory);

};
