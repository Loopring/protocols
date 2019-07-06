/**
 * @fileoverview gRPC-Web generated client stub for io.lightcone.data.dex
 * @enhanceable
 * @public
 */

// GENERATED CODE -- DO NOT EDIT!


import * as grpcWeb from 'grpc-web';

import * as google_protobuf_empty_pb from 'google-protobuf/google/protobuf/empty_pb';
import * as google_protobuf_wrappers_pb from 'google-protobuf/google/protobuf/wrappers_pb';
import * as data_order_pb from './data_order_pb';
import * as data_requests_pb from './data_requests_pb';
import * as data_types_pb from './data_types_pb';

import {
  Account,
  CancelOrderRes,
  Candles,
  DexConfigurations,
  GetCandlesReq,
  GetFillsRes,
  GetMarketFillsReq,
  GetMarketsReq,
  GetMarketsRes,
  GetNextOrderIdReq,
  GetOrderBookReq,
  GetTokensReq,
  GetTokensRes,
  GetUserFillsReq,
  GetUserOrdersReq,
  GetUserOrdersRes,
  GetUserTransactionsReq,
  GetUserTransactionsRes,
  OffchainWithdrawalalRes,
  OrderBook,
  SimpleOrderCancellationReq,
  SubmitOrderRes} from './service_dex_pb';

export class DexServiceClient {
  client_: grpcWeb.AbstractClientBase;
  hostname_: string;
  credentials_: null | { [index: string]: string; };
  options_: null | { [index: string]: string; };

  constructor (hostname: string,
               credentials: null | { [index: string]: string; },
               options: null | { [index: string]: string; }) {
    if (!options) options = {};
    options['format'] = 'text';

    this.client_ = new grpcWeb.GrpcWebClientBase(options);
    this.hostname_ = hostname;
    this.credentials_ = credentials;
    this.options_ = options;
  }

  methodInfogetDexConfigurations = new grpcWeb.AbstractClientBase.MethodInfo(
    DexConfigurations,
    (request: google_protobuf_empty_pb.Empty) => {
      return request.serializeBinary();
    },
    DexConfigurations.deserializeBinary
  );

  getDexConfigurations(
    request: google_protobuf_empty_pb.Empty,
    metadata: grpcWeb.Metadata | null,
    callback: (err: grpcWeb.Error,
               response: DexConfigurations) => void) {
    return this.client_.rpcCall(
      this.hostname_ +
        '/io.lightcone.data.dex.DexService/getDexConfigurations',
      request,
      metadata || {},
      this.methodInfogetDexConfigurations,
      callback);
  }

  methodInfogetTokens = new grpcWeb.AbstractClientBase.MethodInfo(
    GetTokensRes,
    (request: GetTokensReq) => {
      return request.serializeBinary();
    },
    GetTokensRes.deserializeBinary
  );

  getTokens(
    request: GetTokensReq,
    metadata: grpcWeb.Metadata | null,
    callback: (err: grpcWeb.Error,
               response: GetTokensRes) => void) {
    return this.client_.rpcCall(
      this.hostname_ +
        '/io.lightcone.data.dex.DexService/getTokens',
      request,
      metadata || {},
      this.methodInfogetTokens,
      callback);
  }

  methodInfogetMarkets = new grpcWeb.AbstractClientBase.MethodInfo(
    GetMarketsRes,
    (request: GetMarketsReq) => {
      return request.serializeBinary();
    },
    GetMarketsRes.deserializeBinary
  );

  getMarkets(
    request: GetMarketsReq,
    metadata: grpcWeb.Metadata | null,
    callback: (err: grpcWeb.Error,
               response: GetMarketsRes) => void) {
    return this.client_.rpcCall(
      this.hostname_ +
        '/io.lightcone.data.dex.DexService/getMarkets',
      request,
      metadata || {},
      this.methodInfogetMarkets,
      callback);
  }

  methodInfogetMarketFills = new grpcWeb.AbstractClientBase.MethodInfo(
    GetFillsRes,
    (request: GetMarketFillsReq) => {
      return request.serializeBinary();
    },
    GetFillsRes.deserializeBinary
  );

  getMarketFills(
    request: GetMarketFillsReq,
    metadata: grpcWeb.Metadata | null,
    callback: (err: grpcWeb.Error,
               response: GetFillsRes) => void) {
    return this.client_.rpcCall(
      this.hostname_ +
        '/io.lightcone.data.dex.DexService/getMarketFills',
      request,
      metadata || {},
      this.methodInfogetMarketFills,
      callback);
  }

