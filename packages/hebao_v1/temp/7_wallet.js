const WalletImplV2 = artifacts.require("./version2/WalletImplV2.sol");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(WalletImplV2);
};
