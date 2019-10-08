import BN from "bn.js";

export interface FloatEncoding {
  numBitsExponent: number;
  numBitsMantissa: number;
  exponentBase: number;
}

export function toFloat(value: BN, encoding: FloatEncoding) {
  const maxExponent = (1 << encoding.numBitsExponent) - 1;
  const maxMantissa = (1 << encoding.numBitsMantissa) - 1;
  const maxExponentValue = new BN(encoding.exponentBase).pow(
    new BN(maxExponent)
  );
  const maxValue = new BN(maxMantissa).mul(maxExponentValue);
  assert(
    value.lte(maxValue),
    "Value too large: " +
      value.toString(10) +
      ", max value: " +
      maxValue.toString(10)
  );

  let exponent = 0;
  let r = value.div(new BN(maxMantissa));
  let d = new BN(1);
  while (
    r.gte(new BN(encoding.exponentBase)) ||
    d.mul(new BN(maxMantissa)).lt(value)
  ) {
    r = r.div(new BN(encoding.exponentBase));
    exponent += 1;
    d = d.mul(new BN(encoding.exponentBase));
  }
  const mantissa = value.div(d).toNumber();

  assert(exponent <= maxExponent, "Exponent too large");
  assert(mantissa <= maxMantissa, "Mantissa too large");
  const f = (exponent << encoding.numBitsMantissa) + mantissa;
  return f;
}

export function fromFloat(f: number, encoding: FloatEncoding) {
  const exponent = f >> encoding.numBitsMantissa;
  const mantissa = f & ((1 << encoding.numBitsMantissa) - 1);
  const value = new BN(mantissa).mul(
    new BN(encoding.exponentBase).pow(new BN(exponent))
  );
  return value;
}

export function roundToFloatValue(value: BN, encoding: FloatEncoding) {
  const f = toFloat(value, encoding);
  const floatValue = fromFloat(f, encoding);
  assert(
    floatValue.lte(value),
    "float value can never be higher than the original value"
  );
  return floatValue;
}
