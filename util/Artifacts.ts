
export class Artifacts {
  public RingSubmitter: any;
  public RingCanceller: any;
  public TradeDelegate: any;
  public BrokerRegistry: any;
  public OrderRegistry: any;
  public MinerRegistry: any;
  public DummyBrokerInterceptor: any;
  public DummyExchange: any;
  public DummyTaxManager: any;
  public FeeHolder: any;
  public OrderBook: any;
  public TaxTable: any;
  public DummyToken: any;
  public LRCToken: any;
  public GTOToken: any;
  public RDNToken: any;
  public REPToken: any;
  public WETHToken: any;
  constructor(artifacts: any) {
    this.RingSubmitter = artifacts.require("impl/RingSubmitter");
    this.RingCanceller = artifacts.require("impl/RingCanceller");
    this.TradeDelegate = artifacts.require("impl/TradeDelegate");
    this.BrokerRegistry = artifacts.require("impl/BrokerRegistry");
    this.OrderRegistry = artifacts.require("impl/OrderRegistry");
    this.MinerRegistry = artifacts.require("impl/MinerRegistry");
    this.DummyBrokerInterceptor = artifacts.require("test/DummyBrokerInterceptor");
    this.DummyExchange = artifacts.require("test/DummyExchange");
    this.DummyTaxManager = artifacts.require("test/DummyTaxManager");
    this.FeeHolder = artifacts.require("impl/FeeHolder");
    this.OrderBook = artifacts.require("impl/OrderBook");
    this.TaxTable = artifacts.require("impl/TaxTable");
    this.DummyToken = artifacts.require("test/DummyToken");
    this.LRCToken = artifacts.require("test/tokens/LRC");
    this.GTOToken = artifacts.require("test/tokens/GTO");
    this.RDNToken = artifacts.require("test/tokens/RDN");
    this.REPToken = artifacts.require("test/tokens/REP");
    this.WETHToken = artifacts.require("test/tokens/WETH");
  }
}
