// Deploy the ExchangeV3 library which is very large in terms of
// gas usage. We need to deploy most libraries linked from it as stand-alone
// libraries, otherwise we'll run into the 'exceeded block gas limit' issue.

const ExchangeConstants = artifacts.require(
  "./impl/libexchange/ExchangeConstants.sol"
);
const ExchangeAccounts = artifacts.require(
  "./impl/libexchange/ExchangeAccounts.sol"
);
const ExchangeAdmins = artifacts.require("./impl/libexchange/ExchangeAdmins.sol");
const ExchangeBalances = artifacts.require(
  "./impl/libexchange/ExchangeBalances.sol"
);
const ExchangeBlocks = artifacts.require("./impl/libexchange/ExchangeBlocks.sol");
const ExchangeDeposits = artifacts.require(
  "./impl/libexchange/ExchangeDeposits.sol"
);
const ExchangeGenesis = artifacts.require("./impl/libexchange/ExchangeGenesis.sol");
const ExchangeTokens = artifacts.require("./impl/libexchange/ExchangeTokens.sol");
const ExchangeWithdrawals = artifacts.require(
  "./impl/libexchange/ExchangeWithdrawals.sol"
);
const ExchangeV3 = artifacts.require("./impl/ExchangeV3.sol");

module.exports = function(deployer, network, accounts) {
  console.log("deploying to network: " + network);
  var deployer_ = deployer;

  if (network != "live") {
    deployer_ = deployer_
      .then(() => {
        return Promise.all([
          deployer.deploy(ExchangeConstants) // only for testing purpose
        ]);
      })
  }

  deployer_
    .then(() => {
      return Promise.all([
        deployer.deploy(ExchangeBalances)
      ]);
    })
    .then(() => {
      return Promise.all([
        deployer.link(ExchangeBalances, [ExchangeAccounts, ExchangeWithdrawals])
      ]);
    })
    .then(() => {
      return Promise.all([
        deployer.deploy(ExchangeAccounts)
      ]);
    })
    .then(() => {
      return Promise.all([
        deployer.link(ExchangeAccounts, [
          ExchangeDeposits,
          ExchangeGenesis,
          ExchangeWithdrawals
        ])
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
        deployer.link(ExchangeTokens, [
          ExchangeDeposits,
          ExchangeGenesis,
          ExchangeWithdrawals
        ])
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
      console.log(">>>>>>>> contracts deployed by deploy_exchange_v3_libs:");
      console.log("ExchangeConstants: ", ExchangeConstants.address);
      console.log("ExchangeBalances: ", ExchangeBalances.address);
      console.log("ExchangeAccounts: ", ExchangeAccounts.address);
      console.log("ExchangeAdmins: ", ExchangeAdmins.address);
      console.log("ExchangeBlocks: ", ExchangeBlocks.address);
      console.log("ExchangeTokens: ", ExchangeTokens.address);
      console.log("ExchangeGenesis: ", ExchangeGenesis.address);
      console.log("ExchangeDeposits: ", ExchangeDeposits.address);
      console.log("ExchangeWithdrawals: ", ExchangeWithdrawals.address);
    });
};
