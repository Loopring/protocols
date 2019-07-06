import * as jspb from "google-protobuf"

import * as google_protobuf_empty_pb from 'google-protobuf/google/protobuf/empty_pb';
import * as google_protobuf_wrappers_pb from 'google-protobuf/google/protobuf/wrappers_pb';
import * as data_order_pb from './data_order_pb';
import * as data_requests_pb from './data_requests_pb';
import * as data_types_pb from './data_types_pb';

export class DexConfigurations extends jspb.Message {
  getDexId(): number;
  setDexId(value: number): void;

  getDexAddress(): string;
  setDexAddress(value: string): void;

  getDepositFeeEth(): string;
  setDepositFeeEth(value: string): void;

  getOnchainWithdrawalFeeEth(): string;
  setOnchainWithdrawalFeeEth(value: string): void;

  getOffchainWithdrawalFeeTokenId(): data_types_pb.TokenID | undefined;
  setOffchainWithdrawalFeeTokenId(value?: data_types_pb.TokenID): void;
  hasOffchainWithdrawalFeeTokenId(): boolean;
  clearOffchainWithdrawalFeeTokenId(): void;

  getOffchainWithdrawalFeeAmount(): string;
  setOffchainWithdrawalFeeAmount(value: string): void;

  getOrderCancellationFeeEth(): string;
  setOrderCancellationFeeEth(value: string): void;

  getInMaintainance(): boolean;
  setInMaintainance(value: boolean): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): DexConfigurations.AsObject;
  static toObject(includeInstance: boolean, msg: DexConfigurations): DexConfigurations.AsObject;
  static serializeBinaryToWriter(message: DexConfigurations, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): DexConfigurations;
  static deserializeBinaryFromReader(message: DexConfigurations, reader: jspb.BinaryReader): DexConfigurations;
}

export namespace DexConfigurations {
  export type AsObject = {
    dexId: number,
    dexAddress: string,
    depositFeeEth: string,
    onchainWithdrawalFeeEth: string,
    offchainWithdrawalFeeTokenId?: data_types_pb.TokenID.AsObject,
    offchainWithdrawalFeeAmount: string,
    orderCancellationFeeEth: string,
    inMaintainance: boolean,
  }
}

export class TokenInfo extends jspb.Message {
  getId(): number;
  setId(value: number): void;

  getSymbol(): string;
  setSymbol(value: string): void;

  getAddress(): string;
  setAddress(value: string): void;

  getDecimals(): number;
  setDecimals(value: number): void;

  getStatus(): string;
  setStatus(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): TokenInfo.AsObject;
  static toObject(includeInstance: boolean, msg: TokenInfo): TokenInfo.AsObject;
  static serializeBinaryToWriter(message: TokenInfo, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): TokenInfo;
  static deserializeBinaryFromReader(message: TokenInfo, reader: jspb.BinaryReader): TokenInfo;
}

export namespace TokenInfo {
  export type AsObject = {
    id: number,
    symbol: string,
    address: string,
    decimals: number,
    status: string,
  }
}

export class GetTokensReq extends jspb.Message {
  getRequireMetadata(): boolean;
  setRequireMetadata(value: boolean): void;

  getRequireInfo(): boolean;
  setRequireInfo(value: boolean): void;

  getRequirePrice(): boolean;
  setRequirePrice(value: boolean): void;

  getQuoteCurrencyForPrice(): string;
  setQuoteCurrencyForPrice(value: string): void;

