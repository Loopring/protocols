var LRCToken = artifacts.require("./NewLRCToken.sol");
var BatchTransfer = artifacts.require("./BatchTransfer.sol");
var NewLRCLongTermHoldingContract = artifacts.require("./NewLRCLongTermHoldingContract.sol");
var NewLRCFoundationIceboxContract = artifacts.require("./NewLRCFoundationIceboxContract.sol");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(BatchTransfer);

  deployer.then(async () => {
    await LRCToken.deployed();
    await deployer.deploy(NewLRCLongTermHoldingContract, LRCToken.address);
    await deployer.deploy(NewLRCFoundationIceboxContract, LRCToken.address);
  });
};
