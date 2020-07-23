import BN = require("bn.js");
import { Constants } from "./Constants";
import { SignatureType, sign, verifySignatures, appendType } from "./Signature";
import { Context } from "./TestUtils";
import { getTokenAddress } from "./TokenUtils";
import { getEIP712Message } from "../../util/EIP712";
import ethUtil = require("ethereumjs-util");

export interface MetaTx {
  from: string;
  to: string;
  nonce: number;
  gasToken: string;
  gasPrice: number;
  gasLimit: number;
  txAwareHash: string;
  data: string;

  chainId: number;
}

export interface TransactionOptions {
  from?: string;
  owner?: string;
  wallet?: string;
  gas?: number;
  value?: BN;
  nonce?: number;
  gasToken?: string;
  gasPrice?: BN;
  gasLimit?: number;
  gasOverhead?: number;
  feeRecipient?: string;
  signatureTypes?: SignatureType[];
  checkSignatures?: boolean;
}

function toTypedData(metaTx: MetaTx, forwardModuleAddr: string) {
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
        { name: "txAwareHash", type: "bytes32" },
        { name: "gasToken", type: "address" },
        { name: "gasPrice", type: "uint256" },
        { name: "gasLimit", type: "uint256" },
        { name: "data", type: "bytes" }
      ]
    },
    primaryType: "MetaTx",
    domain: {
      name: "ForwarderModule",
      version: "1.1.0",
      chainId: new BN(metaTx.chainId),
      verifyingContract: forwardModuleAddr
    },
    message: {
      from: metaTx.from,
      to: metaTx.to,
      nonce: new BN(metaTx.nonce),
      gasToken: metaTx.gasToken,
      gasPrice: metaTx.gasPrice,
      gasLimit: new BN(metaTx.gasLimit),
      txAwareHash: metaTx.txAwareHash,
      data: metaTx.data
    }
  };
  return typedData;
}

export function getHash(metaTx: MetaTx, forwardModuleAddr: string) {
  const typedData = toTypedData(metaTx, forwardModuleAddr);
  const orderHash = getEIP712Message(typedData);
  return orderHash;
}

export async function executeMetaTx(
  ctx: Context,
  contract: any,
  txAwareHash: string,
  data: string,
  options: TransactionOptions
) {
  // Defaults
  const from = options.from ? options.from : web3.eth.defaultAccount;
  const gas = options.gas ? options.gas : 5000000;

  const gasToken = options.gasToken ? options.gasToken : "ETH";
  const gasPrice = options.gasPrice ? options.gasPrice : new BN(0);
  const gasLimit = options.gasLimit ? options.gasLimit : 4000000;
  const nonce = options.nonce ? options.nonce : new Date().getTime();

  // Create the meta transaction
  const metaTx: MetaTx = {
    from: options.wallet,
    to: contract._address,
    nonce,
    gasToken: await getTokenAddress(ctx, gasToken),
    gasPrice: gasPrice.toNumber(),
    gasLimit,
    txAwareHash,
    data,
    chainId: /*await web3.eth.net.getId()*/ 1
  };

  // Sign the meta transaction
  const hash: Buffer = getHash(metaTx, ctx.forwarderModule.address);
  const signature = sign(options.owner, hash);

  const tx = await ctx.forwarderModule.executeMetaTx(metaTx, signature, {
    from,
    gas,
    gasPrice: gasPrice.toString()
  });

  // console.log("tx:", tx);

  // console.log("tx.reciept.logs:", tx.receipt.logs);

  return tx;
}
