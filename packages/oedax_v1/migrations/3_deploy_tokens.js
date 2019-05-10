var FOO                = artifacts.require("./test/tokens/FOO.sol");
var BAR                = artifacts.require("./test/tokens/BAR.sol");
var TESTA              = artifacts.require("./test/tokens/TESTA.sol");
var TESTB              = artifacts.require("./test/tokens/TESTB.sol");

module.exports = function(deployer, network, accounts) {
  if (network === "live") {
    // ignore
  } else {
    deployer.deploy(FOO);
    deployer.deploy(BAR);
    deployer.deploy(TESTA);
    deployer.deploy(TESTB);
  }

};
