"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Contract_1 = __importDefault(require("./Contract"));
const erc20_json_1 = __importDefault(require("../../config/abis/erc20.json"));
const weth_json_1 = __importDefault(require("../../config/abis/weth.json"));
const airdrop_json_1 = __importDefault(require("../../config/abis/airdrop.json"));
const exchange_json_1 = __importDefault(require("../../config/abis/exchange.json"));
const WETH = new Contract_1.default(weth_json_1.default);
const ERC20Token = new Contract_1.default(erc20_json_1.default);
const AirdropContract = new Contract_1.default(airdrop_json_1.default);
const ExchangeContract = new Contract_1.default(exchange_json_1.default);
exports.default = {
    ERC20Token,
    WETH,
    AirdropContract,
    ExchangeContract
};
//# sourceMappingURL=Contracts.js.map