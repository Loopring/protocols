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
  deployer.then(async () => {
    await deployer.deploy(ExchangeBalances);
    await deployer.link(ExchangeBalances, [ExchangeWithdrawals]);
    await deployer.deploy(ExchangeAdmins);
    await deployer.deploy(ExchangeTokens);
    await deployer.link(ExchangeTokens, [
      ExchangeDeposits,
      ExchangeGenesis,
      ExchangeWithdrawals
    ]);
    await deployer.deploy(ExchangeWithdrawals);
    await deployer.link(ExchangeWithdrawals, [ExchangeBlocks]);
    await deployer.deploy(ExchangeBlocks);
    await deployer.deploy(ExchangeGenesis);
    await deployer.deploy(ExchangeDeposits);
  });
};
