var LoopringProtocol = artifacts.require("./LoopringProtocol");
var TokenRegistry = artifacts.require("./TokenRegistry");
var DummyToken = artifacts.require("./DummyToken");

module.exports = function(deployer) {
  deployer.deploy(DummyToken);
  deployer.deploy(TokenRegistry);

  var ownerAddress = '0x0';
  deployer.deploy(LoopringProtocol, ownerAddress);
};
