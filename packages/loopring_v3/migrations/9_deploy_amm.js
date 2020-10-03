// Deploy Amm protocols

const LoopringAmmPool = artifacts.require("LoopringAmmPool");

module.exports = function(deployer, network, accounts) {
  if (network != "live" && network != "live-fork") {
    deployer.then(async () => {
      await deployer.deploy(LoopringAmmPool);
    });
  }
};
