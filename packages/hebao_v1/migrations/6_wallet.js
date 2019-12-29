const BaseWallet = artifacts.require("./base/BaseWallet.sol");

module.exports = function(deployer, network, accounts) {
  deployer
    .then(() => {
      return Promise.all([deployer.deploy(BaseWallet)]);
    })
    .then(() => {
      console.log(">>>>>>>> contracts deployed by controller:");
      console.log("BaseWallet:", BaseWallet.address);
      console.log("");
    });
};
