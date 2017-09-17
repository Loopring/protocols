var DummyToken 				= artifacts.require("./test/DummyToken");
var TokenRegistry 			= artifacts.require("./TokenRegistry");
var RinghashRegistry		= artifacts.require("./RinghashRegistry");
var LoopringProtocolImpl 	= artifacts.require("./LoopringProtocolImpl");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(DummyToken);
  deployer.deploy(TokenRegistry);
  deployer.deploy(RinghashRegistry);
  // TODO(kongliang): give constructor parameters.
  deployer.deploy(
  	LoopringProtocolImpl,
  	accounts[0]);
};
