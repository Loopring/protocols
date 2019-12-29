import BN = require("bn.js");
import { getEIP712Message } from "../util/EIP712";

export interface MetaTransaction {
  wallet: string;
  module: string;

  value: number;
  data: string;

  nonce: number;

  gasToken: string;
  gasPrice: number;
  gasLimit: number;
  gasOverhead: number;
  feeRecipient: string;
  chainId: number;
}

function toTypedData(metaTransaction: MetaTransaction) {
  const typedData = {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" }
      ],
      MetaTransaction: [
        { name: "wallet", type: "address" },
        { name: "module", type: "address" },
        { name: "value", type: "uint256" },
        { name: "data", type: "bytes" },
        { name: "nonce", type: "uint256" },
        { name: "gasToken", type: "address" },
        { name: "gasPrice", type: "uint256" },
        { name: "gasLimit", type: "uint256" },
        { name: "gasOverhead", type: "uint256" },
        { name: "feeRecipient", type: "address" }
      ]
    },
    primaryType: "MetaTransaction",
    domain: {
      name: "MetaTxModule",
      version: "1.0",
      chainId: new BN(metaTransaction.chainId)
    },
    message: {
      wallet: metaTransaction.wallet,
      module: metaTransaction.module,
      value: new BN(metaTransaction.value),
      data: metaTransaction.data,
      nonce: new BN(metaTransaction.nonce),
      gasToken: metaTransaction.gasToken,
      gasPrice: new BN(metaTransaction.gasPrice),
      gasLimit: new BN(metaTransaction.gasLimit),
      gasOverhead: new BN(metaTransaction.gasOverhead),
      feeRecipient: metaTransaction.feeRecipient
    }
  };
  return typedData;
}

export function getHash(metaTransaction: MetaTransaction) {
  const typedData = toTypedData(metaTransaction);
  const orderHash = getEIP712Message(typedData);
  return orderHash;
}
