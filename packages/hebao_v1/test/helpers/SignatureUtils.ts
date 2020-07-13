import ethUtil = require("ethereumjs-util");
import { sign, SignatureType } from "./Signature";
import { MetaTx } from "./MetaTx";
import { Constants } from "./Constants";
import * as eip712 from "./eip712";
import BN = require("bn.js");

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

export function signRecover(
  request: SignedRequest,
  newOwner: string,
  moduleAddr: string
) {
  const domainSeprator = eip712.hash("GuardianModule", "1.1.0", moduleAddr);
  const RECOVER_TYPEHASH = ethUtil.keccak(
    Buffer.from("recover(address wallet,uint256 validUntil,address newOwner)")
  );
  const encodedRequest = web3.eth.abi.encodeParameters(
    ["bytes32", "address", "uint256", "address"],
    [RECOVER_TYPEHASH, request.wallet, request.validUntil, newOwner]
  );
  const hash = eip712.hashPacked(domainSeprator, encodedRequest);

  for (const signer of request.signers) {
    const sig = sign(signer, hash);
    request.signatures.push(sig);
  }
}

export function signChangeDailyQuotaImmediately(
  request: SignedRequest,
  newQuota: BN,
  moduleAddr: string
) {
  const domainSeprator = eip712.hash("TransferModule", "1.1.0", moduleAddr);
  const CHANGE_DAILY_QUOTE_IMMEDIATELY_TYPEHASH = ethUtil.keccak(
    Buffer.from(
      "changeDailyQuotaImmediately(address wallet,uint256 validUntil,uint256 newQuota)"
    )
  );
  const encodedRequest = web3.eth.abi.encodeParameters(
    ["bytes32", "address", "uint256", "uint256"],
    [
      CHANGE_DAILY_QUOTE_IMMEDIATELY_TYPEHASH,
      request.wallet,
      request.validUntil,
      newQuota.toString(10)
    ]
  );
  const hash = eip712.hashPacked(domainSeprator, encodedRequest);
  for (const signer of request.signers) {
    const sig = sign(signer, hash);
    request.signatures.push(sig);
  }
}

export function signTransferTokenApproved(
  request: SignedRequest,
  token: string,
  to: string,
  amount: BN,
  logdata: string,
  moduleAddr: string
) {
  const domainSeprator = eip712.hash("TransferModule", "1.1.0", moduleAddr);
  const TRANSFER_TOKEN_TYPEHASH = ethUtil.keccak(
    Buffer.from(
      "transferTokenWithApproval(address wallet,uint256 validUntil,address token,address to,uint256 amount,bytes logdata)"
    )
  );
  const encodedRequest = web3.eth.abi.encodeParameters(
    [
      "bytes32",
      "address",
      "uint256",
      "address",
      "address",
      "uint256",
      "bytes32"
    ],
    [
      TRANSFER_TOKEN_TYPEHASH,
      request.wallet,
      request.validUntil,
      token,
      to,
      amount.toString(10),
      ethUtil.keccak(Buffer.from(logdata.slice(2), "hex"))
    ]
  );
  const hash = eip712.hashPacked(domainSeprator, encodedRequest);
  for (const signer of request.signers) {
    const sig = sign(signer, hash);
    request.signatures.push(sig);
  }
}

export function signApproveTokenApproved(
  request: SignedRequest,
  token: string,
  to: string,
  amount: BN,
  moduleAddr: string
) {
  const domainSeprator = eip712.hash("TransferModule", "1.1.0", moduleAddr);
  const APPROVE_TOKEN_TYPEHASH = ethUtil.keccak(
    Buffer.from(
      "approveTokenWithApproval(address wallet,uint256 validUntil,address token,address to,uint256 amount)"
    )
  );
  const encodedRequest = web3.eth.abi.encodeParameters(
    ["bytes32", "address", "uint256", "address", "address", "uint256"],
    [
      APPROVE_TOKEN_TYPEHASH,
      request.wallet,
      request.validUntil,
      token,
      to,
      amount.toString(10)
    ]
  );
  const hash = eip712.hashPacked(domainSeprator, encodedRequest);
  for (const signer of request.signers) {
    const sig = sign(signer, hash);
    request.signatures.push(sig);
  }
}

export function signCallContractApproved(
  request: SignedRequest,
  to: string,
  value: BN,
  data: string,
  moduleAddr: string
) {
  const domainSeprator = eip712.hash("TransferModule", "1.1.0", moduleAddr);
  const CALL_CONTRACT_TYPEHASH = ethUtil.keccak(
    Buffer.from(
      "callContractWithApproval(address wallet,uint256 validUntil,address to,uint256 value,bytes data)"
    )
  );
  const encodedRequest = web3.eth.abi.encodeParameters(
    ["bytes32", "address", "uint256", "address", "uint256", "bytes32"],
    [
      CALL_CONTRACT_TYPEHASH,
      request.wallet,
      request.validUntil,
      to,
      value.toString(10),
      ethUtil.keccak(Buffer.from(data.slice(2), "hex"))
    ]
  );
  const hash = eip712.hashPacked(domainSeprator, encodedRequest);
  for (const signer of request.signers) {
    const sig = sign(signer, hash);
    request.signatures.push(sig);
  }
}

export function signApproveThenCallContractApproved(
  request: SignedRequest,
  token: string,
  to: string,
  amount: BN,
  value: BN,
  data: string,
  moduleAddr: string
) {
  const domainSeprator = eip712.hash("TransferModule", "1.1.0", moduleAddr);
  const APPROVE_THEN_CALL_CONTRACT_TYPEHASH = ethUtil.keccak(
    Buffer.from(
      "approveThenCallContractWithApproval(address wallet,uint256 validUntil,address token,address to,uint256 amount,uint256 value,bytes data)"
    )
  );
  const encodedRequest = web3.eth.abi.encodeParameters(
    [
      "bytes32",
      "address",
      "uint256",
      "address",
      "address",
      "uint256",
      "uint256",
      "bytes32"
    ],
    [
      APPROVE_THEN_CALL_CONTRACT_TYPEHASH,
      request.wallet,
      request.validUntil,
      token,
      to,
      amount.toString(10),
      value.toString(10),
      ethUtil.keccak(Buffer.from(data.slice(2), "hex"))
    ]
  );
  const hash = eip712.hashPacked(domainSeprator, encodedRequest);
  for (const signer of request.signers) {
    const sig = sign(signer, hash);
    request.signatures.push(sig);
  }
}

// export function signMetaTx(metaTx: MetaTx) {
//   const META_TX_TYPEHASH = ethUtil.keccak(
//     "MetaTx(address from,address to,\
// uint256 nonce,address gasToken,uint256 gasPrice,\
// uint256 gasLimit,bytes32 txAwareHash,bytes data)"
//   );

//   const encoded = web3.eth.abi.encodeParameters(
//     [
//       "bytes32",
//       "address",
//       "address",
//       "uint256",
//       "address",
//       "uint256",
//       "uint256",
//       "bytes32",
//       "bytes32"
//     ],
//     [
//       META_TX_TYPEHASH,
//       metaTx.from,
//       metaTx.to,
//       metaTx.nonce,
//       metaTx.gasToken,
//       metaTx.gasPrice,
//       metaTx.gasLimit,
//       metaTx.txAwareHash,
//       ethUtil.keccak(metaTx.data)
//     ]
//   );

//   const domainSeprator = eip712.hash(
//     "Loopring Wallet MetaTx",
//     "2.0",
//     Constants.zeroAddress
//   );

//   const hash = eip712.hashPacked(domainSeprator, encoded);
//   return sign(metaTx.from, hash);
// }
