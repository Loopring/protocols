import { bigInt, bn128 } from "snarkjs";

exports.addPoint = addPoint;
exports.mulPointEscalar = mulPointEscalar;
exports.inCurve = inCurve;
exports.inSubgroup = inSubgroup;
exports.packPoint = packPoint;
exports.unpackPoint = unpackPoint;
exports.Base8 = [
  bigInt(
    "16540640123574156134436876038791482806971768689494387082833631921987005038935"
  ),
  bigInt(
    "20819045374670962167435360035096875258406992893633759881276124905556507972311"
  )
];
exports.order = bigInt(
  "21888242871839275222246405745257275088614511777268538073601725287587578984328"
);
exports.subOrder = exports.order.shr(3);
exports.p = bn128.r;

function addPoint(a, b) {
  const q = bn128.r;
  const cta = bigInt("168700");
  const d = bigInt("168696");
  const res = [];

  res[0] = bigInt(
    bigInt(a[0])
      .mul(b[1])
      .add(bigInt(b[0]).mul(a[1]))
      .mul(
        bigInt(
          bigInt("1").add(
            d
              .mul(a[0])
              .mul(b[0])
              .mul(a[1])
              .mul(b[1])
          )
        ).inverse(q)
      )
  ).affine(q);
  res[1] = bigInt(
    bigInt(a[1])
      .mul(b[1])
      .sub(cta.mul(a[0]).mul(b[0]))
      .mul(
        bigInt(
          bigInt("1").sub(
            d
              .mul(a[0])
              .mul(b[0])
              .mul(a[1])
              .mul(b[1])
          )
        ).inverse(q)
      )
  ).affine(q);

  return res;
}

function mulPointEscalar(base, e) {
  let res = [bigInt("0"), bigInt("1")];
  let rem = bigInt(e);
  let exp = base;

  while (!rem.isZero()) {
    if (rem.isOdd()) {
      res = addPoint(res, exp);
    }
    exp = addPoint(exp, exp);
    rem = rem.shr(1);
  }

  return res;
}

function inSubgroup(P) {
  if (!inCurve(P)) return false;
  const res = mulPointEscalar(P, exports.subOrder);
  return res[0].equals(bigInt(0)) && res[1].equals(bigInt(1));
}

function inCurve(P) {
  const F = bn128.Fr;

  const a = bigInt("168700");
  const d = bigInt("168696");

  const x2 = F.square(P[0]);
  const y2 = F.square(P[1]);

  if (!F.equals(F.add(F.mul(a, x2), y2), F.add(F.one, F.mul(F.mul(x2, y2), d))))
    return false;

  return true;
}

function packPoint(P) {
  const buff = bigInt.leInt2Buff(P[1], 32);
  if (P[0].greater(exports.p.shr(1))) {
    buff[31] = buff[31] | 0x80;
  }
  return buff;
}

function unpackPoint(_buff) {
  const F = bn128.Fr;

  const buff = Buffer.from(_buff);
  let sign = false;
  const P = new Array(2);
  if (buff[31] & 0x80) {
    sign = true;
    buff[31] = buff[31] & 0x7f;
  }
  P[1] = bigInt.leBuff2int(buff);
  if (P[1].greaterOrEquals(exports.p)) return null;

  const a = bigInt("168700");
  const d = bigInt("168696");

  const y2 = F.square(P[1]);

  let x = F.sqrt(F.div(F.sub(F.one, y2), F.sub(a, F.mul(d, y2))));

  if (x == null) return null;

  if (sign) x = F.neg(x);

  P[0] = F.affine(x);

  return P;
}
