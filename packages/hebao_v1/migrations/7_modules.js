const WalletFactoryModule = artifacts.require(
  "./modules/core/WalletFactoryModule.sol"
);
const ControllerImpl = artifacts.require("./base/ControllerImpl.sol");
const BaseWallet = artifacts.require("./base/BaseWallet.sol");

const WalletRegistryImpl = artifacts.require("./base/WalletRegistryImpl.sol");
const ModuleRegistryImpl = artifacts.require("./base/ModuleRegistryImpl.sol");

module.exports = function(deployer, network, accounts) {
  deployer
    .then(() => {
      return Promise.all([
        deployer.deploy(
          WalletFactoryModule,
          ControllerImpl.address,
          BaseWallet.address
        )
      ]);
    })
    .then(() => {
      return ModuleRegistryImpl.deployed();
    })
    .then(moduleRegistryImpl => {
      return Promise.all([
        moduleRegistryImpl.registerModule(WalletFactoryModule.address)
      ]);
    })
    .then(() => {
      return WalletRegistryImpl.deployed();
    })
    .then(walletRegistryImpl => {
      return Promise.all([
        walletRegistryImpl.setWalletFactory(WalletFactoryModule.address)
      ]);
    })
    .then(() => {
      console.log(">>>>>>>> contracts deployed by registries:");
      console.log("WalletFactoryModule:", WalletFactoryModule.address);
      console.log("");
    });
};
