import ethUtil = require("ethereumjs-util");
import { keccak256, id, arrayify, hexConcat } from "ethers/lib/utils";
import { utils, ethers } from "ethers";
const ethAbi = require("web3-eth-abi");
const hre = require("hardhat");

const EIP191_HEADER = "0x1901";
const EIP712_DOMAIN_TYPEHASH = id(
  "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);

export function hash(
  name: string,
  version: string,
  moduleAddress: string,
  chainId: number
) {
  return utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "bytes32", "bytes32", "uint256", "address"],
      [
        EIP712_DOMAIN_TYPEHASH,
        id(name),
        id(version),
        chainId, // chainId
        moduleAddress,
      ]
    )
  );
}

export function hashPacked(domainSeprator: string, encodedData: string) {
  return keccak256(
    hexConcat([EIP191_HEADER, domainSeprator, keccak256(encodedData)])
  );
}
