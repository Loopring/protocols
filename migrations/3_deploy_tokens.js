var tokenInfo               = require("./config/tokens.js");
var Bluebird                = require("bluebird");
var _                       = require("lodash");
var DummyToken              = artifacts.require("./test/DummyToken");
var TokenRegistry           = artifacts.require("./impl/TokenRegistry");
var SymbolRegistry          = artifacts.require("./impl/SymbolRegistry");

module.exports = function(deployer, network, accounts) {
  if (network === "live") {
    // ignore
  } else {
    var devTokenInfos = tokenInfo.development;
    var totalSupply = 1e+26;
    deployer.then(() => {
      return Promise.all([
        TokenRegistry.deployed(),
        SymbolRegistry.deployed(),
      ]);
    }).then((contracts) => {
      const [tokenRegistry, symbolRegistry] = contracts;
      return Bluebird.each(devTokenInfos.map(token => DummyToken.new(
        token.name,
        token.symbol,
        token.decimals,
        totalSupply,
      )), _.noop).then(dummyTokens => {
        return Bluebird.each(dummyTokens.map((tokenContract, i) => {
          var token = devTokenInfos[i];
          return Promise.all([
            tokenRegistry.registerToken(tokenContract.address),
            symbolRegistry.registerSymbol(tokenContract.address, token.symbol),
          ]);
        }), _.noop);
      });

    });
  }

};
