var Curve = artifacts.require("./impl/Curve.sol");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(Curve);
};
