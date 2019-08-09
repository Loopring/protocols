// Deploy all auxiliary contracts used by either Exchange, LoopringV3,
// or ProtocolRegistry.

var AddressUtil = artifacts.require("./lib/AddressUtil.sol");
var ERC20SafeTransfer = artifacts.require("./lib/ERC20SafeTransfer.sol");
var MathUint = artifacts.require("./lib/MathUint.sol");

var LRCToken = artifacts.require("./test/tokens/LRC.sol");
var ExchangeV3Deployer = artifacts.require("./impl/ExchangeV3Deployer");
var BlockVerifier = artifacts.require("./impl/BlockVerifier.sol");
var FixPriceDowntimeCostCalculator = artifacts.require(
  "./test/FixPriceDowntimeCostCalculator.sol"
);
var UserStakingPool = artifacts.require("./impl/UserStakingPool");
var ProtocolFeeVault = artifacts.require("./impl/ProtocolFeeVault");

module.exports = function(deployer, network, accounts) {
  if (network === "live") {
    // ignore.
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
        return Promise.all([LRCToken.deployed()]);
      })
      .then(() => {
        return Promise.all([
          deployer.deploy(BlockVerifier),
          deployer.deploy(FixPriceDowntimeCostCalculator),
          deployer.deploy(UserStakingPool, LRCToken.address)
        ]);
      })
      .then(() => {
        return Promise.all([
          deployer.link(AddressUtil, ProtocolFeeVault),
          deployer.link(ERC20SafeTransfer, ProtocolFeeVault),
          deployer.link(MathUint, ProtocolFeeVault)
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
        console.log(">>>>>>>> Deployed contracts addresses (deploy_aux):");
        console.log("BlockVerifier:", BlockVerifier.address);
        console.log(
          "FixPriceDowntimeCostCalculator:",
          FixPriceDowntimeCostCalculator.address
        );
        console.log("UserStakingPool:", UserStakingPool.address);
        console.log("ProtocolFeeVault:", ProtocolFeeVault.address);
        console.log("");
      });
  }
};
