var AddressUtil = artifacts.require("AddressUtil");
var EIP712 = artifacts.require("EIP712");
var MathInt = artifacts.require("MathInt");
var MathUint = artifacts.require("MathUint");
var BytesUtil = artifacts.require("BytesUtil");
var Create2 = artifacts.require("Create2");
var strings = artifacts.require("strings");
var SignedRequest = artifacts.require("SignedRequest");
var SignatureUtil = artifacts.require("SignatureUtil");

const WalletRegistryImpl = artifacts.require("WalletRegistryImpl");
const ModuleRegistryImpl = artifacts.require("ModuleRegistryImpl");
const BaseENSManager = artifacts.require("BaseENSManager");

const ForwarderModule = artifacts.require("ForwarderModule");
const ERC1271Module = artifacts.require("ERC1271Module");
const ControllerImpl = artifacts.require("ControllerImpl");
const WalletImpl = artifacts.require("WalletImpl");

const WalletFactoryModule = artifacts.require("WalletFactoryModule");
const GuardianModule = artifacts.require("GuardianModule");
const InheritanceModule = artifacts.require("InheritanceModule");
const WhitelistModule = artifacts.require("WhitelistModule");
const ApprovedTransferModule = artifacts.require("ApprovedTransferModule");
const DappTransferModule = artifacts.require("DappTransferModule");
const QuotaTransferModule = artifacts.require("QuotaTransferModule");

module.exports = function(deployer, network, accounts) {
  const guardianPendingPeriod =
    Number(process.env.guardianPendingPeriod) || 1 * 24 * 3600;
  const inheritanceWaitingPeriod =
    Number(process.env.inheritanceWaitingPeriod) || 365 * 24 * 3600;
  const whitelistDelayPeriod =
    Number(process.env.whitelistDelayPeriod) || 1 * 24 * 3600;
  const quotaDelayPeriod =
    Number(process.env.quotaDelayPeriod) || 1 * 24 * 3600;

  deployer
    .then(() => {
      let dest = [
        ForwarderModule,
        ERC1271Module,
        WalletFactoryModule,
        GuardianModule,
        InheritanceModule,
        WhitelistModule,
        ApprovedTransferModule,
        DappTransferModule,
        QuotaTransferModule
      ];
      return Promise.all([
        deployer.link(AddressUtil, dest),
        deployer.link(EIP712, dest),
        deployer.link(MathInt, dest),
        deployer.link(MathUint, dest),
        deployer.link(BytesUtil, dest),
        deployer.link(Create2, dest),
        deployer.link(strings, dest),
        deployer.link(SignedRequest, dest),
        deployer.link(Create2, dest),
        deployer.link(SignatureUtil, dest)
      ]);
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
          WalletFactoryModule,
          ControllerImpl.address,
          ForwarderModule.address,
          WalletImpl.address,
          false
        ),
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
          ApprovedTransferModule,
          ControllerImpl.address,
          ForwarderModule.address
        ),
        deployer.deploy(
          DappTransferModule,
          ControllerImpl.address,
          ForwarderModule.address
        ),
        deployer.deploy(
          QuotaTransferModule,
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
            moduleRegistry.registerModule(WalletFactoryModule.address),
            moduleRegistry.registerModule(GuardianModule.address),
            moduleRegistry.registerModule(InheritanceModule.address),
            moduleRegistry.registerModule(WhitelistModule.address),
            moduleRegistry.registerModule(ApprovedTransferModule.address),
            moduleRegistry.registerModule(DappTransferModule.address),
            moduleRegistry.registerModule(QuotaTransferModule.address)
          ]);
        })
      ]);
    })
    .then(() => {
      return Promise.all([
        WalletRegistryImpl.deployed().then(walletRegistry => {
          return Promise.all([
            walletRegistry.setWalletFactory(WalletFactoryModule.address)
          ]);
        })
      ]);
    })
    .then(() => {
      let ensManagerAddr = process.env.ENSManager || "";
      if (web3.utils.isAddress(ensManagerAddr.toLowerCase())) {
        // should be done manually.
        console.log(
          "You will have to do ensManager.addManager(WalletFactoryModule.address) manually"
        );
      } else {
        console.log(
          "add manager for BaseENSManager:",
          WalletFactoryModule.address
        );
        return Promise.all([
          BaseENSManager.deployed().then(ensManager => {
            return Promise.all([
              ensManager.addManager(WalletFactoryModule.address),
              ensManager.addManager(accounts[1])
            ]);
          })
        ]);
      }
    });
};
