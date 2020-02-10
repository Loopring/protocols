const WalletRegistryImpl = artifacts.require("./base/WalletRegistryImpl.sol");
const ModuleRegistryImpl = artifacts.require("./base/ModuleRegistryImpl.sol");

module.exports = function(deployer, network, accounts) {
  deployer
    .then(() => {
      return Promise.all([
        deployer.deploy(WalletRegistryImpl),
        deployer.deploy(ModuleRegistryImpl)
      ]);
    })
    .then(() => {
      console.log(">>>>>>>> contracts deployed by registries:");
      console.log("WalletRegistryImpl:", WalletRegistryImpl.address);
      console.log("ModuleRegistryImpl:", ModuleRegistryImpl.address);
      console.log("");
    });
};
