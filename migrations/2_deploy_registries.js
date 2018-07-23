var TradeDelegate = artifacts.require("./impl/TradeDelegate");
var TokenRegistry = artifacts.require("./impl/TokenRegistry");
var BrokerRegistry = artifacts.require("./impl/BrokerRegistry");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(TradeDelegate, 20);
  deployer.deploy(TokenRegistry);
  deployer.deploy(BrokerRegistry);
};
