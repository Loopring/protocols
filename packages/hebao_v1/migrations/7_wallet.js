const BaseWallet = artifacts.require("./base/BaseWallet.sol");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(BaseWallet);
};
