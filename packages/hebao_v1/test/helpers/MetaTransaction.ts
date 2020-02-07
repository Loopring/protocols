import BN = require("bn.js");
import { Constants } from "./Constants";
import {
  SignatureType,
  batchSign,
  verifySignatures,
  appendType
} from "./Signature";
import { Context } from "./TestUtils";
import { getTokenAddress } from "./TokenUtils";
import { getEIP712Message } from "../../util/EIP712";

export interface MetaTransaction {
  wallet: string;
  module: string;

  value: BN;
  data: string;

  nonce: number;

  gasToken: string;
  gasPrice: BN;
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
      value: metaTransaction.value,
      data: metaTransaction.data,
      nonce: new BN(metaTransaction.nonce),
      gasToken: metaTransaction.gasToken,
      gasPrice: metaTransaction.gasPrice,
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

export async function executeMetaTransaction(
  ctx: Context,
  contract: any,
  data: string,
  wallet: string,
  signers: string[],
  options: TransactionOptions
) {
  // Defaults
  const from = options.from ? options.from : web3.eth.defaultAccount;
  const gas = options.gas ? options.gas : 5000000;
  const value = options.value ? options.value : new BN(0);
  const gasToken = options.gasToken ? options.gasToken : "ETH";
  const gasPrice = options.gasPrice ? options.gasPrice : new BN(0);
  const gasLimit = options.gasLimit ? options.gasLimit : 4000000;
  const gasOverhead = options.gasOverhead ? options.gasOverhead : 0;
  const feeRecipient = options.feeRecipient
    ? options.feeRecipient
    : Constants.zeroAddress;
  const signatureTypes =
    options.signatureTypes !== undefined
      ? options.signatureTypes
      : Array(signers.length).fill(SignatureType.EIP_712);
  const nonce =
    options.nonce !== undefined
      ? options.nonce
      : +(await contract.methods.lastNonce(wallet).call()) + 1;
  const checkSignatures =
    options.checkSignatures !== undefined ? options.checkSignatures : false;

  // Create the meta transaction
  const metaTransaction: MetaTransaction = {
    wallet,
    module: contract._address,
    value,
    data,
    nonce,
    gasToken: await getTokenAddress(ctx, gasToken),
    gasPrice,
    gasLimit,
    gasOverhead,
    feeRecipient,
    // Don't use this yet: https://github.com/trufflesuite/ganache-core/issues/515
    chainId: /*await web3.eth.net.getId()*/ 1
  };

  // Sign the meta transaction
  const hash = getHash(metaTransaction);
  const signatures = await batchSign(ctx, signers, hash, signatureTypes);
  if (checkSignatures) {
    await verifySignatures(ctx, signers, hash, signatures);
  }

  // Execute the meta transaction
  const gasSettings = [
    new BN(metaTransaction.gasToken.slice(2), 16).toString(10),
    metaTransaction.gasPrice.toString(10),
    new BN(metaTransaction.gasLimit).toString(10),
    new BN(metaTransaction.gasOverhead).toString(10),
    new BN(metaTransaction.feeRecipient.slice(2), 16).toString(10)
  ];
  return contract.methods
    .executeMetaTx(metaTransaction.data, nonce, gasSettings, signatures)
    .send({ from, gas, gasPrice: 0 });
}

export interface TransactionOptions {
  from?: string;
  gas?: number;
  value?: BN;
  gasToken?: string;
  gasPrice?: BN;
  gasLimit?: number;
  gasOverhead?: number;
  feeRecipient?: string;
  signatureTypes?: SignatureType[];
  nonce?: number;
  checkSignatures?: boolean;
}
