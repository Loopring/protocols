const SignedRequest = artifacts.require("SignedRequest");

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

const DappAddressStore = artifacts.require("DappAddressStore");
const HashStore = artifacts.require("HashStore");
const NonceStore = artifacts.require("NonceStore");
const QuotaStore = artifacts.require("QuotaStore");
const SecurityStore = artifacts.require("SecurityStore");
const WhitelistStore = artifacts.require("WhitelistStore");

module.exports = function(deployer, network, accounts) {
  console.log("SignedRequest", SignedRequest.address);
  console.log("WalletRegistryImpl", WalletRegistryImpl.address);
  console.log("ModuleRegistryImpl", ModuleRegistryImpl.address);
  console.log("ForwarderModule", ForwarderModule.address);
  console.log("ERC1271Module", ERC1271Module.address);
  console.log("ControllerImpl", ControllerImpl.address);
  console.log("WalletImpl", WalletImpl.address);
  console.log("WalletFactory", WalletFactory.address);
  console.log("GuardianModule", GuardianModule.address);
  console.log("InheritanceModule", InheritanceModule.address);
  console.log("WhitelistModule", WhitelistModule.address);
  console.log("TransferModule", TransferModule.address);
  console.log("DappAddressStore", DappAddressStore.address);
  console.log("HashStore", HashStore.address);
  console.log("NonceStore", NonceStore.address);
  console.log("QuotaStore", QuotaStore.address);
  console.log("SecurityStore", SecurityStore.address);
  console.log("WhitelistStore", WhitelistStore.address);
};
