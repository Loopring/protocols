var TokenRegistry           = artifacts.require("./TokenRegistry");
var TokenTransferDelegate   = artifacts.require("./TokenTransferDelegate");
var NameRegistry            = artifacts.require("./NameRegistry");
var TokenFactory            = artifacts.require("./TokenFactory");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(TokenTransferDelegate);
  deployer.deploy(NameRegistry);

  deployer.deploy(TokenFactory).then(function() {
    return deployer.deploy(TokenRegistry, TokenFactory.address);
  });

};
