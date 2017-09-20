var tokenInfo               = require("./config/tokens.js");
var DummyToken              = artifacts.require("./test/DummyToken");
var TestLrcToken            = artifacts.require("./test/TestLrcToken");

module.exports = function(deployer, network, accounts) {

  if (network == 'live') {

  } else {
    var devTokenInfos = tokenInfo.development;
    var totalSupply = 1e+26;
    deployer.deploy(TestLrcToken, "TestLrcToken", "TLRC", 18, 1e27).then(() => {
      return devTokenInfos.forEach((token) =>  DummyToken.new(
        token.name,
        token.symbol,
        token.decimals,
        totalSupply,
      ));
    })

  }
};
