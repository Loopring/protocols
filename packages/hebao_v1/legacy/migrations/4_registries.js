const WalletRegistryImpl = artifacts.require("./base/WalletRegistryImpl.sol");
const ModuleRegistryImpl = artifacts.require("./base/ModuleRegistryImpl.sol");

module.exports = function(deployer) {
  deployer.then(() => {
    return Promise.all([
      deployer.deploy(WalletRegistryImpl),
      deployer.deploy(ModuleRegistryImpl)
    ]);
  });
};
