import ethUtil = require("ethereumjs-util");
const ethAbi = require("web3-eth-abi");
import { sign, sign2, SignatureType } from "./Signature";
import * as eip712 from "./eip712";
import BN = require("bn.js");
import { BigNumberish } from "ethers";

export interface SignedRequest {
  signers: string[];
  signatures: string[];
  validUntil: number;
  wallet: string;
}

export interface MetaTx {
  to: string;
  nonce: BN;
  gasToken: string;
  gasPrice: BN;
  gasLimit: BN;
  gasOverhead: BN;
  feeRecipient: string;
  requiresSuccess: boolean;
  data: Buffer;
  signature: Buffer;
  approvedHash: Buffer;
}

function encodeAddressesPacked(addrs: string[]) {
  const addrsBs = Buffer.concat(
    addrs.map((a) => Buffer.from("00".repeat(12) + a.slice(2), "hex"))
  );
  return addrsBs;
}

export function signCreateWalletV2(
  moduleAddress: string,
  owner: string,
  guardians: string[],
  quota: BN,
  inheritor: string,
  feeRecipient: string,
  feeToken: string,
  maxFeeAmount: BN,
  salt: BigNumberish,
  privateKey: string
) {
  const domainSeprator = eip712.hash("WalletFactory", "2.0.0", moduleAddress);

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

export function signCreateWallet(
  moduleAddress: string,
  owner: string,
  guardians: string[],
  quota: BN,
  inheritor: string,
  feeRecipient: string,
  feeToken: string,
  maxFeeAmount: BN,
  salt: number
) {
  const domainSeprator = eip712.hash("WalletFactory", "2.0.0", moduleAddress);

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

  const txSignature = sign(owner, hash);
  return { txSignature, hash };
}

export function signChangeMasterCopy(
  walletAddress: string,
  masterCopy: string,
  validUntil: BN,
  newMasterCopy: string,
  signer: string
) {
  const domainSeprator = eip712.hash("LoopringWallet", "2.0.0", masterCopy);
  const TYPE_STR =
    "changeMasterCopy(address wallet,uint256 validUntil,address masterCopy)";
  const CREATE_WALLET_TYPEHASH = ethUtil.keccak(Buffer.from(TYPE_STR));

  const encodedRequest = ethAbi.encodeParameters(
    ["bytes32", "address", "uint256", "address"],
    [CREATE_WALLET_TYPEHASH, walletAddress, validUntil, newMasterCopy]
  );

  const hash = eip712.hashPacked(domainSeprator, encodedRequest);

  const txSignature = sign(signer, hash);
  return { txSignature, hash };
}

export function signAddGuardianWA(
  masterCopy: string,
  walletAddress: string,
  guardian: string,
  validUntil: BN,
  signer: string
) {
  const domainSeprator = eip712.hash("LoopringWallet", "2.0.0", masterCopy);
  const TYPE_STR =
    "addGuardian(address wallet,uint256 validUntil,address guardian)";
  const CREATE_WALLET_TYPEHASH = ethUtil.keccak(Buffer.from(TYPE_STR));

  const encodedRequest = ethAbi.encodeParameters(
    ["bytes32", "address", "uint256", "address"],
    [CREATE_WALLET_TYPEHASH, walletAddress, validUntil, guardian]
  );

  const hash = eip712.hashPacked(domainSeprator, encodedRequest);

  const txSignature = sign(signer, hash);
  return { txSignature, hash };
}

export function signRecover(
  masterCopy: string,
  walletAddress: string,
  validUntil: BN,
  newOwner: string,
  guardians: string[],
  signer: string,
  privateKey: string
) {
  const domainSeprator = eip712.hash("LoopringWallet", "2.0.0", masterCopy);
  const TYPE_STR =
    "recover(address wallet,uint256 validUntil,address newOwner,address[] newGuardians)";
  const RECOVER_TYPEHASH = ethUtil.keccak(Buffer.from(TYPE_STR));

  const guardiansBs = encodeAddressesPacked(guardians);
  const guardiansHash = ethUtil.keccak(guardiansBs);

  const encodedRequest = ethAbi.encodeParameters(
    ["bytes32", "address", "uint256", "address", "bytes32"],
    [RECOVER_TYPEHASH, walletAddress, validUntil, newOwner, guardiansHash]
  );

  const hash = eip712.hashPacked(domainSeprator, encodedRequest);

  const txSignature = sign2(signer, privateKey, hash);
  return { txSignature, hash };
}

export function signMetaTx(masterCopy: string, metaTx: MetaTx, signer: string) {
  const domainSeprator = eip712.hash("LoopringWallet", "2.0.0", masterCopy);
  const TYPE_STR =
    "MetaTx(address to,uint256 nonce,address gasToken,uint256 gasPrice,uint256 gasLimit,uint256 gasOverhead,address feeRecipient,bytes data,bytes32 approvedHash)";
  const METATX_TYPEHASH = ethUtil.keccak(Buffer.from(TYPE_STR));

  const encodedMetaTx = ethAbi.encodeParameters(
    [
      "bytes32",
      "address",
      "uint256",
      "address",
      "uint256",
      "uint256",
      "uint256",
      "address",
      "bool",
      "bytes32",
      "bytes32",
    ],
    [
      METATX_TYPEHASH,
      metaTx.to,
      metaTx.nonce,
      metaTx.gasToken,
      metaTx.gasPrice,
      metaTx.gasLimit,
      metaTx.gasOverhead,
      metaTx.feeRecipient,
      metaTx.requiresSuccess,
      ethUtil.keccak(metaTx.data),
      metaTx.approvedHash,
    ]
  );

  const hash = eip712.hashPacked(domainSeprator, encodedMetaTx);

  if (signer) {
    const txSignature = sign(signer, hash);
    return { txSignature, hash };
  } else {
    return { txSignature: "", hash };
  }
}

export function signUnlock(
  masterCopy: string,
  wallet: string,
  validUntil: BN,
  signer: string
) {
  const domainSeprator = eip712.hash("LoopringWallet", "2.0.0", masterCopy);
  const TYPE_STR = "unlock(address wallet,uint256 validUntil)";
  const UNLOCK_TYPEHASH = ethUtil.keccak(Buffer.from(TYPE_STR));

  const approvalEncoded = ethAbi.encodeParameters(
    ["bytes32", "address", "uint256"],
    [UNLOCK_TYPEHASH, wallet, validUntil]
  );
  const hash = eip712.hashPacked(domainSeprator, approvalEncoded);

  const txSignature = sign(signer, hash);
  return { txSignature, hash };
}

export function signChangeDailyQuotaWA(
  masterCopy: string,
  wallet: string,
  validUntil: BN,
  newQuota: BN,
  signer: string
) {
  const domainSeprator = eip712.hash("LoopringWallet", "2.0.0", masterCopy);
  const TYPE_STR =
    "changeDailyQuota(address wallet,uint256 validUntil,uint256 newQuota)";
  const CHANGE_QUOTA_TYPEHASH = ethUtil.keccak(Buffer.from(TYPE_STR));

  const approvalEncoded = ethAbi.encodeParameters(
    ["bytes32", "address", "uint256", "uint256"],
    [CHANGE_QUOTA_TYPEHASH, wallet, validUntil, newQuota]
  );
  const hash = eip712.hashPacked(domainSeprator, approvalEncoded);

  const txSignature = sign(signer, hash);
  return { txSignature, hash };
}

export function signAddToWhitelistWA(
  masterCopy: string,
  wallet: string,
  validUntil: BN,
  addr: string,
  signer: string
) {
  const domainSeprator = eip712.hash("LoopringWallet", "2.0.0", masterCopy);
  const TYPE_STR =
    "addToWhitelist(address wallet,uint256 validUntil,address addr)";
  const TYPEHASH = ethUtil.keccak(Buffer.from(TYPE_STR));

  const approvalEncoded = ethAbi.encodeParameters(
    ["bytes32", "address", "uint256", "address"],
    [TYPEHASH, wallet, validUntil, addr]
  );
  const hash = eip712.hashPacked(domainSeprator, approvalEncoded);

  const txSignature = sign(signer, hash);
  return { txSignature, hash };
}

export function signTransferTokenWA(
  masterCopy: string,
  wallet: string,
  validUntil: BN,
  token: string,
  to: string,
  amount: BN,
  logdata: Buffer,
  signer: string
) {
  const domainSeprator = eip712.hash("LoopringWallet", "2.0.0", masterCopy);
  const TYPE_STR =
    "transferToken(address wallet,uint256 validUntil,address token,address to,uint256 amount,bytes logdata)";
  const TYPEHASH = ethUtil.keccak(Buffer.from(TYPE_STR));

  const approvalEncoded = ethAbi.encodeParameters(
    [
      "bytes32",
      "address",
      "uint256",
      "address",
      "address",
      "uint256",
      "bytes32",
    ],
    [TYPEHASH, wallet, validUntil, token, to, amount, ethUtil.keccak(logdata)]
  );
  const hash = eip712.hashPacked(domainSeprator, approvalEncoded);

  const txSignature = sign(signer, hash);
  return { txSignature, hash };
}

export function signCallContractWA(
  masterCopy: string,
  wallet: string,
  validUntil: BN,
  to: string,
  value: BN,
  data: Buffer,
  signer: string
) {
  const domainSeprator = eip712.hash("LoopringWallet", "2.0.0", masterCopy);
  const TYPE_STR =
    "callContract(address wallet,uint256 validUntil,address to,uint256 value,bytes data)";
  const TYPEHASH = ethUtil.keccak(Buffer.from(TYPE_STR));

  const approvalEncoded = ethAbi.encodeParameters(
    ["bytes32", "address", "uint256", "address", "uint256", "bytes32"],
    [TYPEHASH, wallet, validUntil, to, value, ethUtil.keccak(data)]
  );
  const hash = eip712.hashPacked(domainSeprator, approvalEncoded);

  const txSignature = sign(signer, hash);
  return { txSignature, hash };
}

export function signApproveTokenWA(
  masterCopy: string,
  wallet: string,
  validUntil: BN,
  token: string,
  to: string,
  amount: BN,
  signer: string
) {
  const domainSeprator = eip712.hash("LoopringWallet", "2.0.0", masterCopy);
  const TYPE_STR =
    "approveToken(address wallet,uint256 validUntil,address token,address to,uint256 amount)";
  const TYPEHASH = ethUtil.keccak(Buffer.from(TYPE_STR));

  const approvalEncoded = ethAbi.encodeParameters(
    ["bytes32", "address", "uint256", "address", "address", "uint256"],
    [TYPEHASH, wallet, validUntil, token, to, amount]
  );
  const hash = eip712.hashPacked(domainSeprator, approvalEncoded);

  const txSignature = sign(signer, hash);
  return { txSignature, hash };
}

export function signApproveThenCallContractWA(
  masterCopy: string,
  wallet: string,
  validUntil: BN,
  token: string,
  to: string,
  amount: BN,
  value: BN,
  data: Buffer,
  signer: string
) {
  const domainSeprator = eip712.hash("LoopringWallet", "2.0.0", masterCopy);
  const TYPE_STR =
    "approveThenCallContract(address wallet,uint256 validUntil,address token,address to,uint256 amount,uint256 value,bytes data)";
  const TYPEHASH = ethUtil.keccak(Buffer.from(TYPE_STR));

  const approvalEncoded = ethAbi.encodeParameters(
    [
      "bytes32",
      "address",
      "uint256",
      "address",
      "address",
      "uint256",
      "uint256",
      "bytes32",
    ],
    [
      TYPEHASH,
      wallet,
      validUntil,
      token,
      to,
      amount,
      value,
      ethUtil.keccak(data),
    ]
  );
  const hash = eip712.hashPacked(domainSeprator, approvalEncoded);

  const txSignature = sign(signer, hash);
  return { txSignature, hash };
}
