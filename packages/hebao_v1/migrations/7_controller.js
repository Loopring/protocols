const ModuleRegistryImpl = artifacts.require("ModuleRegistryImpl");
const BaseENSManager = artifacts.require("BaseENSManager");
const TestPriceOracle = artifacts.require("TestPriceOracle");
const HashStore = artifacts.require("HashStore");
const QuotaStore = artifacts.require("QuotaStore");
const SecurityStore = artifacts.require("SecurityStore");
const WhitelistStore = artifacts.require("WhitelistStore");
const ControllerImpl = artifacts.require("ControllerImpl");

module.exports = function(deployer, network, accounts) {
  let ensManagerAddr = process.env.ENSManager || "";

  if (!web3.utils.isAddress(ensManagerAddr.toLowerCase())) {
    ensManagerAddr = BaseENSManager.address;
  }

  const collecTo = process.env.collectTo || accounts[1];

  let priceOracle;
  let controllerImpl;
  deployer.then(async () => {
    await deployer.deploy(TestPriceOracle);
    await deployer.deploy(
      ControllerImpl,
      HashStore.address,
      QuotaStore.address,
      SecurityStore.address,
      WhitelistStore.address,
      ModuleRegistryImpl.address,
      collecTo,
      ensManagerAddr,
      TestPriceOracle.address
    );
  });
};
