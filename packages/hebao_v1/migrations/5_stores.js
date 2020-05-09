const QuotaStore = artifacts.require("./stores/QuotaStore.sol");
const SecurityStore = artifacts.require("./stores/SecurityStore.sol");
const WhitelistStore = artifacts.require("./stores/WhitelistStore.sol");
const PriceCacheStore = artifacts.require("./stores/PriceCacheStore.sol");

module.exports = function(deployer, network, accounts) {
  deployer
    .then(() => {
      return Promise.all([
        deployer.deploy(QuotaStore, 1000),
        deployer.deploy(SecurityStore),
        deployer.deploy(WhitelistStore),
        deployer.deploy(PriceCacheStore, accounts[0], 14 * 24 * 3600)
      ]);
    })
    .then(() => {
      console.log(">>>>>>>> contracts deployed by registries:");
      console.log("QuotaStore:", QuotaStore.address);
      console.log("SecurityStore:", SecurityStore.address);
      console.log("WhitelistStore:", WhitelistStore.address);
      console.log("PriceCacheStore:", PriceCacheStore.address);
      console.log("");
    });
};
