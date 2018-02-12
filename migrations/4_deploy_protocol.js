var TokenRegistry           = artifacts.require("./TokenRegistry");
var TokenTransferDelegate   = artifacts.require("./TokenTransferDelegate");
var NameRegistry            = artifacts.require("./NameRegistry");
var LoopringProtocolImpl    = artifacts.require("./LoopringProtocolImpl");

module.exports = function(deployer, network, accounts) {

  if (network === "live") {
    deployer.then(() => {
      return Promise.all([
        TokenRegistry.deployed(),
        TokenTransferDelegate.deployed(),
        NameRegistry.deployed(),
      ]);
    }).then((contracts) => {
      var lrcAddr = "0xEF68e7C694F40c8202821eDF525dE3782458639f";
      return deployer.deploy(
        LoopringProtocolImpl,
        lrcAddr,
        TokenRegistry.address,
        TokenTransferDelegate.address,
        NameRegistry.address,
        5,
        62500,
        20);
    });
  } else {
    deployer.then(() => {
      return Promise.all([
        TokenRegistry.deployed(),
        TokenTransferDelegate.deployed(),
        NameRegistry.deployed(),
      ]);
    }).then((contracts) => {
      var [tokenRegistry] = contracts;
      return tokenRegistry.getAddressBySymbol("LRC");
    }).then(lrcAddr => {
      return deployer.deploy(
        LoopringProtocolImpl,
        lrcAddr,
        TokenRegistry.address,
        TokenTransferDelegate.address,
        NameRegistry.address,
        5,
        62500,
        20);
    });

  }
};
