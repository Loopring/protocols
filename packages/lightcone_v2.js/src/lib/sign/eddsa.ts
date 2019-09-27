import { bigInt } from "snarkjs";
import { BitArray } from "./bitarray";

const createBlakeHash = require("blake-hash");
const babyJub = require("./babyjub");
const pedersenHash = require("./pedersenHash").hash;

exports.prv2pub = prv2pub;
exports.sign = sign;
exports.verify = verify;
exports.packSignature = packSignature;
exports.unpackSignature = unpackSignature;
exports.pruneBuffer = pruneBuffer;
exports.generateKeyPair = generateKeyPair;

export function pruneBuffer(_buff) {
  const buff = Buffer.from(_buff);
  buff[0] = buff[0] & 0xf8;
  buff[31] = buff[31] & 0x7f;
  buff[31] = buff[31] | 0x40;
  return buff;
}

export function prv2pub(prv) {
  const sBuff = pruneBuffer(
    createBlakeHash("blake512")
      .update(prv)
      .digest()
      .slice(0, 32)
  );
  let s = bigInt.leBuff2int(sBuff);
  return babyJub.mulPointEscalar(babyJub.Base8, s.shr(3));
}

export function toBitsBigInt(value, length) {
  const res = new Array(length);
  for (let i = 0; i < length; i++) {
    res[i] = value.and(bigInt("1").shl(i)).isZero() ? 0 : 1;
  }
  return res;
}

export function toBitsArray(l) {
  return [].concat.apply([], l);
}

export function bitsToBigInt(bits) {
  let value = bigInt(0);
  for (let i = 0; i < bits.length; i++) {
    value = value.add(bigInt(bits[i]).shl(i));
  }
  return value;
}

export function generateKeyPair(seed: string) {
  let randomNumber = BitArray.hashCode(seed);
  let secretKey = bigInt(randomNumber.toString(10));
  secretKey = secretKey.mod(babyJub.subOrder);
  const publicKey = babyJub.mulPointEscalar(babyJub.Base8, secretKey);

  return {
    publicKeyX: publicKey[0].toString(10),
    publicKeyY: publicKey[1].toString(10),
    secretKey: secretKey.toString(10)
  };
}

export function sign(strKey, bits) {
  const key = bigInt(strKey);
  const prv = bigInt.leInt2Buff(key, 32);
  const msg = bigInt.leInt2Buff(
    bitsToBigInt(bits),
    Math.floor(bits.length + 7) / 8
  );

  const h1 = createBlakeHash("blake512")
    .update(prv)
    .digest();
  const rBuff = createBlakeHash("blake512")
    .update(Buffer.concat([h1.slice(32, 64), msg]))
    .digest();
  let r = bigInt.leBuff2int(rBuff);
  r = r.mod(babyJub.subOrder);

  const A = babyJub.mulPointEscalar(babyJub.Base8, key);
  const R = babyJub.mulPointEscalar(babyJub.Base8, r);

  const hash = pedersenHash(
    toBitsArray([toBitsBigInt(R[0], 254), toBitsBigInt(A[0], 254), bits])
  );
  const hm = bigInt(hash);
  const S = r.add(hm.mul(key)).mod(babyJub.order);
  return {
    R: R,
    S: S,
    hash: hash
  };
}

export function verify(msg_bits, sig, A) {
  // Check parameters
  if (typeof sig != "object") return false;
  if (!Array.isArray(sig.R8)) return false;
  if (sig.R8.length != 2) return false;
  if (!babyJub.inCurve(sig.R8)) return false;
  if (!Array.isArray(A)) return false;
  if (A.length != 2) return false;
  if (!babyJub.inCurve(A)) return false;
  if (sig.S >= babyJub.subOrder) return false;

  const S = bigInt(sig.s);
  const hash = pedersenHash(
    toBitsArray([
      toBitsBigInt(sig.R8[0], 254),
      toBitsBigInt(A[0], 254),
      msg_bits
    ])
  );
  const hm = bigInt(hash);
  const Pleft = babyJub.mulPointEscalar(babyJub.Base8, S);
  let Pright = babyJub.mulPointEscalar(A, hm);
  Pright = babyJub.addPoint(sig.R8, Pright);

  if (!Pleft[0].equals(Pright[0])) return false;
  if (!Pleft[1].equals(Pright[1])) return false;
  return true;
}

export function packSignature(sig) {
  const R8p = babyJub.packPoint(sig.R8);
  const Sp = bigInt.leInt2Buff(sig.S, 32);
  return Buffer.concat([R8p, Sp]);
}

export function unpackSignature(sigBuff) {
  return {
    R8: babyJub.unpackPoint(sigBuff.slice(0, 32)),
    S: bigInt.leBuff2int(sigBuff.slice(32, 64))
  };
}
