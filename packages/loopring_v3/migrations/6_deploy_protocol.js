var AddressUtil = artifacts.require("./lib/LRC.sol");
var ERC20SafeTransfer = artifacts.require("./lib/ERC20SafeTransfer.sol");
var MathUint = artifacts.require("./lib/MathUint.sol");

var LRCToken = artifacts.require("./test/tokens/LRC.sol");
var WETHToken = artifacts.require("./test/tokens/WETH.sol");
var ExchangeV3Deployer = artifacts.require("./impl/ExchangeV3Deployer");
var BlockVerifier = artifacts.require("./impl/BlockVerifier.sol");
var FixPriceDowntimeCostCalculator = artifacts.require(
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
          AddressUtil.deployed(),
          ERC20SafeTransfer.deployed(),
          MathUint.deployed()
        ]);
      })
      .then(() => {
        return Promise.all([
          LRCToken.deployed(),
          WETHToken.deployed(),
          ProtocolFeeVault.deployed(),
          BlockVerifier.deployed(),
          FixPriceDowntimeCostCalculator.deployed(),
          ExchangeV3Deployer.deployed()
        ]);
      })
      .then(() => {
        return Promise.all([
          deployer.link(AddressUtil, LoopringV3),
          deployer.link(ERC20SafeTransfer, LoopringV3),
          deployer.link(MathUint, LoopringV3),
          deployer.link(ExchangeV3Deployer, LoopringV3)
        ]);
      })
      .then(() => {
        return Promise.all([
          deployer.deploy(
            LoopringV3,
            LRCToken.address,
            WETHToken.address,
            ProtocolFeeVault.address,
            BlockVerifier.address,
            FixPriceDowntimeCostCalculator.address
          )
        ]);
      })
      .then(() => {
        console.log(">>>>>>>> Deployed contracts addresses (deploy_protocol):");
        console.log("LoopringV3:", LoopringV3.address);
        console.log("");
      });
  }
};
