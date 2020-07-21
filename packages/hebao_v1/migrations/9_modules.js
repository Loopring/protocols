var SignedRequest = artifacts.require("SignedRequest");

const WalletRegistryImpl = artifacts.require("WalletRegistryImpl");
const ModuleRegistryImpl = artifacts.require("ModuleRegistryImpl");
const BaseENSManager = artifacts.require("BaseENSManager");

const ForwarderModule = artifacts.require("ForwarderModule");
const ERC1271Module = artifacts.require("ERC1271Module");
const ControllerImpl = artifacts.require("ControllerImpl");
const WalletImpl = artifacts.require("WalletImpl");

const WalletFactory = artifacts.require("WalletFactory");
const GuardianModule = artifacts.require("GuardianModule");
const InheritanceModule = artifacts.require("InheritanceModule");
const WhitelistModule = artifacts.require("WhitelistModule");
const TransferModule = artifacts.require("TransferModule");

module.exports = function(deployer, network, accounts) {
  const guardianPendingPeriod =
    Number(process.env.guardianPendingPeriod) || 1 * 24 * 3600;
  const inheritanceWaitingPeriod =
    Number(process.env.inheritanceWaitingPeriod) || 365 * 24 * 3600;
  const whitelistDelayPeriod =
    Number(process.env.whitelistDelayPeriod) || 1 * 24 * 3600;
  const quotaDelayPeriod =
    Number(process.env.quotaDelayPeriod) || 1 * 24 * 3600;

  const ensOperator = process.env.ensOperator || accounts[0];

  deployer
    .then(() => {
      let dest = [
        ForwarderModule,
        ERC1271Module,
        GuardianModule,
        InheritanceModule,
        WhitelistModule,
        TransferModule
      ];
      return Promise.all([deployer.link(SignedRequest, dest)]);
    })
    .then(() => {
      return Promise.all([
        deployer.deploy(ForwarderModule, ControllerImpl.address),
        deployer.deploy(ERC1271Module, ControllerImpl.address)
      ]);
    })
    .then(() => {
      return Promise.all([
        deployer.deploy(
          GuardianModule,
          ControllerImpl.address,
          ForwarderModule.address,
          guardianPendingPeriod
        ),
        deployer.deploy(
          InheritanceModule,
          ControllerImpl.address,
          ForwarderModule.address,
          inheritanceWaitingPeriod
        ),
        deployer.deploy(
          WhitelistModule,
          ControllerImpl.address,
          ForwarderModule.address,
          whitelistDelayPeriod
        ),
        deployer.deploy(
          TransferModule,
          ControllerImpl.address,
          ForwarderModule.address,
          quotaDelayPeriod
        )
      ]);
    })
    .then(() => {
      return Promise.all([
        ModuleRegistryImpl.deployed().then(moduleRegistry => {
          return Promise.all([
            moduleRegistry.registerModule(ForwarderModule.address),
            moduleRegistry.registerModule(ERC1271Module.address),
            moduleRegistry.registerModule(GuardianModule.address),
            moduleRegistry.registerModule(InheritanceModule.address),
            moduleRegistry.registerModule(WhitelistModule.address),
            moduleRegistry.registerModule(TransferModule.address)
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