  methodInfogetOrderBook = new grpcWeb.AbstractClientBase.MethodInfo(
    OrderBook,
    (request: GetOrderBookReq) => {
      return request.serializeBinary();
    },
    OrderBook.deserializeBinary
  );

  getOrderBook(
    request: GetOrderBookReq,
    metadata: grpcWeb.Metadata | null,
    callback: (err: grpcWeb.Error,
               response: OrderBook) => void) {
    return this.client_.rpcCall(
      this.hostname_ +
        '/io.lightcone.data.dex.DexService/getOrderBook',
      request,
      metadata || {},
      this.methodInfogetOrderBook,
      callback);
  }

  methodInfogetCandles = new grpcWeb.AbstractClientBase.MethodInfo(
    Candles,
    (request: GetCandlesReq) => {
      return request.serializeBinary();
    },
    Candles.deserializeBinary
  );

  getCandles(
    request: GetCandlesReq,
    metadata: grpcWeb.Metadata | null,
    callback: (err: grpcWeb.Error,
               response: Candles) => void) {
    return this.client_.rpcCall(
      this.hostname_ +
        '/io.lightcone.data.dex.DexService/getCandles',
      request,
      metadata || {},
      this.methodInfogetCandles,
      callback);
  }

  methodInfogetAccount = new grpcWeb.AbstractClientBase.MethodInfo(
    Account,
    (request: google_protobuf_wrappers_pb.StringValue) => {
      return request.serializeBinary();
    },
    Account.deserializeBinary
  );

  getAccount(
    request: google_protobuf_wrappers_pb.StringValue,
    metadata: grpcWeb.Metadata | null,
    callback: (err: grpcWeb.Error,
               response: Account) => void) {
    return this.client_.rpcCall(
      this.hostname_ +
        '/io.lightcone.data.dex.DexService/getAccount',
      request,
      metadata || {},
      this.methodInfogetAccount,
      callback);
  }

  methodInfogetUserOrders = new grpcWeb.AbstractClientBase.MethodInfo(
    GetUserOrdersRes,
    (request: GetUserOrdersReq) => {
      return request.serializeBinary();
    },
    GetUserOrdersRes.deserializeBinary
  );

  getUserOrders(
    request: GetUserOrdersReq,
    metadata: grpcWeb.Metadata | null,
    callback: (err: grpcWeb.Error,
               response: GetUserOrdersRes) => void) {
    return this.client_.rpcCall(
      this.hostname_ +
        '/io.lightcone.data.dex.DexService/getUserOrders',
      request,
      metadata || {},
      this.methodInfogetUserOrders,
      callback);
  }

  methodInfogetUserFills = new grpcWeb.AbstractClientBase.MethodInfo(
    GetFillsRes,
    (request: GetUserFillsReq) => {
      return request.serializeBinary();
    },
    GetFillsRes.deserializeBinary
  );

  getUserFills(
    request: GetUserFillsReq,
    metadata: grpcWeb.Metadata | null,
    callback: (err: grpcWeb.Error,
               response: GetFillsRes) => void) {
    return this.client_.rpcCall(
      this.hostname_ +
        '/io.lightcone.data.dex.DexService/getUserFills',
      request,
      metadata || {},
      this.methodInfogetUserFills,
      callback);
  }

  methodInfogetUserTransfers = new grpcWeb.AbstractClientBase.MethodInfo(
    GetUserTransactionsRes,
    (request: GetUserTransactionsReq) => {
      return request.serializeBinary();
    },
    GetUserTransactionsRes.deserializeBinary
  );

  getUserTransfers(
    request: GetUserTransactionsReq,
    metadata: grpcWeb.Metadata | null,
    callback: (err: grpcWeb.Error,
               response: GetUserTransactionsRes) => void) {
    return this.client_.rpcCall(
      this.hostname_ +
        '/io.lightcone.data.dex.DexService/getUserTransfers',
      request,
      metadata || {},
      this.methodInfogetUserTransfers,
      callback);
  }

  methodInfogetNextOrderId = new grpcWeb.AbstractClientBase.MethodInfo(
    google_protobuf_wrappers_pb.UInt32Value,
    (request: GetNextOrderIdReq) => {
      return request.serializeBinary();
    },
    google_protobuf_wrappers_pb.UInt32Value.deserializeBinary
  );

