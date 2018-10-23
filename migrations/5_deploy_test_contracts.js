var RingSubmitter = artifacts.require("./impl/RingSubmitter");
var TradeDelegate = artifacts.require("./impl/TradeDelegate");
var FeeHolder = artifacts.require("./impl/FeeHolder");
var DummyBrokerInterceptor = artifacts.require("./test/DummyBrokerInterceptor");
var DummyExchange = artifacts.require("./test/DummyExchange");
var DummyBurnManager = artifacts.require("./test/DummyBurnManager");
var LRCToken = artifacts.require("./test/tokens/LRC.sol");
var DeserializerTest = artifacts.require("./test/DeserializerTest.sol");

module.exports = function(deployer, network, accounts) {
  if (network === "live" || network === "ropsten" || network === "rinkeby") {
    // ignore.
  } else {
    deployer.then(() => {
      return Promise.all([
        RingSubmitter.deployed(),
        TradeDelegate.deployed(),
        FeeHolder.deployed(),
        RingSubmitter.deployed(),
        LRCToken.deployed(),
      ]);
    }).then((contracts) => {
      return Promise.all([
        deployer.deploy(DeserializerTest, LRCToken.address),
        deployer.deploy(DummyBrokerInterceptor, RingSubmitter.address),
        deployer.deploy(DummyExchange, TradeDelegate.address, FeeHolder.address, RingSubmitter.address),
        deployer.deploy(DummyBurnManager, FeeHolder.address),
      ]);
    });
  }
};
