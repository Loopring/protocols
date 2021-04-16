import ethUtil = require("ethereumjs-util");
const ethAbi = require("web3-eth-abi");
import { sign, SignatureType } from "./Signature";
import { Constants } from "./Constants";
import * as eip712 from "./eip712";
import BN = require("bn.js");

export interface SignedRequest {
  signers: string[];
  signatures: string[];
  validUntil: number;
  wallet: string;
}

function encodeAddressesPacked(addrs: string[]) {
  const addrsBs = Buffer.concat(
    addrs.map(a => Buffer.from("00".repeat(12) + a.slice(2), "hex"))
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
  feeAmount: BN,
  salt: number
) {
  const domainSeprator = eip712.hash("WalletFactory", "2.0.0", moduleAddress);

  const TYPE_STR =
    "createWallet(address owner,address[] guardians,uint256 quota,address inheritor,address feeRecipient,address feeToken,uint256 feeAmount,uint256 salt)";
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
      "uint256"
    ],
    [
      CREATE_WALLET_TYPEHASH,
      owner,
      guardiansHash,
      quota,
      inheritor,
      feeRecipient,
      feeToken,
      feeAmount,
      salt
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
  const TYPE_STR = "changeMasterCopy(address wallet,uint256 validUntil,address masterCopy)";
  const CREATE_WALLET_TYPEHASH = ethUtil.keccak(Buffer.from(TYPE_STR));

  const encodedRequest = ethAbi.encodeParameters(
    [
      "bytes32",
      "address",
      "uint256",
      "address"
    ],
    [
      CREATE_WALLET_TYPEHASH,
      walletAddress,
      validUntil,
      newMasterCopy
    ]
  );

  const hash = eip712.hashPacked(domainSeprator, encodedRequest);

  const txSignature = sign(signer, hash);
  return { txSignature, hash };
}

// export function signAddToWhitelistWA(
//   request: SignedRequest,
//   addr: string,
//   moduleAddr: string
// ) {
//   const domainSeprator = eip712.hash("WhitelistModule", "1.2.0", moduleAddr);
//   const ADD_TO_WHITELIST_TYPEHASH = ethUtil.keccak(
//     Buffer.from(
//       "addToWhitelist(address wallet,uint256 validUntil,address addr)"
//     )
//   );
//   const encodedRequest = ethAbi.encodeParameters(
//     ["bytes32", "address", "uint256", "address"],
//     [ADD_TO_WHITELIST_TYPEHASH, request.wallet, request.validUntil, addr]
//   );
//   const hash = eip712.hashPacked(domainSeprator, encodedRequest);
//   // console.log(`hash: ${hash}`);
//   // console.log(`request.signers: ${request.signers}`);

//   for (const signer of request.signers) {
//     if (signer) {
//       const sig = sign(signer, hash);
//       request.signatures.push(sig);
//     }
//   }
// }

// export function signUnlock(request: SignedRequest, moduleAddr: string) {
//   const domainSeprator = eip712.hash("GuardianModule", "1.2.0", moduleAddr);
//   const UNLOCK_TYPEHASH = ethUtil.keccak(
//     Buffer.from("unlock(address wallet,uint256 validUntil)")
//   );
//   const encodedRequest = ethAbi.encodeParameters(
//     ["bytes32", "address", "uint256"],
//     [UNLOCK_TYPEHASH, request.wallet, request.validUntil]
//   );
//   const hash = eip712.hashPacked(domainSeprator, encodedRequest);
//   // console.log("hash:", hash);
//   // console.log(`request.signers: ${request.signers}`);

//   for (const signer of request.signers) {
//     if (signer) {
//       const sig = sign(signer, hash);
//       request.signatures.push(sig);
//     }
//   }
// }

// export function signRecover(
//   request: SignedRequest,
//   newOwner: string,
//   moduleAddr: string
// ) {
//   const domainSeprator = eip712.hash("GuardianModule", "1.2.0", moduleAddr);
//   const RECOVER_TYPEHASH = ethUtil.keccak(
//     Buffer.from("recover(address wallet,uint256 validUntil,address newOwner)")
//   );
//   const encodedRequest = ethAbi.encodeParameters(
//     ["bytes32", "address", "uint256", "address"],
//     [RECOVER_TYPEHASH, request.wallet, request.validUntil, newOwner]
//   );
//   const hash = eip712.hashPacked(domainSeprator, encodedRequest);

//   for (const signer of request.signers) {
//     const sig = sign(signer, hash);
//     request.signatures.push(sig);
//   }
// }

// export function signChangeDailyQuotaWA(
//   request: SignedRequest,
//   newQuota: BN,
//   moduleAddr: string
// ) {
//   const domainSeprator = eip712.hash("TransferModule", "1.2.0", moduleAddr);
//   const CHANGE_DAILY_QUOTE_TYPEHASH = ethUtil.keccak(
//     Buffer.from(
//       "changeDailyQuota(address wallet,uint256 validUntil,uint256 newQuota)"
//     )
//   );
//   const encodedRequest = ethAbi.encodeParameters(
//     ["bytes32", "address", "uint256", "uint256"],
//     [
//       CHANGE_DAILY_QUOTE_TYPEHASH,
//       request.wallet,
//       request.validUntil,
//       newQuota.toString(10)
//     ]
//   );
//   const hash = eip712.hashPacked(domainSeprator, encodedRequest);
//   for (const signer of request.signers) {
//     const sig = sign(signer, hash);
//     request.signatures.push(sig);
//   }
// }

// export function signTransferTokenApproved(
//   request: SignedRequest,
//   token: string,
//   to: string,
//   amount: BN,
//   logdata: string,
//   moduleAddr: string
// ) {
//   const domainSeprator = eip712.hash("TransferModule", "1.2.0", moduleAddr);
//   const TRANSFER_TOKEN_TYPEHASH = ethUtil.keccak(
//     Buffer.from(
//       "transferToken(address wallet,uint256 validUntil,address token,address to,uint256 amount,bytes logdata)"
//     )
//   );
//   const encodedRequest = ethAbi.encodeParameters(
//     [
//       "bytes32",
//       "address",
//       "uint256",
//       "address",
//       "address",
//       "uint256",
//       "bytes32"
//     ],
//     [
//       TRANSFER_TOKEN_TYPEHASH,
//       request.wallet,
//       request.validUntil,
//       token,
//       to,
//       amount.toString(10),
//       ethUtil.keccak(Buffer.from(logdata.slice(2), "hex"))
//     ]
//   );
//   const hash = eip712.hashPacked(domainSeprator, encodedRequest);
//   for (const signer of request.signers) {
//     const sig = sign(signer, hash);
//     request.signatures.push(sig);
//   }
// }

// export function signApproveTokenApproved(
//   request: SignedRequest,
//   token: string,
//   to: string,
//   amount: BN,
//   moduleAddr: string
// ) {
//   const domainSeprator = eip712.hash("TransferModule", "1.2.0", moduleAddr);
//   const APPROVE_TOKEN_TYPEHASH = ethUtil.keccak(
//     Buffer.from(
//       "approveToken(address wallet,uint256 validUntil,address token,address to,uint256 amount)"
//     )
//   );
//   const encodedRequest = ethAbi.encodeParameters(
//     ["bytes32", "address", "uint256", "address", "address", "uint256"],
//     [
//       APPROVE_TOKEN_TYPEHASH,
//       request.wallet,
//       request.validUntil,
//       token,
//       to,
//       amount.toString(10)
//     ]
//   );
//   const hash = eip712.hashPacked(domainSeprator, encodedRequest);
//   for (const signer of request.signers) {
//     const sig = sign(signer, hash);
//     request.signatures.push(sig);
//   }
// }

// export function signCallContractApproved(
//   request: SignedRequest,
//   to: string,
//   value: BN,
//   data: string,
//   moduleAddr: string
// ) {
//   const domainSeprator = eip712.hash("TransferModule", "1.2.0", moduleAddr);
//   const CALL_CONTRACT_TYPEHASH = ethUtil.keccak(
//     Buffer.from(
//       "callContract(address wallet,uint256 validUntil,address to,uint256 value,bytes data)"
//     )
//   );
//   const encodedRequest = ethAbi.encodeParameters(
//     ["bytes32", "address", "uint256", "address", "uint256", "bytes32"],
//     [
//       CALL_CONTRACT_TYPEHASH,
//       request.wallet,
//       request.validUntil,
//       to,
//       value.toString(10),
//       ethUtil.keccak(Buffer.from(data.slice(2), "hex"))
//     ]
//   );
//   const hash = eip712.hashPacked(domainSeprator, encodedRequest);
//   for (const signer of request.signers) {
//     const sig = sign(signer, hash);
//     request.signatures.push(sig);
//   }
// }

// export function signApproveThenCallContractApproved(
//   request: SignedRequest,
//   token: string,
//   to: string,
//   amount: BN,
//   value: BN,
//   data: string,
//   moduleAddr: string
// ) {
//   const domainSeprator = eip712.hash("TransferModule", "1.2.0", moduleAddr);
//   const APPROVE_THEN_CALL_CONTRACT_TYPEHASH = ethUtil.keccak(
//     Buffer.from(
//       "approveThenCallContract(address wallet,uint256 validUntil,address token,address to,uint256 amount,uint256 value,bytes data)"
//     )
//   );
//   const encodedRequest = ethAbi.encodeParameters(
//     [
//       "bytes32",
//       "address",
//       "uint256",
//       "address",
//       "address",
//       "uint256",
//       "uint256",
//       "bytes32"
//     ],
//     [
//       APPROVE_THEN_CALL_CONTRACT_TYPEHASH,
//       request.wallet,
//       request.validUntil,
//       token,
//       to,
//       amount.toString(10),
//       value.toString(10),
//       ethUtil.keccak(Buffer.from(data.slice(2), "hex"))
//     ]
//   );
//   const hash = eip712.hashPacked(domainSeprator, encodedRequest);
//   for (const signer of request.signers) {
//     const sig = sign(signer, hash);
//     request.signatures.push(sig);
//   }
// }

// // export function getMetaTxHash(metaTx: MetaTx, moduleAddr: string) {
// //   const domainSeprator = eip712.hash("ForwarderModule", "1.2.0", moduleAddr);

// //   const META_TX_TYPEHASH = ethUtil.keccak(
// //     Buffer.from(
// //       "MetaTx(address from,address to,uint256 nonce,bytes32 txAwareHash,address gasToken,uint256 gasPrice,uint256 gasLimit,bytes data)"
// //     )
// //   );

// //   const data =
// //     metaTx.txAwareHash === Constants.emptyBytes32
// //       ? metaTx.data
// //       : metaTx.data.slice(0, 10);

// //   const encodedRequest = ethAbi.encodeParameters(
// //     [
// //       "bytes32",
// //       "address",
// //       "address",
// //       "uint256",
// //       "bytes32",
// //       "address",
// //       "uint256",
// //       "uint256",
// //       "bytes32"
// //     ],
// //     [
// //       META_TX_TYPEHASH,
// //       metaTx.from,
// //       metaTx.to,
// //       new BN(metaTx.nonce).toString(10),
// //       metaTx.txAwareHash,
// //       metaTx.gasToken,
// //       new BN(metaTx.gasPrice).toString(10),
// //       new BN(metaTx.gasLimit).toString(10),
// //       ethUtil.keccak(data)
// //     ]
// //   );
// //   const hash = eip712.hashPacked(domainSeprator, encodedRequest);
// //   return hash;
// // }
