var TokenRegistry           = artifacts.require("./TokenRegistry");
var TokenTransferDelegate   = artifacts.require("./TokenTransferDelegate");
var NameRegistry            = artifacts.require("./NameRegistry");
var TokenMint               = artifacts.require("./TokenMint");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(TokenTransferDelegate);
  deployer.deploy(NameRegistry);

  deployer.deploy(TokenMint).then(function() {
    return deployer.deploy(TokenRegistry, TokenMint.address);
  });

};
