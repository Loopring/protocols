var LRCToken = artifacts.require("./test/tokens/LRC.sol");
var WETHToken = artifacts.require("./test/tokens/WETH.sol");
var ExchangeDeployer = artifacts.require("./impl/ExchangeDeployer");
var BlockVerifier = artifacts.require("./impl/BlockVerifier.sol");
var DowntimeCostCalculator = artifacts.require(
  "./test/DowntimeCostCalculator.sol"
);
var LoopringV3 = artifacts.require("./impl/LoopringV3.sol");
var ExchangeAccounts = artifacts.require("./impl/libexchange/ExchangeAccounts");
var ExchangeAdmins = artifacts.require("./impl/libexchange/ExchangeAdmins");
var ExchangeBalances = artifacts.require("./impl/libexchange/ExchangeBalances");
var ExchangeBlocks = artifacts.require("./impl/libexchange/ExchangeBlocks");
var ExchangeData = artifacts.require("./impl/libexchange/ExchangeData");
var ExchangeDeposits = artifacts.require("./impl/libexchange/ExchangeDeposits");
var ExchangeGenesis = artifacts.require("./impl/libexchange/ExchangeGenesis");
var ExchangeTokens = artifacts.require("./impl/libexchange/ExchangeTokens");
var ExchangeWithdrawals = artifacts.require(
  "./impl/libexchange/ExchangeWithdrawals"
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
          deployer.deploy(ExchangeData),
          deployer.deploy(ExchangeBalances),
          LRCToken.deployed(),
          WETHToken.deployed()
        ]);
      })
      .then(() => {
        return Promise.all([
          deployer.link(ExchangeData, [
            ExchangeAccounts,
            ExchangeAdmins,
            ExchangeBlocks,
            ExchangeDeposits,
            ExchangeTokens,
            ExchangeGenesis,
            ExchangeWithdrawals
          ]),
          deployer.link(ExchangeBalances, [
            ExchangeAccounts,
            ExchangeWithdrawals
          ])
        ]);
      })
      .then(() => {
        return Promise.all([deployer.deploy(ExchangeTokens)]);
      })
      .then(() => {
        return Promise.all([
          deployer.link(ExchangeTokens, [
            ExchangeDeposits,
            ExchangeGenesis,
            ExchangeWithdrawals
          ])
        ]);
      })
      .then(() => {
        return Promise.all([
          deployer.deploy(ExchangeAccounts),
          deployer.deploy(ExchangeAdmins),
          deployer.deploy(ExchangeBlocks),
          deployer.deploy(ExchangeDeposits),
          deployer.deploy(ExchangeGenesis),
          deployer.deploy(ExchangeWithdrawals)
        ]);
      })
      .then(() => {
        return Promise.all([
          deployer.link(ExchangeAccounts, ExchangeDeployer),
          deployer.link(ExchangeAdmins, ExchangeDeployer),
          deployer.link(ExchangeBalances, ExchangeDeployer),
          deployer.link(ExchangeBlocks, ExchangeDeployer),
          deployer.link(ExchangeData, ExchangeDeployer),
          deployer.link(ExchangeDeposits, ExchangeDeployer),
          deployer.link(ExchangeGenesis, ExchangeDeployer),
          deployer.link(ExchangeTokens, ExchangeDeployer),
          deployer.link(ExchangeWithdrawals, ExchangeDeployer)
        ]);
      })
      .then(() => {
        return Promise.all([
          deployer.deploy(ExchangeDeployer),
          deployer.deploy(BlockVerifier),
          deployer.deploy(DowntimeCostCalculator, 60000, 2, 1000, 120000, 500)
        ]);
      })
      .then(() => {
        return Promise.all([deployer.link(ExchangeDeployer, LoopringV3)]);
      })
      .then(() => {
        return Promise.all([
          deployer.deploy(
            LoopringV3,
            accounts[0],
            LRCToken.address,
            WETHToken.address,
            BlockVerifier.address,
            DowntimeCostCalculator.address,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0
          )
        ]);
      })
      .then(() => {
        return Promise.all([
          deployer.deploy(UserStakingPool, LRCToken.address)
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
        console.log("Deployed contracts addresses:");
        console.log("LoopringV3:", LoopringV3.address);
        console.log("BlockVerifier:", BlockVerifier.address);
        console.log("DowntimeCostCalculator:", DowntimeCostCalculator.address);
        console.log("WETHToken:", WETHToken.address);
        console.log("LRCToken:", LRCToken.address);
      });
  }
};
