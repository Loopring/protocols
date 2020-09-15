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
const Cloneable = artifacts.require("./thirdparty/Cloneable.sol");
const ExchangeV3 = artifacts.require("./impl/ExchangeV3.sol");

module.exports = function(deployer, network, accounts) {
  deployer.then(async () => {
    await deployer.link(ExchangeBalances, ExchangeV3);
    await deployer.link(ExchangeAdmins, ExchangeV3);
    await deployer.link(ExchangeBlocks, ExchangeV3);
    await deployer.link(ExchangeTokens, ExchangeV3);
    await deployer.link(ExchangeGenesis, ExchangeV3);
    await deployer.link(ExchangeDeposits, ExchangeV3);
    await deployer.link(ExchangeWithdrawals, ExchangeV3);
    await deployer.link(Cloneable, ExchangeV3);

    await deployer.deploy(ExchangeV3, { gas: 6700000 });
  });
};
