var LRCToken = artifacts.require("./test/tokens/LRC.sol");

var ProtocolRegistry = artifacts.require("./impl/ProtocolRegistry");

module.exports = function(deployer, network, accounts) {
  if (network === "live") {
    // ignore.
    // TODO(kongliang): we should deploy on mainnet using scripts written here.
  } else {
    deployer
      .then(() => {
        return Promise.all([LRCToken.deployed()]);
      })
      .then(() => {
        return Promise.all([
          deployer.deploy(ProtocolRegistry, LRCToken.address)
        ]);
      })
      .then(() => {
        console.log(">>>>>>>> Deployed contracts addresses (deploy_registry):");
        console.log("ProtocolRegistry:", ProtocolRegistry.address);
        console.log("");
      });
  }
};
