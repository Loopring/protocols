// Deploy protocol: LoopringV3

var lrcAddress = "0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD";
var protocolFeeValutAddress = "0xa8b6A3EFBcdd578154a913F33dc9949808B7A9f4";
var userStakingPoolAddress = "[undeployed]";

module.exports = function(deployer, network, accounts) {
  console.log("deploying to network: " + network);
  var deployer_ = deployer;

  if (network != "live" && network != "live-fork") {
    const LRCToken = artifacts.require("./test/tokens/LRC.sol");
    const WETHToken = artifacts.require("./test/tokens/WETH.sol");
    const ProtocolFeeVault = artifacts.require("ProtocolFeeVault");
    deployer_ = deployer_.then(() => {
      return Promise.all([
        LRCToken.deployed().then(c => {
          lrcAddress = c.address;
        }),
        ProtocolFeeVault.deployed().then(c => {
          protocolFeeValutAddress = c.address;
        })
      ]);
    });
  }

  // common deployment

  const UniversalRegistry = artifacts.require("UniversalRegistry");
  const BlockVerifier = artifacts.require("BlockVerifier");
  const ExchangeV3 = artifacts.require("ExchangeV3");
  const LoopringV3 = artifacts.require("LoopringV3");

  deployer_
    .then(() => {
      return Promise.all([
        UniversalRegistry.deployed(),
        BlockVerifier.deployed()
      ]);
    })
    .then(() => {
      return Promise.all([
        deployer.deploy(
          LoopringV3,
          UniversalRegistry.address,
          lrcAddress,
          protocolFeeValutAddress,
          BlockVerifier.address
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
      console.log("protocolFeeValutAddress:", protocolFeeValutAddress);
      console.log("userStakingPoolAddress:", userStakingPoolAddress);
      console.log("UniversalRegistry:", UniversalRegistry.address);
      console.log("BlockVerifier:", BlockVerifier.address);
      console.log("LoopringV3:", LoopringV3.address);
      console.log("");
    });
};
