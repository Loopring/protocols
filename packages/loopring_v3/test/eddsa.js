// Taken and modified from
// https://github.com/iden3/circomlib

const createBlakeHash = require("blake-hash");
const bigInt = require("snarkjs").bigInt;
const babyJub = require("./babyjub");
const pedersenHash = require("./pedersenHash").hash;

exports.prv2pub= prv2pub;
exports.sign = sign;
exports.verify = verify;
exports.packSignature = packSignature;
exports.unpackSignature = unpackSignature;
exports.pruneBuffer = pruneBuffer;


function pruneBuffer(_buff) {
    const buff = Buffer.from(_buff);
    buff[0] = buff[0] & 0xF8;
    buff[31] = buff[31] & 0x7F;
    buff[31] = buff[31] | 0x40;
    return buff;
}

function prv2pub(prv) {
    const sBuff = pruneBuffer(createBlakeHash("blake512").update(prv).digest().slice(0,32));
    let s = bigInt.leBuff2int(sBuff);
    const A = babyJub.mulPointEscalar(babyJub.Base8, s.shr(3));
    return A;
}

function toBitsBigInt(value, length) {
  const res = new Array(length);
  for (let i = 0; i < length; i++) {
    res[i] = (value.and(bigInt("1").shl(i)).isZero()) ? 0 : 1;
  }
  return res;
}

function toBitsArray(l) {
    return [].concat.apply([], l);
}

function bitsToBigInt(bits) {
    value = bigInt(0);
    for (let i = 0; i < bits.length; i++) {
        value = value.add(bigInt(bits[i]).shl(i));
    }
    return value;
}

function sign(strKey, bits) {
    const key = bigInt(strKey);
    const prv = bigInt.leInt2Buff(key, 32);
    const msg = bigInt.leInt2Buff(bitsToBigInt(bits), Math.floor(bits.length + 7) / 8);

    // console.log("msg: " + msg.toString("hex"));

    const h1 = createBlakeHash("blake512").update(prv).digest();
    // const sBuff = pruneBuffer(h1.slice(0,32));
    // const s = bigInt.leBuff2int(sBuff);
    // const A = babyJub.mulPointEscalar(babyJub.Base8, s.shr(3));

    const rBuff = createBlakeHash("blake512").update(Buffer.concat([h1.slice(32,64), msg])).digest();
    let r = bigInt.leBuff2int(rBuff);
    r = r.mod(babyJub.subOrder);

    // console.log("r: " + r.toString(10));

    // const h1 = createBlakeHash("blake512").update(prv).digest();
    // const sBuff = pruneBuffer(h1.slice(0,32));
    // const s = bigInt.leBuff2int(sBuff);

    const A = babyJub.mulPointEscalar(babyJub.Base8, key);

    // const rBuff = createBlakeHash("blake512").update(Buffer.concat([h1.slice(32,64), msg])).digest();
    // let r = bigInt.leBuff2int(rBuff);
    // r = r.mod(babyJub.subOrder);
    // TODO: secure r
    // const r = bigInt("1");
    const R = babyJub.mulPointEscalar(babyJub.Base8, r);
    // const R8p = babyJub.packPoint(R8);
    // const Ap = babyJub.packPoint(A);

    // console.log("R[0]: " + R[0].toString(10));
    // console.log("R[1]: " + R[1].toString(10));
    // console.log("A[0]: " + A[0].toString(10));
    // console.log("A[1]: " + A[1].toString(10));

    const hash = pedersenHash(toBitsArray(
        [
            toBitsBigInt(R[0], 254),
            toBitsBigInt(A[0], 254),
            bits,
        ]
    ));
    // console.log("sig hash: " + hash);
    // const hm = bigInt.leBuff2int(hmBuff);
    const hm = bigInt(hash);
    const S = r.add(hm.mul(key)).mod(babyJub.order);
    // console.log("sig S: " + S.toString());
    return {
        R: R,
        S: S,
        hash: hash,
    };
}

function verify(bits, sig, pubKey) {
    const A = [bigInt(pubKey[0]), bigInt(pubKey[1])];
    const R = [bigInt(sig.Rx), bigInt(sig.Ry)];
    const S = bigInt(sig.s);

    // Check parameters
    if (!Array.isArray(R)) return false;
    if (R.length!= 2) return false;
    if (!babyJub.inCurve(R)) return false;
    if (!Array.isArray(A)) return false;
    if (A.length!= 2) return false;
    if (!babyJub.inCurve(A)) return false;
    // if (S>= babyJub.subOrder) return false;

    const hash = pedersenHash(toBitsArray(
        [
            toBitsBigInt(R[0], 254),
            toBitsBigInt(A[0], 254),
            bits,
        ]
    ));
    const hm = bigInt(hash);

    const Pleft = babyJub.mulPointEscalar(babyJub.Base8, S);
    let Pright = babyJub.mulPointEscalar(A, hm);
    Pright = babyJub.addPoint(R, Pright);

    if (!Pleft[0].equals(Pright[0])) return false;
    if (!Pleft[1].equals(Pright[1])) return false;
    return true;
}

function packSignature(sig) {
    const R8p = babyJub.packPoint(sig.R8);
    const Sp = bigInt.leInt2Buff(sig.S, 32);
    return Buffer.concat([R8p, Sp]);
}

function unpackSignature(sigBuff) {
    return {
        R8: babyJub.unpackPoint(sigBuff.slice(0,32)),
        S: bigInt.leBuff2int(sigBuff.slice(32,64))
    };
}


