import ethUtil = require("ethereumjs-util");
const ethAbi = require("web3-eth-abi");
import { sign, sign2, SignatureType } from "./Signature";
import * as eip712 from "./eip712";
import BN = require("bn.js");
import { BigNumberish } from "ethers";

function encodeAddressesPacked(addrs: string[]) {
  const addrsBs = Buffer.concat(
    addrs.map((a) => Buffer.from("00".repeat(12) + a.slice(2), "hex"))
  );
  return addrsBs;
}

export function signCreateWallet(
  moduleAddress: string,
  owner: string,
  guardians: string[],
  quota: BN,
  inheritor: string,
  feeRecipient: string,
  feeToken: string,
  maxFeeAmount: BN,
  salt: BigNumberish,
  privateKey: string,
  chainId: number
) {
  const domainSeprator = eip712.hash(
    "WalletFactory",
    "2.0.0",
    moduleAddress,
    chainId
  );

  const TYPE_STR =
    "createWallet(address owner,address[] guardians,uint256 quota,address inheritor,address feeRecipient,address feeToken,uint256 maxFeeAmount,uint256 salt)";
  const CREATE_WALLET_TYPEHASH = ethUtil.keccak(Buffer.from(TYPE_STR));

  const guardiansBs = encodeAddressesPacked(guardians);
  const guardiansHash = ethUtil.keccak(guardiansBs);

  const encodedRequest = ethAbi.encodeParameters(
    [
      "bytes32",
      "address",
      "bytes32",
      "uint256",
      "address",
      "address",
      "address",
      "uint256",
      "uint256",
    ],
    [
      CREATE_WALLET_TYPEHASH,
      owner,
      guardiansHash,
      quota,
      inheritor,
      feeRecipient,
      feeToken,
      maxFeeAmount,
      salt,
    ]
  );

  const hash = eip712.hashPacked(domainSeprator, encodedRequest);
  // console.log(`hash: ${hash.toString("hex")}`);

  const txSignature = sign2(owner, privateKey, hash);
  return { txSignature, hash };
}
