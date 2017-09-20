var tokenInfo               = require('./config/tokens.js');
var Bluebird                = require('bluebird');
var _                       = require('lodash');
var DummyToken              = artifacts.require("./test/DummyToken");
var TestLrcToken            = artifacts.require("./test/TestLrcToken");
var TokenRegistry           = artifacts.require("./TokenRegistry");

module.exports = function(deployer, network, accounts) {

  if (network == 'live') {

  } else {
    var devTokenInfos = tokenInfo.development;
    var totalSupply = 1e+26;
    deployer.then(() => {
      return TokenRegistry.deployed();
    }).then((tokenRegistry) => {
      deployer.deploy(TestLrcToken, "TestLrcToken", "TLRC", 18, 1e27).then(() => {
        return Bluebird.each(devTokenInfos.map(token =>  DummyToken.new(
          token.name,
          token.symbol,
          token.decimals,
          totalSupply,
        )), _.noop).then(dummyTokens => {
          return Bluebird.each(dummyTokens.map(tokenContract => {
            return tokenRegistry.registerToken(tokenContract.address);
          }), _.noop);
        });
      });

    });

  }
}
