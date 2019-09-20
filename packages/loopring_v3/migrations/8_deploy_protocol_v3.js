// Deploy protocol: LoopringV3

var DowntimeCostCalculator = artifacts.require(
  "./impl/DowntimeCostCalculator.sol"
);

var lrcAddress = "0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD";
var wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
var protocolFeeValutAddress = "0xa8b6A3EFBcdd578154a913F33dc9949808B7A9f4";
var userStakingPoolAddress = "[undeployed]";

module.exports = function(deployer, network, accounts) {
  console.log("deploying to network: " + network);
  var deployer_ = deployer;

  if (network != "live" && network != "live-fork") {
    DowntimeCostCalculator = artifacts.require(
      "./test/FixPriceDowntimeCostCalculator.sol"
    );

    const LRCToken = artifacts.require("./test/tokens/LRC.sol");
    const WETHToken = artifacts.require("./test/tokens/WETH.sol");
    const ProtocolFeeVault = artifacts.require("./impl/ProtocolFeeVault.sol");
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

  const UniversalRegistry = artifacts.require("./impl/UniversalRegistry.sol");
  const BlockVerifier = artifacts.require("./impl/BlockVerifier.sol");
  const ExchangeV3 = artifacts.require("./impl/ExchangeV3.sol");
  const LoopringV3 = artifacts.require("./impl/LoopringV3.sol");

  deployer_
    .then(() => {
      return Promise.all([
        UniversalRegistry.deployed(),
        BlockVerifier.deployed(),
        DowntimeCostCalculator.deployed()
      ]);
    })
    .then(() => {
      return Promise.all([
        deployer.deploy(
          LoopringV3,
          UniversalRegistry.address,
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
        UniversalRegistry.deployed().then(c => {
          console.log(
            "registering protocol:",
            LoopringV3.address,
            ExchangeV3.address
          );
          c.registerProtocol(LoopringV3.address, ExchangeV3.address);
        })
      ]);
    })
    .then(() => {
      console.log(">>>>>>>> contracts deployed by deploy_protocol_v3:");
      console.log("lrcAddress:", lrcAddress);
      console.log("wethAddress:", wethAddress);
      console.log("protocolFeeValutAddress:", protocolFeeValutAddress);
      console.log("userStakingPoolAddress:", userStakingPoolAddress);
      console.log("UniversalRegistry:", UniversalRegistry.address);
      console.log("BlockVerifier:", BlockVerifier.address);
      console.log("DowntimeCostCalculator:", DowntimeCostCalculator.address);
      console.log("LoopringV3:", LoopringV3.address);
      console.log("");
    });
};
