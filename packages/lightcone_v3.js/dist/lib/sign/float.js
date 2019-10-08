"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bn_js_1 = __importDefault(require("bn.js"));
function toFloat(value, encoding) {
    const maxExponent = (1 << encoding.numBitsExponent) - 1;
    const maxMantissa = (1 << encoding.numBitsMantissa) - 1;
    const maxExponentValue = new bn_js_1.default(encoding.exponentBase).pow(new bn_js_1.default(maxExponent));
    const maxValue = new bn_js_1.default(maxMantissa).mul(maxExponentValue);
    assert(value.lte(maxValue), "Value too large: " +
        value.toString(10) +
        ", max value: " +
        maxValue.toString(10));
    let exponent = 0;
    let r = value.div(new bn_js_1.default(maxMantissa));
    let d = new bn_js_1.default(1);
    while (r.gte(new bn_js_1.default(encoding.exponentBase)) ||
        d.mul(new bn_js_1.default(maxMantissa)).lt(value)) {
        r = r.div(new bn_js_1.default(encoding.exponentBase));
        exponent += 1;
        d = d.mul(new bn_js_1.default(encoding.exponentBase));
    }
    const mantissa = value.div(d).toNumber();
    assert(exponent <= maxExponent, "Exponent too large");
    assert(mantissa <= maxMantissa, "Mantissa too large");
    const f = (exponent << encoding.numBitsMantissa) + mantissa;
    return f;
}
exports.toFloat = toFloat;
function fromFloat(f, encoding) {
    const exponent = f >> encoding.numBitsMantissa;
    const mantissa = f & ((1 << encoding.numBitsMantissa) - 1);
    const value = new bn_js_1.default(mantissa).mul(new bn_js_1.default(encoding.exponentBase).pow(new bn_js_1.default(exponent)));
    return value;
}
exports.fromFloat = fromFloat;
function roundToFloatValue(value, encoding) {
    const f = toFloat(value, encoding);
    const floatValue = fromFloat(f, encoding);
    assert(floatValue.lte(value), "float value can never be higher than the original value");
    return floatValue;
}
exports.roundToFloatValue = roundToFloatValue;
//# sourceMappingURL=float.js.map