var UintLib                 = artifacts.require("./lib/UintLib");
var TokenRegistry           = artifacts.require("./TokenRegistry");
var RinghashRegistry        = artifacts.require("./RinghashRegistry");
var TokenTransferDelegate   = artifacts.require("./TokenTransferDelegate");
var LoopringProtocolImpl    = artifacts.require("./LoopringProtocolImpl");

module.exports = function(deployer, network, accounts) {

  if (network == 'live') {
    deployer.then(() => {
      return Promise.all([
        UintLib.deployed(),
        TokenRegistry.deployed(),
        RinghashRegistry.deployed(),
        TokenTransferDelegate.deployed(),
      ]);
    }).then((contracts) => {
      var lrcAddr = "0xEF68e7C694F40c8202821eDF525dE3782458639f";
      deployer.link(UintLib, LoopringProtocolImpl);
      return deployer.deploy(
        LoopringProtocolImpl,
        lrcAddr,
        TokenRegistry.address,
        RinghashRegistry.address,
        TokenTransferDelegate.address,
        5,
        100);
    });
  } else {
    deployer.then(() => {
      return Promise.all([
        UintLib.deployed(),
        TokenRegistry.deployed(),
        RinghashRegistry.deployed(),
        TokenTransferDelegate.deployed(),
      ]);
    }).then((contracts) => {
      var [uintLib, tokenRegistry] = contracts;
      return tokenRegistry.getAddressBySymbol("LRC");
    }).then(lrcAddr => {
      deployer.link(UintLib, LoopringProtocolImpl);
      return deployer.deploy(
        LoopringProtocolImpl,
        lrcAddr,
        TokenRegistry.address,
        RinghashRegistry.address,
        TokenTransferDelegate.address,
        5,
        100);
    });

  }
};
