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
        deployer.deploy(QuotaStore, 1000),
        deployer.deploy(SecurityStore),
        deployer.deploy(WhitelistStore),
        deployer.deploy(PriceCacheStore, accounts[0], 14 * 24 * 3600),
        deployer.deploy(DappAddressStore)
      ]);
    })
    .then(() => {
      if (dappManager) {
        console.log("dappManager:", dappManager);
        DappAddressStore.deployed().then(dappAddressStore => {
          return Promise.all([dappAddressStore.addManager(dappManager)]);
        }).then(() => {
          if (loopringDEX) {
            DappAddressStore.deployed().then(dappAddressStore => {
              console.log("loopringDEX:", loopringDEX);
              return Promise.all([dappAddressStore.addDapp(loopringDEX)]);
            });
          }
        });
      }

      console.log(">>>>>>>> contracts deployed by stores:");
      console.log("QuotaStore:", QuotaStore.address);
      console.log("SecurityStore:", SecurityStore.address);
      console.log("WhitelistStore:", WhitelistStore.address);
      console.log("PriceCacheStore:", PriceCacheStore.address);
      console.log("DappAddressStore:", DappAddressStore.address);
    });
};
