import { Bitstream } from "loopringV3.js";
import ethUtil = require("ethereumjs-util");
import fs = require("fs");

export enum SignatureType {
  ILLEGAL,
  INVALID,
  EIP_712,
  ETH_SIGN,
  WALLET
}

export async function sign(
  signer: string,
  message: Buffer,
  type: SignatureType = SignatureType.EIP_712
) {
  let signature: string;
  switch (+type) {
    case SignatureType.ETH_SIGN: {
      const privateKey = getPrivateKey(signer);
      signature = appendType(await signEthereum(message, privateKey), type);
      break;
    }
    case SignatureType.EIP_712: {
      const privateKey = getPrivateKey(signer);
      signature = appendType(await signEIP712(message, privateKey), type);
      break;
    }
    /*case SignatureType.WALLET: {
      try {
        const wallet = await ctx.contracts.BaseWallet.at(signer);
        const walletOwner = await wallet.owner();
        const privateKey = getPrivateKey(walletOwner);

        // Sign using the wallet owner
        signature = appendType(
          appendType(
            await signEIP712(message, privateKey),
            SignatureType.EIP_712
          ),
          type
        );
      } catch {
        signature = appendType("", type);
      }
      break;
    }*/
    default: {
      // console.log("Unsupported signature type: " + type);
      signature = appendType("", type);
    }
  }
  return signature;
}

export function appendType(str: string, type: SignatureType) {
  const data = new Bitstream(str);
  data.addNumber(type, 1);
  return data.getData();
}

async function signEthereum(message: Buffer, privateKey: string) {
  const parts = [
    Buffer.from("\x19Ethereum Signed Message:\n32", "utf8"),
    message
  ];
  const totalHash = ethUtil.keccak(Buffer.concat(parts));
  const signature = ethUtil.ecsign(totalHash, new Buffer(privateKey, "hex"));

  const data = new Bitstream();
  data.addHex(ethUtil.bufferToHex(signature.r));
  data.addHex(ethUtil.bufferToHex(signature.s));
  data.addHex(ethUtil.bufferToHex(signature.v));
  return data.getData();
}

async function signEIP712(message: Buffer, privateKey: string) {
  const signature = ethUtil.ecsign(message, new Buffer(privateKey, "hex"));

  const data = new Bitstream();
  data.addHex(ethUtil.bufferToHex(signature.r));
  data.addHex(ethUtil.bufferToHex(signature.s));
  data.addHex(ethUtil.bufferToHex(signature.v));
  return data.getData();
}

export async function verifySignatures(
  signers: string[],
  message: Buffer,
  signatures: string[]
) {
  assert(signers.length == signatures.length, "invalid input");
  for (let i = 0; i < signatures.length; i++) {
    await verifySignature(signers[i], message, signatures[i]);
  }
}

export async function verifySignature(
  signer: string,
  message: Buffer,
  signature: string
) {
  const data = new Bitstream(signature);
  const type = data.extractUint8(data.length() - 1);
  if (type === SignatureType.ETH_SIGN) {
    const personalMessage = ethUtil.hashPersonalMessage(message);
    assert(
      verifyECDSA(personalMessage, data, signer),
      "invalid ETH_SIGN signature"
    );
  } else if (type === SignatureType.EIP_712) {
    assert(verifyECDSA(message, data, signer), "invalid EIP_712 signature");
  }/* else if (type === SignatureType.WALLET) {
    try {
      const wallet = await ctx.contracts.BaseWallet.at(signer);
      const walletOwner = await wallet.owner();
      assert(signature.length > 0, "invalid WALLET signature");
      await verifySignature(ctx, walletOwner, message, signature.slice(0, -1));
    } catch {
      assert(false, "invalid WALLET signature");
    }
  } */else {
    assert(false, "invalid signature type");
  }
}

function verifyECDSA(message: Buffer, data: Bitstream, signer: string) {
  const r = data.extractBytes32(0);
  const s = data.extractBytes32(32);
  const v = data.extractUint8(64);
  try {
    const pub = ethUtil.ecrecover(message, v, r, s);
    const recoveredAddress = "0x" + ethUtil.pubToAddress(pub).toString("hex");
    return signer.toLowerCase() === recoveredAddress.toLowerCase();
  } catch {
    return false;
  }
}

function getPrivateKey(address: string) {
  const textData = fs.readFileSync("./ganache_account_keys.txt", "ascii");
  const data = JSON.parse(textData);
  const privateKey = data.private_keys[address.toLowerCase()];
  assert(privateKey !== undefined, "private key not found for: " + address);
  return privateKey;
}
