var TokenRegistry = artifacts.require("./TokenRegistry.sol");
var LoopringExchange = artifacts.require("./LoopringExchange.sol");

module.exports = function(deployer) {
  deployer.deploy(TokenRegistry);
  deployer.deploy(LoopringExchange);
};
