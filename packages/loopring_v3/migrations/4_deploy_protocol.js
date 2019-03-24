var LRCToken = artifacts.require("./test/tokens/LRC.sol");
var WETHToken = artifacts.require("./test/tokens/WETH.sol");
var TokenRegistry = artifacts.require("./impl/TokenRegistry.sol");
var OperatorRegistry = artifacts.require("./impl/OperatorRegistry.sol");
var BlockVerifier = artifacts.require("./impl/BlockVerifier.sol");
var Exchange = artifacts.require("./impl/Exchange");
var ExchangeHelper = artifacts.require("./impl/ExchangeHelper");
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
        deployer.deploy(ExchangeHelper),
        deployer.deploy(
          TokenRegistry,
          LRCToken.address,
          WETHToken.address,
        ),
        deployer.deploy(
          OperatorRegistry,
          LRCToken.address,
        ),
        deployer.deploy(BlockVerifier),
      ]);
    }).then(() => {
      return Promise.all([
        deployer.deploy(
          Exchange,
          ExchangeHelper.address,
          TokenRegistry.address,
          BlockVerifier.address,
          LRCToken.address,
          LRCToken.address,
          0,
          1000000000000000,
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
