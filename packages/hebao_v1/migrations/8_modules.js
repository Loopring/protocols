const WalletRegistry = artifacts.require("./base/WalletRegistryImpl.sol");
const ModuleRegistry = artifacts.require("./base/ModuleRegistryImpl.sol");
const ENSManager = artifacts.require("./thirdparty/ens/BaseENSManager.sol");

const ForwarderModule = artifacts.require(
  "./version1.1/core/ForwarderModule.sol"
);
const ERC1271Module = artifacts.require("./version1.1/core/ERC1271Module.sol");
const WalletFactoryModule = artifacts.require(
  "./version1.1/core/WalletFactoryModule.sol"
);
const GuardianModule = artifacts.require(
  "./version1.1/security/GuardianModule.sol"
);
const InheritanceModule = artifacts.require(
  "./version1.1/security/InheritanceModule.sol"
);
const WhitelistModule = artifacts.require(
  "./version1.1/security/WhitelistModule.sol"
);
const ApprovedTransferModule = artifacts.require(
  "./version1.1/transfers/ApprovedTransferModule.sol"
);
const DappTransferModule = artifacts.require(
  "./version1.1/transfers/DappTransferModule.sol"
);
const QuotaTransferModule = artifacts.require(
  "./version1.1/transfers/QuotaTransferModule.sol"
);

const ControllerImpl = artifacts.require("./version1.1/ControllerImpl.sol");
const WalletImpl = artifacts.require("./version1.1/WalletImpl.sol");

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
          ForwarderModule.adddress,
          WalletImpl.address,
          false
        ),
        deployer.deploy(
          GuardianModule,
          ControllerImpl.address,
          ForwarderModule.adddress,
          guardianPendingPeriod
        ),
        deployer.deploy(
          InheritanceModule,
          ControllerImpl.address,
          ForwarderModule.adddress,
          inheritanceWaitingPeriod
        ),
        deployer.deploy(
          WhitelistModule,
          ControllerImpl.address,
          ForwarderModule.adddress,
          whitelistDelayPeriod
        ),
        deployer.deploy(
          ApprovedTransferModule,
          ControllerImpl.address,
          ForwarderModule.adddress
        ),
        deployer.deploy(
          DappTransferModule,
          ControllerImpl.address,
          ForwarderModule.adddress
        ),

        deployer.deploy(
          QuotaTransferModule,
          ControllerImpl.address,
          ForwarderModule.adddress,
          quotaDelayPeriod
        )
      ]);
    })
    .then(() => {
      ModuleRegistry.deployed().then(moduleRegistry => {
        return Promise.all([
          moduleRegistry.registerModule(ForwarderModule.address),
          moduleRegistry.registerModule(ERC1271Module.address),
          moduleRegistry.registerModule(WalletFactoryModule.address),
          moduleRegistry.registerModule(GuardianModule.address),
          moduleRegistry.registerModule(InheritanceModule.address),
          moduleRegistry.registerModule(WhitelistModule.address),
          moduleRegistry.registerModule(ApprovedTransfers.address),
          moduleRegistry.registerModule(DappTransfers.address),
          moduleRegistry.registerModule(QuotaTransfers.address)
        ]);
      });
    })
    .then(() => {
      WalletRegistry.deployed().then(walletRegistry => {
        return Promise.all([
          walletRegistry.setWalletFactory(WalletFactoryModule.address)
        ]);
      });
    })
    .then(() => {
      let ensManagerAddr = process.env.ENSManager || "";
      if (web3.utils.isAddress(ensManagerAddr.toLowerCase())) {
        // should be done manually.
        console.log(
          "You will have to do ensManager.addManager(WalletFactoryModule.address) manually"
        );
      } else {
        console.log("add manager for ENSManager:", WalletFactoryModule.address);
        ENSManager.deployed().then(ensManager => {
          return Promise.all([
            ensManager.addManager(WalletFactoryModule.address),
            ensManager.addManager(accounts[1])
          ]);
        });
      }
    });
};
