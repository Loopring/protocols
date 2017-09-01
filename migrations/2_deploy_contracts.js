var LoopringProtocol 		= artifacts.require("./LoopringProtocol");
var LoopringProtocolImpl 	= artifacts.require("./LoopringProtocolImpl");
var TokenRegistry 			= artifacts.require("./TokenRegistry");
var DummyToken 				= artifacts.require("./DummyToken");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(DummyToken);
  deployer.deploy(TokenRegistry);
  deployer.deploy(LoopringProtocolImpl, accounts[0]);
};
