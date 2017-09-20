var ErrorLib                = artifacts.require("./lib/ErrorLib");
var UintLib                 = artifacts.require("./lib/UintLib");
var DummyToken              = artifacts.require("./test/DummyToken");
var TestLrcToken            = artifacts.require("./test/TestLrcToken");
var TokenRegistry           = artifacts.require("./TokenRegistry");
var RinghashRegistry        = artifacts.require("./RinghashRegistry");
var LoopringProtocolImpl    = artifacts.require("./LoopringProtocolImpl");

module.exports = function(deployer, network, accounts) {

  if (network == 'live') {

  } else {
    //deployer.deploy(LoopringProtocolImpl);

    deployer.then(() => {
      return Promise.all([
        ErrorLib.deployed(),
        UintLib.deployed(),
        TestLrcToken.deployed(),
        TokenRegistry.deployed(),
        RinghashRegistry.deployed(),
      ]);
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
