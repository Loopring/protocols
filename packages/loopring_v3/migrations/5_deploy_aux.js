var AddressUtil = artifacts.require("./lib/LRC.sol");
var ERC20SafeTransfer = artifacts.require("./lib/ERC20SafeTransfer.sol");
var MathUint = artifacts.require("./lib/MathUint.sol");

var LRCToken = artifacts.require("./test/tokens/LRC.sol");
var ExchangeV3Deployer = artifacts.require("./impl/ExchangeV3Deployer");
var BlockVerifier = artifacts.require("./impl/BlockVerifier.sol");
var DowntimeCostCalculator = artifacts.require(
  "./test/DowntimeCostCalculator.sol"
);
var UserStakingPool = artifacts.require("./impl/UserStakingPool");
var ProtocolFeeVault = artifacts.require("./impl/ProtocolFeeVault");

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
        return Promise.all([LRCToken.deployed()]);
      })
      .then(() => {
        return Promise.all([
          deployer.deploy(BlockVerifier),
          deployer.deploy(DowntimeCostCalculator),
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
        console.log("DowntimeCostCalculator:", DowntimeCostCalculator.address);
        console.log("UserStakingPool:", UserStakingPool.address);
        console.log("ProtocolFeeVault:", ProtocolFeeVault.address);
      });
  }
};
