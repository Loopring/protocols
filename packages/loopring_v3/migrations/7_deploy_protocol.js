// Deploy protocol: LoopringV3

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
      "./test/FixPriceDowntimeCostCalculator"
    );

    const LRCToken = artifacts.require("./test/tokens/LRC");
    const WETHToken = artifacts.require("./test/tokens/WETH");
    const ProtocolFeeVault = artifacts.require("./impl/ProtocolFeeVault");
    deployer_ = deployer_.then(() => {
      return Promise.all([
        LRCToken.deployed().then(c => {
          lrcAddress = c.address;
        }),
        WETHToken.deployed().then(c => {
          wethAddress = c.address;
        }),
        ProtocolFeeVault.deployed().then(c => {
          protocolFeeValutAddress = c.address;
        })
      ]);
    });
  }

  // common deployment

  const ProtocolRegistry = artifacts.require("./impl/ProtocolRegistry");
  const BlockVerifier = artifacts.require("./impl/BlockVerifier");
  const ExchangeV3 = artifacts.require("./impl/ExchangeV3");
  const LoopringV3 = artifacts.require("./impl/LoopringV3");

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
      return Promise.all([ExchangeV3.deployed()]);
    })
    .then(() => {
      return Promise.all([
        ProtocolRegistry.deployed().then(c => {
          c.registerProtocol(LoopringV3.address, ExchangeV3.address);
        })
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
