var SignedRequest = artifacts.require("SignedRequest");

const ModuleRegistryImpl = artifacts.require("ModuleRegistryImpl");
const BaseENSManager = artifacts.require("BaseENSManager");

const ControllerImpl = artifacts.require("ControllerImpl");
const WalletImpl = artifacts.require("WalletImpl");

const OfficialGuardian = artifacts.require("OfficialGuardian");

const WalletFactory = artifacts.require("WalletFactory");
const FinalCoreModule = artifacts.require("FinalCoreModule");
const FinalSecurityModule = artifacts.require("FinalSecurityModule");
const FinalTransferModule = artifacts.require("FinalTransferModule");
const AddOfficialGuardianModule = artifacts.require(
  "AddOfficialGuardianModule"
);

module.exports = function(deployer, network, accounts) {
  const ensOperator = process.env.ensOperator || accounts[1];
  const ensManagerAddr = process.env.ENSManager || "";

  deployer.then(async () => {
    await deployer.deploy(OfficialGuardian);

    const dest = [FinalCoreModule, FinalSecurityModule, FinalTransferModule];
    await deployer.link(SignedRequest, dest);
    await deployer.deploy(FinalCoreModule, ControllerImpl.address, {
      gas: 6700000
    });
    await deployer.deploy(
      FinalSecurityModule,
      ControllerImpl.address,
      FinalCoreModule.address,
      { gas: 6700000 }
    );
    await deployer.deploy(
      FinalTransferModule,
      ControllerImpl.address,
      FinalCoreModule.address,
      { gas: 6700000 }
    );

    await deployer.deploy(
      AddOfficialGuardianModule,
      ControllerImpl.address,
      OfficialGuardian.address,
      11,
      { gas: 6700000 }
    );

    const moduleRegistry = await ModuleRegistryImpl.deployed();
    const walletFactory = await WalletFactory.deployed();
    const ensManager = await BaseENSManager.deployed();

    let setupFuncList = [
      moduleRegistry.registerModule(FinalCoreModule.address),
      moduleRegistry.registerModule(FinalSecurityModule.address),
      moduleRegistry.registerModule(FinalTransferModule.address)
    ];

    if (!web3.utils.isAddress(ensManagerAddr.toLowerCase())) {
      setupFuncList = setupFuncList.concat([
        ensManager.addManager(WalletFactory.address),
        ensManager.addManager(ensOperator)
      ]);
    }

    return Promise.all(setupFuncList);
  });
};
