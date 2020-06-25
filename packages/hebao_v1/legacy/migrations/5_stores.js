const QuotaStore = artifacts.require("./stores/QuotaStore.sol");
const SecurityStore = artifacts.require("./stores/SecurityStore.sol");
const WhitelistStore = artifacts.require("./stores/WhitelistStore.sol");
const PriceCacheStore = artifacts.require("./stores/PriceCacheStore.sol");
const DappAddressStore = artifacts.require("./stores/DappAddressStore.sol");

const dappManager = process.env.APP_MANAGER || "";
const loopringDEX = process.env.LOOPRING_DEX || "";
module.exports = function(deployer, network, accounts) {
  deployer
    .then(() => {
      return Promise.all([
        deployer.deploy(QuotaStore, 1000), // 1000 wei for unit test
        deployer.deploy(SecurityStore),
        deployer.deploy(WhitelistStore),
        deployer.deploy(PriceCacheStore, accounts[0], 14 * 24 * 3600),
        deployer.deploy(DappAddressStore)
      ]);
    })
    .then(() => {
      if (dappManager) {
        console.log("add dappManager for dappAddressStore:", dappManager);
        DappAddressStore.deployed().then(dappAddressStore => {
          return Promise.all([dappAddressStore.addManager(dappManager)]);
        });
      }

      if (loopringDEX) {
        console.log("add loopringDEX to dapp list:", loopringDEX);
        DappAddressStore.deployed().then(dappAddressStore => {
          return Promise.all([dappAddressStore.addDapp(loopringDEX)]);
        });
      }
    });
};
