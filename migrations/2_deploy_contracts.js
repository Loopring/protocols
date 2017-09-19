var DummyToken              = artifacts.require("./test/DummyToken");
var TestLrcToken            = artifacts.require("./test/TestLrcToken");
var TokenRegistry           = artifacts.require("./TokenRegistry");
var RinghashRegistry        = artifacts.require("./RinghashRegistry");
var LoopringProtocolImpl    = artifacts.require("./LoopringProtocolImpl");

module.exports = function(deployer, network, accounts) {

  if (network !== 'live') {

  } else {
    deployer.deploy(DummyToken, "DummyToken", "DUM", 18, 1e26);
    deployer.deploy(TestLrcToken, "TestLrcToken", "TLRC", 18, 1e27);
    deployer.deploy(TokenRegistry);
    deployer.deploy(RinghashRegistry, 10000);
    // TODO(kongliang): give constructor parameters.
    deployer.deploy(
      LoopringProtocolImpl,
      TestLrcToken.address,
      TokenRegistry.address,
      RinghashRegistry.address,
      5,
      2);
  }
};
