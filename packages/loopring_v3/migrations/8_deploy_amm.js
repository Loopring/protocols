// Deploy Amm protocols

const AmmJoinRequest = artifacts.require("AmmJoinRequest");
const AmmExitRequest = artifacts.require("AmmExitRequest");
const LoopringAmmPool = artifacts.require("LoopringAmmPool");

module.exports = function(deployer, network, accounts) {
  if (network != "live" && network != "live-fork") {
    deployer.then(async () => {
      await deployer.deploy(AmmJoinRequest);
      await deployer.deploy(AmmExitRequest);
      await deployer.link(AmmJoinRequest, LoopringAmmPool);
      await deployer.link(AmmExitRequest, LoopringAmmPool);
      await deployer.deploy(LoopringAmmPool);
    });
  }
};
