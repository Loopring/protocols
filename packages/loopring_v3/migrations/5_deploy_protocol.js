var LRCToken = artifacts.require("./test/tokens/LRC.sol");
var WETHToken = artifacts.require("./test/tokens/WETH.sol");
var ExchangeV3Deployer = artifacts.require("./impl/ExchangeV3Deployer");
var BlockVerifier = artifacts.require("./impl/BlockVerifier.sol");
var DowntimeCostCalculator = artifacts.require(
  "./test/DowntimeCostCalculator.sol"
);
var ProtocolFeeVault = artifacts.require("./impl/ProtocolFeeVault");
var LoopringV3 = artifacts.require("./impl/LoopringV3.sol");

module.exports = function(deployer, network, accounts) {
  if (network === "live") {
    // ignore.
    // TODO(kongliang): we should deploy on mainnet using scripts written here.
  } else {
    deployer
      .then(() => {
        return Promise.all([
          LRCToken.deployed(),
          WETHToken.deploy(),
          ProtocolFeeVault.deployed(),
          BlockVerifier.deployed(),
          DowntimeCostCalculator.deployed(),
          ExchangeV3Deployer.deployed()
        ]);
      })
      .then(() => {
        return Promise.all([deployer.link(ExchangeV3Deployer, LoopringV3)]);
      })
      .then(() => {
        return Promise.all([
          deployer.deploy(
            LoopringV3,
            LRCToken.address,
            WETHToken.address,
            ProtocolFeeVault.address,
            BlockVerifier.address,
            DowntimeCostCalculator.address
          )
        ]);
      })
      .then(() => {
        console.log(">>>>>>>> Deployed contracts addresses:");
        console.log("LoopringV3:", LoopringV3.address);
      });
  }
};
