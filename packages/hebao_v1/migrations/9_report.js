const ENSManager = artifacts.require("./thirdparty/ens/BaseENSManager.sol");
const WalletRegistry = artifacts.require("./base/WalletRegistryImpl.sol");
const ModuleRegistry = artifacts.require("./base/ModuleRegistryImpl.sol");

const DappAddressStore = artifacts.require("./stores/DappAddressStore.sol");
const NonceStore = artifacts.require("./stores/NonceStore.sol");
const QuotaStore = artifacts.require("./stores/QuotaStore.sol");
const SecurityStore = artifacts.require("./stores/SecurityStore.sol");
const WhitelistStore = artifacts.require("./stores/WhitelistStore.sol");

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
  let ensManagerAddr = process.env.ENSManager || "";
  if (!web3.utils.isAddress(ensManagerAddr.toLowerCase())) {
    ensManagerAddr = ENSManager.address;
  }

  const date = new Date().toISOString().replace(/T.+/, "");
  let report = `### Contract addresses (${date})  \n`;
  report += `- deployer: ${accounts[0]}  \n`;
  report += `- ENSManager: ${ensManagerAddr}  \n`;
  report += `- WalletRegistry: ${WalletRegistry.address}  \n`;
  report += `- ModuleRegistry: ${ModuleRegistry.address}  \n`;

  report += `- DappAddressStore: ${DappAddressStore.address}  \n`;
  report += `- NonceStore: ${NonceStore.address}  \n`;
  report += `- QuotaStore: ${QuotaStore.address}  \n`;
  report += `- SecurityStore: ${SecurityStore.address}  \n`;
  report += `- WhitelistStore: ${WhitelistStore.address}  \n`;

  report += `- ForwarderModule: ${ForwarderModule.address}  \n`;
  report += `- ERC1271Module: ${ERC1271Module.address}  \n`;
  report += `- WalletFactoryModule: ${WalletFactoryModule.address}  \n`;
  report += `- GuardianModule: ${GuardianModule.address}  \n`;
  report += `- InheritanceModule: ${InheritanceModule.address}  \n`;
  report += `- WhitelistModule: ${WhitelistModule.address}  \n`;
  report += `- ApprovedTransferModule: ${ApprovedTransferModule.address}  \n`;
  report += `- DappTransferModule: ${DappTransferModule.address}  \n`;
  report += `- QuotaTransferModule: ${QuotaTransferModule.address}  \n`;

  report += `- ControllerImpl: ${ControllerImpl.address}  \n`;
  report += `- WalletImpl: ${ModuleRegistry.address}  \n`;

  console.log("report:\n" + report);
};
