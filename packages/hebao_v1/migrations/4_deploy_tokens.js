// Deploy tokens for testing purposes
const GTOToken = artifacts.require("GTO");
const INDAToken = artifacts.require("INDA");
const INDBToken = artifacts.require("INDB");
const LRCToken = artifacts.require("LRC");
const RDNToken = artifacts.require("RDN");
const REPToken = artifacts.require("REP");
const WETHToken = artifacts.require("WETH");

module.exports = function(deployer, network, accounts) {
  if (
    network != "live" &&
    network != "live-fork" &&
    network != "goerli" &&
    network != "goerli-fork"
  ) {
    deployer.then(async () => {
      await deployer.deploy(GTOToken);
      await deployer.deploy(INDAToken);
      await deployer.deploy(INDBToken);
      await deployer.deploy(LRCToken);
      await deployer.deploy(RDNToken);
      await deployer.deploy(REPToken);
      await deployer.deploy(WETHToken);
    });
  }
};
