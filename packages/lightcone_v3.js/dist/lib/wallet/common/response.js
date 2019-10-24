"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Response {
    constructor(errorCode, errorMsg) {
        this["id"] = "1";
        this["result"] = null;
        this["error"] = {
            code: errorCode,
            message: errorMsg,
            data: null
        };
    }
}
exports.default = Response;
// common/config/config.json index.js
// loopring/ethereum/abi.js token.js transaction.js util.js
//# sourceMappingURL=response.js.map