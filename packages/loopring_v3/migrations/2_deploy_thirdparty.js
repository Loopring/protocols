const BatchVerifier = artifacts.require("BatchVerifier");

module.exports = function(deployer, network, accounts) {
  deployer.then(async () => {
    await deployer.deploy(BatchVerifier);
  });
};
