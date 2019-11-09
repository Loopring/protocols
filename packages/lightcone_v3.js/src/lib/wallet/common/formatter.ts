import ethUtil from "ethereumjs-util";
import BigNumber from "bignumber.js";
import BN from "bn.js";

BigNumber.config({
  EXPONENTIAL_AT: 20,
  RANGE: [-100000, 10000000],
  ROUNDING_MODE: 1
});

/**
 *
 * @param mixed Buffer|number|string (hex string must be with '0x' prefix)
 * @returns {Buffer}
 */
export function toBuffer(mixed) {
  if (mixed instanceof Buffer) {
    return mixed;
  } else {
    return ethUtil.toBuffer(mixed);
  }
}

/**
 *
 * @param num number|string (hex string must be with '0x' prefix)
 * @param places number of zeros to pad
 * @returns {Buffer}
 */
export function zeroPad(num, places) {
  return toBuffer(String(num).padStart(places, '0'));
}

/**
 *
 * @param mixed number | BigNumber |  BN  | Buffer | string
 * @returns {string}
 */
export function toHex(mixed) {
  if (
    typeof mixed === "number" ||
    mixed instanceof BigNumber ||
    mixed instanceof BN
  ) {
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

/**
 *
 * @param mixed number | BigNumber |  BN  | Buffer | string
 * @returns {number}
 */
export function toNumber(mixed) {
  if (typeof mixed === "number") {
    return mixed;
  }

  if (mixed instanceof BigNumber || mixed instanceof BN) {
    return mixed.toNumber();
  }

  if (typeof mixed === "string") {
    return Number(mixed);
  }

  throw new Error("Unsupported type");
}

/**
 *
 * @param mixed number | BigNumber |  BN  | Buffer | string
 * @returns {BigNumber}
 */
export function toBig(mixed) {
  if (mixed instanceof BigNumber) {
    return mixed;
  }

  if (typeof mixed === "number") {
    return new BigNumber(mixed.toString());
  }

  if (typeof mixed === "string") {
    return new BigNumber(mixed);
  }

  throw new Error("Unsupported type");
}

/**
 *
 * @param mixed number | BigNumber |  BN  | Buffer | string
 * @returns {BN}
 */
export function toBN(mixed) {
  return mixed instanceof BN ? mixed : new BN(toBig(mixed).toString(10), 10);
}

/**
 *
 * @param mixed number | BigNumber |  BN  | Buffer | string
 * @returns {BN}
 */
export function fromGWEI(value) {
  return toBig(value).times(1e9);
}

/**
 *
 * @param mixed number | BigNumber |  BN  | Buffer | string
 * @returns {BN}
 */
export function toGWEI(valueInWEI) {
  return toBig(valueInWEI).div(1e9);
}

/**
 * Returns formatted hex string of a given private key
 * @param mixed Buffer| string
 * @returns {string}
 */
export function formatKey(mixed) {
  if (mixed instanceof Buffer) {
    return mixed.toString("hex");
  }

  if (typeof mixed === "string") {
    return mixed.startsWith("0x") ? mixed.slice(2) : mixed;
  }
  throw new Error("Unsupported type");
}

/**
 * Returns hex string of a given address
 * @param mixed Buffer | string
 * @returns {string}
 */
export function formatAddress(mixed) {
  if (mixed instanceof Buffer) {
    return ethUtil.toChecksumAddress("0x" + mixed.toString("hex"));
  }

  if (typeof mixed === "string") {
    return ethUtil.toChecksumAddress(
      mixed.startsWith("0x") ? mixed : "0x" + mixed
    );
  }
  throw new Error("Unsupported type");
}

/**
 * Returns hex string with '0x' prefix
 * @param input
 * @returns {string}
 */
export function addHexPrefix(input) {
  if (typeof input === "string") {
    return input.startsWith("0x") ? input : "0x" + input;
  }
  throw new Error("Unsupported type");
}

/**
 * Returns hex string without '0x' prefix
 * @param input string
 * @returns {string}
 */
export function clearHexPrefix(input) {
  if (typeof input === "string") {
    return input.startsWith("0x") ? input.slice(2) : input;
  }
  throw new Error("Unsupported type");
}

/**
 *
 * @param hex
 * @returns {string}
 */
export function padLeftEven(hex) {
  return hex.length % 2 !== 0 ? `0${hex}` : hex;
}

/**
 * Returns symbol of a given kind of currency
 * @param settingsCurrency
 * @returns {*}
 */
export function getDisplaySymbol(settingsCurrency) {
  switch (settingsCurrency) {
    case "CNY":
      return "￥";
    case "USD":
      return "$";
    default:
      return "";
  }
}

/**
 * Returns number in string with a given precision
 * @param number number | BigNumber
 * @param precision number
 * @param ceil bool  round up
 * @returns {string}
 */
export function toFixed(number, precision, ceil) {
  precision = precision || 0;
  ceil = ceil || false;
  if (number instanceof BigNumber) {
    const rm = ceil ? 0 : 1;
    return number.toFixed(precision, rm);
  }

  if (typeof number === "number") {
    return ceil
      ? (
          Math.ceil(number * Number("1e" + precision)) /
          Number("1e" + precision)
        ).toFixed(precision)
      : (
          Math.floor(number * Number("1e" + precision)) /
          Number("1e" + precision)
        ).toFixed(precision);
  }

  throw new Error("Unsupported type");
}

export default {};
