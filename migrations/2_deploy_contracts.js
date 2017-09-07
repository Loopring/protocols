var DummyToken 				= artifacts.require("./DummyToken");
var TokenRegistry 			= artifacts.require("./TokenRegistry");
var RingHashRegistry		= artifacts.require("./RingHashRegistry");
var LoopringProtocolImpl 	= artifacts.require("./LoopringProtocolImpl");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(DummyToken);
  deployer.deploy(TokenRegistry);
  deployer.deploy(RingHashRegistry);
  // TODO(kongliang): give constructor parameters.
  deployer.deploy(
  	LoopringProtocolImpl,
  	accounts[0]);
};
