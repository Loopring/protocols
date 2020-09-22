export class ExchangeTestContext {
  public deployer: string;
  public stateOwners: string[];
  public operators: string[];
  public orderOwners: string[];
  public wallets: string[];

  public tokenSymbolAddrMap: Map<string, string>; // key: symbol, value: addr
  public tokenAddrSymbolMap: Map<string, string>; // key: addr, value: symbol
  public tokenAddrDecimalsMap: Map<string, number>; // key: addr, value: decimals
  public tokenAddrInstanceMap: Map<string, any>; // key: addr, value: contract
  public allTokens: any[];

  constructor(
    deployer: string,
    stateOwners: string[],
    operators: string[],
    orderOwners: string[],
    wallets: string[],
    tokenSymbolAddrMap: Map<string, string>,
    tokenAddrSymbolMap: Map<string, string>,
    tokenAddrDecimalsMap: Map<string, number>,
    tokenAddrInstanceMap: Map<string, any>,
    allTokens: any[]
  ) {
    this.deployer = deployer;
    this.stateOwners = stateOwners;
    this.operators = operators;
    this.orderOwners = orderOwners;
    this.wallets = wallets;
    this.tokenSymbolAddrMap = tokenSymbolAddrMap;
    this.tokenAddrSymbolMap = tokenAddrSymbolMap;
    this.tokenAddrDecimalsMap = tokenAddrDecimalsMap;
    this.tokenAddrInstanceMap = tokenAddrInstanceMap;
    this.allTokens = allTokens;
  }
}
