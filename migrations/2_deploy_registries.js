var TokenRegistry           = artifacts.require("./TokenRegistry");
var TokenTransferDelegate   = artifacts.require("./TokenTransferDelegate");
var NameRegistry            = artifacts.require("./NameRegistry");
var TokenCreator            = artifacts.require("./TokenCreator");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(TokenTransferDelegate);
  deployer.deploy(NameRegistry);

  deployer.deploy(TokenCreator).then(function() {
    return deployer.deploy(TokenRegistry, TokenCreator.address);
  });

};
