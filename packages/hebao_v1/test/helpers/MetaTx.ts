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

export interface MetaTx {
  from: string;
  to: string;
  nonce: number;
  gasToken: string;
  gasPrice: BN;
  gasLimit: number;
  txInnerHash: string;
  data: string;

  chainId: number;
}

function toTypedData(metaTx: MetaTx) {
  const typedData = {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" }
      ],
      MetaTx: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "gasToken", type: "address" },
        { name: "gasPrice", type: "uint256" },
        { name: "gasLimit", type: "uint256" },
        { name: "txInnerHash", type: "bytes32" },
        { name: "data", type: "bytes" }
      ]
    },
    primaryType: "MetaTx",
    domain: {
      name: "Loopring Wallet MetaTx",
      version: "2.0",
      chainId: new BN(metaTx.chainId),
      verifyingContract: Constants.zeroAddress
    },
    message: {
      from: metaTx.from,
      to: metaTx.to,
      nonce: new BN(metaTx.nonce),
      gasToken: metaTx.gasToken,
      gasPrice: metaTx.gasPrice,
      gasLimit: new BN(metaTx.gasLimit),
      txInnerHash: metaTx.txInnerHash,
      data: metaTx.data
    }
  };
  return typedData;
}

export function getHash(metaTx: MetaTx) {
  const typedData = toTypedData(metaTx);
  const orderHash = getEIP712Message(typedData);
  return orderHash;
}

export async function executeMetaTx(
  ctx: Context,
  contract: any,
  txInnerHash: string,
  data: string,
  options: TransactionOptions
) {
  // Defaults
  const from = options.from ? options.from : web3.eth.defaultAccount;
  const gas = options.gas ? options.gas : 5000000;

  const gasToken = options.gasToken ? options.gasToken : "ETH";
  const gasPrice = options.gasPrice ? options.gasPrice : new BN(0);
  const gasLimit = options.gasLimit ? options.gasLimit : 4000000;
  const nonce = new Date().getTime();

  // Create the meta transaction
  const metaTx: MetaTx = {
    from,
    to: contract._address,
    nonce,
    gasToken: await getTokenAddress(ctx, gasToken),
    gasPrice,
    gasLimit,
    txInnerHash,
    data,
    chainId: /*await web3.eth.net.getId()*/ 1
  };

  // Sign the meta transaction
  const hash = getHash(metaTx);
  const signature = "";

  return ctx.contracts.forwarderModule.methods
    .executeMetaTx(metaTx, signature)
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
  actualSigners?: string[];
}
