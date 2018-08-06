var TradeDelegate = artifacts.require("./impl/TradeDelegate");
var TokenRegistry = artifacts.require("./impl/TokenRegistry");
var SymbolRegistry = artifacts.require("./impl/SymbolRegistry");
var BrokerRegistry = artifacts.require("./impl/BrokerRegistry");
var OrderRegistry = artifacts.require("./impl/OrderRegistry");
var MinerRegistry = artifacts.require("./impl/MinerRegistry");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(TradeDelegate, 20);
  deployer.deploy(TokenRegistry);
  deployer.deploy(SymbolRegistry);
  deployer.deploy(BrokerRegistry);
  deployer.deploy(OrderRegistry);
  deployer.deploy(MinerRegistry);
};
