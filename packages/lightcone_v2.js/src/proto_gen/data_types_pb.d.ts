import * as jspb from "google-protobuf"

export class AccountID extends jspb.Message {
  getValue(): number;
  setValue(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): AccountID.AsObject;
  static toObject(includeInstance: boolean, msg: AccountID): AccountID.AsObject;
  static serializeBinaryToWriter(message: AccountID, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): AccountID;
  static deserializeBinaryFromReader(message: AccountID, reader: jspb.BinaryReader): AccountID;
}

export namespace AccountID {
  export type AsObject = {
    value: number,
  }
}

export class TokenID extends jspb.Message {
  getValue(): number;
  setValue(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): TokenID.AsObject;
  static toObject(includeInstance: boolean, msg: TokenID): TokenID.AsObject;
  static serializeBinaryToWriter(message: TokenID, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): TokenID;
  static deserializeBinaryFromReader(message: TokenID, reader: jspb.BinaryReader): TokenID;
}

export namespace TokenID {
  export type AsObject = {
    value: number,
  }
}

export class OrderID extends jspb.Message {
  getValue(): number;
  setValue(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): OrderID.AsObject;
  static toObject(includeInstance: boolean, msg: OrderID): OrderID.AsObject;
  static serializeBinaryToWriter(message: OrderID, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): OrderID;
  static deserializeBinaryFromReader(message: OrderID, reader: jspb.BinaryReader): OrderID;
}

export namespace OrderID {
  export type AsObject = {
    value: number,
  }
}