  getNextOrderId(
    request: GetNextOrderIdReq,
    metadata: grpcWeb.Metadata | null,
    callback: (err: grpcWeb.Error,
               response: google_protobuf_wrappers_pb.UInt32Value) => void) {
    return this.client_.rpcCall(
      this.hostname_ +
        '/io.lightcone.data.dex.DexService/getNextOrderId',
      request,
      metadata || {},
      this.methodInfogetNextOrderId,
      callback);
  }

  methodInfogetNonce = new grpcWeb.AbstractClientBase.MethodInfo(
    google_protobuf_wrappers_pb.UInt32Value,
    (request: google_protobuf_wrappers_pb.UInt32Value) => {
      return request.serializeBinary();
    },
    google_protobuf_wrappers_pb.UInt32Value.deserializeBinary
  );

  getNonce(
    request: google_protobuf_wrappers_pb.UInt32Value,
    metadata: grpcWeb.Metadata | null,
    callback: (err: grpcWeb.Error,
               response: google_protobuf_wrappers_pb.UInt32Value) => void) {
    return this.client_.rpcCall(
      this.hostname_ +
        '/io.lightcone.data.dex.DexService/getNonce',
      request,
      metadata || {},
      this.methodInfogetNonce,
      callback);
  }

  methodInfosubmitOrder = new grpcWeb.AbstractClientBase.MethodInfo(
    SubmitOrderRes,
    (request: data_order_pb.Order) => {
      return request.serializeBinary();
    },
    SubmitOrderRes.deserializeBinary
  );

  submitOrder(
    request: data_order_pb.Order,
    metadata: grpcWeb.Metadata | null,
    callback: (err: grpcWeb.Error,
               response: SubmitOrderRes) => void) {
    return this.client_.rpcCall(
      this.hostname_ +
        '/io.lightcone.data.dex.DexService/submitOrder',
      request,
      metadata || {},
      this.methodInfosubmitOrder,
      callback);
  }

  methodInfocancelOrder = new grpcWeb.AbstractClientBase.MethodInfo(
    CancelOrderRes,
    (request: SimpleOrderCancellationReq) => {
      return request.serializeBinary();
    },
    CancelOrderRes.deserializeBinary
  );

  cancelOrder(
    request: SimpleOrderCancellationReq,
    metadata: grpcWeb.Metadata | null,
    callback: (err: grpcWeb.Error,
               response: CancelOrderRes) => void) {
    return this.client_.rpcCall(
      this.hostname_ +
        '/io.lightcone.data.dex.DexService/cancelOrder',
      request,
      metadata || {},
      this.methodInfocancelOrder,
      callback);
  }

  methodInfosubmitOrderCancellation = new grpcWeb.AbstractClientBase.MethodInfo(
    CancelOrderRes,
    (request: data_requests_pb.OrderCancellationRequest) => {
      return request.serializeBinary();
    },
    CancelOrderRes.deserializeBinary
  );

  submitOrderCancellation(
    request: data_requests_pb.OrderCancellationRequest,
    metadata: grpcWeb.Metadata | null,
    callback: (err: grpcWeb.Error,
               response: CancelOrderRes) => void) {
    return this.client_.rpcCall(
      this.hostname_ +
        '/io.lightcone.data.dex.DexService/submitOrderCancellation',
      request,
      metadata || {},
      this.methodInfosubmitOrderCancellation,
      callback);
  }

  methodInfosubmitOffchainWithdrawal = new grpcWeb.AbstractClientBase.MethodInfo(
    OffchainWithdrawalalRes,
    (request: data_requests_pb.OffchainWithdrawalRequest) => {
      return request.serializeBinary();
    },
    OffchainWithdrawalalRes.deserializeBinary
  );

  submitOffchainWithdrawal(
    request: data_requests_pb.OffchainWithdrawalRequest,
    metadata: grpcWeb.Metadata | null,
    callback: (err: grpcWeb.Error,
               response: OffchainWithdrawalalRes) => void) {
    return this.client_.rpcCall(
      this.hostname_ +
        '/io.lightcone.data.dex.DexService/submitOffchainWithdrawal',
      request,
      metadata || {},
      this.methodInfosubmitOffchainWithdrawal,
      callback);
  }

}

