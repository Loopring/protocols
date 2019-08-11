import { Empty } from "google-protobuf/google/protobuf/empty_pb";
import {
  StringValue,
  UInt32Value
} from "google-protobuf/google/protobuf/wrappers_pb";

import * as grpcWeb from "grpc-web";

import { io } from "../model/types";
import { Order } from "./proto_gen/data_order_pb";
import {
  OffchainWithdrawalRequest,
  OrderCancellationRequest
} from "./proto_gen/data_requests_pb.d";
import { CursorPaging } from "./proto_gen/data_types_pb";
import {
  Account,
  CancelOrderRes,
  DexConfigurations,
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
  SubmitOrderRes
} from "./proto_gen/service_dex_pb";
import { DexServiceClient } from "./proto_gen/Service_dexServiceClientPb";

/**
 * gRPC GrpcClientService Service
 */
class GrpcClientService {
  // TODO: use localhost for debug
  private readonly client = new DexServiceClient(
    "http://0.0.0.0:5000",
    null,
    null
  ); // TODO: config

  // Verfied
  public async getDexConfigurations(): Promise<DexConfigurations> {
    const empty: Empty = new Empty();

    return new Promise<DexConfigurations>(
      (resolve: Function, reject: Function): void => {
        this.client.getDexConfigurations(
          empty,
          null,
          (err: grpcWeb.Error, res: DexConfigurations) => {
            if (err) {
              return reject(err);
            }
            resolve(res);
          }
        );
      }
    );
  }

  public async getAccount(param: string): Promise<Account> {
    const address: StringValue = new StringValue();
    address.setValue(param);

    return new Promise<Account>((resolve: Function, reject: Function): void => {
      this.client.getAccount(
        address,
        null,
        (err: grpcWeb.Error, res: Account) => {
          if (err) {
            return reject(err);
          }
          resolve(res);
        }
      );
    });
  }

  public async getNonce(param: number): Promise<UInt32Value> {
    const accountId: UInt32Value = new UInt32Value();
    accountId.setValue(param);

    return new Promise<UInt32Value>(
      (resolve: Function, reject: Function): void => {
        this.client.getNonce(
          accountId,
          null,
          (err: grpcWeb.Error, res: UInt32Value) => {
            if (err) {
              return reject(err);
            }
            resolve(res);
          }
        );
      }
    );
  }

  public async getNextOrderId(
    accountId: number,
    tokenSellId: number
  ): Promise<UInt32Value> {
    const req: GetNextOrderIdReq = new GetNextOrderIdReq();
    req.setAccountId(accountId);
    req.setTokenSellId(tokenSellId);

    return new Promise<UInt32Value>(
      (resolve: Function, reject: Function): void => {
        this.client.getNextOrderId(
          req,
          null,
          (err: grpcWeb.Error, res: UInt32Value) => {
            if (err) {
              return reject(err);
            }
            resolve(res);
          }
        );
      }
    );
  }

  public async submitOrder(param: Order): Promise<SubmitOrderRes> {
    return new Promise<SubmitOrderRes>(
      (resolve: Function, reject: Function): void => {
        this.client.submitOrder(
          param,
          null,
          (err: grpcWeb.Error, res: SubmitOrderRes) => {
            if (err) {
              return reject(err);
            }
            resolve(res);
          }
        );
      }
    );
  }

  // TODO: not test in web
  // Cancel orders by marking them obsoleted in database, not to be included in blocks.
  public async cancelOrder(
    param: SimpleOrderCancellationReq
  ): Promise<CancelOrderRes> {
    return new Promise<CancelOrderRes>(
      (resolve: Function, reject: Function): void => {
        this.client.cancelOrder(
          param,
          null,
          (err: grpcWeb.Error, res: CancelOrderRes) => {
            if (err) {
              return reject(err);
            }
            resolve(res);
          }
        );
      }
    );
  }

  // TODO: not test in web
  // Submit an offchain order cancellation request, will make into blocks.
  public async submitOrderCancellation(
    param: OrderCancellationRequest
  ): Promise<CancelOrderRes> {
    return new Promise<CancelOrderRes>(
      (resolve: Function, reject: Function): void => {
        this.client.submitOrderCancellation(
          param,
          null,
          (err: grpcWeb.Error, res: CancelOrderRes) => {
            if (err) {
              return reject(err);
            }
            resolve(res);
          }
        );
      }
    );
  }

  // TODO: not test in web
  // Submit an offchain withdrawal request, will make into blocks.
  public async submitOffchainWithdrawal(
    param: OffchainWithdrawalRequest
  ): Promise<OffchainWithdrawalalRes> {
    return new Promise<OffchainWithdrawalalRes>(
      (resolve: Function, reject: Function): void => {
        this.client.submitOffchainWithdrawal(
          param,
          null,
          (err: grpcWeb.Error, res: OffchainWithdrawalalRes) => {
            if (err) {
              return reject(err);
            }
            resolve(res);
          }
        );
      }
    );
  }
}

export const grpcClientService: GrpcClientService = new GrpcClientService();
