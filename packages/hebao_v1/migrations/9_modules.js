var SignedRequest = artifacts.require("SignedRequest");

const WalletRegistryImpl = artifacts.require("WalletRegistryImpl");
const ModuleRegistryImpl = artifacts.require("ModuleRegistryImpl");
const BaseENSManager = artifacts.require("BaseENSManager");

const ControllerImpl = artifacts.require("ControllerImpl");
const WalletImpl = artifacts.require("WalletImpl");

const WalletFactory = artifacts.require("WalletFactory");
const FinalCoreModule = artifacts.require("FinalCoreModule");
const FinalSecurityModule = artifacts.require("FinalSecurityModule");
const FinalTransferModule = artifacts.require("FinalTransferModule");

module.exports = function(deployer, network, accounts) {
  const guardianPendingPeriod =
    Number(process.env.guardianPendingPeriod) || 1 * 24 * 3600;
  const inheritanceWaitingPeriod =
    Number(process.env.inheritanceWaitingPeriod) || 365 * 24 * 3600;
  const whitelistDelayPeriod =
    Number(process.env.whitelistDelayPeriod) || 1 * 24 * 3600;
  const quotaDelayPeriod =
    Number(process.env.quotaDelayPeriod) || 1 * 24 * 3600;

  const ensOperator = process.env.ensOperator || accounts[1];
  const ensManagerAddr = process.env.ENSManager || "";

  deployer.then(async () => {
    const dest = [FinalCoreModule, FinalSecurityModule, FinalTransferModule];
    await deployer.link(SignedRequest, dest);
    await deployer.deploy(FinalCoreModule, ControllerImpl.address);
    await deployer.deploy(
      FinalSecurityModule,
      ControllerImpl.address,
      FinalCoreModule.address,
      guardianPendingPeriod,
      inheritanceWaitingPeriod,
      whitelistDelayPeriod
    );
    await deployer.deploy(
      FinalTransferModule,
      ControllerImpl.address,
      FinalCoreModule.address,
      quotaDelayPeriod
    );

    const moduleRegistry = await ModuleRegistryImpl.deployed();
    const walletRegistry = await WalletRegistryImpl.deployed();
    const walletFactory = await WalletFactory.deployed();
    const ensManager = await BaseENSManager.deployed();

    let setupFuncList = [
      moduleRegistry.registerModule(FinalCoreModule.address),
      moduleRegistry.registerModule(FinalSecurityModule.address),
      moduleRegistry.registerModule(FinalTransferModule.address),
      walletRegistry.setWalletFactory(WalletFactory.address)
    ];

    if (!web3.utils.isAddress(ensManagerAddr.toLowerCase())) {
      setupFuncList = setupFuncList.concat([
        ensManager.addManager(WalletFactory.address),
        ensManager.addManager(ensOperator)
      ]);
    }

    return Promise.all(setupFuncList);
  });
};
