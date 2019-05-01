// var TestableExchange = artifacts.require("./test/TestableExchange");

module.exports = function(deployer, network, accounts) {
  if (network === "live" || network === "ropsten" || network === "rinkeby") {
    // ignore.
  } else {
    /*deployer.then(() => {
      return Promise.all([
        TradeDelegate.deployed(),
      ]);
    }).then(() => {
      return Promise.all([
        deployer.deploy(
          TestableExchange,
          TradeDelegate.address,
        ),
      ]);
    }).then(() => {
      // do nothing
    });*/
  }
};
