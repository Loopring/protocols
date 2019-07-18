import {Empty} from 'google-protobuf/google/protobuf/empty_pb';
import {StringValue, UInt32Value} from 'google-protobuf/google/protobuf/wrappers_pb';

import * as grpcWeb from 'grpc-web';

import {io} from '../model/types';
import {Order} from '../proto_gen/data_order_pb';
import {
    OffchainWithdrawalRequest,
    OrderCancellationRequest
} from '../proto_gen/data_requests_pb.d';
import {
    CursorPaging
} from '../proto_gen/data_types_pb';
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
} from '../proto_gen/service_dex_pb';
import { DexServiceClient } from '../proto_gen/Service_dexServiceClientPb';

/**
 * gRPC GrpcClientService Service
 */
class GrpcClientService {
    // TODO: use localhost for debug
    private readonly client = new DexServiceClient('http://0.0.0.0:5000', null, null); // TODO: config

    // Verfied
    public async getDexConfigurations(): Promise<DexConfigurations> {
        const empty: Empty = new Empty();

        return new Promise<DexConfigurations>((resolve: Function, reject: Function): void => {
            this.client.getDexConfigurations(empty, null, (err: grpcWeb.Error, res: DexConfigurations) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getAccount(param: string): Promise<Account> {
        const address: StringValue = new StringValue();
        address.setValue(param);

        return new Promise<Account>((resolve: Function, reject: Function): void => {
            this.client.getAccount(address, null, (err: grpcWeb.Error, res: Account) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getNonce(param: number): Promise<UInt32Value> {
        const accountId: UInt32Value = new UInt32Value();
        accountId.setValue(param);

        return new Promise<UInt32Value>((resolve: Function, reject: Function): void => {
            this.client.getNonce(accountId, null, (err: grpcWeb.Error, res: UInt32Value) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getTokens(param: GetTokensReq): Promise<GetTokensRes> {
        const req: GetTokensReq = new GetTokensReq();
        req.setRequireMetadata(true);
        req.setRequireInfo(true);
        req.setRequirePrice(true);
        req.setQuoteCurrencyForPrice('hello');
        req.setTokensList(['LRC', 'ETH']);

        return new Promise<GetTokensRes>((resolve: Function, reject: Function): void => {
            this.client.getTokens(req, null, (err: grpcWeb.Error, res: GetTokensRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getNextOrderId(accountId: number, tokenSellId: number): Promise<UInt32Value> {
        const req: GetNextOrderIdReq = new GetNextOrderIdReq();
        req.setAccountId(accountId);
        req.setTokenSellId(tokenSellId);

        return new Promise<UInt32Value>((resolve: Function, reject: Function): void => {
            this.client.getNextOrderId(req, null, (err: grpcWeb.Error, res: UInt32Value) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getMarkets(param: GetMarketsReq): Promise<GetMarketsRes> {
        const req: GetMarketsReq = new GetMarketsReq();
        req.setRequireMetadata(true);
        req.setRequireTicker(true);
        req.setQueryLoopringTicker(true);
        req.setMarketIdList([100]);

        return new Promise<GetMarketsRes>((resolve: Function, reject: Function): void => {
            this.client.getMarkets(req, null, (err: grpcWeb.Error, res: GetMarketsRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    public async getMarketFills(param: GetMarketFillsReq): Promise<GetFillsRes> {
        const req: GetMarketFillsReq = new GetMarketFillsReq();
        req.setMarketId(100);
        req.setNum(100);

        return new Promise<GetFillsRes>((resolve: Function, reject: Function): void => {
            this.client.getMarketFills(req, null, (err: grpcWeb.Error, res: GetFillsRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    // FIXME: time out
    public async getUserFills(param: GetUserFillsReq): Promise<GetFillsRes> {
        const req = new GetUserFillsReq();
        req.setAccountId(100);
        req.setOrderUuid(100);
        const paging = new CursorPaging();
        paging.setNum(100);
        paging.setCursor(0);
        req.setPaging(paging);

        return new Promise<GetFillsRes>((resolve: Function, reject: Function): void => {
            this.client.getUserFills(req, null, (err: grpcWeb.Error, res: GetFillsRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    // TODO: getUserTransactions and getUserTransfers are different
    public async getUserTransactions(param: GetUserTransactionsReq): Promise<GetUserTransactionsRes> {
        const req = new GetUserTransactionsReq();
        req.setAccountId(100);
        req.setTokenId(100);
        req.setTransactionType('TX_TYPE_DEPOSIT');
        const paging = new CursorPaging();
        paging.setNum(100);
        paging.setCursor(0);
        req.setPaging(paging);

        return new Promise<GetUserTransactionsRes>((resolve: Function, reject: Function): void => {
            this.client.getUserTransfers(req, null, (err: grpcWeb.Error, res: GetUserTransactionsRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    // FIXME: time out
    public async getOrderBook(param: GetOrderBookReq): Promise<OrderBook> {
        const req = new GetOrderBookReq();
        req.setMarketId(100);
        req.setAggregationLevel(6);
        req.setFiatSymbol('USD');

        return new Promise<OrderBook>((resolve: Function, reject: Function): void => {
            this.client.getOrderBook(req, null, (err: grpcWeb.Error, res: OrderBook) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    // FIXME: time out
    public async getUserOrders(param: GetUserOrdersReq): Promise<GetUserOrdersRes> {
        const req = new GetUserOrdersReq();
        req.setAccountId(100);
        req.setBaseTokenId('b3b79b8d-0c7e-4142-9694-eb7df51969de');
        req.setQuoteTokenId('738156aa-9f51-4e1f-96dd-c02712ea7e7a');
        const paging = new CursorPaging();
        paging.setNum(100);
        paging.setCursor(0);
        req.setPaging(paging);
        req.setStatusesList(['Hello', 'World']);

        return new Promise<GetUserOrdersRes>((resolve: Function, reject: Function): void => {
            this.client.getUserOrders(req, null, (err: grpcWeb.Error, res: GetUserOrdersRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    // TODO: not test in web
    public async submitOrder(param: Order): Promise<SubmitOrderRes> {
        return new Promise<SubmitOrderRes>((resolve: Function, reject: Function): void => {
            this.client.submitOrder(param, null, (err: grpcWeb.Error, res: SubmitOrderRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    // TODO: not test in web
    // Cancel orders by marking them obsoleted in database, not to be included in blocks.
    public async cancelOrder(param: SimpleOrderCancellationReq): Promise<CancelOrderRes> {
        return new Promise<CancelOrderRes>((resolve: Function, reject: Function): void => {
            this.client.cancelOrder(param, null, (err: grpcWeb.Error, res: CancelOrderRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    // TODO: not test in web
    // Submit an offchain order cancellation request, will make into blocks.
    public async submitOrderCancellation(param: OrderCancellationRequest): Promise<CancelOrderRes> {
        return new Promise<CancelOrderRes>((resolve: Function, reject: Function): void => {
            this.client.submitOrderCancellation(param, null, (err: grpcWeb.Error, res: CancelOrderRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    // TODO: not test in web
    // Submit an offchain withdrawal request, will make into blocks.
    public async submitOffchainWithdrawal(param: OffchainWithdrawalRequest): Promise<OffchainWithdrawalalRes> {
        return new Promise<OffchainWithdrawalalRes>((resolve: Function, reject: Function): void => {
            this.client.submitOffchainWithdrawal(param, null, (err: grpcWeb.Error, res: OffchainWithdrawalalRes) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

}

export const grpcClientService: GrpcClientService = new GrpcClientService();
