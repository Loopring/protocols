var TokenRegistry = artifacts.require("./impl/TokenRegistry");
var Exchange = artifacts.require("./impl/Exchange");
var DummyAgency = artifacts.require("./test/DummyAgency");
var DummyBrokerInterceptor = artifacts.require("./test/DummyBrokerInterceptor");

module.exports = function(deployer, network, accounts) {

  if (network === "live") {
    // ignore.
  } else {
    deployer.then(() => {
      return Promise.all([
        Exchange.deployed(),
        TokenRegistry.deployed(),
      ]);
    }).then((contracts) => {
      deployer.deploy(
        DummyBrokerInterceptor,
        Exchange.address,
      );
      return deployer.deploy(
        DummyAgency,
        TokenRegistry.address,
      );
    });

  }
};
