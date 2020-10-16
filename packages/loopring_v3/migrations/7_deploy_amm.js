// Deploy Amm protocols

const LoopringAmmPool = artifacts.require("LoopringAmmPool");
const LoopringAmmPoolCopy = artifacts.require("LoopringAmmPoolCopy");
const LoopringAmmSharedConfig = artifacts.require("LoopringAmmSharedConfig");
const AmmJoinRequest = artifacts.require("AmmJoinRequest");
const AmmExitRequest = artifacts.require("AmmExitRequest");

module.exports = function(deployer, network, accounts) {
  if (network != "live" && network != "live-fork") {
    deployer.then(async () => {
      await deployer.deploy(AmmJoinRequest);
      await deployer.deploy(AmmExitRequest);
      await deployer.link(AmmJoinRequest, LoopringAmmPool);
      await deployer.link(AmmExitRequest, LoopringAmmPool);
      await deployer.deploy(LoopringAmmPool);

      await deployer.link(AmmJoinRequest, LoopringAmmPoolCopy);
      await deployer.link(AmmExitRequest, LoopringAmmPoolCopy);
      await deployer.deploy(LoopringAmmPoolCopy);
      await deployer.deploy(LoopringAmmSharedConfig);

      const loopringAmmSharedConfig = await LoopringAmmSharedConfig.deployed();
      await loopringAmmSharedConfig.setMaxForcedExitAge(3600 * 24 * 14);
      await loopringAmmSharedConfig.setMaxForcedExitCount(500);
      await loopringAmmSharedConfig.setForcedExitFee(
        web3.utils.toWei("0.01", "ether")
      );
    });
  }
};
