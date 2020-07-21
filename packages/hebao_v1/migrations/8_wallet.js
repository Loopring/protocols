const WalletImpl = artifacts.require("WalletImpl");
const WalletFactory = artifacts.require("WalletFactory");
const ControllerImpl = artifacts.require("ControllerImpl");

module.exports = function(deployer, network, accounts) {
  deployer
    .then(() => {
      return Promise.all([deployer.deploy(WalletImpl)]);
    })
    .then(() => {
      return Promise.all([
        deployer.deploy(
          WalletFactory,
          ControllerImpl.address,
          WalletImpl.address,
          true
        )
      ]);
    })
    .then(() => {
      return Promise.all([
        ControllerImpl.deployed().then(controllerImpl => {
          return Promise.all([
            controllerImpl.initWalletFactory(WalletFactory.address)
          ]);
        })
      ]);
    });
};