  getTokensList(): Array<string>;
  setTokensList(value: Array<string>): void;
  clearTokensList(): void;
  addTokens(value: string, index?: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetTokensReq.AsObject;
  static toObject(includeInstance: boolean, msg: GetTokensReq): GetTokensReq.AsObject;
  static serializeBinaryToWriter(message: GetTokensReq, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetTokensReq;
  static deserializeBinaryFromReader(message: GetTokensReq, reader: jspb.BinaryReader): GetTokensReq;
}

export namespace GetTokensReq {
  export type AsObject = {
    requireMetadata: boolean,
    requireInfo: boolean,
    requirePrice: boolean,
    quoteCurrencyForPrice: string,
    tokensList: Array<string>,
  }
}

export class GetTokensRes extends jspb.Message {
  getTokensList(): Array<data_types_pb.Token>;
  setTokensList(value: Array<data_types_pb.Token>): void;
  clearTokensList(): void;
  addTokens(value?: data_types_pb.Token, index?: number): data_types_pb.Token;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetTokensRes.AsObject;
  static toObject(includeInstance: boolean, msg: GetTokensRes): GetTokensRes.AsObject;
  static serializeBinaryToWriter(message: GetTokensRes, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetTokensRes;
  static deserializeBinaryFromReader(message: GetTokensRes, reader: jspb.BinaryReader): GetTokensRes;
}

export namespace GetTokensRes {
  export type AsObject = {
    tokensList: Array<data_types_pb.Token.AsObject>,
  }
}

export class GetMarketsReq extends jspb.Message {
  getRequireMetadata(): boolean;
  setRequireMetadata(value: boolean): void;

  getRequireTicker(): boolean;
  setRequireTicker(value: boolean): void;

  getQueryLoopringTicker(): boolean;
  setQueryLoopringTicker(value: boolean): void;

  getQuoteCurrencyForTicker(): string;
  setQuoteCurrencyForTicker(value: string): void;

  getMarketIdList(): Array<number>;
  setMarketIdList(value: Array<number>): void;
  clearMarketIdList(): void;
  addMarketId(value: number, index?: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetMarketsReq.AsObject;
  static toObject(includeInstance: boolean, msg: GetMarketsReq): GetMarketsReq.AsObject;
  static serializeBinaryToWriter(message: GetMarketsReq, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetMarketsReq;
  static deserializeBinaryFromReader(message: GetMarketsReq, reader: jspb.BinaryReader): GetMarketsReq;
}

export namespace GetMarketsReq {
  export type AsObject = {
    requireMetadata: boolean,
    requireTicker: boolean,
    queryLoopringTicker: boolean,
    quoteCurrencyForTicker: string,
    marketIdList: Array<number>,
  }
}

export class GetMarketsRes extends jspb.Message {
  getMarketsList(): Array<data_types_pb.Market>;
  setMarketsList(value: Array<data_types_pb.Market>): void;
  clearMarketsList(): void;
  addMarkets(value?: data_types_pb.Market, index?: number): data_types_pb.Market;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetMarketsRes.AsObject;
  static toObject(includeInstance: boolean, msg: GetMarketsRes): GetMarketsRes.AsObject;
  static serializeBinaryToWriter(message: GetMarketsRes, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetMarketsRes;
  static deserializeBinaryFromReader(message: GetMarketsRes, reader: jspb.BinaryReader): GetMarketsRes;
}

export namespace GetMarketsRes {
  export type AsObject = {
    marketsList: Array<data_types_pb.Market.AsObject>,
  }
}

export class TokenBalance extends jspb.Message {
  getId(): number;
  setId(value: number): void;

  getBalance(): string;
  setBalance(value: string): void;

  getOrderFrozen(): string;
  setOrderFrozen(value: string): void;

  getWithdrawFrozen(): string;
  setWithdrawFrozen(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): TokenBalance.AsObject;
  static toObject(includeInstance: boolean, msg: TokenBalance): TokenBalance.AsObject;
  static serializeBinaryToWriter(message: TokenBalance, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): TokenBalance;
  static deserializeBinaryFromReader(message: TokenBalance, reader: jspb.BinaryReader): TokenBalance;
}

export namespace TokenBalance {
  export type AsObject = {
    id: number,
    balance: string,
    orderFrozen: string,
    withdrawFrozen: string,
  }
}

export class Account extends jspb.Message {
  getAddress(): string;
  setAddress(value: string): void;

  getAccountId(): data_types_pb.AccountID | undefined;
  setAccountId(value?: data_types_pb.AccountID): void;
  hasAccountId(): boolean;
  clearAccountId(): void;

  getBalancesList(): Array<TokenBalance>;
  setBalancesList(value: Array<TokenBalance>): void;
  clearBalancesList(): void;
  addBalances(value?: TokenBalance, index?: number): TokenBalance;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Account.AsObject;
  static toObject(includeInstance: boolean, msg: Account): Account.AsObject;
  static serializeBinaryToWriter(message: Account, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Account;
  static deserializeBinaryFromReader(message: Account, reader: jspb.BinaryReader): Account;
}

export namespace Account {
  export type AsObject = {
    address: string,
    accountId?: data_types_pb.AccountID.AsObject,
    balancesList: Array<TokenBalance.AsObject>,
  }
}

export class GetAvailableBalanceReq extends jspb.Message {
  getAccountId(): number;
  setAccountId(value: number): void;

  getTokenAddressesList(): Array<string>;
  setTokenAddressesList(value: Array<string>): void;
  clearTokenAddressesList(): void;
  addTokenAddresses(value: string, index?: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetAvailableBalanceReq.AsObject;
  static toObject(includeInstance: boolean, msg: GetAvailableBalanceReq): GetAvailableBalanceReq.AsObject;
  static serializeBinaryToWriter(message: GetAvailableBalanceReq, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetAvailableBalanceReq;
  static deserializeBinaryFromReader(message: GetAvailableBalanceReq, reader: jspb.BinaryReader): GetAvailableBalanceReq;
}

export namespace GetAvailableBalanceReq {
  export type AsObject = {
    accountId: number,
    tokenAddressesList: Array<string>,
  }
}

export class GetAvailableBalanceRes extends jspb.Message {
  getAvailableBalancesList(): Array<TokenBalance>;
  setAvailableBalancesList(value: Array<TokenBalance>): void;
  clearAvailableBalancesList(): void;
  addAvailableBalances(value?: TokenBalance, index?: number): TokenBalance;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetAvailableBalanceRes.AsObject;
  static toObject(includeInstance: boolean, msg: GetAvailableBalanceRes): GetAvailableBalanceRes.AsObject;
  static serializeBinaryToWriter(message: GetAvailableBalanceRes, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetAvailableBalanceRes;
  static deserializeBinaryFromReader(message: GetAvailableBalanceRes, reader: jspb.BinaryReader): GetAvailableBalanceRes;
}

export namespace GetAvailableBalanceRes {
  export type AsObject = {
    availableBalancesList: Array<TokenBalance.AsObject>,
  }
}

export class Order extends jspb.Message {
  getUuid(): number;
  setUuid(value: number): void;

  getIsSell(): boolean;
  setIsSell(value: boolean): void;

  getBaseTokenId(): data_types_pb.TokenID | undefined;
  setBaseTokenId(value?: data_types_pb.TokenID): void;
  hasBaseTokenId(): boolean;
  clearBaseTokenId(): void;

  getBaseAmount(): string;
  setBaseAmount(value: string): void;

  getBaseFillAmount(): string;
  setBaseFillAmount(value: string): void;

  getQuoteSymbol(): string;
  setQuoteSymbol(value: string): void;

  getQuoteAmount(): string;
  setQuoteAmount(value: string): void;

  getQuoteFillAmount(): string;
  setQuoteFillAmount(value: string): void;

  getStatus(): data_types_pb.OrderStatus;
  setStatus(value: data_types_pb.OrderStatus): void;

  getSubmittedAt(): number;
  setSubmittedAt(value: number): void;

  getProcessedAt(): number;
  setProcessedAt(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Order.AsObject;
  static toObject(includeInstance: boolean, msg: Order): Order.AsObject;
  static serializeBinaryToWriter(message: Order, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Order;
  static deserializeBinaryFromReader(message: Order, reader: jspb.BinaryReader): Order;
}

export namespace Order {
  export type AsObject = {
    uuid: number,
    isSell: boolean,
    baseTokenId?: data_types_pb.TokenID.AsObject,
    baseAmount: string,
    baseFillAmount: string,
    quoteSymbol: string,
    quoteAmount: string,
    quoteFillAmount: string,
    status: data_types_pb.OrderStatus,
    submittedAt: number,
    processedAt: number,
  }
}

export class GetUserOrdersReq extends jspb.Message {
  getAccountId(): number;
  setAccountId(value: number): void;

  getBaseTokenId(): string;
  setBaseTokenId(value: string): void;

  getQuoteTokenId(): string;
  setQuoteTokenId(value: string): void;

  getPaging(): data_types_pb.CursorPaging | undefined;
  setPaging(value?: data_types_pb.CursorPaging): void;
  hasPaging(): boolean;
  clearPaging(): void;

  getStatusesList(): Array<string>;
  setStatusesList(value: Array<string>): void;
  clearStatusesList(): void;
  addStatuses(value: string, index?: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetUserOrdersReq.AsObject;
  static toObject(includeInstance: boolean, msg: GetUserOrdersReq): GetUserOrdersReq.AsObject;
  static serializeBinaryToWriter(message: GetUserOrdersReq, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetUserOrdersReq;
  static deserializeBinaryFromReader(message: GetUserOrdersReq, reader: jspb.BinaryReader): GetUserOrdersReq;
}

export namespace GetUserOrdersReq {
  export type AsObject = {
    accountId: number,
    baseTokenId: string,
    quoteTokenId: string,
    paging?: data_types_pb.CursorPaging.AsObject,
    statusesList: Array<string>,
  }
}

export class GetUserOrdersRes extends jspb.Message {
  getOrdersList(): Array<Order>;
  setOrdersList(value: Array<Order>): void;
  clearOrdersList(): void;
  addOrders(value?: Order, index?: number): Order;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetUserOrdersRes.AsObject;
  static toObject(includeInstance: boolean, msg: GetUserOrdersRes): GetUserOrdersRes.AsObject;
  static serializeBinaryToWriter(message: GetUserOrdersRes, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetUserOrdersRes;
  static deserializeBinaryFromReader(message: GetUserOrdersRes, reader: jspb.BinaryReader): GetUserOrdersRes;
}

export namespace GetUserOrdersRes {
  export type AsObject = {
    ordersList: Array<Order.AsObject>,
  }
}

export class Fill extends jspb.Message {
  getUuid(): number;
  setUuid(value: number): void;

  getOrderUuid(): number;
  setOrderUuid(value: number): void;

  getIsTaker(): boolean;
  setIsTaker(value: boolean): void;

  getIsSell(): boolean;
  setIsSell(value: boolean): void;

  getBaseTokenId(): data_types_pb.TokenID | undefined;
  setBaseTokenId(value?: data_types_pb.TokenID): void;
  hasBaseTokenId(): boolean;
  clearBaseTokenId(): void;

  getBaseFillAmount(): string;
  setBaseFillAmount(value: string): void;

  getQuoteTokenId(): data_types_pb.TokenID | undefined;
  setQuoteTokenId(value?: data_types_pb.TokenID): void;
  hasQuoteTokenId(): boolean;
  clearQuoteTokenId(): void;

  getQuoteFillAmount(): string;
  setQuoteFillAmount(value: string): void;

  getTimestamp(): number;
  setTimestamp(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Fill.AsObject;
  static toObject(includeInstance: boolean, msg: Fill): Fill.AsObject;
  static serializeBinaryToWriter(message: Fill, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Fill;
  static deserializeBinaryFromReader(message: Fill, reader: jspb.BinaryReader): Fill;
}

export namespace Fill {
  export type AsObject = {
    uuid: number,
    orderUuid: number,
    isTaker: boolean,
    isSell: boolean,
    baseTokenId?: data_types_pb.TokenID.AsObject,
    baseFillAmount: string,
    quoteTokenId?: data_types_pb.TokenID.AsObject,
    quoteFillAmount: string,
    timestamp: number,
  }
}

export class MarketTicker extends jspb.Message {
  getBaseTokenId(): data_types_pb.TokenID | undefined;
  setBaseTokenId(value?: data_types_pb.TokenID): void;
  hasBaseTokenId(): boolean;
  clearBaseTokenId(): void;

  getQuoteTokenId(): data_types_pb.TokenID | undefined;
  setQuoteTokenId(value?: data_types_pb.TokenID): void;
  hasQuoteTokenId(): boolean;
  clearQuoteTokenId(): void;

  getExchangeRate(): number;
  setExchangeRate(value: number): void;

  getPrice(): number;
  setPrice(value: number): void;

  getVolume24h(): number;
  setVolume24h(value: number): void;

  getPercentChange1h(): number;
  setPercentChange1h(value: number): void;

  getPercentChange24h(): number;
  setPercentChange24h(value: number): void;

  getPercentChange7d(): number;
  setPercentChange7d(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): MarketTicker.AsObject;
  static toObject(includeInstance: boolean, msg: MarketTicker): MarketTicker.AsObject;
  static serializeBinaryToWriter(message: MarketTicker, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): MarketTicker;
  static deserializeBinaryFromReader(message: MarketTicker, reader: jspb.BinaryReader): MarketTicker;
}

export namespace MarketTicker {
  export type AsObject = {
    baseTokenId?: data_types_pb.TokenID.AsObject,
    quoteTokenId?: data_types_pb.TokenID.AsObject,
    exchangeRate: number,
    price: number,
    volume24h: number,
    percentChange1h: number,
    percentChange24h: number,
    percentChange7d: number,
  }
}

export class UserTransaction extends jspb.Message {
  getRequestId(): number;
  setRequestId(value: number): void;

  getAccountId(): number;
  setAccountId(value: number): void;

  getTokenId(): number;
  setTokenId(value: number): void;

  getAmount(): string;
  setAmount(value: string): void;

  getSubmittedAt(): number;
  setSubmittedAt(value: number): void;

  getUpdatedAt(): number;
  setUpdatedAt(value: number): void;

  getTxStatus(): data_types_pb.UserTxStatus;
  setTxStatus(value: data_types_pb.UserTxStatus): void;

  getTxType(): data_types_pb.UserTxType;
  setTxType(value: data_types_pb.UserTxType): void;

  getTxHash(): data_types_pb.SHA256Hash | undefined;
  setTxHash(value?: data_types_pb.SHA256Hash): void;
  hasTxHash(): boolean;
  clearTxHash(): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): UserTransaction.AsObject;
  static toObject(includeInstance: boolean, msg: UserTransaction): UserTransaction.AsObject;
  static serializeBinaryToWriter(message: UserTransaction, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): UserTransaction;
  static deserializeBinaryFromReader(message: UserTransaction, reader: jspb.BinaryReader): UserTransaction;
}

export namespace UserTransaction {
  export type AsObject = {
    requestId: number,
    accountId: number,
    tokenId: number,
    amount: string,
    submittedAt: number,
    updatedAt: number,
    txStatus: data_types_pb.UserTxStatus,
    txType: data_types_pb.UserTxType,
    txHash?: data_types_pb.SHA256Hash.AsObject,
  }
}

export class GetUserFillsReq extends jspb.Message {
  getAccountId(): number;
  setAccountId(value: number): void;

  getOrderUuid(): number;
  setOrderUuid(value: number): void;

  getPaging(): data_types_pb.CursorPaging | undefined;
  setPaging(value?: data_types_pb.CursorPaging): void;
  hasPaging(): boolean;
  clearPaging(): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetUserFillsReq.AsObject;
  static toObject(includeInstance: boolean, msg: GetUserFillsReq): GetUserFillsReq.AsObject;
  static serializeBinaryToWriter(message: GetUserFillsReq, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetUserFillsReq;
  static deserializeBinaryFromReader(message: GetUserFillsReq, reader: jspb.BinaryReader): GetUserFillsReq;
}

export namespace GetUserFillsReq {
  export type AsObject = {
    accountId: number,
    orderUuid: number,
    paging?: data_types_pb.CursorPaging.AsObject,
  }
}

export class GetMarketFillsReq extends jspb.Message {
  getMarketId(): number;
  setMarketId(value: number): void;

  getNum(): number;
  setNum(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetMarketFillsReq.AsObject;
  static toObject(includeInstance: boolean, msg: GetMarketFillsReq): GetMarketFillsReq.AsObject;
  static serializeBinaryToWriter(message: GetMarketFillsReq, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetMarketFillsReq;
  static deserializeBinaryFromReader(message: GetMarketFillsReq, reader: jspb.BinaryReader): GetMarketFillsReq;
}

export namespace GetMarketFillsReq {
  export type AsObject = {
    marketId: number,
    num: number,
  }
}

export class GetFillsRes extends jspb.Message {
  getFillsList(): Array<Fill>;
  setFillsList(value: Array<Fill>): void;
  clearFillsList(): void;
  addFills(value?: Fill, index?: number): Fill;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetFillsRes.AsObject;
  static toObject(includeInstance: boolean, msg: GetFillsRes): GetFillsRes.AsObject;
  static serializeBinaryToWriter(message: GetFillsRes, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetFillsRes;
  static deserializeBinaryFromReader(message: GetFillsRes, reader: jspb.BinaryReader): GetFillsRes;
}

export namespace GetFillsRes {
  export type AsObject = {
    fillsList: Array<Fill.AsObject>,
  }
}

export class OrderBook extends jspb.Message {
  getLastPrice(): string;
  setLastPrice(value: string): void;

  getLastPriceFiat(): string;
  setLastPriceFiat(value: string): void;

  getSellsList(): Array<OrderBook.Item>;
  setSellsList(value: Array<OrderBook.Item>): void;
  clearSellsList(): void;
  addSells(value?: OrderBook.Item, index?: number): OrderBook.Item;

  getBuysList(): Array<OrderBook.Item>;
  setBuysList(value: Array<OrderBook.Item>): void;
  clearBuysList(): void;
  addBuys(value?: OrderBook.Item, index?: number): OrderBook.Item;

  getBaseTokenId(): data_types_pb.TokenID | undefined;
  setBaseTokenId(value?: data_types_pb.TokenID): void;
  hasBaseTokenId(): boolean;
  clearBaseTokenId(): void;

  getQuoteTokenId(): data_types_pb.TokenID | undefined;
  setQuoteTokenId(value?: data_types_pb.TokenID): void;
  hasQuoteTokenId(): boolean;
  clearQuoteTokenId(): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): OrderBook.AsObject;
  static toObject(includeInstance: boolean, msg: OrderBook): OrderBook.AsObject;
  static serializeBinaryToWriter(message: OrderBook, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): OrderBook;
  static deserializeBinaryFromReader(message: OrderBook, reader: jspb.BinaryReader): OrderBook;
}

export namespace OrderBook {
  export type AsObject = {
    lastPrice: string,
    lastPriceFiat: string,
    sellsList: Array<OrderBook.Item.AsObject>,
    buysList: Array<OrderBook.Item.AsObject>,
    baseTokenId?: data_types_pb.TokenID.AsObject,
    quoteTokenId?: data_types_pb.TokenID.AsObject,
  }

  export class Item extends jspb.Message {
    getPrice(): string;
    setPrice(value: string): void;

    getBaseAmount(): string;
    setBaseAmount(value: string): void;

    getQuoteAmount(): string;
    setQuoteAmount(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Item.AsObject;
    static toObject(includeInstance: boolean, msg: Item): Item.AsObject;
    static serializeBinaryToWriter(message: Item, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Item;
    static deserializeBinaryFromReader(message: Item, reader: jspb.BinaryReader): Item;
  }

  export namespace Item {
    export type AsObject = {
      price: string,
      baseAmount: string,
      quoteAmount: string,
    }
  }


  export class Update extends jspb.Message {
    getLevel(): number;
    setLevel(value: number): void;

    getSellsList(): Array<OrderBook.Item>;
    setSellsList(value: Array<OrderBook.Item>): void;
    clearSellsList(): void;
    addSells(value?: OrderBook.Item, index?: number): OrderBook.Item;

    getBuysList(): Array<OrderBook.Item>;
    setBuysList(value: Array<OrderBook.Item>): void;
    clearBuysList(): void;
    addBuys(value?: OrderBook.Item, index?: number): OrderBook.Item;

    getLatestPrice(): number;
    setLatestPrice(value: number): void;

    getMarketId(): number;
    setMarketId(value: number): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Update.AsObject;
    static toObject(includeInstance: boolean, msg: Update): Update.AsObject;
    static serializeBinaryToWriter(message: Update, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Update;
    static deserializeBinaryFromReader(message: Update, reader: jspb.BinaryReader): Update;
  }

  export namespace Update {
    export type AsObject = {
      level: number,
      sellsList: Array<OrderBook.Item.AsObject>,
      buysList: Array<OrderBook.Item.AsObject>,
      latestPrice: number,
      marketId: number,
    }
  }

}

export class GetOrderBookReq extends jspb.Message {
  getMarketId(): number;
  setMarketId(value: number): void;

  getAggregationLevel(): number;
  setAggregationLevel(value: number): void;

  getFiatSymbol(): string;
  setFiatSymbol(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetOrderBookReq.AsObject;
  static toObject(includeInstance: boolean, msg: GetOrderBookReq): GetOrderBookReq.AsObject;
  static serializeBinaryToWriter(message: GetOrderBookReq, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetOrderBookReq;
  static deserializeBinaryFromReader(message: GetOrderBookReq, reader: jspb.BinaryReader): GetOrderBookReq;
}

export namespace GetOrderBookReq {
  export type AsObject = {
    marketId: number,
    aggregationLevel: number,
    fiatSymbol: string,
  }
}

export class Candles extends jspb.Message {
  getDataList(): Array<Candles.OHLC>;
  setDataList(value: Array<Candles.OHLC>): void;
  clearDataList(): void;
  addData(value?: Candles.OHLC, index?: number): Candles.OHLC;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Candles.AsObject;
  static toObject(includeInstance: boolean, msg: Candles): Candles.AsObject;
  static serializeBinaryToWriter(message: Candles, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Candles;
  static deserializeBinaryFromReader(message: Candles, reader: jspb.BinaryReader): Candles;
}

export namespace Candles {
  export type AsObject = {
    dataList: Array<Candles.OHLC.AsObject>,
  }

  export class OHLC extends jspb.Message {
    getOhlcList(): Array<number>;
    setOhlcList(value: Array<number>): void;
    clearOhlcList(): void;
    addOhlc(value: number, index?: number): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): OHLC.AsObject;
    static toObject(includeInstance: boolean, msg: OHLC): OHLC.AsObject;
    static serializeBinaryToWriter(message: OHLC, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): OHLC;
    static deserializeBinaryFromReader(message: OHLC, reader: jspb.BinaryReader): OHLC;
  }

  export namespace OHLC {
    export type AsObject = {
      ohlcList: Array<number>,
    }
  }

}

export class GetCandlesReq extends jspb.Message {
  getMarketId(): number;
  setMarketId(value: number): void;

  getInterval(): data_types_pb.Interval;
  setInterval(value: data_types_pb.Interval): void;

  getPaging(): data_types_pb.CursorPaging | undefined;
  setPaging(value?: data_types_pb.CursorPaging): void;
  hasPaging(): boolean;
  clearPaging(): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetCandlesReq.AsObject;
  static toObject(includeInstance: boolean, msg: GetCandlesReq): GetCandlesReq.AsObject;
  static serializeBinaryToWriter(message: GetCandlesReq, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetCandlesReq;
  static deserializeBinaryFromReader(message: GetCandlesReq, reader: jspb.BinaryReader): GetCandlesReq;
}

export namespace GetCandlesReq {
  export type AsObject = {
    marketId: number,
    interval: data_types_pb.Interval,
    paging?: data_types_pb.CursorPaging.AsObject,
  }
}

export class GetUserTransactionsReq extends jspb.Message {
  getAccountId(): number;
  setAccountId(value: number): void;

  getTokenId(): number;
  setTokenId(value: number): void;

  getTransactionType(): string;
  setTransactionType(value: string): void;

  getPaging(): data_types_pb.CursorPaging | undefined;
  setPaging(value?: data_types_pb.CursorPaging): void;
  hasPaging(): boolean;
  clearPaging(): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetUserTransactionsReq.AsObject;
  static toObject(includeInstance: boolean, msg: GetUserTransactionsReq): GetUserTransactionsReq.AsObject;
  static serializeBinaryToWriter(message: GetUserTransactionsReq, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetUserTransactionsReq;
  static deserializeBinaryFromReader(message: GetUserTransactionsReq, reader: jspb.BinaryReader): GetUserTransactionsReq;
}

export namespace GetUserTransactionsReq {
  export type AsObject = {
    accountId: number,
    tokenId: number,
    transactionType: string,
    paging?: data_types_pb.CursorPaging.AsObject,
  }
}

export class GetUserTransactionsRes extends jspb.Message {
  getTransactionsList(): Array<UserTransaction>;
  setTransactionsList(value: Array<UserTransaction>): void;
  clearTransactionsList(): void;
  addTransactions(value?: UserTransaction, index?: number): UserTransaction;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetUserTransactionsRes.AsObject;
  static toObject(includeInstance: boolean, msg: GetUserTransactionsRes): GetUserTransactionsRes.AsObject;
  static serializeBinaryToWriter(message: GetUserTransactionsRes, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetUserTransactionsRes;
  static deserializeBinaryFromReader(message: GetUserTransactionsRes, reader: jspb.BinaryReader): GetUserTransactionsRes;
}

export namespace GetUserTransactionsRes {
  export type AsObject = {
    transactionsList: Array<UserTransaction.AsObject>,
  }
}

export class GetNextOrderIdReq extends jspb.Message {
  getAccountId(): number;
  setAccountId(value: number): void;

  getTokenSellId(): number;
  setTokenSellId(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetNextOrderIdReq.AsObject;
  static toObject(includeInstance: boolean, msg: GetNextOrderIdReq): GetNextOrderIdReq.AsObject;
  static serializeBinaryToWriter(message: GetNextOrderIdReq, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetNextOrderIdReq;
  static deserializeBinaryFromReader(message: GetNextOrderIdReq, reader: jspb.BinaryReader): GetNextOrderIdReq;
}

export namespace GetNextOrderIdReq {
  export type AsObject = {
    accountId: number,
    tokenSellId: number,
  }
}

export class SubmitOrderRes extends jspb.Message {
  getOrderUuid(): number;
  setOrderUuid(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SubmitOrderRes.AsObject;
  static toObject(includeInstance: boolean, msg: SubmitOrderRes): SubmitOrderRes.AsObject;
  static serializeBinaryToWriter(message: SubmitOrderRes, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SubmitOrderRes;
  static deserializeBinaryFromReader(message: SubmitOrderRes, reader: jspb.BinaryReader): SubmitOrderRes;
}

export namespace SubmitOrderRes {
  export type AsObject = {
    orderUuid: number,
  }
}

export class CancelOrderRes extends jspb.Message {
  getOrderUuidsList(): Array<number>;
  setOrderUuidsList(value: Array<number>): void;
  clearOrderUuidsList(): void;
  addOrderUuids(value: number, index?: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): CancelOrderRes.AsObject;
  static toObject(includeInstance: boolean, msg: CancelOrderRes): CancelOrderRes.AsObject;
  static serializeBinaryToWriter(message: CancelOrderRes, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): CancelOrderRes;
  static deserializeBinaryFromReader(message: CancelOrderRes, reader: jspb.BinaryReader): CancelOrderRes;
}

export namespace CancelOrderRes {
  export type AsObject = {
    orderUuidsList: Array<number>,
  }
}

export class OffchainWithdrawalalRes extends jspb.Message {
  getWithdrwalUuid(): number;
  setWithdrwalUuid(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): OffchainWithdrawalalRes.AsObject;
  static toObject(includeInstance: boolean, msg: OffchainWithdrawalalRes): OffchainWithdrawalalRes.AsObject;
  static serializeBinaryToWriter(message: OffchainWithdrawalalRes, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): OffchainWithdrawalalRes;
  static deserializeBinaryFromReader(message: OffchainWithdrawalalRes, reader: jspb.BinaryReader): OffchainWithdrawalalRes;
}

export namespace OffchainWithdrawalalRes {
  export type AsObject = {
    withdrwalUuid: number,
  }
}

export class SimpleOrderCancellationReq extends jspb.Message {
  getExchangeId(): number;
  setExchangeId(value: number): void;

  getAccountId(): number;
  setAccountId(value: number): void;

  getOrderUuid(): number;
  setOrderUuid(value: number): void;

  getMarketId(): number;
  setMarketId(value: number): void;

  getTimestamp(): number;
  setTimestamp(value: number): void;

  getSig(): data_types_pb.EdDSASignature | undefined;
  setSig(value?: data_types_pb.EdDSASignature): void;
  hasSig(): boolean;
  clearSig(): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SimpleOrderCancellationReq.AsObject;
  static toObject(includeInstance: boolean, msg: SimpleOrderCancellationReq): SimpleOrderCancellationReq.AsObject;
  static serializeBinaryToWriter(message: SimpleOrderCancellationReq, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SimpleOrderCancellationReq;
  static deserializeBinaryFromReader(message: SimpleOrderCancellationReq, reader: jspb.BinaryReader): SimpleOrderCancellationReq;
}

export namespace SimpleOrderCancellationReq {
  export type AsObject = {
    exchangeId: number,
    accountId: number,
    orderUuid: number,
    marketId: number,
    timestamp: number,
    sig?: data_types_pb.EdDSASignature.AsObject,
  }
}

export class SocketIOSubscription extends jspb.Message {
  getParamsForOrderbook(): SocketIOSubscription.ParamsForOrderbook | undefined;
  setParamsForOrderbook(value?: SocketIOSubscription.ParamsForOrderbook): void;
  hasParamsForOrderbook(): boolean;
  clearParamsForOrderbook(): void;

  getParamsForCandles(): SocketIOSubscription.ParamsForCandles | undefined;
  setParamsForCandles(value?: SocketIOSubscription.ParamsForCandles): void;
  hasParamsForCandles(): boolean;
  clearParamsForCandles(): void;

  getParamsForFills(): SocketIOSubscription.ParamsForFills | undefined;
  setParamsForFills(value?: SocketIOSubscription.ParamsForFills): void;
  hasParamsForFills(): boolean;
  clearParamsForFills(): void;

  getParamsForInternalTickers(): SocketIOSubscription.ParamsForInternalTickers | undefined;
  setParamsForInternalTickers(value?: SocketIOSubscription.ParamsForInternalTickers): void;
  hasParamsForInternalTickers(): boolean;
  clearParamsForInternalTickers(): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SocketIOSubscription.AsObject;
  static toObject(includeInstance: boolean, msg: SocketIOSubscription): SocketIOSubscription.AsObject;
  static serializeBinaryToWriter(message: SocketIOSubscription, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SocketIOSubscription;
  static deserializeBinaryFromReader(message: SocketIOSubscription, reader: jspb.BinaryReader): SocketIOSubscription;
}

export namespace SocketIOSubscription {
  export type AsObject = {
    paramsForOrderbook?: SocketIOSubscription.ParamsForOrderbook.AsObject,
    paramsForCandles?: SocketIOSubscription.ParamsForCandles.AsObject,
    paramsForFills?: SocketIOSubscription.ParamsForFills.AsObject,
    paramsForInternalTickers?: SocketIOSubscription.ParamsForInternalTickers.AsObject,
  }

  export class Ack extends jspb.Message {
    getError(): data_types_pb.Error | undefined;
    setError(value?: data_types_pb.Error): void;
    hasError(): boolean;
    clearError(): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Ack.AsObject;
    static toObject(includeInstance: boolean, msg: Ack): Ack.AsObject;
    static serializeBinaryToWriter(message: Ack, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Ack;
    static deserializeBinaryFromReader(message: Ack, reader: jspb.BinaryReader): Ack;
  }

  export namespace Ack {
    export type AsObject = {
      error?: data_types_pb.Error.AsObject,
    }
  }


  export class ParamsForFills extends jspb.Message {
    getAccountId(): data_types_pb.AccountID | undefined;
    setAccountId(value?: data_types_pb.AccountID): void;
    hasAccountId(): boolean;
    clearAccountId(): void;

    getMarketId(): number;
    setMarketId(value: number): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ParamsForFills.AsObject;
    static toObject(includeInstance: boolean, msg: ParamsForFills): ParamsForFills.AsObject;
    static serializeBinaryToWriter(message: ParamsForFills, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ParamsForFills;
    static deserializeBinaryFromReader(message: ParamsForFills, reader: jspb.BinaryReader): ParamsForFills;
  }

  export namespace ParamsForFills {
    export type AsObject = {
      accountId?: data_types_pb.AccountID.AsObject,
      marketId: number,
    }
  }


  export class ParamsForInternalTickers extends jspb.Message {
    getMarketId(): number;
    setMarketId(value: number): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ParamsForInternalTickers.AsObject;
    static toObject(includeInstance: boolean, msg: ParamsForInternalTickers): ParamsForInternalTickers.AsObject;
    static serializeBinaryToWriter(message: ParamsForInternalTickers, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ParamsForInternalTickers;
    static deserializeBinaryFromReader(message: ParamsForInternalTickers, reader: jspb.BinaryReader): ParamsForInternalTickers;
  }

  export namespace ParamsForInternalTickers {
    export type AsObject = {
      marketId: number,
    }
  }


  export class ParamsForOrderbook extends jspb.Message {
    getLevel(): number;
    setLevel(value: number): void;

    getMarketId(): number;
    setMarketId(value: number): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ParamsForOrderbook.AsObject;
    static toObject(includeInstance: boolean, msg: ParamsForOrderbook): ParamsForOrderbook.AsObject;
    static serializeBinaryToWriter(message: ParamsForOrderbook, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ParamsForOrderbook;
    static deserializeBinaryFromReader(message: ParamsForOrderbook, reader: jspb.BinaryReader): ParamsForOrderbook;
  }

  export namespace ParamsForOrderbook {
    export type AsObject = {
      level: number,
      marketId: number,
    }
  }


  export class ParamsForCandles extends jspb.Message {
    getMarketId(): number;
    setMarketId(value: number): void;

    getBeginTime(): number;
    setBeginTime(value: number): void;

    getEndTime(): number;
    setEndTime(value: number): void;

    getInterval(): data_types_pb.Interval;
    setInterval(value: data_types_pb.Interval): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ParamsForCandles.AsObject;
    static toObject(includeInstance: boolean, msg: ParamsForCandles): ParamsForCandles.AsObject;
    static serializeBinaryToWriter(message: ParamsForCandles, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ParamsForCandles;
    static deserializeBinaryFromReader(message: ParamsForCandles, reader: jspb.BinaryReader): ParamsForCandles;
  }

  export namespace ParamsForCandles {
    export type AsObject = {
      marketId: number,
      beginTime: number,
      endTime: number,
      interval: data_types_pb.Interval,
    }
  }


  export class Notification extends jspb.Message {
    getOrderbook(): OrderBook.Update | undefined;
    setOrderbook(value?: OrderBook.Update): void;
    hasOrderbook(): boolean;
    clearOrderbook(): void;

    getCandles(): Candles | undefined;
    setCandles(value?: Candles): void;
    hasCandles(): boolean;
    clearCandles(): void;

    getFill(): Fill | undefined;
    setFill(value?: Fill): void;
    hasFill(): boolean;
    clearFill(): void;

    getInternalTicker(): MarketTicker | undefined;
    setInternalTicker(value?: MarketTicker): void;
    hasInternalTicker(): boolean;
    clearInternalTicker(): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Notification.AsObject;
    static toObject(includeInstance: boolean, msg: Notification): Notification.AsObject;
    static serializeBinaryToWriter(message: Notification, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Notification;
    static deserializeBinaryFromReader(message: Notification, reader: jspb.BinaryReader): Notification;
  }

  export namespace Notification {
    export type AsObject = {
      orderbook?: OrderBook.Update.AsObject,
      candles?: Candles.AsObject,
      fill?: Fill.AsObject,
      internalTicker?: MarketTicker.AsObject,
    }
  }

}

