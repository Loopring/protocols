var ErrorLib                = artifacts.require("./lib/ErrorLib");
var Bytes32Lib              = artifacts.require("./lib/Bytes32Lib");
var Uint8Lib                = artifacts.require("./lib/Uint8Lib");
var TokenRegistry           = artifacts.require("./TokenRegistry");
var RinghashRegistry        = artifacts.require("./RinghashRegistry");

module.exports = function(deployer, network, accounts) {
  if (network == 'live') {

  } else {
    deployer.then(() => {
      return Promise.all([
        Bytes32Lib.deployed(),
        ErrorLib.deployed(),
        Uint8Lib.deployed(),
      ]);
    }).then(() => {
      deployer.deploy(TokenRegistry);
    }).then(() => {
      deployer.deploy(Bytes32Lib);
      deployer.link(Bytes32Lib, RinghashRegistry);
      deployer.link(ErrorLib, RinghashRegistry);
      deployer.link(Uint8Lib, RinghashRegistry);
      return deployer.deploy(RinghashRegistry, 10000);
    });
  }
};
