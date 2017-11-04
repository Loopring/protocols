var Bytes32Lib              = artifacts.require("./lib/Bytes32Lib");
var Uint8Lib                = artifacts.require("./lib/Uint8Lib");
var TokenRegistry           = artifacts.require("./TokenRegistry");
var RinghashRegistry        = artifacts.require("./RinghashRegistry");
var TokenTransferDelegate   = artifacts.require("./TokenTransferDelegate");

module.exports = function(deployer, network, accounts) {
    deployer.then(() => {
      return Promise.all([
        Bytes32Lib.deployed(),
        Uint8Lib.deployed(),
      ]);
    }).then(() => {
      deployer.deploy(TokenRegistry);
    }).then(() => {
      deployer.link(Bytes32Lib, RinghashRegistry);
      deployer.link(Uint8Lib, RinghashRegistry);
      return deployer.deploy(RinghashRegistry, 100);
    }).then(() => {
      return deployer.deploy(TokenTransferDelegate);
    });
};
