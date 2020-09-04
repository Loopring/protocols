import BN = require("bn.js");
import { Constants } from "./Constants";
import { SignatureType, sign, verifySignatures, appendType } from "./Signature";
import { Context } from "./TestUtils";
import { getTokenAddress } from "./TokenUtils";
import { getEIP712Message } from "../../util/EIP712";
import ethUtil = require("ethereumjs-util");
import { getMetaTxHash } from "./SignatureUtils";

export interface MetaTx {
  from: string;
  to: string;
  nonce: number;
  txAwareHash: string;
  gasToken: string;
  gasPrice: number;
  gasLimit: number;
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
  txAwareHash?: string;
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
      txAwareHash: metaTx.txAwareHash,
      gasToken: metaTx.gasToken,
      gasPrice: metaTx.gasPrice,
      gasLimit: new BN(metaTx.gasLimit),
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
  let nonce = options.nonce ? options.nonce : new Date().getTime();
  nonce = txAwareHash === "0x" + "00".repeat(32) ? nonce : 0;
  const metaTxData =
    txAwareHash === "0x" + "00".repeat(32) ? data : data.slice(0, 10);
  // console.log('metaTxData:', metaTxData);
  // console.log('txAwareHash:', txAwareHash);

  // Create the meta transaction
  const metaTx: MetaTx = {
    from: options.wallet,
    to: contract._address,
    nonce,
    txAwareHash,
    gasToken: await getTokenAddress(ctx, gasToken),
    gasPrice: gasPrice.toNumber(),
    gasLimit,
    data: metaTxData,
    chainId: /*await web3.eth.net.getId()*/ 1
  };

  // Sign the meta transaction
  const hash: Buffer = getMetaTxHash(metaTx, ctx.finalCoreModule.address);
  // console.log('hash', hash);
  const signature = sign(options.owner, hash);

  // const trustedForwarder = await ctx.walletFactory.trustedForwarder();
  // console.log('trustedForwarder:', trustedForwarder);

  const tx = await ctx.finalCoreModule.executeMetaTx(metaTx, signature, {
    from,
    gas,
    gasPrice: gasPrice.toString()
  });

  // const allEvents = await ctx.finalCoreModule.getPastEvents(
  //   "allEvents",
  //   {
  //     fromBlock: await web3.eth.getBlockNumber(),
  //     toBlock: await web3.eth.getBlockNumber()
  //   }
  // );
  // console.log("allEvents:", allEvents);

  // console.log("tx:", tx);
  // console.log("tx.reciept.logs:", tx.receipt.logs);

  return tx;
}
