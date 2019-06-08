
export class Artifacts {
  public LoopringV3: any;
  public Exchange: any;
  public ExchangeDeployer: any;
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
  public AccountContract: any;
  constructor(artifacts: any) {
    this.LoopringV3 = artifacts.require("impl/LoopringV3");
    this.Exchange = artifacts.require("impl/Exchange");
    this.ExchangeDeployer = artifacts.require("impl/ExchangeDeployer");
    this.BlockVerifier = artifacts.require("impl/BlockVerifier");
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
  }
}
