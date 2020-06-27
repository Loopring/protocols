const DappAddressStore = artifacts.require("./stores/DappAddressStore.sol");
const ModuleRegistry = artifacts.require("./base/ModuleRegistryImpl.sol");
const WalletRegistry = artifacts.require("./base/WalletRegistryImpl.sol");
const ENSManager = artifacts.require("./thirdparty/ens/BaseENSManager.sol");
const PriceOracle = artifacts.require("./test/TestPriceOracle");
const NonceStore = artifacts.require("./stores/NonceStore.sol");
const QuotaStore = artifacts.require("./stores/QuotaStore.sol");
const SecurityStore = artifacts.require("./stores/SecurityStore.sol");
const WhitelistStore = artifacts.require("./stores/WhitelistStore.sol");
const Controller = artifacts.require("./version1.1/ControllerImpl.sol");

module.exports = function(deployer, network, accounts) {
  let ensManagerAddr = process.env.ENSManager || "";

  if (!web3.utils.isAddress(ensManagerAddr.toLowerCase())) {
    ensManagerAddr = ENSManager.address;
  }
  const lockPeriod = Number(process.env.controllerLockPeriod) || 1 * 24 * 3600;
  const collecTo = accounts[1];

  deployer
    .then(() => {
      return Promise.all([deployer.deploy(PriceOracle)]);
    })
    .then(controller => {
      return Promise.all([
        deployer.deploy(
          Controller,
          ModuleRegistry.address,
          WalletRegistry.address,
          lockPeriod,
          collecTo,
          ensManagerAddr,
          PriceOracle.address,
          DappAddressStore.address,
          NonceStore.address,
          QuotaStore.address,
          SecurityStore.address,
          WhitelistStore.address
        )
      ]);
    });
};
