// Deploy the ExchangeV3 library which is very large in terms of
// gas usage. We need to deploy most libraries linked from it as stand-alone
// libraries, otherwise we'll run into the 'exceeded block gas limit' issue.

const ExchangeAdmins = artifacts.require(
  "./impl/libexchange/ExchangeAdmins.sol"
);
const ExchangeBalances = artifacts.require(
  "./impl/libexchange/ExchangeBalances.sol"
);
const ExchangeBlocks = artifacts.require(
  "./impl/libexchange/ExchangeBlocks.sol"
);
const ExchangeDeposits = artifacts.require(
  "./impl/libexchange/ExchangeDeposits.sol"
);
const ExchangeGenesis = artifacts.require(
  "./impl/libexchange/ExchangeGenesis.sol"
);
const ExchangeTokens = artifacts.require(
  "./impl/libexchange/ExchangeTokens.sol"
);
const ExchangeWithdrawals = artifacts.require(
  "./impl/libexchange/ExchangeWithdrawals.sol"
);
const Cloneable = artifacts.require("./thirdparty/Cloneable.sol");
const ExchangeV3 = artifacts.require("./impl/ExchangeV3.sol");

module.exports = function(deployer, network, accounts) {
  console.log("deploying to network: " + network);
  deployer
    .then(() => {
      return Promise.all([
        ExchangeBalances.deployed(),
        ExchangeAdmins.deployed(),
        ExchangeBlocks.deployed(),
        ExchangeTokens.deployed(),
        ExchangeGenesis.deployed(),
        ExchangeDeposits.deployed(),
        ExchangeWithdrawals.deployed(),
        Cloneable.deployed()
      ]);
    })
    .then(() => {
      return Promise.all([
        deployer.link(ExchangeBalances, ExchangeV3),
        deployer.link(ExchangeAdmins, ExchangeV3),
        deployer.link(ExchangeBlocks, ExchangeV3),
        deployer.link(ExchangeTokens, ExchangeV3),
        deployer.link(ExchangeGenesis, ExchangeV3),
        deployer.link(ExchangeDeposits, ExchangeV3),
        deployer.link(ExchangeWithdrawals, ExchangeV3),
        deployer.link(Cloneable, ExchangeV3)
      ]);
    })
    .then(() => {
      return Promise.all([deployer.deploy(ExchangeV3, { gas: 6700000 })]);
    })
    .then(() => {
      console.log(">>>>>>>> contracts deployed by deploy_exchange_v3:");
      console.log("ExchangeV3:", ExchangeV3.address);
      console.log("");
    });
};
