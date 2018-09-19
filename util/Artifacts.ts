
export class Artifacts {
  public RingSubmitter: any;
  public RingCanceller: any;
  public TradeDelegate: any;
  public BrokerRegistry: any;
  public OrderRegistry: any;
  public DummyBrokerInterceptor: any;
  public DummyExchange: any;
  public DummyBurnManager: any;
  public FeeHolder: any;
  public OrderBook: any;
  public BurnRateTable: any;
  public DummyToken: any;
  public LRCToken: any;
  public GTOToken: any;
  public RDNToken: any;
  public REPToken: any;
  public WETHToken: any;
  public DeserializerTest: any;
  constructor(artifacts: any) {
    this.RingSubmitter = artifacts.require("impl/RingSubmitter");
    this.RingCanceller = artifacts.require("impl/RingCanceller");
    this.TradeDelegate = artifacts.require("impl/TradeDelegate");
    this.BrokerRegistry = artifacts.require("impl/BrokerRegistry");
    this.OrderRegistry = artifacts.require("impl/OrderRegistry");
    this.DummyBrokerInterceptor = artifacts.require("test/DummyBrokerInterceptor");
    this.DummyExchange = artifacts.require("test/DummyExchange");
    this.DummyBurnManager = artifacts.require("test/DummyBurnManager");
    this.FeeHolder = artifacts.require("impl/FeeHolder");
    this.OrderBook = artifacts.require("impl/OrderBook");
    this.BurnRateTable = artifacts.require("impl/BurnRateTable");
    this.DummyToken = artifacts.require("test/DummyToken");
    this.LRCToken = artifacts.require("test/tokens/LRC");
    this.GTOToken = artifacts.require("test/tokens/GTO");
    this.RDNToken = artifacts.require("test/tokens/RDN");
    this.REPToken = artifacts.require("test/tokens/REP");
    this.WETHToken = artifacts.require("test/tokens/WETH");
    this.DeserializerTest = artifacts.require("test/DeserializerTest");
  }
}
