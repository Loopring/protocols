import * as jspb from "google-protobuf"

import * as data_types_pb from './data_types_pb';

export class TokenAmounts extends jspb.Message {
  getAmountS(): data_types_pb.Amount | undefined;
  setAmountS(value?: data_types_pb.Amount): void;
  hasAmountS(): boolean;
  clearAmountS(): void;

  getAmountB(): data_types_pb.Amount | undefined;
  setAmountB(value?: data_types_pb.Amount): void;
  hasAmountB(): boolean;
  clearAmountB(): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): TokenAmounts.AsObject;
  static toObject(includeInstance: boolean, msg: TokenAmounts): TokenAmounts.AsObject;
  static serializeBinaryToWriter(message: TokenAmounts, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): TokenAmounts;
  static deserializeBinaryFromReader(message: TokenAmounts, reader: jspb.BinaryReader): TokenAmounts;
}

export namespace TokenAmounts {
  export type AsObject = {
    amountS?: data_types_pb.Amount.AsObject,
    amountB?: data_types_pb.Amount.AsObject,
  }
}

export class Order extends jspb.Message {
  getExchangeId(): number;
  setExchangeId(value: number): void;

  getOrderId(): data_types_pb.OrderID | undefined;
  setOrderId(value?: data_types_pb.OrderID): void;
  hasOrderId(): boolean;
  clearOrderId(): void;

  getAccountId(): data_types_pb.AccountID | undefined;
  setAccountId(value?: data_types_pb.AccountID): void;
  hasAccountId(): boolean;
  clearAccountId(): void;

  getTokenS(): data_types_pb.TokenID | undefined;
  setTokenS(value?: data_types_pb.TokenID): void;
  hasTokenS(): boolean;
  clearTokenS(): void;

  getTokenB(): data_types_pb.TokenID | undefined;
  setTokenB(value?: data_types_pb.TokenID): void;
  hasTokenB(): boolean;
  clearTokenB(): void;

  getAmounts(): TokenAmounts | undefined;
  setAmounts(value?: TokenAmounts): void;
  hasAmounts(): boolean;
  clearAmounts(): void;

  getMaxFee(): data_types_pb.Bips | undefined;
  setMaxFee(value?: data_types_pb.Bips): void;
  hasMaxFee(): boolean;
  clearMaxFee(): void;

  getFee(): data_types_pb.Bips | undefined;
  setFee(value?: data_types_pb.Bips): void;
  hasFee(): boolean;
  clearFee(): void;

  getRebate(): data_types_pb.Bips | undefined;
  setRebate(value?: data_types_pb.Bips): void;
  hasRebate(): boolean;
  clearRebate(): void;

  getAllOrNone(): boolean;
  setAllOrNone(value: boolean): void;

  getValidSince(): number;
  setValidSince(value: number): void;

  getValidUntil(): number;
  setValidUntil(value: number): void;

  getBuy(): boolean;
  setBuy(value: boolean): void;

  getTradingPubKey(): data_types_pb.EdDSAPubKey | undefined;
  setTradingPubKey(value?: data_types_pb.EdDSAPubKey): void;
  hasTradingPubKey(): boolean;
  clearTradingPubKey(): void;

  getDualAuthPubKey(): data_types_pb.EdDSAPubKey | undefined;
  setDualAuthPubKey(value?: data_types_pb.EdDSAPubKey): void;
  hasDualAuthPubKey(): boolean;
  clearDualAuthPubKey(): void;

  getDualAuthPrivKey(): data_types_pb.EdDSAPrivKey | undefined;
  setDualAuthPrivKey(value?: data_types_pb.EdDSAPrivKey): void;
  hasDualAuthPrivKey(): boolean;
  clearDualAuthPrivKey(): void;

  getTradingSig(): data_types_pb.EdDSASignature | undefined;
  setTradingSig(value?: data_types_pb.EdDSASignature): void;
  hasTradingSig(): boolean;
  clearTradingSig(): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Order.AsObject;
  static toObject(includeInstance: boolean, msg: Order): Order.AsObject;
  static serializeBinaryToWriter(message: Order, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Order;
  static deserializeBinaryFromReader(message: Order, reader: jspb.BinaryReader): Order;
}

export namespace Order {
  export type AsObject = {
    exchangeId: number,
    orderId?: data_types_pb.OrderID.AsObject,
    accountId?: data_types_pb.AccountID.AsObject,
    tokenS?: data_types_pb.TokenID.AsObject,
    tokenB?: data_types_pb.TokenID.AsObject,
    amounts?: TokenAmounts.AsObject,
    maxFee?: data_types_pb.Bips.AsObject,
    fee?: data_types_pb.Bips.AsObject,
    rebate?: data_types_pb.Bips.AsObject,
    allOrNone: boolean,
    validSince: number,
    validUntil: number,
    buy: boolean,
    tradingPubKey?: data_types_pb.EdDSAPubKey.AsObject,
    dualAuthPubKey?: data_types_pb.EdDSAPubKey.AsObject,
    dualAuthPrivKey?: data_types_pb.EdDSAPrivKey.AsObject,
    tradingSig?: data_types_pb.EdDSASignature.AsObject,
  }
}

export class Fill extends jspb.Message {
  getAccountId(): data_types_pb.AccountID | undefined;
  setAccountId(value?: data_types_pb.AccountID): void;
  hasAccountId(): boolean;
  clearAccountId(): void;

