var LRCToken = artifacts.require("./test/tokens/LRC.sol");
var ExchangeV3Deployer = artifacts.require("./impl/ExchangeV3Deployer");
var BlockVerifier = artifacts.require("./impl/BlockVerifier.sol");
var DowntimeCostCalculator = artifacts.require(
  "./test/DowntimeCostCalculator.sol"
);
var UserStakingPool = artifacts.require("./impl/UserStakingPool");
var ProtocolFeeVault = artifacts.require("./impl/ProtocolFeeVault");

module.exports = function(deployer, network, accounts) {
  if (network === "live") {
    // ignore.
    // TODO(kongliang): we should deploy on mainnet using scripts written here.
  } else {
    deployer
      .then(() => {
        return Promise.all([
          deployer.deploy(BlockVerifier),
          deployer.deploy(DowntimeCostCalculator),
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
        console.log(">>>>>>>> Deployed contracts addresses:");
        console.log("BlockVerifier:", BlockVerifier.address);
        console.log("DowntimeCostCalculator:", DowntimeCostCalculator.address);
        console.log("UserStakingPool:", UserStakingPool.address);
        console.log("ProtocolFeeVault:", ProtocolFeeVault.address);
      });
  }
};
