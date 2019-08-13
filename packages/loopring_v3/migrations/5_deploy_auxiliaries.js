// Deploy all auxiliary contracts used by either Exchange, LoopringV3,
// or ProtocolRegistry.

var LRCToken = artifacts.require("./test/tokens/LRC.sol");
var BlockVerifier = artifacts.require("./impl/BlockVerifier.sol");
var FixPriceDowntimeCostCalculator = artifacts.require(
  "./test/FixPriceDowntimeCostCalculator.sol"
);
var UserStakingPool = artifacts.require("./impl/UserStakingPool.sol");
var ProtocolFeeVault = artifacts.require("./impl/ProtocolFeeVault.sol");

module.exports = function(deployer, network, accounts) {
  if (network === "live") {
    // ignore.
  } else {
    deployer
      .then(() => {
        return Promise.all([LRCToken.deployed()]);
      })
      .then(() => {
        return Promise.all([
          deployer.deploy(BlockVerifier),
          deployer.deploy(FixPriceDowntimeCostCalculator),
          deployer.deploy(UserStakingPool, LRCToken.address)
        ]);
      })
      .then(() => {
        return Promise.all([
          deployer.deploy(
            ProtocolFeeVault,
            LRCToken.address,
            UserStakingPool.address
          )
        ]);
      })
      .then(() => {
        console.log(">>>>>>>> contracts deployed by deploy_aux:");
        console.log("BlockVerifier:", BlockVerifier.address);
        console.log(
          "FixPriceDowntimeCostCalculator:",
          FixPriceDowntimeCostCalculator.address
        );
        console.log("UserStakingPool:", UserStakingPool.address);
        console.log("ProtocolFeeVault:", ProtocolFeeVault.address);
        console.log("");
      });
  }
};
