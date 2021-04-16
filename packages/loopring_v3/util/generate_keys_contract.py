import sys
import json
from datetime import datetime
from pytz import reference

# block settings
block_type = 0
block_sizes = [384, 256, 128, 64, 32, 16]
block_version = 32

# keys path
keys_path = "./trusted_setup_keys/"
# output
output_filename = "./contracts/core/impl/VerificationKeys.sol"


def to_hex(d):
    return hex(int(d)).rstrip('L')

def from_hex(h):
    return int(h, 16)

now = datetime.now()
localtime = reference.LocalTimezone()

o = ""
o = o + "// SPDX-License-Identifier: Apache-2.0\n"
o = o + "// Copyright 2017 Loopring Technology Limited.\n"
o = o + "pragma solidity ^0.7.0;\n"
o = o + "\n"
o = o + "\n"
o = o + "/// @title Hard coded verification keys\n"
o = o + "/// @dev Generated on " + now.strftime("%d-%b-%Y %H:%M:%S, " + localtime.tzname(now)) + "\n"
o = o + "/// @author Brecht Devos - <brecht@loopring.org>\n"
o = o + "library VerificationKeys\n"
o = o + "{\n"
o = o + "    function getKey(\n"
o = o + "        uint blockType,\n"
o = o + "        uint blockSize,\n"
o = o + "        uint blockVersion\n"
o = o + "        )\n"
o = o + "        internal\n"
o = o + "        pure\n"
o = o + "        returns (uint[14] memory vk, uint[4] memory vk_gammaABC, bool found)\n"
o = o + "    {\n"

for i in range(len(block_sizes)):
    f = json.load(open(keys_path + "all_" + str(block_sizes[i]) + "_vk.json"))

    values = f["alpha"] + f["beta"][0] + f["beta"][1] + f["gamma"][0] + f["gamma"][1] + f["delta"][0] + f["delta"][1] + f["gammaABC"][0] + f["gammaABC"][1]
    values = list(map(from_hex, values))

    vk = values[:14]
    vk_gammaABC = values[14:]

    o = o + "        " + ("" if i == 0 else "} else ") + "if (blockType == 0 && blockSize == " + str(block_sizes[i]) + " && blockVersion == " + str(block_version) + ") {\n"

    o = o + "            vk = [\n"
    for i in range(len(vk)):
       o = o + "              " + str(vk[i]) + ("" if i == len(vk) - 1 else ",") + "\n"
    o = o + "            ];\n"

    o = o + "            vk_gammaABC = [\n"
    for i in range(len(vk_gammaABC)):
       o = o + "              " + str(vk_gammaABC[i]) + ("" if i == len(vk_gammaABC) - 1 else ",") + "\n"
    o = o + "            ];\n"

    o = o + "            found = true;\n"

o = o + "        } else {\n"
o = o + "            found = false;\n"
o = o + "        }\n"
o = o + "    }\n"
o = o + "}\n"

f3 = open(output_filename, 'w')
f3.write(o)
f3.close()

print(output_filename + " updated.")