export class Amount extends jspb.Message {
  getValue(): Uint8Array | string;
  getValue_asU8(): Uint8Array;
  getValue_asB64(): string;
  setValue(value: Uint8Array | string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Amount.AsObject;
  static toObject(includeInstance: boolean, msg: Amount): Amount.AsObject;
  static serializeBinaryToWriter(message: Amount, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Amount;
  static deserializeBinaryFromReader(message: Amount, reader: jspb.BinaryReader): Amount;
}

export namespace Amount {
  export type AsObject = {
    value: Uint8Array | string,
  }
}

export class Address extends jspb.Message {
  getValue(): string;
  setValue(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Address.AsObject;
  static toObject(includeInstance: boolean, msg: Address): Address.AsObject;
  static serializeBinaryToWriter(message: Address, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Address;
  static deserializeBinaryFromReader(message: Address, reader: jspb.BinaryReader): Address;
}

export namespace Address {
  export type AsObject = {
    value: string,
  }
}

export class TxData extends jspb.Message {
  getValue(): string;
  setValue(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): TxData.AsObject;
  static toObject(includeInstance: boolean, msg: TxData): TxData.AsObject;
  static serializeBinaryToWriter(message: TxData, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): TxData;
  static deserializeBinaryFromReader(message: TxData, reader: jspb.BinaryReader): TxData;
}

export namespace TxData {
  export type AsObject = {
    value: string,
  }
}

export class Nonce extends jspb.Message {
  getValue(): number;
  setValue(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Nonce.AsObject;
  static toObject(includeInstance: boolean, msg: Nonce): Nonce.AsObject;
  static serializeBinaryToWriter(message: Nonce, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Nonce;
  static deserializeBinaryFromReader(message: Nonce, reader: jspb.BinaryReader): Nonce;
}

export namespace Nonce {
  export type AsObject = {
    value: number,
  }
}

export class Bips extends jspb.Message {
  getValue(): number;
  setValue(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Bips.AsObject;
  static toObject(includeInstance: boolean, msg: Bips): Bips.AsObject;
  static serializeBinaryToWriter(message: Bips, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Bips;
  static deserializeBinaryFromReader(message: Bips, reader: jspb.BinaryReader): Bips;
}

export namespace Bips {
  export type AsObject = {
    value: number,
  }
}

export class Percentage extends jspb.Message {
  getValue(): number;
  setValue(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Percentage.AsObject;
  static toObject(includeInstance: boolean, msg: Percentage): Percentage.AsObject;
  static serializeBinaryToWriter(message: Percentage, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Percentage;
  static deserializeBinaryFromReader(message: Percentage, reader: jspb.BinaryReader): Percentage;
}

export namespace Percentage {
  export type AsObject = {
    value: number,
  }
}

export class MiMCHash extends jspb.Message {
  getValue(): Uint8Array | string;
  getValue_asU8(): Uint8Array;
  getValue_asB64(): string;
  setValue(value: Uint8Array | string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): MiMCHash.AsObject;
  static toObject(includeInstance: boolean, msg: MiMCHash): MiMCHash.AsObject;
  static serializeBinaryToWriter(message: MiMCHash, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): MiMCHash;
  static deserializeBinaryFromReader(message: MiMCHash, reader: jspb.BinaryReader): MiMCHash;
}

export namespace MiMCHash {
  export type AsObject = {
    value: Uint8Array | string,
  }
}

export class SHA256Hash extends jspb.Message {
  getValue(): Uint8Array | string;
  getValue_asU8(): Uint8Array;
  getValue_asB64(): string;
  setValue(value: Uint8Array | string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SHA256Hash.AsObject;
  static toObject(includeInstance: boolean, msg: SHA256Hash): SHA256Hash.AsObject;
  static serializeBinaryToWriter(message: SHA256Hash, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SHA256Hash;
  static deserializeBinaryFromReader(message: SHA256Hash, reader: jspb.BinaryReader): SHA256Hash;
}

export namespace SHA256Hash {
  export type AsObject = {
    value: Uint8Array | string,
  }
}

export class Proof extends jspb.Message {
  getDataList(): Array<MiMCHash>;
  setDataList(value: Array<MiMCHash>): void;
  clearDataList(): void;
  addData(value?: MiMCHash, index?: number): MiMCHash;

  getCostSeconds(): number;
  setCostSeconds(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Proof.AsObject;
  static toObject(includeInstance: boolean, msg: Proof): Proof.AsObject;
  static serializeBinaryToWriter(message: Proof, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Proof;
  static deserializeBinaryFromReader(message: Proof, reader: jspb.BinaryReader): Proof;
}

export namespace Proof {
  export type AsObject = {
    dataList: Array<MiMCHash.AsObject>,
    costSeconds: number,
  }
}

export class EdDSAPrivKey extends jspb.Message {
  getValue(): Uint8Array | string;
  getValue_asU8(): Uint8Array;
  getValue_asB64(): string;
  setValue(value: Uint8Array | string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): EdDSAPrivKey.AsObject;
  static toObject(includeInstance: boolean, msg: EdDSAPrivKey): EdDSAPrivKey.AsObject;
  static serializeBinaryToWriter(message: EdDSAPrivKey, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): EdDSAPrivKey;
  static deserializeBinaryFromReader(message: EdDSAPrivKey, reader: jspb.BinaryReader): EdDSAPrivKey;
}

export namespace EdDSAPrivKey {
  export type AsObject = {
    value: Uint8Array | string,
  }
}

export class EdDSAPubKey extends jspb.Message {
  getX(): Uint8Array | string;
  getX_asU8(): Uint8Array;
  getX_asB64(): string;
  setX(value: Uint8Array | string): void;

  getY(): Uint8Array | string;
  getY_asU8(): Uint8Array;
  getY_asB64(): string;
  setY(value: Uint8Array | string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): EdDSAPubKey.AsObject;
  static toObject(includeInstance: boolean, msg: EdDSAPubKey): EdDSAPubKey.AsObject;
  static serializeBinaryToWriter(message: EdDSAPubKey, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): EdDSAPubKey;
  static deserializeBinaryFromReader(message: EdDSAPubKey, reader: jspb.BinaryReader): EdDSAPubKey;
}

export namespace EdDSAPubKey {
  export type AsObject = {
    x: Uint8Array | string,
    y: Uint8Array | string,
  }
}

export class EdDSASignature extends jspb.Message {
  getRx(): Uint8Array | string;
  getRx_asU8(): Uint8Array;
  getRx_asB64(): string;
  setRx(value: Uint8Array | string): void;

  getRy(): Uint8Array | string;
  getRy_asU8(): Uint8Array;
  getRy_asB64(): string;
  setRy(value: Uint8Array | string): void;

  getS(): Uint8Array | string;
  getS_asU8(): Uint8Array;
  getS_asB64(): string;
  setS(value: Uint8Array | string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): EdDSASignature.AsObject;
  static toObject(includeInstance: boolean, msg: EdDSASignature): EdDSASignature.AsObject;
  static serializeBinaryToWriter(message: EdDSASignature, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): EdDSASignature;
  static deserializeBinaryFromReader(message: EdDSASignature, reader: jspb.BinaryReader): EdDSASignature;
}

export namespace EdDSASignature {
  export type AsObject = {
    rx: Uint8Array | string,
    ry: Uint8Array | string,
    s: Uint8Array | string,
  }
}

export class CursorPaging extends jspb.Message {
  getNum(): number;
  setNum(value: number): void;

  getCursor(): number;
  setCursor(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): CursorPaging.AsObject;
  static toObject(includeInstance: boolean, msg: CursorPaging): CursorPaging.AsObject;
  static serializeBinaryToWriter(message: CursorPaging, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): CursorPaging;
  static deserializeBinaryFromReader(message: CursorPaging, reader: jspb.BinaryReader): CursorPaging;
}

export namespace CursorPaging {
  export type AsObject = {
    num: number,
    cursor: number,
  }
}

export class Account extends jspb.Message {
  getOwner(): Address | undefined;
  setOwner(value?: Address): void;
  hasOwner(): boolean;
  clearOwner(): void;

  getPubKey(): EdDSAPubKey | undefined;
  setPubKey(value?: EdDSAPubKey): void;
  hasPubKey(): boolean;
  clearPubKey(): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Account.AsObject;
  static toObject(includeInstance: boolean, msg: Account): Account.AsObject;
  static serializeBinaryToWriter(message: Account, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Account;
  static deserializeBinaryFromReader(message: Account, reader: jspb.BinaryReader): Account;
}

export namespace Account {
  export type AsObject = {
    owner?: Address.AsObject,
    pubKey?: EdDSAPubKey.AsObject,
  }
}

export class TokenMetadata extends jspb.Message {
  getType(): TokenMetadata.Type;
  setType(value: TokenMetadata.Type): void;

  getSymbol(): string;
  setSymbol(value: string): void;

  getName(): string;
  setName(value: string): void;

  getAddress(): string;
  setAddress(value: string): void;

  getUnit(): string;
  setUnit(value: string): void;

  getDecimals(): number;
  setDecimals(value: number): void;

  getPrecision(): number;
  setPrecision(value: number): void;

  getUpdatedAt(): number;
  setUpdatedAt(value: number): void;

  getTokenId(): TokenID | undefined;
  setTokenId(value?: TokenID): void;
  hasTokenId(): boolean;
  clearTokenId(): void;

  getDepositEnabled(): boolean;
  setDepositEnabled(value: boolean): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): TokenMetadata.AsObject;
  static toObject(includeInstance: boolean, msg: TokenMetadata): TokenMetadata.AsObject;
  static serializeBinaryToWriter(message: TokenMetadata, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): TokenMetadata;
  static deserializeBinaryFromReader(message: TokenMetadata, reader: jspb.BinaryReader): TokenMetadata;
}

export namespace TokenMetadata {
  export type AsObject = {
    type: TokenMetadata.Type,
    symbol: string,
    name: string,
    address: string,
    unit: string,
    decimals: number,
    precision: number,
    updatedAt: number,
    tokenId?: TokenID.AsObject,
    depositEnabled: boolean,
  }

  export enum Type { 
    TOKEN_TYPE_ERC20 = 0,
    TOKEN_TYPE_ETH = 1,
  }
}

export class TokenInfo extends jspb.Message {
  getSymbol(): string;
  setSymbol(value: string): void;

  getCirculatingSupply(): number;
  setCirculatingSupply(value: number): void;

  getTotalSupply(): number;
  setTotalSupply(value: number): void;

  getMaxSupply(): number;
  setMaxSupply(value: number): void;

  getCmcRank(): number;
  setCmcRank(value: number): void;

  getIcoRateWithEth(): number;
  setIcoRateWithEth(value: number): void;

  getWebsiteUrl(): string;
  setWebsiteUrl(value: string): void;

  getUpdatedAt(): number;
  setUpdatedAt(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): TokenInfo.AsObject;
  static toObject(includeInstance: boolean, msg: TokenInfo): TokenInfo.AsObject;
  static serializeBinaryToWriter(message: TokenInfo, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): TokenInfo;
  static deserializeBinaryFromReader(message: TokenInfo, reader: jspb.BinaryReader): TokenInfo;
}

export namespace TokenInfo {
  export type AsObject = {
    symbol: string,
    circulatingSupply: number,
    totalSupply: number,
    maxSupply: number,
    cmcRank: number,
    icoRateWithEth: number,
    websiteUrl: string,
    updatedAt: number,
  }
}

export class TokenTicker extends jspb.Message {
  getTokenId(): TokenID | undefined;
  setTokenId(value?: TokenID): void;
  hasTokenId(): boolean;
  clearTokenId(): void;

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
  toObject(includeInstance?: boolean): TokenTicker.AsObject;
  static toObject(includeInstance: boolean, msg: TokenTicker): TokenTicker.AsObject;
  static serializeBinaryToWriter(message: TokenTicker, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): TokenTicker;
  static deserializeBinaryFromReader(message: TokenTicker, reader: jspb.BinaryReader): TokenTicker;
}

export namespace TokenTicker {
  export type AsObject = {
    tokenId?: TokenID.AsObject,
    price: number,
    volume24h: number,
    percentChange1h: number,
    percentChange24h: number,
    percentChange7d: number,
  }
}

export class Token extends jspb.Message {
  getMetadata(): TokenMetadata | undefined;
  setMetadata(value?: TokenMetadata): void;
  hasMetadata(): boolean;
  clearMetadata(): void;

  getInfo(): TokenInfo | undefined;
  setInfo(value?: TokenInfo): void;
  hasInfo(): boolean;
  clearInfo(): void;

  getTicker(): TokenTicker | undefined;
  setTicker(value?: TokenTicker): void;
  hasTicker(): boolean;
  clearTicker(): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Token.AsObject;
  static toObject(includeInstance: boolean, msg: Token): Token.AsObject;
  static serializeBinaryToWriter(message: Token, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Token;
  static deserializeBinaryFromReader(message: Token, reader: jspb.BinaryReader): Token;
}

export namespace Token {
  export type AsObject = {
    metadata?: TokenMetadata.AsObject,
    info?: TokenInfo.AsObject,
    ticker?: TokenTicker.AsObject,
  }
}

export class MarketMetadata extends jspb.Message {
  getStatus(): MarketMetadata.Status;
  setStatus(value: MarketMetadata.Status): void;

  getQuoteTokenSymbol(): string;
  setQuoteTokenSymbol(value: string): void;

  getBaseTokenSymbol(): string;
  setBaseTokenSymbol(value: string): void;

  getMaxNumbersOfOrders(): number;
  setMaxNumbersOfOrders(value: number): void;

  getPriceDecimals(): number;
  setPriceDecimals(value: number): void;

  getOrderbookAggLevels(): number;
  setOrderbookAggLevels(value: number): void;

  getPrecisionForAmount(): number;
  setPrecisionForAmount(value: number): void;

  getPrecisionForTotal(): number;
  setPrecisionForTotal(value: number): void;

  getBrowsableInWallet(): boolean;
  setBrowsableInWallet(value: boolean): void;

  getUpdatedAt(): number;
  setUpdatedAt(value: number): void;

  getMarketId(): number;
  setMarketId(value: number): void;

  getMarketHash(): string;
  setMarketHash(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): MarketMetadata.AsObject;
  static toObject(includeInstance: boolean, msg: MarketMetadata): MarketMetadata.AsObject;
  static serializeBinaryToWriter(message: MarketMetadata, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): MarketMetadata;
  static deserializeBinaryFromReader(message: MarketMetadata, reader: jspb.BinaryReader): MarketMetadata;
}

export namespace MarketMetadata {
  export type AsObject = {
    status: MarketMetadata.Status,
    quoteTokenSymbol: string,
    baseTokenSymbol: string,
    maxNumbersOfOrders: number,
    priceDecimals: number,
    orderbookAggLevels: number,
    precisionForAmount: number,
    precisionForTotal: number,
    browsableInWallet: boolean,
    updatedAt: number,
    marketId: number,
    marketHash: string,
  }

  export enum Status { 
    TERMINATED = 0,
    ACTIVE = 1,
    READONLY = 2,
  }
}

export class MarketTicker extends jspb.Message {
  getBaseToken(): string;
  setBaseToken(value: string): void;

  getQuoteToken(): string;
  setQuoteToken(value: string): void;

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
    baseToken: string,
    quoteToken: string,
    exchangeRate: number,
    price: number,
    volume24h: number,
    percentChange1h: number,
    percentChange24h: number,
    percentChange7d: number,
  }
}

export class Market extends jspb.Message {
  getMetadata(): MarketMetadata | undefined;
  setMetadata(value?: MarketMetadata): void;
  hasMetadata(): boolean;
  clearMetadata(): void;

  getTicker(): MarketTicker | undefined;
  setTicker(value?: MarketTicker): void;
  hasTicker(): boolean;
  clearTicker(): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Market.AsObject;
  static toObject(includeInstance: boolean, msg: Market): Market.AsObject;
  static serializeBinaryToWriter(message: Market, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Market;
  static deserializeBinaryFromReader(message: Market, reader: jspb.BinaryReader): Market;
}

export namespace Market {
  export type AsObject = {
    metadata?: MarketMetadata.AsObject,
    ticker?: MarketTicker.AsObject,
  }
}

export class Error extends jspb.Message {
  getCode(): ErrorCode;
  setCode(value: ErrorCode): void;

  getMessage(): string;
  setMessage(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Error.AsObject;
  static toObject(includeInstance: boolean, msg: Error): Error.AsObject;
  static serializeBinaryToWriter(message: Error, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Error;
  static deserializeBinaryFromReader(message: Error, reader: jspb.BinaryReader): Error;
}

export namespace Error {
  export type AsObject = {
    code: ErrorCode,
    message: string,
  }
}

export enum Interval { 
  OHCL_INTERVAL_INVALID = 0,
  OHLC_INTERVAL_ONE_MINUTES = 60,
  OHLC_INTERVAL_FIVE_MINUTES = 300,
  OHLC_INTERVAL_FIFTEEN_MINUTES = 900,
  OHLC_INTERVAL_THIRTY_MINUTES = 1800,
  OHLC_INTERVAL_ONE_HOUR = 3600,
  OHLC_INTERVAL_TWO_HOURS = 7200,
  OHLC_INTERVAL_FOUR_HOURS = 14400,
  OHLC_INTERVAL_TWELVE_HOURS = 43200,
  OHLC_INTERVAL_ONE_DAY = 86400,
  OHLC_INTERVAL_THREE_DAYS = 259200,
  OHLC_INTERVAL_FIVE_DAYS = 432000,
  OHLC_INTERVAL_ONE_WEEK = 604800,
}
export enum ErrorCode { 
  ERR_NONE = 0,
  ERR_INTERNAL_UNKNOWN = 1,
  ERR_INVALID_ARGUMENT = 2,
  ERR_ETHEREUM_ILLEGAL_ADDRESS = 1001,
  ERR_NO_ACCESSIBLE_ETHEREUM_NODE = 1002,
  ERR_UNEXPECTED_RESPONSE = 1003,
  ERR_INVALID_SIG = 1004,
  ERR_BLOCK_UNRECOGNIZED_TYPE = 2001,
  ERR_COMMITTER_NOT_READY = 2002,
  ERR_PERSISTENCE_INVALID_DATA = 3001,
  ERR_PERSISTENCE_DUPLICATE_INSERT = 3002,
  ERR_PERSISTENCE_UPDATE_FAILED = 3003,
  ERR_PERSISTENCE_INTERNAL = 3004,
}
export enum OrderStatus { 
  ORDER_STATUS_NEW = 0,
  ORDER_STATUS_PENDING = 1,
  ORDER_STATUS_EXPIRED = 2,
  ORDER_STATUS_COMPLETELY_FILLED = 4,
  ORDER_STATUS_PARTIALLY_FILLED = 5,
  ORDER_STATUS_ONCHAIN_CANCELLED = 6,
  ORDER_STATUS_SOFT_CANCELLED = 7,
}
export enum UserTxStatus { 
  TX_STATUS_NEW = 0,
  TX_STATUS_PENDING = 1,
  TX_STATUS_FAILED = 2,
}
export enum UserTxType { 
  TX_TYPE_DEPOSIT = 0,
  TX_TYPE_WITHDRAW = 1,
  TX_TYPE_TRANSFER = 2,
}
