const ControllerImpl = artifacts.require("./base/ControllerImpl.sol");
const ModuleRegistryImpl = artifacts.require("./base/ModuleRegistryImpl.sol");
const WalletRegistryImpl = artifacts.require("./base/WalletRegistryImpl.sol");
const QuotaStore = artifacts.require("./stores/QuotaStore.sol");
const SecurityStore = artifacts.require("./stores/SecurityStore.sol");
const WhitelistStore = artifacts.require("./stores/WhitelistStore.sol");
const PriceCacheStore = artifacts.require("./stores/PriceCacheStore.sol");
const WalletENSManager = artifacts.require("./base/WalletENSManager.sol");

module.exports = function(deployer, network, accounts) {
  deployer
    .then(() => {
      return Promise.all([deployer.deploy(ControllerImpl)]);
    })
    .then(() => {
      return ControllerImpl.deployed();
    })
    .then(controllerImpl => {
      return Promise.all([
        controllerImpl.init(
          ModuleRegistryImpl.address,
          5 * 24 * 3600,
          ModuleRegistryImpl.address,
          WalletRegistryImpl.address,
          QuotaStore.address,
          SecurityStore.address,
          WhitelistStore.address,
          PriceCacheStore.address,
          WalletENSManager.address
        )
      ]);
    })
    .then(() => {
      console.log(">>>>>>>> contracts deployed by controller:");
      console.log("ControllerImpl:", ControllerImpl.address);
      console.log("");
    });
};
