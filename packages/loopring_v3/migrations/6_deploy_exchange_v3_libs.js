// Deploy the ExchangeV3 library which is very large in terms of
// gas usage. We need to deploy most libraries linked from it as stand-alone
// libraries, otherwise we'll run into the 'exceeded block gas limit' issue.

const ExchangeAdmins = artifacts.require("ExchangeAdmins");
const ExchangeBalances = artifacts.require("ExchangeBalances");
const ExchangeBlocks = artifacts.require("ExchangeBlocks");
const ExchangeDeposits = artifacts.require("ExchangeDeposits");
const ExchangeGenesis = artifacts.require("ExchangeGenesis");
const ExchangeTokens = artifacts.require("ExchangeTokens");
const ExchangeWithdrawals = artifacts.require("ExchangeWithdrawals");

module.exports = function(deployer, network, accounts) {
  console.log("deploying to network: " + network);
  deployer
    .then(() => {
      return Promise.all([deployer.deploy(ExchangeBalances)]);
    })
    .then(() => {
      return Promise.all([
        deployer.link(ExchangeBalances, [ExchangeWithdrawals])
      ]);
    })
    .then(() => {
      return Promise.all([
        deployer.deploy(ExchangeAdmins),
        deployer.deploy(ExchangeTokens)
      ]);
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
      return Promise.all([deployer.deploy(ExchangeWithdrawals)]);
    })
    .then(() => {
      return Promise.all([
        deployer.link(ExchangeWithdrawals, [ExchangeBlocks])
      ]);
    })
    .then(() => {
      return Promise.all([
        deployer.deploy(ExchangeBlocks),
        deployer.deploy(ExchangeGenesis),
        deployer.deploy(ExchangeDeposits)
      ]);
    })
    .then(() => {
      console.log(">>>>>>>> contracts deployed by deploy_exchange_v3_libs:");
      console.log("ExchangeBalances: ", ExchangeBalances.address);
      console.log("ExchangeAdmins: ", ExchangeAdmins.address);
      console.log("ExchangeBlocks: ", ExchangeBlocks.address);
      console.log("ExchangeTokens: ", ExchangeTokens.address);
      console.log("ExchangeGenesis: ", ExchangeGenesis.address);
      console.log("ExchangeDeposits: ", ExchangeDeposits.address);
      console.log("ExchangeWithdrawals: ", ExchangeWithdrawals.address);
    });
};
