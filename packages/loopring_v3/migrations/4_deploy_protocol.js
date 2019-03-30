var LRCToken = artifacts.require("./test/tokens/LRC.sol");
var WETHToken = artifacts.require("./test/tokens/WETH.sol");
var ExchangeDeployer = artifacts.require("./impl/ExchangeDeployer");
var BlockVerifier = artifacts.require("./impl/BlockVerifier.sol");
var LoopringV3 = artifacts.require("./impl/LoopringV3.sol");
var BurnManager = artifacts.require("./impl/BurnManager");
var ExchangeAccounts = artifacts.require("./impl/libexchange/ExchangeAccounts");
var ExchangeAdmins = artifacts.require("./impl/libexchange/ExchangeAdmins");
var ExchangeBalances = artifacts.require("./impl/libexchange/ExchangeBalances");
var ExchangeBlocks = artifacts.require("./impl/libexchange/ExchangeBlocks");
var ExchangeData = artifacts.require("./impl/libexchange/ExchangeData");
var ExchangeDeposits = artifacts.require("./impl/libexchange/ExchangeDeposits");
var ExchangeGenesis = artifacts.require("./impl/libexchange/ExchangeGenesis");
var ExchangeTokens = artifacts.require("./impl/libexchange/ExchangeTokens");
var ExchangeWithdrawals = artifacts.require("./impl/libexchange/ExchangeWithdrawals");

module.exports = function(deployer, network, accounts) {
  if (network === "live") {
    // ignore.
  } else {
    deployer.then(() => {
      return Promise.all([
        deployer.deploy(ExchangeData),
        deployer.deploy(ExchangeBalances),
        LRCToken.deployed(),
        WETHToken.deployed(),
      ]);
    }).then(() => {
      return Promise.all([
        deployer.link(ExchangeData, [ExchangeAccounts, ExchangeAdmins, ExchangeBlocks,
                                     ExchangeDeposits, ExchangeTokens, ExchangeGenesis,
                                     ExchangeWithdrawals]),
        deployer.link(ExchangeBalances, ExchangeAccounts),
      ]);
    }).then(() => {
      return Promise.all([
        deployer.deploy(ExchangeTokens),
      ]);
    }).then(() => {
      return Promise.all([
        deployer.link(ExchangeTokens, [ExchangeDeposits, ExchangeGenesis, ExchangeWithdrawals]),
      ]);
    }).then(() => {
      return Promise.all([
        deployer.deploy(ExchangeAccounts),
        deployer.deploy(ExchangeAdmins),
        deployer.deploy(ExchangeBlocks),
        deployer.deploy(ExchangeDeposits),
        deployer.deploy(ExchangeGenesis),
        deployer.deploy(ExchangeWithdrawals),
      ]);
    }).then(() => {
      return Promise.all([
        deployer.link(ExchangeAccounts, ExchangeDeployer),
        deployer.link(ExchangeAdmins, ExchangeDeployer),
        deployer.link(ExchangeBalances, ExchangeDeployer),
        deployer.link(ExchangeBlocks, ExchangeDeployer),
        deployer.link(ExchangeData, ExchangeDeployer),
        deployer.link(ExchangeDeposits, ExchangeDeployer),
        deployer.link(ExchangeGenesis, ExchangeDeployer),
        deployer.link(ExchangeTokens, ExchangeDeployer),
        deployer.link(ExchangeWithdrawals, ExchangeDeployer),
      ]);
    }).then(() => {
      return Promise.all([
        deployer.deploy(ExchangeDeployer),
        deployer.deploy(BlockVerifier),
      ]);
    }).then(() => {
      return Promise.all([
        deployer.deploy(LoopringV3),
      ]);
    }).then(() => {
      return Promise.all([
        deployer.deploy(
          BurnManager,
          LoopringV3.address,
          LRCToken.address,
        ),
      ]);
    });
  }
};
