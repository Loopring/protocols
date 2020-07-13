const DappAddressStore = artifacts.require("DappAddressStore");
const HashStore = artifacts.require("HashStore");
const NonceStore = artifacts.require("NonceStore");
const QuotaStore = artifacts.require("QuotaStore");
const SecurityStore = artifacts.require("SecurityStore");
const WhitelistStore = artifacts.require("WhitelistStore");

const dappManager = process.env.APP_MANAGER || "";
const loopringDEX = process.env.LOOPRING_DEX || "";

module.exports = function(deployer, network, accounts) {
  deployer
    .then(() => {
      return Promise.all([
        deployer.deploy(DappAddressStore),
        deployer.deploy(NonceStore),
        deployer.deploy(HashStore),
        deployer.deploy(QuotaStore, 1000), // 1000 wei for unit test
        deployer.deploy(SecurityStore),
        deployer.deploy(WhitelistStore)
      ]);
    })
    .then(() => {
      return Promise.all([
        DappAddressStore.deployed().then(dappAddressStore => {
          if (dappManager) {
            console.log("add dappManager for dappAddressStore:", dappManager);
            dappAddressStore.addDapp(dappManager);
          }

          if (loopringDEX) {
            console.log("add loopringDEX to dapp list:", loopringDEX);
            dappAddressStore.addDapp(loopringDEX);
          }
        })
      ]);
    });
};
