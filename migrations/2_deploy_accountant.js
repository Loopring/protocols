const Accountant = artifacts.require("./AccountantImpl.sol")

module.exports = function(deployer) {
  deployer.deploy(Accountant, ["0xf264cd2b6d02e5ed54dd6a1cef5bc7e2746ef893", "0x25c592617f439db108e5531c456016e823b7046d"]);
};