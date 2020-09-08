const WalletImpl = artifacts.require("WalletImpl");
const WalletFactory = artifacts.require("WalletFactory");
const ControllerImpl = artifacts.require("ControllerImpl");

module.exports = function(deployer, network, accounts) {
  deployer.then(async () => {
    await deployer.deploy(WalletImpl);
    await deployer.deploy(
      WalletFactory,
      ControllerImpl.address,
      WalletImpl.address,
      true
    );

    const controllerImpl = await ControllerImpl.deployed();
    return Promise.all([
      controllerImpl.initWalletFactory(WalletFactory.address)
    ]);
  });
};