  getOrderId(): data_types_pb.OrderID | undefined;
  setOrderId(value?: data_types_pb.OrderID): void;
  hasOrderId(): boolean;
  clearOrderId(): void;

  getIsSell(): boolean;
  setIsSell(value: boolean): void;

  getPrice(): number;
  setPrice(value: number): void;

  getAmountBaseToken(): data_types_pb.Amount | undefined;
  setAmountBaseToken(value?: data_types_pb.Amount): void;
  hasAmountBaseToken(): boolean;
  clearAmountBaseToken(): void;

  getAmountQuoteToken(): data_types_pb.Amount | undefined;
  setAmountQuoteToken(value?: data_types_pb.Amount): void;
  hasAmountQuoteToken(): boolean;
  clearAmountQuoteToken(): void;

  getTimestamp(): number;
  setTimestamp(value: number): void;

  getDeprecated(): boolean;
  setDeprecated(value: boolean): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Fill.AsObject;
  static toObject(includeInstance: boolean, msg: Fill): Fill.AsObject;
  static serializeBinaryToWriter(message: Fill, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Fill;
  static deserializeBinaryFromReader(message: Fill, reader: jspb.BinaryReader): Fill;
}

export namespace Fill {
  export type AsObject = {
    accountId?: data_types_pb.AccountID.AsObject,
    orderId?: data_types_pb.OrderID.AsObject,
    isSell: boolean,
    price: number,
    amountBaseToken?: data_types_pb.Amount.AsObject,
    amountQuoteToken?: data_types_pb.Amount.AsObject,
    timestamp: number,
    deprecated: boolean,
  }
}

export class FillData extends jspb.Message {
  getSequenceId(): number;
  setSequenceId(value: number): void;

  getAccountId(): data_types_pb.AccountID | undefined;
  setAccountId(value?: data_types_pb.AccountID): void;
  hasAccountId(): boolean;
  clearAccountId(): void;

  getOrderId(): data_types_pb.OrderID | undefined;
  setOrderId(value?: data_types_pb.OrderID): void;
  hasOrderId(): boolean;
  clearOrderId(): void;

  getSettlementRequestId(): number;
  setSettlementRequestId(value: number): void;

  getTokenS(): data_types_pb.TokenID | undefined;
  setTokenS(value?: data_types_pb.TokenID): void;
  hasTokenS(): boolean;
  clearTokenS(): void;

  getTokenB(): data_types_pb.TokenID | undefined;
  setTokenB(value?: data_types_pb.TokenID): void;
  hasTokenB(): boolean;
  clearTokenB(): void;

  getIsSell(): boolean;
  setIsSell(value: boolean): void;

  getPrice(): number;
  setPrice(value: number): void;

  getEstimateAmountBaseToken(): data_types_pb.Amount | undefined;
  setEstimateAmountBaseToken(value?: data_types_pb.Amount): void;
  hasEstimateAmountBaseToken(): boolean;
  clearEstimateAmountBaseToken(): void;

  getEstimateAmountQuoteToken(): data_types_pb.Amount | undefined;
  setEstimateAmountQuoteToken(value?: data_types_pb.Amount): void;
  hasEstimateAmountQuoteToken(): boolean;
  clearEstimateAmountQuoteToken(): void;

  getActualAmountBaseToken(): data_types_pb.Amount | undefined;
  setActualAmountBaseToken(value?: data_types_pb.Amount): void;
  hasActualAmountBaseToken(): boolean;
  clearActualAmountBaseToken(): void;

  getActualAmountQuoteToken(): data_types_pb.Amount | undefined;
  setActualAmountQuoteToken(value?: data_types_pb.Amount): void;
  hasActualAmountQuoteToken(): boolean;
  clearActualAmountQuoteToken(): void;

  getCreatedAt(): number;
  setCreatedAt(value: number): void;

  getUpdatedAt(): number;
  setUpdatedAt(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): FillData.AsObject;
  static toObject(includeInstance: boolean, msg: FillData): FillData.AsObject;
  static serializeBinaryToWriter(message: FillData, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): FillData;
  static deserializeBinaryFromReader(message: FillData, reader: jspb.BinaryReader): FillData;
}

export namespace FillData {
  export type AsObject = {
    sequenceId: number,
    accountId?: data_types_pb.AccountID.AsObject,
    orderId?: data_types_pb.OrderID.AsObject,
    settlementRequestId: number,
    tokenS?: data_types_pb.TokenID.AsObject,
    tokenB?: data_types_pb.TokenID.AsObject,
    isSell: boolean,
    price: number,
    estimateAmountBaseToken?: data_types_pb.Amount.AsObject,
    estimateAmountQuoteToken?: data_types_pb.Amount.AsObject,
    actualAmountBaseToken?: data_types_pb.Amount.AsObject,
    actualAmountQuoteToken?: data_types_pb.Amount.AsObject,
    createdAt: number,
    updatedAt: number,
  }
}

