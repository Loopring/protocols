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

var ENSManager = artifacts.require("./WalletENSManager.sol");

module.exports = function(deployer, network, accounts) {
  let deployedEnsManagerAddr = process.env.ENSManager || "";
  if (!web3.utils.isAddress(deployedEnsManagerAddr.toLowerCase())) {
    deployedEnsManagerAddr = ENSManager.address;
  }

  const date = new Date().toISOString().replace(/T.+/, '');
  let report = `### Contract addresses (${date})  \n`;
  report += `- deployer: ${accounts[0]}  \n`;
  report += `- ENSManager: ${deployedEnsManagerAddr}  \n`;
  report += `- WalletRegistryImpl: ${WalletRegistryImpl.address}  \n`;
  report += `- ModuleRegistryImpl: ${ModuleRegistryImpl.address}  \n`;
  report += `- QuotaStore: ${QuotaStore.address}  \n`;
  report += `- SecurityStore: ${SecurityStore.address}  \n`;
  report += `- WhitelistStore: ${WhitelistStore.address}  \n`;
  report += `- PriceCacheStore: ${PriceCacheStore.address}  \n`;
  report += `- ControllerImpl: ${ControllerImpl.address}  \n`;
  report += `- BaseWallet: ${BaseWallet.address}  \n`;
  report += `- WalletFactoryModule: ${WalletFactoryModule.address}  \n`;
  report += `- GuardianModule: ${GuardianModule.address}  \n`;
  report += `- RecoveryModule: ${RecoveryModule.address}  \n`;
  report += `- LockModule: ${LockModule.address}  \n`;
  report += `- InheritanceModule: ${InheritanceModule.address}  \n`;
  report += `- WhitelistModule: ${WhitelistModule.address}  \n`;
  report += `- QuotaModule: ${QuotaModule.address}  \n`;
  report += `- QuotaTransfers: ${QuotaTransfers.address}  \n`;
  report += `- ApprovedTransfers: ${ApprovedTransfers.address}  \n`;
  report += `- ERC1271Module: ${ERC1271Module.address}  \n`;
  report += `- LoopringModule: ${LoopringModule.address}  \n`;
  report += `- LRCStakingModule: ${LRCStakingModule.address}  \n`;

  console.log("report:\n", report);
};
