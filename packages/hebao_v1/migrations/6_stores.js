const HashStore = artifacts.require("HashStore");
const QuotaStore = artifacts.require("QuotaStore");
const SecurityStore = artifacts.require("SecurityStore");
const WhitelistStore = artifacts.require("WhitelistStore");

module.exports = function(deployer, network, accounts) {
  deployer.then(() => {
    return Promise.all([
      deployer.deploy(HashStore),
      deployer.deploy(QuotaStore, "1" + "0".repeat(19)), // 1000 wei for unit test
      deployer.deploy(SecurityStore),
      deployer.deploy(WhitelistStore)
    ]);
  });
};
