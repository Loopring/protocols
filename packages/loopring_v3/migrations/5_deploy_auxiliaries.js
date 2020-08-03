// Deploy all auxiliary contracts used by either Exchange, LoopringV3,
// or UniversalRegistry.

const ProtocolFeeVault = artifacts.require("ProtocolFeeVault");

var UniswapTokenSeller = artifacts.require("UniswapTokenSeller");
var lrcAddress = "0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD";
var protocolFeeValutAddress = "0xa8b6A3EFBcdd578154a913F33dc9949808B7A9f4";
var userStakingPoolAddress = "[undeployed]";
var uniswapTokenSellerAddress = "[undeployed]";

module.exports = function(deployer, network, accounts) {
  console.log("deploying to network: " + network);
  var deployer_ = deployer;

  if (network != "live" && network != "live-fork") {
    const LRCToken = artifacts.require("./test/tokens/LRC.sol");
    const WETHToken = artifacts.require("./test/tokens/WETH.sol");

    deployer_ = deployer_
      .then(() => {
        return Promise.all([
          LRCToken.deployed().then(c => {
            lrcAddress = c.address;
          })
        ]);
      })
      .then(() => {
        const UserStakingPool = artifacts.require("UserStakingPool");
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

  const BatchVerifier = artifacts.require("BatchVerifier");
  const BlockVerifier = artifacts.require("BlockVerifier");

  deployer_
    .then(() => {
      return Promise.all([BatchVerifier.deployed()]);
    })
    .then(() => {
      return Promise.all([deployer.link(BatchVerifier, BlockVerifier)]);
    })
    .then(() => {
      return Promise.all([deployer.deploy(BlockVerifier)]);
    })
    .then(() => {
      console.log(">>>>>>>> contracts deployed by deploy_aux:");
      console.log("lrcAddress:", lrcAddress);
      console.log("protocolFeeValutAddress:", protocolFeeValutAddress);
      console.log("userStakingPoolAddress:", userStakingPoolAddress);
      console.log("uniswapTokenSellerAddress:", uniswapTokenSellerAddress);
      console.log("BlockVerifier:", BlockVerifier.address);
      console.log("");
    });
};
