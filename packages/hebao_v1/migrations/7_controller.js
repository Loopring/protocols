const DappAddressStore = artifacts.require("DappAddressStore");
const ModuleRegistryImpl = artifacts.require("ModuleRegistryImpl");
const WalletRegistryImpl = artifacts.require("WalletRegistryImpl");
const BaseENSManager = artifacts.require("BaseENSManager");
const TestPriceOracle = artifacts.require("TestPriceOracle");
const HashStore = artifacts.require("HashStore");
const NonceStore = artifacts.require("NonceStore");
const QuotaStore = artifacts.require("QuotaStore");
const SecurityStore = artifacts.require("SecurityStore");
const WhitelistStore = artifacts.require("WhitelistStore");
const ControllerImpl = artifacts.require("ControllerImpl");

module.exports = function(deployer, network, accounts) {
  let ensManagerAddr = process.env.ENSManager || "";

  if (!web3.utils.isAddress(ensManagerAddr.toLowerCase())) {
    ensManagerAddr = BaseENSManager.address;
  }

  const lockPeriod = Number(process.env.controllerLockPeriod) || 1 * 24 * 3600;
  const collecTo = process.env.collectTo || accounts[1];

  let priceOracle;
  let controllerImpl;
  deployer.then(async () => {
    await deployer.deploy(TestPriceOracle);
    await deployer.deploy(
      ControllerImpl,
      ModuleRegistryImpl.address,
      WalletRegistryImpl.address,
      lockPeriod,
      collecTo,
      ensManagerAddr,
      TestPriceOracle.address,
      true
    );

    const controllerImpl = await ControllerImpl.deployed();
    return Promise.all([
      controllerImpl.initStores(
        DappAddressStore.address,
        HashStore.address,
        NonceStore.address,
        QuotaStore.address,
        SecurityStore.address,
        WhitelistStore.address
      )
    ]);
  });
};
