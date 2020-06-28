var SignedRequest = artifacts.require("SignedRequest");

const WalletImpl = artifacts.require("WalletImpl");

module.exports = function(deployer, network, accounts) {
  deployer
    .then(() => {
      let dest = [WalletImpl];
      return Promise.all([deployer.link(SignedRequest, dest)]);
    })
    .then(() => {
      return Promise.all([deployer.deploy(WalletImpl)]);
    });
};
