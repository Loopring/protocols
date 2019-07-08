import {Empty} from 'google-protobuf/google/protobuf/empty_pb';
import {StringValue, UInt32Value} from 'google-protobuf/google/protobuf/wrappers_pb';
import {Order} from '../proto_gen/data_order_pb';
import {io} from "../model/types";
import {
    OffchainWithdrawalRequest,
    OrderCancellationRequest
} from '../proto_gen/data_requests_pb';
import { DexServiceClient } from '..';
import {Metadata} from "grpc";
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
} from 'src/proto_gen/service_dex_pb';

/**
 * gRPC GrpcClientService Service
 */
class GrpcClientService {
    private readonly client: DexServiceClient = new DexServiceClient('18.179.197.168:5000', null, null); // TODO: config

    public async getDexConfigurations(): Promise<DexConfigurations> {
        const metadata = new Metadata();
        const empty: Empty = new Empty();
        return new Promise<DexConfigurations>((resolve: Function, reject: Function): void => {
            this.client.getDexConfigurations(empty, metadata, (err: Error | null, res: DexConfigurations) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getAccount(param: string): Promise<Account> {
        const metadata = new Metadata();
        const address: StringValue = new StringValue();
        address.setValue(param);

        return new Promise<Account>((resolve: Function, reject: Function): void => {
            this.client.getAccount(address, metadata, (err: Error | null, res: Account) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getNonce(param: number): Promise<UInt32Value> {
        const metadata = new Metadata();
        const accountId: UInt32Value = new UInt32Value();
        accountId.setValue(param);

        return new Promise<UInt32Value>((resolve: Function, reject: Function): void => {
            this.client.getNonce(accountId, metadata, (err: Error | null, res: UInt32Value) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getTokens(param: GetTokensReq): Promise<GetTokensRes> {
        const metadata = new Metadata();
        return new Promise<GetTokensRes>((resolve: Function, reject: Function): void => {
            this.client.getTokens(param, metadata, (err: Error | null, res: GetTokensRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getNextOrderId(param: GetNextOrderIdReq): Promise<UInt32Value> {
        const metadata = new Metadata();
        return new Promise<UInt32Value>((resolve: Function, reject: Function): void => {
            this.client.getNextOrderId(param, metadata, (err: Error | null, res: UInt32Value) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getMarkets(param: GetMarketsReq): Promise<GetMarketsRes> {
        const metadata = new Metadata();
        return new Promise<GetMarketsRes>((resolve: Function, reject: Function): void => {
            this.client.getMarkets(param, metadata, (err: Error | null, res: GetMarketsRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getMarketFills(param: GetMarketFillsReq): Promise<GetFillsRes> {
        const metadata = new Metadata();
        return new Promise<GetFillsRes>((resolve: Function, reject: Function): void => {
            this.client.getMarketFills(param, metadata, (err: Error | null, res: GetFillsRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getUserFills(param: GetUserFillsReq): Promise<GetFillsRes> {
        const metadata = new Metadata();
        return new Promise<GetFillsRes>((resolve: Function, reject: Function): void => {
            this.client.getUserFills(param, metadata, (err: Error | null, res: GetFillsRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getUserTransactions(param: GetUserTransactionsReq): Promise<GetUserTransactionsRes> {
        const metadata = new Metadata();
        return new Promise<GetUserTransactionsRes>((resolve: Function, reject: Function): void => {
            this.client.getUserTransfers(param, metadata, (err: Error | null, res: GetUserTransactionsRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getOrderBook(param: GetOrderBookReq): Promise<OrderBook> {
        const metadata = new Metadata();
        return new Promise<OrderBook>((resolve: Function, reject: Function): void => {
            this.client.getOrderBook(param, metadata, (err: Error | null, res: OrderBook) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getUserOrders(param: GetUserOrdersReq): Promise<GetUserOrdersRes> {
        const metadata = new Metadata();
        return new Promise<GetUserOrdersRes>((resolve: Function, reject: Function): void => {
            this.client.getUserOrders(param, metadata, (err: Error | null, res: GetUserOrdersRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async submitOrder(param: Order): Promise<SubmitOrderRes> {
        const metadata = new Metadata();
        return new Promise<SubmitOrderRes>((resolve: Function, reject: Function): void => {
            this.client.submitOrder(param, metadata, (err: Error | null, res: SubmitOrderRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    // Cancel orders by marking them obsoleted in database, not to be included in blocks.
    public async cancelOrder(param: SimpleOrderCancellationReq): Promise<CancelOrderRes> {
        const metadata = new Metadata();
        return new Promise<CancelOrderRes>((resolve: Function, reject: Function): void => {
            this.client.cancelOrder(param, metadata, (err: Error | null, res: CancelOrderRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    // Submit an offchain order cancellation request, will make into blocks.
    public async submitOrderCancellation(param: OrderCancellationRequest): Promise<CancelOrderRes> {
        const metadata = new Metadata();
        return new Promise<CancelOrderRes>((resolve: Function, reject: Function): void => {
            this.client.submitOrderCancellation(param, metadata, (err: Error | null, res: CancelOrderRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    // Submit an offchain withdrawal request, will make into blocks.
    public async submitOffchainWithdrawal(param: OffchainWithdrawalRequest): Promise<OffchainWithdrawalalRes> {
        const metadata = new Metadata();
        return new Promise<OffchainWithdrawalalRes>((resolve: Function, reject: Function): void => {
            this.client.submitOffchainWithdrawal(param, metadata, (err: Error | null, res: OffchainWithdrawalalRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public socketExample() {
        const socket = io.connect("localhost");  // TODO: config server ip
        socket.on("news", (data: any) => alert(data));
        socket.emit("news", "hello");
    }

}

export const grpcClientService: GrpcClientService = new GrpcClientService();
