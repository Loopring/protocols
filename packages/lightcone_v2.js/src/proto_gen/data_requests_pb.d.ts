import * as jspb from "google-protobuf"

import * as data_types_pb from './data_types_pb';
import * as data_order_pb from './data_order_pb';

export class DepositRequest extends jspb.Message {
  getExchangeId(): number;
  setExchangeId(value: number): void;

  getAccountId(): data_types_pb.AccountID | undefined;
  setAccountId(value?: data_types_pb.AccountID): void;
  hasAccountId(): boolean;
  clearAccountId(): void;

  getTxData(): data_types_pb.TxData | undefined;
  setTxData(value?: data_types_pb.TxData): void;
  hasTxData(): boolean;
  clearTxData(): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): DepositRequest.AsObject;
  static toObject(includeInstance: boolean, msg: DepositRequest): DepositRequest.AsObject;
  static serializeBinaryToWriter(message: DepositRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): DepositRequest;
  static deserializeBinaryFromReader(message: DepositRequest, reader: jspb.BinaryReader): DepositRequest;
}

export namespace DepositRequest {
  export type AsObject = {
    exchangeId: number,
    accountId?: data_types_pb.AccountID.AsObject,
    txData?: data_types_pb.TxData.AsObject,
  }
}

export class OnchainWithdrawalRequest extends jspb.Message {
  getExchangeId(): number;
  setExchangeId(value: number): void;

  getAccountId(): data_types_pb.AccountID | undefined;
  setAccountId(value?: data_types_pb.AccountID): void;
  hasAccountId(): boolean;
  clearAccountId(): void;

  getTxData(): data_types_pb.TxData | undefined;
  setTxData(value?: data_types_pb.TxData): void;
  hasTxData(): boolean;
  clearTxData(): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): OnchainWithdrawalRequest.AsObject;
  static toObject(includeInstance: boolean, msg: OnchainWithdrawalRequest): OnchainWithdrawalRequest.AsObject;
  static serializeBinaryToWriter(message: OnchainWithdrawalRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): OnchainWithdrawalRequest;
  static deserializeBinaryFromReader(message: OnchainWithdrawalRequest, reader: jspb.BinaryReader): OnchainWithdrawalRequest;
}

export namespace OnchainWithdrawalRequest {
  export type AsObject = {
    exchangeId: number,
    accountId?: data_types_pb.AccountID.AsObject,
    txData?: data_types_pb.TxData.AsObject,
  }
}

export class OffchainWithdrawalRequest extends jspb.Message {
  getExchangeId(): number;
  setExchangeId(value: number): void;

  getAccountId(): data_types_pb.AccountID | undefined;
  setAccountId(value?: data_types_pb.AccountID): void;
  hasAccountId(): boolean;
  clearAccountId(): void;

  getTokenId(): data_types_pb.TokenID | undefined;
  setTokenId(value?: data_types_pb.TokenID): void;
  hasTokenId(): boolean;
  clearTokenId(): void;

  getAmount(): data_types_pb.Amount | undefined;
  setAmount(value?: data_types_pb.Amount): void;
  hasAmount(): boolean;
  clearAmount(): void;

  getWalletId(): data_types_pb.AccountID | undefined;
  setWalletId(value?: data_types_pb.AccountID): void;
  hasWalletId(): boolean;
  clearWalletId(): void;

  getTokenF(): data_types_pb.TokenID | undefined;
  setTokenF(value?: data_types_pb.TokenID): void;
  hasTokenF(): boolean;
  clearTokenF(): void;

  getAmountF(): data_types_pb.Amount | undefined;
  setAmountF(value?: data_types_pb.Amount): void;
  hasAmountF(): boolean;
  clearAmountF(): void;

  getWalletSplit(): data_types_pb.Percentage | undefined;
  setWalletSplit(value?: data_types_pb.Percentage): void;
  hasWalletSplit(): boolean;
  clearWalletSplit(): void;

  getNonce(): data_types_pb.Nonce | undefined;
  setNonce(value?: data_types_pb.Nonce): void;
  hasNonce(): boolean;
  clearNonce(): void;

