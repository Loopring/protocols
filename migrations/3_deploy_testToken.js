const TestToken = artifacts.require("./TestToken.sol")

module.exports = function(deployer, network, accounts) {
  var accountants = [];
  accountants.push(accounts[0]);

  if (network === "live") {
    // ignore.
  } else {
    return deployer.deploy(TestToken, accounts[0]);
  }

};