import ethUtil = require("ethereumjs-util");
import { keccak256, id, arrayify } from "ethers/lib/utils";
import { utils } from "ethers";
const ethAbi = require("web3-eth-abi");
const hre = require("hardhat");

const EIP191_HEADER = "\x19\x01";
const EIP712_DOMAIN_TYPEHASH = id(
  "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);

export function hash(name: string, version: string, moduleAddress: string) {
  const encoded = utils.keccak256(
    ethAbi.encodeParameters(
      ["bytes32", "bytes32", "bytes32", "uint256", "address"],
      [
        EIP712_DOMAIN_TYPEHASH,
        id(name),
        id(version),
        hre.network.config.chainId, // chainId
        moduleAddress,
      ]
    )
  );

  return Buffer.from(encoded.slice(2), "hex");
}

export function hashPacked(domainSeprator: Buffer, encodedData: string) {
  return ethUtil.keccak(
    Buffer.concat([
      Buffer.from(EIP191_HEADER, "utf8"),
      domainSeprator,
      Buffer.from(keccak256(encodedData).slice(2), "hex"),
    ])
  );
}
