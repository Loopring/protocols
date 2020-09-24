// Deploy the ExchangeV3 library which is very large in terms of
// gas usage. We need to deploy most libraries linked from it as stand-alone
// libraries, otherwise we'll run into the 'exceeded block gas limit' issue.

const AmmExitProcess = artifacts.require("AmmExitProcess");
const AmmJoinProcess = artifacts.require("AmmJoinProcess");
const AmmBlockReceiver = artifacts.require("AmmBlockReceiver");
const AmmExchange = artifacts.require("AmmExchange");
const AmmExitRequest = artifacts.require("AmmExitRequest");
const AmmJoinRequest = artifacts.require("AmmJoinRequest");
const AmmPoolToken = artifacts.require("AmmPoolToken");
const AmmStatus = artifacts.require("AmmStatus");
const LoopringAmmPool = artifacts.require("LoopringAmmPool");

module.exports = function(deployer, network, accounts) {
  deployer.then(async () => {
    await deployer.deploy(AmmExitProcess);
    await deployer.deploy(AmmJoinProcess);
    await deployer.link(AmmExitProcess, AmmBlockReceiver);
    await deployer.link(AmmJoinProcess, AmmBlockReceiver);

    await deployer.deploy(AmmBlockReceiver);
    await deployer.deploy(AmmExchange);

    await deployer.deploy(AmmStatus);
    await deployer.link(AmmStatus, AmmExitRequest);
    await deployer.deploy(AmmExitRequest);

    await deployer.deploy(AmmJoinRequest);
    await deployer.deploy(AmmPoolToken);

    await deployer.link(AmmBlockReceiver, LoopringAmmPool);
    await deployer.link(AmmExchange, LoopringAmmPool);
    await deployer.link(AmmExitRequest, LoopringAmmPool);
    await deployer.link(AmmJoinRequest, LoopringAmmPool);
    await deployer.link(AmmPoolToken, LoopringAmmPool);
    await deployer.link(AmmStatus, LoopringAmmPool);

    await deployer.deploy(LoopringAmmPool, { gas: 6700000 });
  });
};
