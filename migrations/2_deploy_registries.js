var TokenRegistryImpl           = artifacts.require("./TokenRegistryImpl");
var TokenTransferDelegateImpl   = artifacts.require("./TokenTransferDelegateImpl");
var TokenFactoryImpl            = artifacts.require("./TokenFactoryImpl");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(TokenTransferDelegateImpl);
  deployer.deploy(TokenRegistryImpl).then(() => {
    return deployer.deploy(TokenFactoryImpl, TokenRegistryImpl.address);
  });
};
