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
  public BaseWallet: any;
  public WalletFactoryModule: any;
  public UpgraderModule: any;
  public WalletRegistryImpl: any;
  public ModuleRegistryImpl: any;
  public WalletENSManager: any;

  public RecoveryModule: any;
  public GuardianModule: any;
  public LockModule: any;
  public InheritanceModule: any;
  public WhitelistModule: any;
  public QuotaModule: any;
  public QuotaTransfers: any;
  public ApprovedTransfers: any;
  public ERC1271Module: any;

  public SecurityStore: any;
  public WhitelistStore: any;
  public QuotaStore: any;
  public PriceCacheStore: any;

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
    this.BaseWallet = artifacts.require("./base/BaseWallet.sol");
    this.WalletFactoryModule = artifacts.require("WalletFactoryModule");
    this.UpgraderModule = artifacts.require("UpgraderModule");
    this.WalletRegistryImpl = artifacts.require(
      "./base/WalletRegistryImpl.sol"
    );
    this.ModuleRegistryImpl = artifacts.require(
      "./base/ModuleRegistryImpl.sol"
    );
    this.WalletENSManager = artifacts.require("WalletENSManager.sol");

    this.RecoveryModule = artifacts.require("RecoveryModule");
    this.GuardianModule = artifacts.require("GuardianModule");
    this.LockModule = artifacts.require("LockModule");
    this.InheritanceModule = artifacts.require("InheritanceModule");
    this.WhitelistModule = artifacts.require("WhitelistModule");
    this.QuotaModule = artifacts.require("QuotaModule");
    this.QuotaTransfers = artifacts.require("QuotaTransfers");
    this.ApprovedTransfers = artifacts.require("ApprovedTransfers");
    this.ERC1271Module = artifacts.require("ERC1271Module");

    this.SecurityStore = artifacts.require("SecurityStore");
    this.WhitelistStore = artifacts.require("WhitelistStore");
    this.QuotaStore = artifacts.require("QuotaStore");
    this.PriceCacheStore = artifacts.require("PriceCacheStore");
  }
}
