// Deploy UniversalRegistry

var lrcAddress = "0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD";
var wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

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
        }),
        WETHToken.deployed().then(c => {
          wethAddress = c.address;
        })
      ]);
    });
  }

  // common deployment

  const UniversalRegistry = artifacts.require("./impl/UniversalRegistry.sol");

  deployer_
    .then(() => {
      return Promise.all([deployer.deploy(UniversalRegistry, lrcAddress)]);
    })
    .then(() => {
      console.log(">>>>>>>> contracts deployed by deploy_registry:");
      console.log("lrcAddress:", lrcAddress);
      console.log("wethAddress:", wethAddress);
      console.log("UniversalRegistry:", UniversalRegistry.address);
      console.log("");
    });
};
