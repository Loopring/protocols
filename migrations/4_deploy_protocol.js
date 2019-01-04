var TradeDelegate = artifacts.require("./impl/TradeDelegate");
var Exchange = artifacts.require("./impl/Exchange");

module.exports = function(deployer, network, accounts) {
  if (network === "live") {
    // ignore.
  } else {
    deployer.then(() => {
      return Promise.all([
        TradeDelegate.deployed(),
      ]);
    }).then(() => {
      return Promise.all([
        deployer.deploy(
          Exchange,
          TradeDelegate.address,
        ),
      ]);
    }).then(() => {
      // do nothing
    });
  }
};
