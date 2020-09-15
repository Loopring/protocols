// Deploy UniversalRegistry
const LRCToken = artifacts.require("LRC");
const UniversalRegistry = artifacts.require("UniversalRegistry");

module.exports = function(deployer, network, accounts) {
  let lrcAddress = "0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD";

  if (network != "live" && network != "live-fork") {
    lrcAddress = LRCToken.address;
  }

  deployer.then(async () => {
    await deployer.deploy(UniversalRegistry, lrcAddress);
  });
};
