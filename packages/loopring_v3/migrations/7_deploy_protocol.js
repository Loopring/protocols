// Deploy protocol: LoopringV3

const LRCToken = artifacts.require("./test/tokens/LRC.sol");
const WETHToken = artifacts.require("./test/tokens/WETH.sol");
const BlockVerifier = artifacts.require("./impl/BlockVerifier.sol");
const ProtocolFeeVault = artifacts.require("./impl/ProtocolFeeVault");
const ProtocolRegistry = artifacts.require("./impl/ProtocolRegistry");
const LoopringV3 = artifacts.require("./impl/LoopringV3.sol");

var DowntimeCostCalculator = artifacts.require(
  "./impl/DowntimeCostCalculator.sol"
);

var lrcAddress = "0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD";
var wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
var protocolFeeValutAddress = "0xa8b6A3EFBcdd578154a913F33dc9949808B7A9f4";
var userStakingPoolAddress = "undeployed";

module.exports = function(deployer, network, accounts) {
  var deployer_ = deployer;

  if (network !== "live") {
    DowntimeCostCalculator = artifacts.require(
      "./test/FixPriceDowntimeCostCalculator.sol"
    );

    deployer_ = deployer_.then(() => {
      return Promise.all([
        LRCToken.deployed().then(addr => {
          lrcAddress = addr;
        }),
        WETHToken.deployed().then(addr => {
          wethAddress = addr;
        }),
        ProtocolFeeVault.deployed().then(addr => {
          protocolFeeValutAddress = addr;
        })
      ]);
    });
  }

  // common deployment
  deployer_
    .then(() => {
      return Promise.all([
        ProtocolRegistry.deployed(),
        BlockVerifier.deployed(),
        DowntimeCostCalculator.deployed()
      ]);
    })
    .then(() => {
      return Promise.all([
        deployer.deploy(
          LoopringV3,
          ProtocolRegistry.address,
          lrcAddress,
          wethAddress,
          protocolFeeValutAddress,
          BlockVerifier.address,
          DowntimeCostCalculator.address
        )
      ]);
    })
    .then(() => {
      console.log(">>>>>>>> contracts deployed by deploy_protocol:");
      console.log("lrcAddress:", lrcAddress);
      console.log("wethAddress:", wethAddress);
      console.log("protocolFeeValutAddress:", protocolFeeValutAddress);
      console.log("userStakingPoolAddress:", userStakingPoolAddress);
      console.log("ProtocolRegistry:", ProtocolRegistry.address);
      console.log("BlockVerifier:", BlockVerifier.address);
      console.log("DowntimeCostCalculator:", DowntimeCostCalculator.address);
      console.log("LoopringV3:", LoopringV3.address);
      console.log("");
    });
};
