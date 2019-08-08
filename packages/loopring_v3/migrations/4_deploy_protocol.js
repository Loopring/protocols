var LRCToken = artifacts.require("./test/tokens/LRC.sol");
var WETHToken = artifacts.require("./test/tokens/WETH.sol");
var ExchangeV3Deployer = artifacts.require("./impl/ExchangeV3Deployer");
var ExchangeProxy = artifacts.require("./impl/ExchangeProxy");
var BlockVerifier = artifacts.require("./impl/BlockVerifier.sol");
var ProtocolRegistry = artifacts.require("./impl/ProtocolRegistry");
var LoopringV3 = artifacts.require("./impl/LoopringV3.sol");
var ExchangeAccounts = artifacts.require("./impl/libexchange/ExchangeAccounts");
var ExchangeAdmins = artifacts.require("./impl/libexchange/ExchangeAdmins");
var ExchangeBalances = artifacts.require("./impl/libexchange/ExchangeBalances");
var ExchangeBlocks = artifacts.require("./impl/libexchange/ExchangeBlocks");
var ExchangeData = artifacts.require("./impl/libexchange/ExchangeData");
var ExchangeDeposits = artifacts.require("./impl/libexchange/ExchangeDeposits");
var ExchangeGenesis = artifacts.require("./impl/libexchange/ExchangeGenesis");
var ExchangeMode = artifacts.require("./impl/libexchange/ExchangeMode");
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
        return Promise.all([LRCToken.deployed(), WETHToken.deployed()]);
      })
      .then(() => {
        return Promise.all([
          deployer.deploy(ExchangeData),
          deployer.deploy(ExchangeBalances)
        ]);
      })
      .then(() => {
        return Promise.all([
          deployer.link(ExchangeData, [
            ExchangeAccounts,
            ExchangeMode,
            ExchangeAccounts,
            ExchangeAdmins,
            ExchangeBlocks,
            ExchangeTokens,
            ExchangeGenesis,
            ExchangeDeposits,
            ExchangeWithdrawals
          ])
        ]);
      })
      .then(() => {
        return Promise.all([
          deployer.link(ExchangeBalances, [
            ExchangeAccounts,
            ExchangeWithdrawals
          ])
        ]);
      })
      .then(() => {
        return Promise.all([
          deployer.deploy(ExchangeMode),
          deployer.deploy(ExchangeAccounts)
        ]);
      })
      .then(() => {
        return Promise.all([
          deployer.link(ExchangeMode, [
            ExchangeAdmins,
            ExchangeBlocks,
            ExchangeTokens,
            ExchangeDeposits,
            ExchangeWithdrawals
          ]),
          deployer.link(ExchangeAccounts, ExchangeGenesis)
        ]);
      })
      .then(() => {
        return Promise.all([
          deployer.deploy(ExchangeAdmins),
          deployer.deploy(ExchangeBlocks),
          deployer.deploy(ExchangeTokens)
        ]);
      })
      .then(() => {
        return Promise.all([
          deployer.link(ExchangeTokens, ExchangeGenesis),
          deployer.link(ExchangeTokens, ExchangeDeposits),
          deployer.link(ExchangeTokens, ExchangeWithdrawals)
        ]);
      })
      .then(() => {
        return Promise.all([
          deployer.deploy(ExchangeGenesis),
          deployer.deploy(ExchangeDeposits),
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
          deployer.link(ExchangeMode, ExchangeV3Deployer),
          deployer.link(ExchangeTokens, ExchangeV3Deployer),
          deployer.link(ExchangeWithdrawals, ExchangeV3Deployer)
        ]);
      })
      .then(() => {
        return Promise.all([
          deployer.deploy(ExchangeV3Deployer),
          deployer.deploy(BlockVerifier),
          deployer.deploy(ProtocolRegistry),
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
        return Promise.all([deployer.link(ExchangeV3Deployer, LoopringV3)]);
      })
      .then(() => {
        return Promise.all([
          deployer.deploy(
            LoopringV3,
            LRCToken.address,
            WETHToken.address,
            ProtocolFeeVault.address,
            BlockVerifier.address
          )
        ]);
      })
      .then(() => {
        console.log(">>>>>>>> Deployed contracts addresses: >>>>>>>>");
        console.log("WETHToken:", WETHToken.address);
        console.log("LRCToken:", LRCToken.address);
        console.log("UserStakingPool:", UserStakingPool.address);
        console.log("ProtocolFeeVault:", ProtocolFeeVault.address);
        console.log("BlockVerifier:", BlockVerifier.address);
        console.log("ExchangeV3Deployer:", ExchangeV3Deployer.address);
        console.log("ProtocolRegistry:", ProtocolRegistry.address);
        console.log("LoopringV3:", LoopringV3.address);
      });
  }
};
