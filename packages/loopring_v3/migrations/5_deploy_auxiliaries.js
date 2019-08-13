// Deploy all auxiliary contracts used by either Exchange, LoopringV3,
// or ProtocolRegistry.

var LRCToken = artifacts.require("./test/tokens/LRC.sol");
var BlockVerifier = artifacts.require("./impl/BlockVerifier.sol");
var DowntimeCostCalculator = artifacts.require(
  "./test/FixPriceDowntimeCostCalculator.sol"
);
var UserStakingPool = artifacts.require("./impl/UserStakingPool");
var ProtocolFeeVault = artifacts.require("./impl/ProtocolFeeVault");

var lrcAddress = "0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD";

module.exports = function(deployer, network, accounts) {
  var d = deployer;

  if (network === "live") {
    DowntimeCostCalculator = artifacts.require(
      "./test/FixPriceDowntimeCostCalculator.sol"
    );
  } else {
    d = d.then(() => {
      return Promise.all([
        LRCToken.deployed().then(addr => {
          lrcAddress = addr;
        })
      ]);
    });
  }

  d.then(() => {
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
      console.log(">>>>>>>> contracts deployed by deploy_aux:");
      console.log("BlockVerifier:", BlockVerifier.address);
      console.log("DowntimeCostCalculator:", DowntimeCostCalculator.address);
      console.log("UserStakingPool:", UserStakingPool.address);
      console.log("ProtocolFeeVault:", ProtocolFeeVault.address);
      console.log("");
    });
};
