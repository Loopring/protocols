var LRCToken = artifacts.require("./NewLRCToken.sol");
var BatchTransfer = artifacts.require("./BatchTransfer.sol");
var NewLRCLongTermHoldingContract = artifacts.require("./NewLRCLongTermHoldingContract.sol");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(BatchTransfer);

  deployer.then(async () => {
    await LRCToken.deployed();

    return deployer.deploy(NewLRCLongTermHoldingContract, LRCToken.address, accounts[0]);
  });
};
