const WalletImpl = artifacts.require("./version1.1/WalletImpl.sol");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(WalletImpl);
};
