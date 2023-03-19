import ethUtil = require("ethereumjs-util");
const ethAbi = require("web3-eth-abi");
const hre = require("hardhat");

const EIP191_HEADER = "\x19\x01";
const EIP712_DOMAIN_TYPEHASH = ethUtil.keccakFromString(
  "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);

export function hash(name: string, version: string, moduleAddress: string) {
  const encoded = ethAbi.encodeParameters(
    ["bytes32", "bytes32", "bytes32", "uint256", "address"],
    [
      EIP712_DOMAIN_TYPEHASH,
      ethUtil.keccakFromString(name),
      ethUtil.keccakFromString(version),
      hre.network.config.chainId, // chainId
      moduleAddress,
    ]
  );

  return ethUtil.keccak(Buffer.from(encoded));
}

export function hashPacked(domainSeprator: Buffer, encodedData: string) {
  return ethUtil.keccak(
    Buffer.concat([
      Buffer.from(EIP191_HEADER, "utf8"),
      domainSeprator,
      ethUtil.keccakFromString(encodedData),
    ])
  );
}
