var LoopringExchange = artifacts.require("./LoopringExchange");
var TokenRegistry = artifacts.require("./TokenRegistry");
var DummyToken = artifacts.require("./DummyToken");

module.exports = function(deployer) {
  deployer.deploy(DummyToken);
  deployer.deploy(TokenRegistry);

  var _exchangeAddr = '0x0';
  deployer.deploy(LoopringExchange, _exchangeAddr);
};
