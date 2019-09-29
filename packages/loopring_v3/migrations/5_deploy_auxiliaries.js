// Deploy all auxiliary contracts used by either Exchange, LoopringV3,
// or UniversalRegistry.

var DowntimeCostCalculator = artifacts.require(
  "./impl/DowntimeCostCalculator.sol"
);
const ProtocolFeeVault = artifacts.require("./impl/ProtocolFeeVault.sol");

var UniswapTokenSeller = artifacts.require("./impl/UniswapTokenSeller.sol");
var lrcAddress = "0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD";
var wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
var protocolFeeValutAddress = "0xa8b6A3EFBcdd578154a913F33dc9949808B7A9f4";
var userStakingPoolAddress = "[undeployed]";
var uniswapTokenSellerAddress = "[undeployed]";

module.exports = function(deployer, network, accounts) {
  console.log("deploying to network: " + network);
  var deployer_ = deployer;

  if (network != "live" && network != "live-fork") {
    DowntimeCostCalculator = artifacts.require(
      "./test/FixPriceDowntimeCostCalculator.sol"
    );

    const LRCToken = artifacts.require("./test/tokens/LRC.sol");
    const WETHToken = artifacts.require("./test/tokens/WETH.sol");

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
        const UserStakingPool = artifacts.require("./impl/UserStakingPool.sol");
        return Promise.all([
          deployer.deploy(UserStakingPool, lrcAddress).then(c => {
            userStakingPoolAddress = c.address;
          })
        ]);
      })
      .then(() => {
        return Promise.all([
          deployer.deploy(ProtocolFeeVault, lrcAddress).then(c => {
            protocolFeeValutAddress = c.address;
          })
        ]);
      });
  }

  if (network === "live" || network === "rinkeby") {
    const factoryAddress =
      network === "live"
        ? "0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95"
        : "0xf5D915570BC477f9B8D6C0E980aA81757A3AaC36";

    deployer_.then(() => {
      return Promise.all([
        deployer
          .deploy(UniswapTokenSeller, factoryAddress, protocolFeeValutAddress)
          .then(c => {
            uniswapTokenSellerAddress = c.address;
          })
      ]);
    });
  }

  const BatchVerifier = artifacts.require("./thirdparty/BatchVerifier.sol");
  const BlockVerifier = artifacts.require("./impl/BlockVerifier.sol");

  deployer_
    .then(() => {
      return Promise.all([BatchVerifier.deployed()]);
    })
    .then(() => {
      return Promise.all([deployer.link(BatchVerifier, BlockVerifier)]);
    })
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
      console.log("uniswapTokenSellerAddress:", uniswapTokenSellerAddress);
      console.log("BlockVerifier:", BlockVerifier.address);
      console.log("DowntimeCostCalculator:", DowntimeCostCalculator.address);
      console.log("");
    });
};
