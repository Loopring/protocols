"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ethereumjs_util_1 = __importDefault(require("ethereumjs-util"));
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const bn_js_1 = __importDefault(require("bn.js"));
bignumber_js_1.default.config({
    EXPONENTIAL_AT: 20,
    RANGE: [-100000, 10000000],
    ROUNDING_MODE: 1
});
/**
 *
 * @param mixed Buffer|number|string (hex string must be with '0x' prefix)
 * @returns {Buffer}
 */
function toBuffer(mixed) {
    if (mixed instanceof Buffer) {
        return mixed;
    }
    else {
        return ethereumjs_util_1.default.toBuffer(mixed);
    }
}
exports.toBuffer = toBuffer;
/**
 *
 * @param mixed number | BigNumber |  BN  | Buffer | string
 * @returns {string}
 */
function toHex(mixed) {
    if (typeof mixed === "number" ||
        mixed instanceof bignumber_js_1.default ||
        mixed instanceof bn_js_1.default) {
        return addHexPrefix(mixed.toString(16));
    }
    if (mixed instanceof Buffer) {
        return addHexPrefix(mixed.toString("hex"));
    }
    if (typeof mixed === "string") {
        const regex = new RegExp(/^0x[0-9a-fA-F]*$/);
        return regex.test(mixed)
            ? mixed
            : addHexPrefix(toBuffer(mixed).toString("hex"));
    }
    throw new Error("Unsupported type");
}
exports.toHex = toHex;
/**
 *
 * @param mixed number | BigNumber |  BN  | Buffer | string
 * @returns {number}
 */
function toNumber(mixed) {
    if (typeof mixed === "number") {
        return mixed;
    }
    if (mixed instanceof bignumber_js_1.default || mixed instanceof bn_js_1.default) {
        return mixed.toNumber();
    }
    if (typeof mixed === "string") {
        return Number(mixed);
    }
    throw new Error("Unsupported type");
}
exports.toNumber = toNumber;
/**
 *
 * @param mixed number | BigNumber |  BN  | Buffer | string
 * @returns {BigNumber}
 */
function toBig(mixed) {
    if (mixed instanceof bignumber_js_1.default) {
        return mixed;
    }
    if (typeof mixed === "number") {
        return new bignumber_js_1.default(mixed.toString());
    }
    if (typeof mixed === "string") {
        return new bignumber_js_1.default(mixed);
    }
    throw new Error("Unsupported type");
}
exports.toBig = toBig;
/**
 *
 * @param mixed number | BigNumber |  BN  | Buffer | string
 * @returns {BN}
 */
function toBN(mixed) {
    return mixed instanceof bn_js_1.default ? mixed : new bn_js_1.default(toBig(mixed).toString(10), 10);
}
exports.toBN = toBN;
/**
 *
 * @param mixed number | BigNumber |  BN  | Buffer | string
 * @returns {BN}
 */
function fromGWEI(value) {
    return toBig(value).times(1e9);
}
exports.fromGWEI = fromGWEI;
/**
 *
 * @param mixed number | BigNumber |  BN  | Buffer | string
 * @returns {BN}
 */
function toGWEI(valueInWEI) {
    return toBig(valueInWEI).div(1e9);
}
exports.toGWEI = toGWEI;
/**
 * Returns formatted hex string of a given private key
 * @param mixed Buffer| string
 * @returns {string}
 */
function formatKey(mixed) {
    if (mixed instanceof Buffer) {
        return mixed.toString("hex");
    }
    if (typeof mixed === "string") {
        return mixed.startsWith("0x") ? mixed.slice(2) : mixed;
    }
    throw new Error("Unsupported type");
}
exports.formatKey = formatKey;
/**
 * Returns hex string of a given address
 * @param mixed Buffer | string
 * @returns {string}
 */
function formatAddress(mixed) {
    if (mixed instanceof Buffer) {
        return ethereumjs_util_1.default.toChecksumAddress("0x" + mixed.toString("hex"));
    }
    if (typeof mixed === "string") {
        return ethereumjs_util_1.default.toChecksumAddress(mixed.startsWith("0x") ? mixed : "0x" + mixed);
    }
    throw new Error("Unsupported type");
}
exports.formatAddress = formatAddress;
/**
 * Returns hex string with '0x' prefix
 * @param input
 * @returns {string}
 */
function addHexPrefix(input) {
    if (typeof input === "string") {
        return input.startsWith("0x") ? input : "0x" + input;
    }
    throw new Error("Unsupported type");
}
exports.addHexPrefix = addHexPrefix;
/**
 * Returns hex string without '0x' prefix
 * @param input string
 * @returns {string}
 */
function clearHexPrefix(input) {
    if (typeof input === "string") {
        return input.startsWith("0x") ? input.slice(2) : input;
    }
    throw new Error("Unsupported type");
}
exports.clearHexPrefix = clearHexPrefix;
/**
 *
 * @param hex
 * @returns {string}
 */
function padLeftEven(hex) {
    return hex.length % 2 !== 0 ? `0${hex}` : hex;
}
exports.padLeftEven = padLeftEven;
/**
 * Returns symbol of a given kind of currency
 * @param settingsCurrency
 * @returns {*}
 */
function getDisplaySymbol(settingsCurrency) {
    switch (settingsCurrency) {
        case "CNY":
            return "￥";
        case "USD":
            return "$";
        default:
            return "";
    }
}
exports.getDisplaySymbol = getDisplaySymbol;
/**
 * Returns number in string with a given precision
 * @param number number | BigNumber
 * @param precision number
 * @param ceil bool  round up
 * @returns {string}
 */
function toFixed(number, precision, ceil) {
    precision = precision || 0;
    ceil = ceil || false;
    if (number instanceof bignumber_js_1.default) {
        const rm = ceil ? 0 : 1;
        return number.toFixed(precision, rm);
    }
    if (typeof number === "number") {
        return ceil
            ? (Math.ceil(number * Number("1e" + precision)) /
                Number("1e" + precision)).toFixed(precision)
            : (Math.floor(number * Number("1e" + precision)) /
                Number("1e" + precision)).toFixed(precision);
    }
    throw new Error("Unsupported type");
}
exports.toFixed = toFixed;
exports.default = {};
//# sourceMappingURL=formatter.js.map