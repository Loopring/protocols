var LRCToken = artifacts.require("./test/tokens/LRC.sol");
var WETHToken = artifacts.require("./test/tokens/WETH.sol");
var ExchangeDeployer = artifacts.require("./impl/ExchangeDeployer");
var BlockVerifier = artifacts.require("./impl/BlockVerifier.sol");
var LoopringV3 = artifacts.require("./impl/LoopringV3.sol");
var BurnManager = artifacts.require("./impl/BurnManager");

module.exports = function(deployer, network, accounts) {
  if (network === "live") {
    // ignore.
  } else {
    deployer.then(() => {
      return Promise.all([
        LRCToken.deployed(),
        WETHToken.deployed(),
      ]);
    }).then(() => {
      return Promise.all([
        deployer.deploy(ExchangeDeployer),
        deployer.deploy(BlockVerifier),
      ]);
    }).then(() => {
      return Promise.all([
        deployer.deploy(LoopringV3),
      ]);
    }).then(() => {
      return Promise.all([
        deployer.deploy(
          BurnManager,
          LoopringV3.address,
          LRCToken.address,
        ),
      ]);
    });
  }
};
