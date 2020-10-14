// Deploy tokens for testing purposes

const LRCToken = artifacts.require("./test/tokens/LRC.sol");
const GTOToken = artifacts.require("./test/tokens/GTO.sol");
const RDNToken = artifacts.require("./test/tokens/RDN.sol");
const REPToken = artifacts.require("./test/tokens/REP.sol");
const WETHToken = artifacts.require("./test/tokens/WETH.sol");
const TESTToken = artifacts.require("./test/tokens/TEST.sol");
const INDAToken = artifacts.require("./test/tokens/INDA.sol");
const INDBToken = artifacts.require("./test/tokens/INDB.sol");

module.exports = function(deployer, network, accounts) {
  if (network != "live" && network != "live-fork") {
    deployer.then(async () => {
      await deployer.deploy(LRCToken);
      await deployer.deploy(GTOToken);
      await deployer.deploy(RDNToken);
      await deployer.deploy(REPToken);
      await deployer.deploy(WETHToken);
      await deployer.deploy(TESTToken);
      await deployer.deploy(INDAToken);
      await deployer.deploy(INDBToken);
    });
  }
};
