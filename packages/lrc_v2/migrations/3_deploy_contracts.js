var LRCToken = artifacts.require("./LRC_v2.sol");
var BatchTransfer = artifacts.require("./BatchTransfer.sol");
var LRCLongTermHoldingContract_v2 = artifacts.require("./LRCLongTermHoldingContract_v2.sol");
var LRC = artifacts.require("./LRC.sol");
// LoopringAdminUpgradeabilityProxy

module.exports = function(deployer, network, accounts) {
  deployer.deploy(BatchTransfer);

  deployer.then(async () => {
    await LRCToken.deployed();

    return deployer.deploy(LRCLongTermHoldingContract_v2, LRCToken.address, accounts[0]);
  }).then(async () => {
    return deployer.deploy(LRC, LRCToken.address, accounts[0]);
  });
};
