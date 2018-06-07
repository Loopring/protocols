var TradeDelegate = artifacts.require("./impl/TradeDelegate");
var TokenRegistry = artifacts.require("./impl/TokenRegistry");
var Exchange = artifacts.require("./impl/Exchange");

module.exports = function(deployer, network, accounts) {

  if (network === "live") {
    // ignore.
  } else {
    deployer.then(() => {
      return Promise.all([
        TokenRegistry.deployed(),
        TradeDelegate.deployed(),
      ]);
    }).then((contracts) => {
      var [tokenRegistry] = contracts;
      return tokenRegistry.getAddressBySymbol("LRC");
    }).then(lrcAddr => {
      return deployer.deploy(
        Exchange,
        lrcAddr,
        TokenRegistry.address,
        TradeDelegate.address
      );
    });

  }
};
