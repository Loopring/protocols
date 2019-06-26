"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const empty_pb_1 = require("google-protobuf/google/protobuf/empty_pb");
const wrappers_pb_1 = require("google-protobuf/google/protobuf/wrappers_pb");
const grpc_1 = require("grpc");
const types_1 = require("src/model/types");
const service_dex_grpc_pb_1 = require("proto_gen/service_dex_grpc_pb");
/**
 * gRPC GrpcClient Service
 */
class GrpcClient {
    constructor() {
        this.client = new service_dex_grpc_pb_1.DexServiceClient('127.0.0.1:59480', grpc_1.credentials.createInsecure()); // TODO: config
    }
    getDexConfigurations(metadata = new grpc_1.Metadata()) {
        return __awaiter(this, void 0, void 0, function* () {
            const empty = new empty_pb_1.Empty();
            return new Promise((resolve, reject) => {
                this.client.getDexConfigurations(empty, metadata, (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(res);
                });
            });
        });
    }
    getAccount(param, metadata = new grpc_1.Metadata()) {
        return __awaiter(this, void 0, void 0, function* () {
            const address = new wrappers_pb_1.StringValue();
            address.setValue(param);
            return new Promise((resolve, reject) => {
                this.client.getAccount(address, metadata, (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(res);
                });
            });
        });
    }
    getNonce(param, metadata = new grpc_1.Metadata()) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountId = new wrappers_pb_1.UInt32Value();
            accountId.setValue(param);
            return new Promise((resolve, reject) => {
                this.client.getNonce(accountId, metadata, (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(res);
                });
            });
        });
    }
    getTokens(param, metadata = new grpc_1.Metadata()) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.client.getTokens(param, metadata, (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(res);
                });
            });
        });
    }
    getNextOrderId(param, metadata = new grpc_1.Metadata()) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.client.getNextOrderId(param, metadata, (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(res);
                });
            });
        });
    }
    getMarkets(param, metadata = new grpc_1.Metadata()) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.client.getMarkets(param, metadata, (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(res);
                });
            });
        });
    }
    getMarketFills(param, metadata = new grpc_1.Metadata()) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.client.getMarketFills(param, metadata, (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(res);
                });
            });
        });
    }
    getUserFills(param, metadata = new grpc_1.Metadata()) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.client.getUserFills(param, metadata, (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(res);
                });
            });
        });
    }
    getUserTransactions(param, metadata = new grpc_1.Metadata()) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.client.getUserTransfers(param, metadata, (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(res);
                });
            });
        });
    }
    getOrderBook(param, metadata = new grpc_1.Metadata()) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.client.getOrderBook(param, metadata, (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(res);
                });
            });
        });
    }
    getUserOrders(param, metadata = new grpc_1.Metadata()) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.client.getUserOrders(param, metadata, (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(res);
                });
            });
        });
    }
    submitOrder(param, metadata = new grpc_1.Metadata()) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.client.submitOrder(param, metadata, (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(res);
                });
            });
        });
    }
    // Cancel orders by marking them obsoleted in database, not to be included in blocks.
    cancelOrder(param, metadata = new grpc_1.Metadata()) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.client.cancelOrder(param, metadata, (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(res);
                });
            });
        });
    }
    // Submit an offchain order cancellation request, will make into blocks.
    submitOrderCancellation(param, metadata = new grpc_1.Metadata()) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.client.submitOrderCancellation(param, metadata, (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(res);
                });
            });
        });
    }
    // Submit an offchain withdrawal request, will make into blocks.
    submitOffchainWithdrawal(param, metadata = new grpc_1.Metadata()) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.client.submitOffchainWithdrawal(param, metadata, (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(res);
                });
            });
        });
    }
    socketExample() {
        const socket = types_1.io.connect("localhost"); // TODO: config server ip
        socket.on("news", (data) => alert(data));
        socket.emit("news", "hello");
    }
}
exports.grpcClient = new GrpcClient();
//# sourceMappingURL=grpcClient.js.map
