// Deploy tokens for testing purposes

module.exports = function(deployer, network, accounts) {
  console.log("deploying to network: " + network);

  if (
    network != "live" &&
    network != "live-fork" &&
    network != "goerli" &&
    network != "goerli-fork"
  ) {
    const LRCToken = artifacts.require("./test/tokens/LRC.sol");
    const GTOToken = artifacts.require("./test/tokens/GTO.sol");
    const RDNToken = artifacts.require("./test/tokens/RDN.sol");
    const REPToken = artifacts.require("./test/tokens/REP.sol");
    const WETHToken = artifacts.require("./test/tokens/WETH.sol");
    const INDAToken = artifacts.require("./test/tokens/INDA.sol");
    const INDBToken = artifacts.require("./test/tokens/INDB.sol");

    deployer.deploy(LRCToken);
    deployer.deploy(GTOToken);
    deployer.deploy(RDNToken);
    deployer.deploy(REPToken);
    deployer.deploy(WETHToken);
    deployer.deploy(INDAToken);
    deployer.deploy(INDBToken);
  }
};
