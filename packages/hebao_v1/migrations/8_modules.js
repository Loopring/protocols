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
const ERC1271Module = artifacts.require("./base/ERC1271Module.sol");
const LoopringModule = artifacts.require(
  "./modules/exchanges/LoopringModule.sol"
);
const LRCStakingModule = artifacts.require(
  "./modules/dapps/LRCStakingModule.sol"
);

const ControllerImpl = artifacts.require("./base/ControllerImpl.sol");
const BaseWallet = artifacts.require("./base/BaseWallet.sol");

const QuotaStore = artifacts.require("./stores/QuotaStore.sol");
const SecurityStore = artifacts.require("./stores/SecurityStore.sol");
const WhitelistStore = artifacts.require("./stores/WhitelistStore.sol");
const PriceCacheStore = artifacts.require("./stores/PriceCacheStore.sol");

const WalletRegistryImpl = artifacts.require("./base/WalletRegistryImpl.sol");
const ModuleRegistryImpl = artifacts.require("./base/ModuleRegistryImpl.sol");

const ENSManager = artifacts.require("./WalletENSManager.sol");

// const LRCToken = artifacts.require("./test/tokens/LRC.sol");
// const lrcTokenAddress = process.env.lrcTokenAddress || LRCToken.address;
// const stakingPoolAddress = process.env.stakingPoolAddress || `0x${"0".repeat(40)}`;

module.exports = function(deployer, network, accounts) {
  const guardianPendingPeriod = Number(process.env.guardianPendingPeriod) || 1 * 24 * 3600;
  const inheritanceWaitingPeriod = Number(process.env.inheritanceWaitingPeriod) || 30 * 24 * 3600;
  const whitelistDelayPeriod = Number(process.env.whitelistDelayPeriod) || 1 * 24 * 3600;
  const quotaDelayPeriod = Number(process.env.quotaDelayPeriod) || 1 * 24 * 3600;
  const quotaTransDelayPeriod = Number(process.env.quotaTransDelayPeriod) || 1 * 24 * 3600;

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
        deployer.deploy(WhitelistModule, ControllerImpl.address, whitelistDelayPeriod),
        deployer.deploy(QuotaModule, ControllerImpl.address, quotaDelayPeriod),
        deployer.deploy(QuotaTransfers, ControllerImpl.address, quotaTransDelayPeriod),
        deployer.deploy(ApprovedTransfers, ControllerImpl.address),
        deployer.deploy(ERC1271Module),
        deployer.deploy(LoopringModule, ControllerImpl.address),
        deployer.deploy(LRCStakingModule, ControllerImpl.address)
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
          securityStore.addManager(ApprovedTransfers.address),
          securityStore.addManager(LoopringModule.address),
          securityStore.addManager(LRCStakingModule.address)
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
          quotaStore.addManager(GuardianModule.address),
          quotaStore.addManager(RecoveryModule.address),
          quotaStore.addManager(LockModule.address),
          quotaStore.addManager(InheritanceModule.address),
          quotaStore.addManager(WhitelistModule.address),
          quotaStore.addManager(QuotaModule.address),
          quotaStore.addManager(QuotaTransfers.address),
          quotaStore.addManager(ApprovedTransfers.address)
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
          moduleRegistryImpl.registerModule(ApprovedTransfers.address),
          moduleRegistryImpl.registerModule(ERC1271Module.address),
          moduleRegistryImpl.registerModule(LoopringModule.address),
          moduleRegistryImpl.registerModule(LRCStakingModule.address)
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
        console.log("You will have to do ensManager.addManager(WalletFactoryModule.address) manually");
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
