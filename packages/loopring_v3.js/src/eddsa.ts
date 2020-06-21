// Taken and modified from
// https://github.com/iden3/circomlib

const createBlakeHash = require("blake-hash");
const crypto = require("crypto");
const Scalar = require("ffjavascript").Scalar;
const F1Field = require("ffjavascript").F1Field;
const babyJub = require("./babyjub");
const utils = require("ffjavascript").utils;
const poseidon = require("./poseidon.js");
import { KeyPair, Signature } from "./types";

export class EdDSA {
  public static getKeyPair() {
    const entropy = crypto.randomBytes(32);
    const Fr = new F1Field(babyJub.subOrder);
    let secretKey = utils.leBuff2int(entropy);
    secretKey = Fr.e(secretKey);

    // Increment the secretKey until we found a point that is compressable
    let unpacked = null;
    while (unpacked == null) {
      console.log(secretKey);
      const publicKey = babyJub.mulPointEscalar(babyJub.Base8, secretKey);
      const packed = this.pack(publicKey[0].toString(10), publicKey[1].toString(10));
      unpacked = this.unpack(packed);
      console.log(unpacked);
      if (unpacked == null) {
        secretKey = Fr.add(secretKey, Fr.e("1"));
      } else {
        assert(unpacked.publicKeyX === publicKey[0].toString(10), "invalid unpack X");
        assert(unpacked.publicKeyY === publicKey[1].toString(10), "invalid unpack Y");
      }
    }
    assert(babyJub.inCurve([babyJub.F.e(unpacked.publicKeyX), babyJub.F.e(unpacked.publicKeyY)]), "invalid point");

    const keyPair: KeyPair = {
      publicKeyX: unpacked.publicKeyX,
      publicKeyY: unpacked.publicKeyY,
      secretKey: secretKey.toString(10)
    };
    return keyPair;
  }

  public static pack(publicKeyX: string, publicKeyY: string) {
    const keyX = babyJub.F.e(publicKeyX);
    const keyY = babyJub.F.e(publicKeyY);
    const packed = babyJub.packPoint([keyX, keyY]);
    const reversed = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      reversed[31 - i] = packed[i];
    }
    return reversed.toString("hex");
  }

  public static unpack(publicKey: string) {
    const packed = Buffer.from(publicKey, "hex");
    const reversed = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      reversed[31 - i] = packed[i];
    }
    const unpacked = babyJub.unpackPoint(reversed);
    if (unpacked == null) {
      return null;
    }
    const pubKey = {
      publicKeyX: unpacked[0].toString(10),
      publicKeyY: unpacked[1].toString(10),
    };
    return pubKey;
  }

  public static sign(strKey: string, msg: string) {
    const key = Scalar.fromString(strKey);
    const prv = utils.leInt2Buff(key, 32);

    const h1 = createBlakeHash("blake512")
      .update(prv)
      .digest();
    const msgBuff = utils.leInt2Buff(Scalar.fromString(msg), 32);
    const rBuff = createBlakeHash("blake512")
      .update(Buffer.concat([h1.slice(32, 64), msgBuff]))
      .digest();
    let r = utils.leBuff2int(rBuff);
    const Fr = new F1Field(babyJub.subOrder);
    r = Fr.e(r);

    const A = babyJub.mulPointEscalar(babyJub.Base8, key);
    const R8 = babyJub.mulPointEscalar(babyJub.Base8, r);

    const hasher = poseidon.createHash(6, 6, 52);
    const hm = hasher([R8[0], R8[1], A[0], A[1], msg]);
    const S = Fr.add(r , Fr.mul(hm, key));

    const signature: Signature = {
      Rx: R8[0].toString(),
      Ry: R8[1].toString(),
      s: S.toString()
    };
    return signature;
  }

  public static verify(msg: string, sig: Signature, pubKey: string[]) {
    const A = [Scalar.fromString(pubKey[0]), Scalar.fromString(pubKey[1])];
    const R = [Scalar.fromString(sig.Rx), Scalar.fromString(sig.Ry)];
    const S = Scalar.fromString(sig.s);

    // Check parameters
    if (!babyJub.inCurve(R)) return false;
    if (!babyJub.inCurve(A)) return false;
    if (S >= babyJub.subOrder) return false;

    const hasher = poseidon.createHash(6, 6, 52);
    const hm = hasher([R[0], R[1], A[0], A[1], Scalar.fromString(msg)]);

    const Pleft = babyJub.mulPointEscalar(babyJub.Base8, S);
    let Pright = babyJub.mulPointEscalar(A, hm);
    Pright = babyJub.addPoint(R, Pright);

    if (!babyJub.F.eq(Pleft[0], Pright[0])) return false;
    if (!babyJub.F.eq(Pleft[1], Pright[1])) return false;

    return true;
  }
}
