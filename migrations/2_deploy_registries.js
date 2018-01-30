var TokenRegistry           = artifacts.require("./TokenRegistry");
var RinghashRegistry        = artifacts.require("./RinghashRegistry");
var TokenTransferDelegate   = artifacts.require("./TokenTransferDelegate");
var NameRegistry            = artifacts.require("./NameRegistry");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(TokenRegistry);
  deployer.deploy(RinghashRegistry, 100);
  deployer.deploy(TokenTransferDelegate);
  deployer.deploy(NameRegistry);
};
