var TokenRegistry = artifacts.require("./impl/TokenRegistry");
var DummyAgency = artifacts.require("./test/DummyAgency");
var DummyBrokerInterceptor = artifacts.require("./test/DummyBrokerInterceptor");

module.exports = function(deployer, network, accounts) {

  if (network === "live") {
    // ignore.
  } else {
    deployer.deploy(DummyBrokerInterceptor);
    deployer.then(() => {
      return Promise.all([
        TokenRegistry.deployed(),
      ]);
    }).then((contracts) => {
      return deployer.deploy(
        DummyAgency,
        TokenRegistry.address,
      );
    });

  }
};
