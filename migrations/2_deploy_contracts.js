var ErrorLib                = artifacts.require("./lib/ErrorLib");
var Bytes32Lib              = artifacts.require("./lib/Bytes32Lib");
var Uint8Lib                = artifacts.require("./lib/Uint8Lib");
var UintLib                 = artifacts.require("./lib/UintLib");
var DummyToken              = artifacts.require("./test/DummyToken");
var TestLrcToken            = artifacts.require("./test/TestLrcToken");
var TokenRegistry           = artifacts.require("./TokenRegistry");
var RinghashRegistry        = artifacts.require("./RinghashRegistry");
var LoopringProtocolImpl    = artifacts.require("./LoopringProtocolImpl");

module.exports = function(deployer, network, accounts) {

  if (network == 'live') {

  } else {
    deployer.then(() => {
      return Promise.all([
        ErrorLib.deployed(),
        Bytes32Lib.deployed(),
        Uint8Lib.deployed(),
        UintLib.deployed(),
      ]);
    }).then(() => {
      return deployer.deploy(DummyToken, "DummyToken", "DUM", 18, 1e26);
    }).then(() => {
      return deployer.deploy(TestLrcToken, "TestLrcToken", "TLRC", 18, 1e27);
    }).then(() => {
      return deployer.deploy(TokenRegistry);
    }).then(() => {
      deployer.link(Bytes32Lib, RinghashRegistry);
      deployer.link(ErrorLib, RinghashRegistry);
      deployer.link(Uint8Lib, RinghashRegistry);
      return deployer.deploy(RinghashRegistry, 10000);
    }).then(() => {
      deployer.link(ErrorLib, LoopringProtocolImpl);
      deployer.link(UintLib, LoopringProtocolImpl);
      return deployer.deploy(
        LoopringProtocolImpl,
        TestLrcToken.address,
        TokenRegistry.address,
        RinghashRegistry.address,
        5,
        2);
    });
  }
};
