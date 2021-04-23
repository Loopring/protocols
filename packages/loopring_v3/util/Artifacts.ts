export class Artifacts {
  public MockContract: any;
  public LoopringV3: any;
  public ExchangeV3: any;
  public BlockVerifier: any;
  public DummyToken: any;
  public LRCToken: any;
  public GTOToken: any;
  public RDNToken: any;
  public REPToken: any;
  public WETHToken: any;
  public INDAToken: any;
  public INDBToken: any;
  public TESTToken: any;
  public TestAccountContract: any;
  public TransferContract: any;
  public PoseidonContract: any;
  public UserStakingPool: any;
  public ProtocolFeeVault: any;
  public UniswapTokenSeller: any;
  public AddressWhitelist: any;
  public DelayedOwnerContract: any;
  public DelayedTargetContract: any;
  public DefaultDepositContract: any;
  public OwnedUpgradabilityProxy: any;

  constructor(artifacts: any) {
    this.MockContract = artifacts.require("MockContract");
    this.LoopringV3 = artifacts.require("LoopringV3");
    this.ExchangeV3 = artifacts.require("ExchangeV3");
    this.BlockVerifier = artifacts.require("BlockVerifier");

    this.DummyToken = artifacts.require("test/DummyToken");
    this.LRCToken = artifacts.require("test/tokens/LRC");
    this.GTOToken = artifacts.require("test/tokens/GTO");
    this.RDNToken = artifacts.require("test/tokens/RDN");
    this.REPToken = artifacts.require("test/tokens/REP");
    this.WETHToken = artifacts.require("test/tokens/WETH");
    this.INDAToken = artifacts.require("test/tokens/INDA");
    this.INDBToken = artifacts.require("test/tokens/INDB");
    this.TESTToken = artifacts.require("test/tokens/TEST");
    this.TestAccountContract = artifacts.require("TestAccountContract");
    this.TransferContract = artifacts.require("TransferContract");
    this.PoseidonContract = artifacts.require("PoseidonContract");
    this.UserStakingPool = artifacts.require("UserStakingPool");
    this.ProtocolFeeVault = artifacts.require("ProtocolFeeVault");
    this.DelayedOwnerContract = artifacts.require("DelayedOwnerContract");
    this.DelayedTargetContract = artifacts.require("DelayedTargetContract");
    this.DefaultDepositContract = artifacts.require("DefaultDepositContract");
    this.OwnedUpgradabilityProxy = artifacts.require("OwnedUpgradabilityProxy");
  }
}
