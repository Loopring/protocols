var LoopringToken = artifacts.require("./LoopringToken.sol")
module.exports = function(deployer) {
  deployer.deploy(LoopringToken);
};
