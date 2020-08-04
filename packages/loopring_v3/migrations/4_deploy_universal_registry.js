// Deploy UniversalRegistry

var lrcAddress = "0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD";

module.exports = function(deployer, network, accounts) {
  console.log("deploying to network: " + network);
  var deployer_ = deployer;

  if (network != "live" && network != "live-fork") {
    const LRCToken = artifacts.require("./test/tokens/LRC.sol");
    const WETHToken = artifacts.require("./test/tokens/WETH.sol");

    deployer_.then(() => {
      return Promise.all([
        LRCToken.deployed().then(c => {
          lrcAddress = c.address;
        })
      ]);
    });
  }

  // common deployment

  const UniversalRegistry = artifacts.require("UniversalRegistry");

  deployer_
    .then(() => {
      return Promise.all([deployer.deploy(UniversalRegistry, lrcAddress)]);
    })
    .then(() => {
      console.log(">>>>>>>> contracts deployed by deploy_registry:");
      console.log("lrcAddress:", lrcAddress);
      console.log("UniversalRegistry:", UniversalRegistry.address);
      console.log("");
    });
};
