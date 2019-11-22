export class Artifacts {
  public MockContract: any;
  public ExchangeConstants: any;
  public UniversalRegistry: any;
  public LoopringV3: any;
  public ExchangeV3: any;
  public BlockVerifier: any;
  public FixPriceDowntimeCostCalculator: any;
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
  public AccountContract: any;
  public LzDecompressor: any;
  public TransferContract: any;
  public PoseidonContract: any;
  public UserStakingPool: any;
  public ProtocolFeeVault: any;
  public UniswapTokenSeller: any;
  public AddressWhitelist: any;
  public DelayedOwnerContract: any;
  public DelayedTargetContract: any;

  constructor(artifacts: any) {
    this.MockContract = artifacts.require("thirdparty/MockContract.sol");
    this.ExchangeConstants = artifacts.require("impl/lib/ExchangeConstants");
    this.UniversalRegistry = artifacts.require("impl/UniversalRegistry");
    this.LoopringV3 = artifacts.require("impl/LoopringV3");
    this.ExchangeV3 = artifacts.require("impl/ExchangeV3");
    this.BlockVerifier = artifacts.require("impl/BlockVerifier");
    this.FixPriceDowntimeCostCalculator = artifacts.require(
      "test/FixPriceDowntimeCostCalculator"
    );
    this.DummyToken = artifacts.require("test/DummyToken");
    this.LRCToken = artifacts.require("test/tokens/LRC");
    this.GTOToken = artifacts.require("test/tokens/GTO");
    this.RDNToken = artifacts.require("test/tokens/RDN");
    this.REPToken = artifacts.require("test/tokens/REP");
    this.WETHToken = artifacts.require("test/tokens/WETH");
    this.INDAToken = artifacts.require("test/tokens/INDA");
    this.INDBToken = artifacts.require("test/tokens/INDB");
    this.TESTToken = artifacts.require("test/tokens/TEST");
    this.Operator = artifacts.require("test/Operator");
    this.AccountContract = artifacts.require("test/AccountContract");
    this.LzDecompressor = artifacts.require("test/LzDecompressor");
    this.TransferContract = artifacts.require("test/TransferContract");
    this.PoseidonContract = artifacts.require("test/PoseidonContract");
    this.UserStakingPool = artifacts.require("impl/UserStakingPool");
    this.AddressWhitelist = artifacts.require(
      "./impl/SignatureBasedAddressWhitelist.sol"
    );
    this.ProtocolFeeVault = artifacts.require("impl/ProtocolFeeVault");
    this.DelayedOwnerContract = artifacts.require("test/DelayedOwnerContract");
    this.DelayedTargetContract = artifacts.require(
      "test/DelayedTargetContract"
    );
  }
}