  getSig(): data_types_pb.EdDSASignature | undefined;
  setSig(value?: data_types_pb.EdDSASignature): void;
  hasSig(): boolean;
  clearSig(): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): OffchainWithdrawalRequest.AsObject;
  static toObject(includeInstance: boolean, msg: OffchainWithdrawalRequest): OffchainWithdrawalRequest.AsObject;
  static serializeBinaryToWriter(message: OffchainWithdrawalRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): OffchainWithdrawalRequest;
  static deserializeBinaryFromReader(message: OffchainWithdrawalRequest, reader: jspb.BinaryReader): OffchainWithdrawalRequest;
}

export namespace OffchainWithdrawalRequest {
  export type AsObject = {
    exchangeId: number,
    accountId?: data_types_pb.AccountID.AsObject,
    tokenId?: data_types_pb.TokenID.AsObject,
    amount?: data_types_pb.Amount.AsObject,
    walletId?: data_types_pb.AccountID.AsObject,
    tokenF?: data_types_pb.TokenID.AsObject,
    amountF?: data_types_pb.Amount.AsObject,
    walletSplit?: data_types_pb.Percentage.AsObject,
    nonce?: data_types_pb.Nonce.AsObject,
    sig?: data_types_pb.EdDSASignature.AsObject,
  }
}

export class OrderCancellationRequest extends jspb.Message {
  getExchangeId(): number;
  setExchangeId(value: number): void;

  getAccountId(): data_types_pb.AccountID | undefined;
  setAccountId(value?: data_types_pb.AccountID): void;
  hasAccountId(): boolean;
  clearAccountId(): void;

  getOrderId(): data_types_pb.OrderID | undefined;
  setOrderId(value?: data_types_pb.OrderID): void;
  hasOrderId(): boolean;
  clearOrderId(): void;

  getWalletId(): data_types_pb.AccountID | undefined;
  setWalletId(value?: data_types_pb.AccountID): void;
  hasWalletId(): boolean;
  clearWalletId(): void;

  getTokenS(): data_types_pb.TokenID | undefined;
  setTokenS(value?: data_types_pb.TokenID): void;
  hasTokenS(): boolean;
  clearTokenS(): void;

  getTokenF(): data_types_pb.TokenID | undefined;
  setTokenF(value?: data_types_pb.TokenID): void;
  hasTokenF(): boolean;
  clearTokenF(): void;

  getAmountF(): data_types_pb.Amount | undefined;
  setAmountF(value?: data_types_pb.Amount): void;
  hasAmountF(): boolean;
  clearAmountF(): void;

  getWalletSplitPctg(): data_types_pb.Percentage | undefined;
  setWalletSplitPctg(value?: data_types_pb.Percentage): void;
  hasWalletSplitPctg(): boolean;
  clearWalletSplitPctg(): void;

  getNonce(): data_types_pb.Nonce | undefined;
  setNonce(value?: data_types_pb.Nonce): void;
  hasNonce(): boolean;
  clearNonce(): void;

  getSig(): data_types_pb.EdDSASignature | undefined;
  setSig(value?: data_types_pb.EdDSASignature): void;
  hasSig(): boolean;
  clearSig(): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): OrderCancellationRequest.AsObject;
  static toObject(includeInstance: boolean, msg: OrderCancellationRequest): OrderCancellationRequest.AsObject;
  static serializeBinaryToWriter(message: OrderCancellationRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): OrderCancellationRequest;
  static deserializeBinaryFromReader(message: OrderCancellationRequest, reader: jspb.BinaryReader): OrderCancellationRequest;
}

export namespace OrderCancellationRequest {
  export type AsObject = {
    exchangeId: number,
    accountId?: data_types_pb.AccountID.AsObject,
    orderId?: data_types_pb.OrderID.AsObject,
    walletId?: data_types_pb.AccountID.AsObject,
    tokenS?: data_types_pb.TokenID.AsObject,
    tokenF?: data_types_pb.TokenID.AsObject,
    amountF?: data_types_pb.Amount.AsObject,
    walletSplitPctg?: data_types_pb.Percentage.AsObject,
    nonce?: data_types_pb.Nonce.AsObject,
    sig?: data_types_pb.EdDSASignature.AsObject,
  }
}

