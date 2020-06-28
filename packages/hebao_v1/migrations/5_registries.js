const ModuleRegistryImpl = artifacts.require("ModuleRegistryImpl");
const WalletRegistryImpl = artifacts.require("WalletRegistryImpl");

module.exports = function(deployer) {
  deployer.then(() => {
    return Promise.all([
      deployer.deploy(ModuleRegistryImpl),
      deployer.deploy(WalletRegistryImpl)
    ]);
  });
};
