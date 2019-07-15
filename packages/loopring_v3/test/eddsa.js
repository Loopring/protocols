// Taken and modified from
// https://github.com/iden3/circomlib

const createBlakeHash = require("blake-hash");
const bigInt = require("snarkjs").bigInt;
const babyJub = require("./babyjub");
const poseidon = require("./poseidon.js");

exports.sign = sign;
exports.verify = verify;

function sign(strKey, msg) {
    const key = bigInt(strKey);
    const prv = bigInt.leInt2Buff(key, 32);

    const h1 = createBlakeHash("blake512").update(prv).digest();
    const msgBuff = bigInt.leInt2Buff(msg, 32);
    const rBuff = createBlakeHash("blake512").update(Buffer.concat([h1.slice(32,64), msgBuff])).digest();
    let r = bigInt.leBuff2int(rBuff);
    r = r.mod(babyJub.subOrder);

    const A = babyJub.mulPointEscalar(babyJub.Base8, key);
    const R8 = babyJub.mulPointEscalar(babyJub.Base8, r);

    const hasher = poseidon.createHash(6, 6, 52);
    const hm = hasher([R8[0], R8[1], A[0], A[1], msg]);
    const S = r.add(hm.mul(key)).mod(babyJub.subOrder);
    return {
        R: R8,
        S: S,
        hash: hm.toString(10),
    };
}

function verify(msg, sig, pubKey) {
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
    if (S>= babyJub.subOrder) return false;

    const hasher = poseidon.createHash(6, 6, 52);
    const hm = hasher([R[0], R[1], A[0], A[1], msg]);

    const Pleft = babyJub.mulPointEscalar(babyJub.Base8, S);
    let Pright = babyJub.mulPointEscalar(A, hm);
    Pright = babyJub.addPoint(R, Pright);

    if (!Pleft[0].equals(Pright[0])) return false;
    if (!Pleft[1].equals(Pright[1])) return false;

    return true;
}

