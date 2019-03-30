var LRCToken = artifacts.require("./NewLRCToken.sol");

module.exports = function(deployer) {
  deployer.deploy(LRCToken);
};
