export class ExchangeTestContext {
  public orderOwners: string[];
  public orderDualAuthAddrs: string[];
  public wallet1: string;
  public allOrderTokenRecipients: string[];

  public tokenSymbolAddrMap: Map<string, string>; // key: symbol, value: addr
  public tokenAddrSymbolMap: Map<string, string>; // key: addr, value: symbol
  public tokenAddrInstanceMap: Map<string, any>;
  public allTokens: any[];

  constructor(
    orderOwners: string[],
    orderDualAuthAddrs: string[],
    wallet1: string,
    allOrderTokenRecipients: string[],
    tokenSymbolAddrMap: Map<string, string>,
    tokenAddrSymbolMap: Map<string, string>,
    tokenAddrInstanceMap: Map<string, any>,
    allTokens: any[]) {
    this.orderOwners = orderOwners;
    this.orderDualAuthAddrs = orderDualAuthAddrs;
    this.wallet1 = wallet1;
    this.allOrderTokenRecipients = allOrderTokenRecipients;
    this.tokenSymbolAddrMap = tokenSymbolAddrMap;
    this.tokenAddrSymbolMap = tokenAddrSymbolMap;
    this.tokenAddrInstanceMap = tokenAddrInstanceMap;
    this.allTokens = allTokens;
  }
}
