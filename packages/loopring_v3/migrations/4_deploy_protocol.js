var LRCToken = artifacts.require("./test/tokens/LRC.sol");
var WETHToken = artifacts.require("./test/tokens/WETH.sol");
var ExchangeV3Deployer = artifacts.require("./impl/ExchangeV3Deployer");
var BlockVerifier = artifacts.require("./impl/BlockVerifier.sol");
var PrototolRegistry = artifacts.require("./impl/ProtocolRegistry");
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
          deployer.link(ExchangeAccounts, ExchangeV3Deployer),
          deployer.link(ExchangeAdmins, ExchangeV3Deployer),
          deployer.link(ExchangeBalances, ExchangeV3Deployer),
          deployer.link(ExchangeBlocks, ExchangeV3Deployer),
          deployer.link(ExchangeData, ExchangeV3Deployer),
          deployer.link(ExchangeDeposits, ExchangeV3Deployer),
          deployer.link(ExchangeGenesis, ExchangeV3Deployer),
          deployer.link(ExchangeTokens, ExchangeV3Deployer),
          deployer.link(ExchangeWithdrawals, ExchangeV3Deployer)
        ]);
      })
      .then(() => {
        return Promise.all([
          deployer.deploy(ExchangeV3Deployer),
          deployer.deploy(BlockVerifier)
        ]);
      })
      .then(() => {
        return Promise.all([deployer.link(ExchangeV3Deployer, LoopringV3)]);
      })
      .then(() => {
        return Promise.all([
          deployer.deploy(
            LoopringV3,
            accounts[0],
            LRCToken.address,
            WETHToken.address,
            BlockVerifier.address,
            0,
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
        return Promise.all([deployer.deploy(ProtocolRegistry)]);
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
        console.log("ProtocolRegistry:", ProtocolRegistry.address);
        console.log("LoopringV3:", LoopringV3.address);
        console.log("BlockVerifier:", BlockVerifier.address);
        console.log("WETHToken:", WETHToken.address);
        console.log("LRCToken:", LRCToken.address);
      });
  }
};
