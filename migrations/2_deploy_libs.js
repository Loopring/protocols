var Bytes32Lib              = artifacts.require("./lib/Bytes32Lib");
var Uint8Lib                = artifacts.require("./lib/Uint8Lib");
var UintLib                 = artifacts.require("./lib/UintLib");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(Bytes32Lib);
  deployer.deploy(Uint8Lib);
  deployer.deploy(UintLib);
};
