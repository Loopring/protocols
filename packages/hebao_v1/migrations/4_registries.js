const ModuleRegistryImpl = artifacts.require("./base/ModuleRegistryImpl.sol");
const WalletRegistryImpl = artifacts.require("./base/WalletRegistryImpl.sol");

module.exports = function(deployer) {
  deployer.then(() => {
    return Promise.all([
      deployer.deploy(ModuleRegistryImpl),
      deployer.deploy(WalletRegistryImpl)
    ]);
  });
};
