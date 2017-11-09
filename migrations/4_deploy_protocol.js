var TokenRegistry           = artifacts.require("./TokenRegistry");
var RinghashRegistry        = artifacts.require("./RinghashRegistry");
var TokenTransferDelegate   = artifacts.require("./TokenTransferDelegate");
var LoopringProtocolImpl    = artifacts.require("./LoopringProtocolImpl");

module.exports = function(deployer, network, accounts) {

  if (network === "live") {
    deployer.then(() => {
      return Promise.all([
        TokenRegistry.deployed(),
        RinghashRegistry.deployed(),
        TokenTransferDelegate.deployed(),
      ]);
    }).then((contracts) => {
      var lrcAddr = "0xEF68e7C694F40c8202821eDF525dE3782458639f";
      return deployer.deploy(
        LoopringProtocolImpl,
        lrcAddr,
        TokenRegistry.address,
        RinghashRegistry.address,
        TokenTransferDelegate.address,
        5,
        62500);
    });
  } else {
    deployer.then(() => {
      return Promise.all([
        TokenRegistry.deployed(),
        RinghashRegistry.deployed(),
        TokenTransferDelegate.deployed(),
      ]);
    }).then((contracts) => {
      var [tokenRegistry] = contracts;
      return tokenRegistry.getAddressBySymbol("LRC");
    }).then(lrcAddr => {
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
