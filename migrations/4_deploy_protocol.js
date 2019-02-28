var LRCToken = artifacts.require("./test/tokens/LRC.sol");
var TokenRegistry = artifacts.require("./impl/TokenRegistry.sol");
var BlockVerifier = artifacts.require("./impl/BlockVerifier.sol");
var Exchange = artifacts.require("./impl/Exchange");
var BurnManager = artifacts.require("./impl/BurnManager");

module.exports = function(deployer, network, accounts) {
  if (network === "live") {
    // ignore.
  } else {
    deployer.then(() => {
      return Promise.all([
        LRCToken.deployed(),
      ]);
    }).then(() => {
      return Promise.all([
        deployer.deploy(
          TokenRegistry,
          LRCToken.address,
        ),
        deployer.deploy(BlockVerifier),
      ]);
    }).then(() => {
      return Promise.all([
        deployer.deploy(
          Exchange,
          TokenRegistry.address,
          BlockVerifier.address,
          LRCToken.address,
        ),
      ]);
    }).then(() => {
      return Promise.all([
        deployer.deploy(
          BurnManager,
          Exchange.address,
          LRCToken.address,
        ),
      ]);
    });
  }
};
