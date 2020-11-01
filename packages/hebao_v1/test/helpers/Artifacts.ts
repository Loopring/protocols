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

  public SimpleProxy: any;

  public ControllerImpl: any;
  public WalletImpl: any;
  public WalletFactory: any;
  public UpgraderModule: any;
  public ModuleRegistryImpl: any;
  public BaseENSManager: any;
  public ENSRegistryImpl: any;

  public FinalCoreModule: any;
  public FinalSecurityModule: any;
  public FinalTransferModule: any;

  public HashStore: any;
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
    this.PriceCacheStore = artifacts.require("test/PriceCacheStore");

    this.SimpleProxy = artifacts.require("SimpleProxy");

    this.ControllerImpl = artifacts.require("./base/ControllerImpl.sol");
    this.WalletImpl = artifacts.require("./base/WalletImpl.sol");
    this.WalletFactory = artifacts.require("WalletFactory");
    this.UpgraderModule = artifacts.require("UpgraderModule");
    this.ModuleRegistryImpl = artifacts.require(
      "./base/ModuleRegistryImpl.sol"
    );
    this.BaseENSManager = artifacts.require("BaseENSManager.sol");
    this.ENSRegistryImpl = artifacts.require("ENSRegistryImpl.sol");

    this.FinalCoreModule = artifacts.require("FinalCoreModule");
    this.FinalSecurityModule = artifacts.require("FinalSecurityModule");
    this.FinalTransferModule = artifacts.require("FinalTransferModule");

    this.HashStore = artifacts.require("HashStore");
    this.SecurityStore = artifacts.require("SecurityStore");
    this.WhitelistStore = artifacts.require("WhitelistStore");
    this.QuotaStore = artifacts.require("QuotaStore");
  }
}
