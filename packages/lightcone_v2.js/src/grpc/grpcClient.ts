import {Empty} from 'google-protobuf/google/protobuf/empty_pb';
import {StringValue, UInt32Value} from 'google-protobuf/google/protobuf/wrappers_pb';
import {credentials, Metadata, ServiceError} from 'grpc';
import {Order} from '../../proto_gen/data_order_pb';
import {
    OffchainWithdrawalRequest,
    OrderCancellationRequest
} from '../../proto_gen/data_requests_pb';
import {DexServiceClient} from '../../proto_gen/service_dex_grpc_pb';
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
} from '../../proto_gen/service_dex_pb';
import {io} from "../model/types";

/**
 * gRPC GrpcClient Service
 */
class GrpcClient {

    private readonly client: DexServiceClient = new DexServiceClient('localhost:50051', credentials.createInsecure()); // TODO: config

    public async getDexConfigurations(metadata: Metadata = new Metadata()): Promise<DexConfigurations> {
        const empty: Empty = new Empty();

        return new Promise<DexConfigurations>((resolve: Function, reject: Function): void => {
            this.client.getDexConfigurations(empty, metadata, (err: ServiceError | null, res: DexConfigurations) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getAccount(param: string, metadata: Metadata = new Metadata()): Promise<Account> {
        const address: StringValue = new StringValue();
        address.setValue(param);

        return new Promise<Account>((resolve: Function, reject: Function): void => {
            this.client.getAccount(address, metadata, (err: ServiceError | null, res: Account) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getTokens(param: GetTokensReq, metadata: Metadata = new Metadata()): Promise<GetTokensRes> {
        return new Promise<GetTokensRes>((resolve: Function, reject: Function): void => {
            this.client.getTokens(param, metadata, (err: ServiceError | null, res: GetTokensRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getNextOrderId(param: GetNextOrderIdReq, metadata: Metadata = new Metadata()): Promise<UInt32Value> {
        return new Promise<UInt32Value>((resolve: Function, reject: Function): void => {
            this.client.getNextOrderId(param, metadata, (err: ServiceError | null, res: UInt32Value) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getMarkets(param: GetMarketsReq, metadata: Metadata = new Metadata()): Promise<GetMarketsRes> {
        return new Promise<GetMarketsRes>((resolve: Function, reject: Function): void => {
            this.client.getMarkets(param, metadata, (err: ServiceError | null, res: GetMarketsRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getMarketFills(param: GetMarketFillsReq, metadata: Metadata = new Metadata()): Promise<GetFillsRes> {
        return new Promise<GetFillsRes>((resolve: Function, reject: Function): void => {
            this.client.getMarketFills(param, metadata, (err: ServiceError | null, res: GetFillsRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getUserFills(param: GetUserFillsReq, metadata: Metadata = new Metadata()): Promise<GetFillsRes> {
        return new Promise<GetFillsRes>((resolve: Function, reject: Function): void => {
            this.client.getUserFills(param, metadata, (err: ServiceError | null, res: GetFillsRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getUserTransactions(param: GetUserTransactionsReq, metadata: Metadata = new Metadata()): Promise<GetUserTransactionsRes> {
        return new Promise<GetUserTransactionsRes>((resolve: Function, reject: Function): void => {
            this.client.getUserTransfers(param, metadata, (err: ServiceError | null, res: GetUserTransactionsRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getOrderBook(param: GetOrderBookReq, metadata: Metadata = new Metadata()): Promise<OrderBook> {
        return new Promise<OrderBook>((resolve: Function, reject: Function): void => {
            this.client.getOrderBook(param, metadata, (err: ServiceError | null, res: OrderBook) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getUserOrders(param: GetUserOrdersReq, metadata: Metadata = new Metadata()): Promise<GetUserOrdersRes> {
        return new Promise<GetUserOrdersRes>((resolve: Function, reject: Function): void => {
            this.client.getUserOrders(param, metadata, (err: ServiceError | null, res: GetUserOrdersRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async submitOrder(param: Order, metadata: Metadata = new Metadata()): Promise<SubmitOrderRes> {
        return new Promise<SubmitOrderRes>((resolve: Function, reject: Function): void => {
            this.client.submitOrder(param, metadata, (err: ServiceError | null, res: SubmitOrderRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    // Cancel orders by marking them obsoleted in database, not to be included in blocks.
    public async cancelOrder(param: SimpleOrderCancellationReq, metadata: Metadata = new Metadata()): Promise<CancelOrderRes> {
        return new Promise<CancelOrderRes>((resolve: Function, reject: Function): void => {
            this.client.cancelOrder(param, metadata, (err: ServiceError | null, res: CancelOrderRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    // Submit an offchain order cancellation request, will make into blocks.
    public async submitOrderCancellation(param: OrderCancellationRequest, metadata: Metadata = new Metadata()): Promise<CancelOrderRes> {
        return new Promise<CancelOrderRes>((resolve: Function, reject: Function): void => {
            this.client.submitOrderCancellation(param, metadata, (err: ServiceError | null, res: CancelOrderRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    // Submit an offchain withdrawal request, will make into blocks.
    public async submitOffchainWithdrawal(param: OffchainWithdrawalRequest,
                                          metadata: Metadata = new Metadata()): Promise<OffchainWithdrawalalRes> {
        return new Promise<OffchainWithdrawalalRes>((resolve: Function, reject: Function): void => {
            this.client.submitOffchainWithdrawal(param, metadata, (err: ServiceError | null, res: OffchainWithdrawalalRes) => {
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

export const grpcClient: GrpcClient = new GrpcClient();
