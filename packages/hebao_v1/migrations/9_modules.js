var SignedRequest = artifacts.require("SignedRequest");

const WalletRegistryImpl = artifacts.require("WalletRegistryImpl");
const ModuleRegistryImpl = artifacts.require("ModuleRegistryImpl");
const BaseENSManager = artifacts.require("BaseENSManager");

const ControllerImpl = artifacts.require("ControllerImpl");
const WalletImpl = artifacts.require("WalletImpl");

const WalletFactory = artifacts.require("WalletFactory");
const PackedCoreModule = artifacts.require("PackedCoreModule");
const PackedSecurityModule = artifacts.require("PackedSecurityModule");
const PackedTransferModule = artifacts.require("PackedTransferModule");

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

  deployer
    .then(() => {
      let dest = [PackedCoreModule, PackedSecurityModule, PackedTransferModule];
      return Promise.all([deployer.link(SignedRequest, dest)]);
    })
    .then(() => {
      return Promise.all([
        deployer.deploy(PackedCoreModule, ControllerImpl.address)
      ]);
    })
    .then(() => {
      return Promise.all([
        deployer.deploy(
          PackedSecurityModule,
          ControllerImpl.address,
          PackedCoreModule.address,
          guardianPendingPeriod,
          inheritanceWaitingPeriod,
          whitelistDelayPeriod
        ),
        deployer.deploy(
          PackedTransferModule,
          ControllerImpl.address,
          PackedCoreModule.address,
          quotaDelayPeriod
        )
      ]);
    })
    .then(() => {
      return Promise.all([
        ModuleRegistryImpl.deployed().then(moduleRegistry => {
          return Promise.all([
            moduleRegistry.registerModule(PackedCoreModule.address),
            moduleRegistry.registerModule(PackedSecurityModule.address),
            moduleRegistry.registerModule(PackedTransferModule.address)
          ]);
        })
      ]);
    })
    .then(() => {
      return Promise.all([
        WalletRegistryImpl.deployed().then(walletRegistry => {
          return Promise.all([
            walletRegistry.setWalletFactory(WalletFactory.address)
          ]);
        })
      ]);
    })
    .then(() => {
      let ensManagerAddr = process.env.ENSManager || "";
      if (web3.utils.isAddress(ensManagerAddr.toLowerCase())) {
        // should be done manually.
        console.log(
          "You will have to do ensManager.addManager(WalletFactory.address) manually"
        );
      } else {
        // console.log("add manager for BaseENSManager:", WalletFactory.address);
        return Promise.all([
          BaseENSManager.deployed().then(ensManager => {
            return Promise.all([
              ensManager.addManager(WalletFactory.address),
              ensManager.addManager(ensOperator)
            ]);
          })
        ]);
      }
    });
};
