"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("isomorphic-fetch");
const crypto_1 = __importDefault(require("crypto"));
const headers = {
    "Content-Type": "application/json"
};
function checkStatus(response) {
    if (response.status >= 200 && response.status < 300) {
        return response;
    }
    else {
        const error = new Error(response.statusText);
        error["response"] = response;
        throw error;
    }
}
/**
 * @description Supports single request and batch request;
 * @param host
 * @param options
 * @param timeOut
 * @returns {Promise}
 */
function request(host, options, timeOut) {
    timeOut = timeOut || 15000;
    const requestPromise = new Promise(resolve => {
        if (options.body) {
            options.headers = options.headers || headers;
            options.body = JSON.stringify(options.body);
        }
        fetch(host, options)
            .then(checkStatus)
            .then(res => res.json())
            .then(data => resolve(data))
            .catch(e => {
            resolve({ error: e });
        });
    });
    const timeoutPromise = new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve({ error: { message: "request time out" } });
        }, timeOut);
    });
    return Promise.race([requestPromise, timeoutPromise]);
}
/**
 * @description Returns a random hex string
 */
function id() {
    return crypto_1.default.randomBytes(8).toString("hex");
}
exports.id = id;
exports.default = request;
//# sourceMappingURL=request.js.map