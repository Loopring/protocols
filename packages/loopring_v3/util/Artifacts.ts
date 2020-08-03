export class Artifacts {
  public MockContract: any;
  public UniversalRegistry: any;
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
  public Operator: any;
  public StatelessWallet: any;
  public TestAccountContract: any;
  public LzDecompressor: any;
  public TransferContract: any;
  public PoseidonContract: any;
  public LzDecompressorContract: any;
  public UserStakingPool: any;
  public ProtocolFeeVault: any;
  public UniswapTokenSeller: any;
  public AddressWhitelist: any;
  public DelayedOwnerContract: any;
  public DelayedTargetContract: any;
  public BasicDepositContract: any;
  public OwnedUpgradeabilityProxy: any;

  constructor(artifacts: any) {
    this.MockContract = artifacts.require("thirdparty/MockContract.sol");
    this.UniversalRegistry = artifacts.require("impl/UniversalRegistry");
    this.LoopringV3 = artifacts.require("impl/LoopringV3");
    this.ExchangeV3 = artifacts.require("impl/ExchangeV3");
    this.BlockVerifier = artifacts.require("impl/BlockVerifier");
    this.Operator = artifacts.require("impl/Operator");
    this.StatelessWallet = artifacts.require("impl/StatelessWallet");

    this.DummyToken = artifacts.require("test/DummyToken");
    this.LRCToken = artifacts.require("test/tokens/LRC");
    this.GTOToken = artifacts.require("test/tokens/GTO");
    this.RDNToken = artifacts.require("test/tokens/RDN");
    this.REPToken = artifacts.require("test/tokens/REP");
    this.WETHToken = artifacts.require("test/tokens/WETH");
    this.INDAToken = artifacts.require("test/tokens/INDA");
    this.INDBToken = artifacts.require("test/tokens/INDB");
    this.TESTToken = artifacts.require("test/tokens/TEST");
    this.TestAccountContract = artifacts.require("test/TestAccountContract");
    this.LzDecompressor = artifacts.require("test/LzDecompressor");
    this.TransferContract = artifacts.require("test/TransferContract");
    this.PoseidonContract = artifacts.require("test/PoseidonContract");
    this.LzDecompressorContract = artifacts.require("test/LzDecompressorContract");
    this.UserStakingPool = artifacts.require("impl/UserStakingPool");
    this.ProtocolFeeVault = artifacts.require("impl/ProtocolFeeVault");
    this.DelayedOwnerContract = artifacts.require("test/DelayedOwnerContract");
    this.DelayedTargetContract = artifacts.require(
      "test/DelayedTargetContract"
    );
    this.BasicDepositContract = artifacts.require(
      "./impl/BasicDepositContract"
    );
    this.OwnedUpgradeabilityProxy = artifacts.require(
      "./impl/OwnedUpgradeabilityProxy"
    );
  }
}
