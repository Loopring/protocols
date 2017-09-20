var DummyToken              = artifacts.require("./test/DummyToken");
var TestLrcToken            = artifacts.require("./test/TestLrcToken");

module.exports = function(deployer, network, accounts) {

  if (network == 'live') {

  } else {
    deployer.deploy(DummyToken, "DummyToken", "DUM", 18, 1e26).then(() => {
      return deployer.deploy(TestLrcToken, "TestLrcToken", "TLRC", 18, 1e27);
    });
  }
};
