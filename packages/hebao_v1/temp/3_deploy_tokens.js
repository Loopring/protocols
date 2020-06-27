// Deploy tokens for testing purposes
const GTOToken = artifacts.require("./test/tokens/GTO.sol");
const INDAToken = artifacts.require("./test/tokens/INDA.sol");
const INDBToken = artifacts.require("./test/tokens/INDB.sol");
const LRCToken = artifacts.require("./test/tokens/LRC.sol");
const RDNToken = artifacts.require("./test/tokens/RDN.sol");
const REPToken = artifacts.require("./test/tokens/REP.sol");
const WETHToken = artifacts.require("./test/tokens/WETH.sol");

module.exports = function(deployer, network, accounts) {
  if (
    network != "live" &&
    network != "live-fork" &&
    network != "goerli" &&
    network != "goerli-fork"
  ) {
    deployer.deploy(GTOToken);
    deployer.deploy(INDAToken);
    deployer.deploy(INDBToken);
    deployer.deploy(LRCToken);
    deployer.deploy(RDNToken);
    deployer.deploy(REPToken);
    deployer.deploy(WETHToken);
  }
};
