require("dotenv").config({ path: require("find-config")(".env") });

const WalletFactoryModule = artifacts.require(
  "./modules/core/WalletFactoryModule.sol"
);
const GuardianModule = artifacts.require(
  "./modules/security/GuardianModule.sol"
);
const RecoveryModule = artifacts.require(
  "./modules/security/RecoveryModule.sol"
);
const LockModule = artifacts.require("./modules/security/LockModule.sol");
const InheritanceModule = artifacts.require(
  "./modules/security/InheritanceModule.sol"
);
const WhitelistModule = artifacts.require(
  "./modules/security/WhitelistModule.sol"
);
const QuotaModule = artifacts.require("./modules/security/QuotaModule.sol");
const QuotaTransfers = artifacts.require(
  "./modules/transfers/QuotaTransfers.sol"
);
const ApprovedTransfers = artifacts.require(
  "./modules/transfers/ApprovedTransfers.sol"
);
const DappTransfers = artifacts.require(
  "./modules/transfers/DappTransfers.sol"
);

const ERC1271Module = artifacts.require("./base/ERC1271Module.sol");

const ControllerImpl = artifacts.require("./base/ControllerImpl.sol");
const BaseWallet = artifacts.require("./base/BaseWallet.sol");

const WalletRegistryImpl = artifacts.require("./base/WalletRegistryImpl.sol");
const ModuleRegistryImpl = artifacts.require("./base/ModuleRegistryImpl.sol");

const ENSManager = artifacts.require("./WalletENSManager.sol");

module.exports = function(deployer, network, accounts) {
  const guardianPendingPeriod =
    Number(process.env.guardianPendingPeriod) || 1 * 24 * 3600;
  const inheritanceWaitingPeriod =
    Number(process.env.inheritanceWaitingPeriod) || 30 * 24 * 3600;
  const whitelistDelayPeriod =
    Number(process.env.whitelistDelayPeriod) || 1 * 24 * 3600;
  const quotaDelayPeriod =
    Number(process.env.quotaDelayPeriod) || 1 * 24 * 3600;

  deployer
    .then(() => {
      return Promise.all([
        deployer.deploy(
          WalletFactoryModule,
          ControllerImpl.address,
          BaseWallet.address
        ),
        deployer.deploy(
          GuardianModule,
          ControllerImpl.address,
          guardianPendingPeriod
        ),
        deployer.deploy(RecoveryModule, ControllerImpl.address),
        deployer.deploy(LockModule, ControllerImpl.address),
        deployer.deploy(
          InheritanceModule,
          ControllerImpl.address,
          inheritanceWaitingPeriod
        ),
        deployer.deploy(
          WhitelistModule,
          ControllerImpl.address,
          whitelistDelayPeriod
        ),
        deployer.deploy(QuotaModule, ControllerImpl.address, quotaDelayPeriod),
        deployer.deploy(QuotaTransfers, ControllerImpl.address),
        deployer.deploy(ApprovedTransfers, ControllerImpl.address),
        deployer.deploy(DappTransfers, ControllerImpl.address),
        deployer.deploy(ERC1271Module)
      ]);
    })
    .then(() => {
      ModuleRegistryImpl.deployed().then(moduleRegistryImpl => {
        return Promise.all([
          moduleRegistryImpl.registerModule(WalletFactoryModule.address),
          moduleRegistryImpl.registerModule(GuardianModule.address),
          moduleRegistryImpl.registerModule(RecoveryModule.address),
          moduleRegistryImpl.registerModule(LockModule.address),
          moduleRegistryImpl.registerModule(InheritanceModule.address),
          moduleRegistryImpl.registerModule(WhitelistModule.address),
          moduleRegistryImpl.registerModule(QuotaModule.address),
          moduleRegistryImpl.registerModule(QuotaTransfers.address),
          moduleRegistryImpl.registerModule(ApprovedTransfers.address),
          moduleRegistryImpl.registerModule(DappTransfers.address),
          moduleRegistryImpl.registerModule(ERC1271Module.address)
        ]);
      });
    })
    .then(() => {
      WalletRegistryImpl.deployed().then(walletRegistryImpl => {
        return Promise.all([
          walletRegistryImpl.setWalletFactory(WalletFactoryModule.address)
        ]);
      });
    })
    .then(() => {
      let deployedEnsManagerAddr = process.env.ENSManager || "";
      if (web3.utils.isAddress(deployedEnsManagerAddr.toLowerCase())) {
        // should be done manually.
        console.log(
          "You will have to do ensManager.addManager(WalletFactoryModule.address) manually"
        );
      } else {
        console.log("add manager for ENSManager:", WalletFactoryModule.address);
        ENSManager.deployed().then(ensManager => {
          return Promise.all([
            ensManager.addManager(WalletFactoryModule.address)
          ]);
        });
      }
    });
};
