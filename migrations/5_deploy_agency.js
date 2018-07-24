var TokenRegistry = artifacts.require("./impl/TokenRegistry");
var DummyAgency = artifacts.require("./test/DummyAgency");

module.exports = function(deployer, network, accounts) {

  if (network === "live") {
    // ignore.
  } else {
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
