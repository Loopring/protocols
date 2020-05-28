require("dotenv").config({ path: require("find-config")(".env") });

const ControllerImpl = artifacts.require("./base/ControllerImpl.sol");
const ModuleRegistryImpl = artifacts.require("./base/ModuleRegistryImpl.sol");
const WalletRegistryImpl = artifacts.require("./base/WalletRegistryImpl.sol");
const QuotaStore = artifacts.require("./stores/QuotaStore.sol");
const SecurityStore = artifacts.require("./stores/SecurityStore.sol");
const WhitelistStore = artifacts.require("./stores/WhitelistStore.sol");
const PriceCacheStore = artifacts.require("./stores/PriceCacheStore.sol");
const DappAddressStore = artifacts.require("./stores/DappAddressStore.sol");
const WalletENSManager = artifacts.require("./base/WalletENSManager.sol");

module.exports = function(deployer, network, accounts) {
  let deployedEnsManagerAddr = process.env.ENSManager || "";
  if (!web3.utils.isAddress(deployedEnsManagerAddr.toLowerCase())) {
    deployedEnsManagerAddr = WalletENSManager.address;
  }
  const lockPeriod = Number(process.env.controllerLockPeriod) || 5 * 24 * 3600;

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
          lockPeriod,
          ModuleRegistryImpl.address,
          WalletRegistryImpl.address,
          QuotaStore.address,
          SecurityStore.address,
          WhitelistStore.address,
          DappAddressStore.address,
          PriceCacheStore.address,
          deployedEnsManagerAddr
        )
      ]);
    })
    .then(() => {
      console.log(">>>>>>>> contracts deployed by controller:");
      console.log("ControllerImpl:", ControllerImpl.address);
      console.log("");
    });
};
