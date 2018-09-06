var TokenRegistry = artifacts.require("./impl/TokenRegistry");
var RingSubmitter = artifacts.require("./impl/RingSubmitter");
var TradeDelegate = artifacts.require("./impl/TradeDelegate");
var FeeHolder = artifacts.require("./impl/FeeHolder");
var DummyAgency = artifacts.require("./test/DummyAgency");
var DummyBrokerInterceptor = artifacts.require("./test/DummyBrokerInterceptor");
var DummyExchange = artifacts.require("./test/DummyExchange");

module.exports = function(deployer, network, accounts) {

  if (network === "live") {
    // ignore.
  } else {
    deployer.then(() => {
      return Promise.all([
        RingSubmitter.deployed(),
        TokenRegistry.deployed(),
        TradeDelegate.deployed(),
        FeeHolder.deployed(),
        RingSubmitter.deployed(),
      ]);
    }).then((contracts) => {
      return Promise.all([
        deployer.deploy(DummyBrokerInterceptor, RingSubmitter.address),
        deployer.deploy(DummyAgency, TokenRegistry.address),
        deployer.deploy(DummyExchange, TradeDelegate.address, FeeHolder.address, RingSubmitter.address),
      ]);
    });
  }
};
