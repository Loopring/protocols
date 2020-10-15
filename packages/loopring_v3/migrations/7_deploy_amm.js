// Deploy Amm protocols

const LoopringAmmPool = artifacts.require("LoopringAmmPool");
const LoopringAmmPoolCopy = artifacts.require("LoopringAmmPoolCopy");
const LoopringAmmSharedConfig = artifacts.require("LoopringAmmSharedConfig");

module.exports = function(deployer, network, accounts) {
  if (network != "live" && network != "live-fork") {
    deployer.then(async () => {
      await deployer.deploy(LoopringAmmPool);
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
