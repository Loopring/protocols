var LRCToken                = artifacts.require("./test/tokens/LRC.sol");
var GTOToken                = artifacts.require("./test/tokens/GTO.sol");
var RDNToken                = artifacts.require("./test/tokens/RDN.sol");
var REPToken                = artifacts.require("./test/tokens/REP.sol");
var WETHToken                = artifacts.require("./test/tokens/WETH.sol");

module.exports = function(deployer, network, accounts) {
  if (network === "live") {
    // ignore
  } else {
    deployer.deploy(LRCToken);
    deployer.deploy(GTOToken);
    deployer.deploy(RDNToken);
    deployer.deploy(REPToken);
    deployer.deploy(WETHToken);
  }

};
