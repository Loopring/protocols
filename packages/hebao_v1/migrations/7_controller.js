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
  const collecTo = accounts[1];

  deployer
    .then(() => {
      return Promise.all([deployer.deploy(TestPriceOracle)]);
    })
    .then(() => {
      return Promise.all([
        TestPriceOracle.deployed().then(priceOracle => {
          return Promise.all([
            deployer.deploy(
              ControllerImpl,
              ModuleRegistryImpl.address,
              WalletRegistryImpl.address,
              lockPeriod,
              collecTo,
              ensManagerAddr,
              priceOracle.address,
              true
            )
          ]);
        })
      ]);
    })
    .then(() => {
      return Promise.all([
        ControllerImpl.deployed().then(controllerImpl => {
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
        })
      ]);
    });
};
