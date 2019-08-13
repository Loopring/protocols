// Deploy ProtocolRegistry

var LRCToken = artifacts.require("./test/tokens/LRC.sol");
var ProtocolRegistry = artifacts.require("./impl/ProtocolRegistry");

module.exports = function(deployer, network, accounts) {
  if (network === "live") {
    const LRCTokenAddress = "0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD";
    deployer

      .then(() => {
        return Promise.all([
          deployer.deploy(ProtocolRegistry, LRCTokenAddress)
        ]);
      })
      .then(() => {
        console.log(">>>>>>>> contracts deployed by deploy_registry:");
        console.log("ProtocolRegistry:", ProtocolRegistry.address);
        console.log("");
      });
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
        console.log(">>>>>>>> contracts deployed by deploy_registry:");
        console.log("LRCToken:", LRCToken.address);
        console.log("ProtocolRegistry:", ProtocolRegistry.address);
        console.log("");
      });
  }
};
