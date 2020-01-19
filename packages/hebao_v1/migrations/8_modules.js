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

const ControllerImpl = artifacts.require("./base/ControllerImpl.sol");
const BaseWallet = artifacts.require("./base/BaseWallet.sol");

const QuotaStore = artifacts.require("./stores/QuotaStore.sol");
const SecurityStore = artifacts.require("./stores/SecurityStore.sol");
const WhitelistStore = artifacts.require("./stores/WhitelistStore.sol");
const PriceCacheStore = artifacts.require("./stores/PriceCacheStore.sol");

const WalletRegistryImpl = artifacts.require("./base/WalletRegistryImpl.sol");
const ModuleRegistryImpl = artifacts.require("./base/ModuleRegistryImpl.sol");

var ENSManager = artifacts.require("./WalletENSManager.sol");

module.exports = function(deployer, network, accounts) {
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
          1 * 24 * 3600,
          1 * 24 * 3600
        ),
        deployer.deploy(RecoveryModule, ControllerImpl.address),
        deployer.deploy(LockModule, ControllerImpl.address),
        deployer.deploy(
          InheritanceModule,
          ControllerImpl.address,
          30 * 24 * 3600
        ),
        deployer.deploy(WhitelistModule, ControllerImpl.address, 1 * 24 * 3600),
        deployer.deploy(QuotaModule, ControllerImpl.address, 1 * 24 * 3600),
        deployer.deploy(QuotaTransfers, ControllerImpl.address, 1 * 24 * 3600),
        deployer.deploy(ApprovedTransfers, ControllerImpl.address)
      ]);
    })
    .then(() => {
      SecurityStore.deployed().then(securityStore => {
        return Promise.all([
          securityStore.addManager(GuardianModule.address),
          securityStore.addManager(LockModule.address),
          securityStore.addManager(InheritanceModule.address),
          securityStore.addManager(WhitelistModule.address),
          securityStore.addManager(QuotaModule.address),
          securityStore.addManager(QuotaTransfers.address),
          securityStore.addManager(ApprovedTransfers.address)
        ]);
      });
    })
    .then(() => {
      WhitelistStore.deployed().then(whitelistStore => {
        return Promise.all([
          whitelistStore.addManager(WhitelistModule.address)
        ]);
      });
    })
    .then(() => {
      QuotaStore.deployed().then(quotaStore => {
        return Promise.all([
          quotaStore.addManager(QuotaModule.address),
          quotaStore.addManager(QuotaTransfers.address)
        ]);
      });
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
          moduleRegistryImpl.registerModule(ApprovedTransfers.address)
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
      ENSManager.deployed().then(ensManager => {
        return Promise.all([
          ensManager.addManager(WalletFactoryModule.address)
        ]);
      });
    })
    .then(() => {
      console.log(">>>>>>>> contracts deployed by modules:");
      console.log("WalletFactoryModule:", WalletFactoryModule.address);
      console.log("GuardianModule:", GuardianModule.address);
      console.log("RecoveryModule:", RecoveryModule.address);
      console.log("LockModule:", LockModule.address);
      console.log("InheritanceModule:", InheritanceModule.address);
      console.log("WhitelistModule:", WhitelistModule.address);
      console.log("QuotaModule:", QuotaModule.address);
      console.log("QuotaTransfers:", QuotaTransfers.address);
      console.log("ApprovedTransfers:", ApprovedTransfers.address);
      console.log("");
    });
};
