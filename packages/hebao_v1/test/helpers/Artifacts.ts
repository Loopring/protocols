export class Artifacts {
  public MockContract: any;
  public DummyToken: any;
  public LRCToken: any;
  public GTOToken: any;
  public RDNToken: any;
  public REPToken: any;
  public WETHToken: any;
  public INDAToken: any;
  public INDBToken: any;

  public OwnedUpgradabilityProxy: any;

  public ControllerImpl: any;
  public WalletImpl: any;
  public WalletFactory: any;
  public ForwarderModule: any;
  public UpgraderModule: any;
  public WalletRegistryImpl: any;
  public ModuleRegistryImpl: any;
  public BaseENSManager: any;
  public ENSRegistryImpl: any;

  public GuardianModule: any;
  public InheritanceModule: any;
  public WhitelistModule: any;
  public TransferModule: any;
  public ERC1271Module: any;

  public SecurityStore: any;
  public WhitelistStore: any;
  public QuotaStore: any;
  public PriceCacheStore: any;
  public NonceStore: any;

  constructor(artifacts: any) {
    this.MockContract = artifacts.require("thirdparty/MockContract.sol");
    this.DummyToken = artifacts.require("test/DummyToken");
    this.LRCToken = artifacts.require("test/tokens/LRC");
    this.GTOToken = artifacts.require("test/tokens/GTO");
    this.RDNToken = artifacts.require("test/tokens/RDN");
    this.REPToken = artifacts.require("test/tokens/REP");
    this.WETHToken = artifacts.require("test/tokens/WETH");
    this.INDAToken = artifacts.require("test/tokens/INDA");
    this.INDBToken = artifacts.require("test/tokens/INDB");

    this.OwnedUpgradabilityProxy = artifacts.require("OwnedUpgradabilityProxy");

    this.ControllerImpl = artifacts.require("./base/ControllerImpl.sol");
    this.WalletImpl = artifacts.require("./base/WalletImpl.sol");
    this.WalletFactory = artifacts.require("WalletFactory");
    this.ForwarderModule = artifacts.require("ForwarderModule");
    this.UpgraderModule = artifacts.require("UpgraderModule");
    this.WalletRegistryImpl = artifacts.require(
      "./base/WalletRegistryImpl.sol"
    );
    this.ModuleRegistryImpl = artifacts.require(
      "./base/ModuleRegistryImpl.sol"
    );
    this.BaseENSManager = artifacts.require("BaseENSManager.sol");
    this.ENSRegistryImpl = artifacts.require("ENSRegistryImpl.sol");

    this.GuardianModule = artifacts.require("GuardianModule");
    this.InheritanceModule = artifacts.require("InheritanceModule");
    this.WhitelistModule = artifacts.require("WhitelistModule");
    this.TransferModule = artifacts.require("TransferModule");
    this.ERC1271Module = artifacts.require("ERC1271Module");

    this.SecurityStore = artifacts.require("SecurityStore");
    this.WhitelistStore = artifacts.require("WhitelistStore");
    this.QuotaStore = artifacts.require("QuotaStore");
    this.NonceStore = artifacts.require("NonceStore");
  }
}
