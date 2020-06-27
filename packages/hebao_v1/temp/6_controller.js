const ControllerV2Impl = artifacts.require("./version2/ControllerV2Impl.sol");
const DappAddressStore = artifacts.require("./stores/DappAddressStore.sol");
const ModuleRegistryImpl = artifacts.require("./base/ModuleRegistryImpl.sol");
const NonceStore = artifacts.require("./stores/NonceStore.sol");
const QuotaStore = artifacts.require("./stores/QuotaStore.sol");
const SecurityStore = artifacts.require("./stores/SecurityStore.sol");
const WalletENSManager = artifacts.require("./base/WalletENSManager.sol");
const WalletRegistryImpl = artifacts.require("./base/WalletRegistryImpl.sol");
const WhitelistStore = artifacts.require("./stores/WhitelistStore.sol");

module.exports = function(deployer, network, accounts) {
  let deployedEnsManagerAddr = process.env.ENSManager || "";

  if (!web3.utils.isAddress(deployedEnsManagerAddr.toLowerCase())) {
    deployedEnsManagerAddr = WalletENSManager.address;
  }
  const lockPeriod = Number(process.env.controllerLockPeriod) || 1 * 24 * 3600;
  const collecTo = accounts[1];

  deployer
    .then(() => {
      return Promise.all([deployer.deploy(ControllerV2Impl)]);
    })
    .then(() => {
      return ControllerV2Impl.deployed();
    })
    .then(controllerV2Impl => {
      return Promise.all([
        controllerV2Impl.init(
          ModuleRegistryImpl.address,
          WalletRegistryImpl.address,
          lockPeriod,
          collecTo,

          ModuleRegistryImpl.address,

          QuotaStore.address,
          SecurityStore.address,
          WhitelistStore.address,
          DappAddressStore.address,
          PriceCacheStore.address,
          deployedEnsManagerAddr
        )
      ]);
    });
};
