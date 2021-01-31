const BatchVerifier = artifacts.require("BatchVerifier");
const ChiToken = artifacts.require("ChiToken.sol");

module.exports = function(deployer, network, accounts) {
  deployer.then(async () => {
    await deployer.deploy(BatchVerifier);
    if (network != "live" && network != "live-fork") {
      await deployer.deploy(ChiToken);
    }
  });
};
