var TradeDelegate = artifacts.require("./impl/TradeDelegate");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(TradeDelegate);
};
