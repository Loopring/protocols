var LRCToken = artifacts.require("./test/tokens/LRC.sol");
var Exchange = artifacts.require("./impl/Exchange");

module.exports = function(deployer, network, accounts) {
  if (network === "live") {
    // ignore.
  } else {
    deployer.then(() => {
      return Promise.all([
        LRCToken.deployed(),
      ]);
    }).then(() => {
      return Promise.all([
        deployer.deploy(
          Exchange,
          LRCToken.address,
        ),
      ]);
    }).then(() => {
      // do nothing
    });
  }
};
