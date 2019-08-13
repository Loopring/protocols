// Deploy all auxiliary contracts used by either Exchange, LoopringV3,
// or ProtocolRegistry.

var DowntimeCostCalculator = artifacts.require("./impl/DowntimeCostCalculator");

var lrcAddress = "0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD";
var wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
var protocolFeeValutAddress = "0xa8b6A3EFBcdd578154a913F33dc9949808B7A9f4";
var userStakingPoolAddress = "[undeployed]";

module.exports = function(deployer, network, accounts) {
  console.log("   > deploying to network: " + network);
  var deployer_ = deployer;

  if (network != "live") {
    DowntimeCostCalculator = artifacts.require(
      "./test/FixPriceDowntimeCostCalculator.sol"
    );

    const LRCToken = artifacts.require("./test/tokens/LRC");
    const WETHToken = artifacts.require("./test/tokens/WETH");

    deployer_ = deployer_
      .then(() => {
        return Promise.all([
          LRCToken.deployed().then(c => {
            lrcAddress = c.address;
          }),
          WETHToken.deployed().then(c => {
            wethAddress = c.address;
          })
        ]);
      })
      .then(() => {
        const UserStakingPool = artifacts.require("./impl/UserStakingPool");
        return Promise.all([
          deployer.deploy(UserStakingPool, lrcAddress).then(c => {
            userStakingPoolAddress = c.address;
          })
        ]);
      })
      .then(() => {
        const ProtocolFeeVault = artifacts.require("./impl/ProtocolFeeVault");
        return Promise.all([
          deployer
            .deploy(ProtocolFeeVault, lrcAddress, userStakingPoolAddress)
            .then(c => {
              protocolFeeValutAddress = c.address;
            })
        ]);
      });
  }

  // common deployment

  const BlockVerifier = artifacts.require("./impl/BlockVerifier");

  deployer_
    .then(() => {
      return Promise.all([
        deployer.deploy(BlockVerifier),
        deployer.deploy(DowntimeCostCalculator)
      ]);
    })
    .then(() => {
      console.log(">>>>>>>> contracts deployed by deploy_aux:");
      console.log("lrcAddress:", lrcAddress);
      console.log("wethAddress:", wethAddress);
      console.log("protocolFeeValutAddress:", protocolFeeValutAddress);
      console.log("userStakingPoolAddress:", userStakingPoolAddress);
      console.log("BlockVerifier:", BlockVerifier.address);
      console.log("DowntimeCostCalculator:", DowntimeCostCalculator.address);
      console.log("");
    });
};
