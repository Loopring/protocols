// Deploy ProtocolRegistry

var lrcAddress = "0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD";
// var wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
// var protocolFeeValutAddress = "0xa8b6A3EFBcdd578154a913F33dc9949808B7A9f4";

module.exports = function(deployer, network, accounts) {
  var deployer_ = deployer;

  if (network !== "live") {
    const LRCToken = artifacts.require("./test/tokens/LRC.sol");

    deployer_.then(() => {
      return Promise.all([
        LRCToken.deployed().then(addr => {
          lrcAddress = addr;
        })
      ]);
    });
  }

  const ProtocolRegistry = artifacts.require("./impl/ProtocolRegistry");

  deployer_
    .then(() => {
      return Promise.all([deployer.deploy(ProtocolRegistry, lrcAddress)]);
    })
    .then(() => {
      console.log(">>>>>>>> contracts deployed by deploy_registry:");
      console.log("LRCToken:", lrcAddress);
      console.log("ProtocolRegistry:", ProtocolRegistry.address);
      console.log("");
    });
};
