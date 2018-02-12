var TokenRegistry           = artifacts.require("./TokenRegistry");
var TokenTransferDelegate   = artifacts.require("./TokenTransferDelegate");
var NameRegistry            = artifacts.require("./NameRegistry");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(TokenRegistry);
  deployer.deploy(TokenTransferDelegate);
  deployer.deploy(NameRegistry);
};
