// Deploy tokens for testing purposes

module.exports = function(deployer, network, accounts) {
  console.log("   > deploying to network: " + network);

  if (network != "live") {
    const LRCToken = artifacts.require("./test/tokens/LRC");
    const GTOToken = artifacts.require("./test/tokens/GTO");
    const RDNToken = artifacts.require("./test/tokens/RDN");
    const REPToken = artifacts.require("./test/tokens/REP");
    const WETHToken = artifacts.require("./test/tokens/WETH");
    const TESTToken = artifacts.require("./test/tokens/TEST");
    const INDAToken = artifacts.require("./test/tokens/INDA");
    const INDBToken = artifacts.require("./test/tokens/INDB");

    deployer.deploy(LRCToken);
    deployer.deploy(GTOToken);
    deployer.deploy(RDNToken);
    deployer.deploy(REPToken);
    deployer.deploy(WETHToken);
    deployer.deploy(TESTToken);
    deployer.deploy(INDAToken);
    deployer.deploy(INDBToken);
  }
};
