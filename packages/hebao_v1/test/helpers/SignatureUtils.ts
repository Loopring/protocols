import ethUtil = require("ethereumjs-util");
import { sign, SignatureType } from "./Signature";
import { MetaTx } from "./MetaTx";
import { Constants } from "./Constants";
import * as eip712 from "./eip712";

export interface SignedRequest {
  signers: string[];
  signatures: string[];
  validUntil: number;
  wallet: string;
}

export function signCreateWallet(
  moduleAddress: string,
  owner: string,
  label: string,
  labelApproval: string,
  modules: string[]
) {
  const domainSeprator = eip712.hash("WalletFactory", "1.1.0", moduleAddress);

  const TYPE_STR =
    "createWallet(address owner,string label,bytes labelApproval,address[] modules)";
  const CREATE_WALLET_TYPEHASH = ethUtil.keccak(Buffer.from(TYPE_STR));

  const encodedLabel = ethUtil.keccak(Buffer.from(label, "utf8"));
  const encodedApproval = ethUtil.keccak(labelApproval);
  const encodedModules = ethUtil.keccak(
    web3.eth.abi.encodeParameter("address[]", modules)
  );

  const encodedRequest = web3.eth.abi.encodeParameters(
    ["bytes32", "address", "bytes32", "bytes32", "bytes32"],
    [
      CREATE_WALLET_TYPEHASH,
      owner,
      encodedLabel,
      encodedApproval,
      encodedModules
    ]
  );

  const hash = eip712.hashPacked(domainSeprator, encodedRequest);
  // console.log(`hash: ${hash.toString("hex")}`);

  return sign(owner, hash);
}

export function signAddToWhitelistImmediately(
  request: SignedRequest,
  addr: string,
  moduleAddr: string
) {
  const domainSeprator = eip712.hash("WhitelistModule", "1.1.0", moduleAddr);
  const ADD_TO_WHITELIST_IMMEDIATELY_TYPEHASH = ethUtil.keccak(
    Buffer.from(
      "addToWhitelistImmediately(address wallet,uint256 validUntil,address addr)"
    )
  );
  const encodedRequest = web3.eth.abi.encodeParameters(
    ["bytes32", "address", "uint256", "address"],
    [
      ADD_TO_WHITELIST_IMMEDIATELY_TYPEHASH,
      request.wallet,
      request.validUntil,
      addr
    ]
  );
  const hash = eip712.hashPacked(domainSeprator, encodedRequest);
  // console.log(`hash: ${hash}`);
  // console.log(`request.signers: ${request.signers}`);

  for (const signer of request.signers) {
    if (signer) {
      const sig = sign(signer, hash);
      request.signatures.push(sig);
    }
  }
}

export function signMetaTx(metaTx: MetaTx) {
  const META_TX_TYPEHASH = ethUtil.keccak(
    "MetaTx(address from,address to,\
uint256 nonce,address gasToken,uint256 gasPrice,\
uint256 gasLimit,bytes32 txAwareHash,bytes data)"
  );

  const encoded = web3.eth.abi.encodeParameters(
    [
      "bytes32",
      "address",
      "address",
      "uint256",
      "address",
      "uint256",
      "uint256",
      "bytes32",
      "bytes32"
    ],
    [
      META_TX_TYPEHASH,
      metaTx.from,
      metaTx.to,
      metaTx.nonce,
      metaTx.gasToken,
      metaTx.gasPrice,
      metaTx.gasLimit,
      metaTx.txAwareHash,
      ethUtil.keccak(metaTx.data)
    ]
  );

  const domainSeprator = eip712.hash(
    "Loopring Wallet MetaTx",
    "2.0",
    Constants.zeroAddress
  );

  const hash = eip712.hashPacked(domainSeprator, encoded);
  return sign(metaTx.from, hash);
}
