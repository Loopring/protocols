import sys
sys.path.insert(0, 'ethsnarks')
import os.path
import json

from ethsnarks.poseidon import poseidon, poseidon_params
from ethsnarks.field import SNARK_SCALAR_FIELD

def sigma_EVM_asm(o, t):
    it = "i.t" + str(t)
    ot = "o.t" + str(t)
    o = o + ot + " = mulmod(" + it + ", " + it + ", q);\n"
    o = o + ot + " = mulmod(" + ot + ", " + ot + ", q);\n"
    o = o + ot + " = mulmod(" + it + ", " + ot + ", q);\n"
    return o

def poseidon_EVM_asm(params):
    ts = "t0"
    _ts = "_t0"
    nts = "nt0"
    for t in range(1, params.t):
        ts = ts + ", t" + str(t)
        _ts = _ts + ", _t" + str(t)
        nts = nts + ", nt" + str(t)

    struct = "HashInputs" + str(params.t)

    o = ""

    o = o + "function mix(" + struct + " memory i, uint q) internal pure \n{\n"
    o = o + struct + " memory o;\n"
    for i in range(params.t):
        for j in range(params.t):
            mulmod = "mulmod(i.t" + str(j) + ", " + str(params.constants_M[i][j]) + ", q)"
            if j == 0:
                o = o + "o.t" + str(i) + " = " + mulmod + ";\n"
            else:
                o = o + "o.t" + str(i) + " = addmod(o.t" + str(i) + ", " + mulmod + ", q);\n"
    for i in range(params.t):
        o = o + "i.t" + str(i) + " = o.t" + str(i) + ";\n"
    o = o + "}\n"
    o = o + "\n"

    o = o + "function ark(" + struct + " memory i, uint q, uint c) internal pure \n{\n"
    o = o + struct + " memory o;\n"
    for t in range(params.t):
        o = o + "o.t" + str(t) + " = addmod(i.t" + str(t) + ", c, q);\n"
    for i in range(params.t):
        o = o + "i.t" + str(i) + " = o.t" + str(i) + ";\n"
    o = o + "}\n"
    o = o + "\n"

    o = o + "function sbox_full(" + struct + " memory i, uint q) internal pure \n{\n"
    o = o + struct + " memory o;\n"
    for j in range(params.t):
        o = sigma_EVM_asm(o, j)
    for i in range(params.t):
        o = o + "i.t" + str(i) + " = o.t" + str(i) + ";\n"
    o = o + "}\n"
    o = o + "\n"

    o = o + "function sbox_partial(" + struct + " memory i, uint q) internal pure \n{\n"
    o = o + struct + " memory o;\n"
    o = sigma_EVM_asm(o, 0)
    for i in range(1):
        o = o + "i.t" + str(i) + " = o.t" + str(i) + ";\n"
    o = o + "}\n"
    o = o + "\n"

    o = o + "function hash_t6f6p52(" + struct + " memory i, uint q) internal pure returns (uint)\n{\n"
    o = o + "// validate inputs\n"
    for i in range(params.t):
        o = o + "require(i.t" + str(i) + " < q, \"INVALID_INPUT\");\n"
    o = o + "\n"
    for i in range(params.nRoundsF + params.nRoundsP):
        o = o + "// round " + str(i) + "\n"
        # ark
        o = o + "ark(i, q, " + str(params.constants_C[i]) + ");\n"
        # sbox
        if (i < params.nRoundsF/2) or (i >= params.nRoundsF/2 + params.nRoundsP):
            o = o + "sbox_full(i, q);\n"
        else:
            o = o + "sbox_partial(i, q);\n"
        # mix
        o = o + "mix(i, q);\n"
    o = o + "\nreturn i.t0;\n"
    o = o + "}\n"
    o = o + "\n"

    return o

poseidonParamsEVM = poseidon_params(SNARK_SCALAR_FIELD, 6, 6, 52, b'poseidon', 5, security_target=128)
data = poseidon_EVM_asm(poseidonParamsEVM)
print(data)
