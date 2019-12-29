import { Bitstream } from "../util/Bitstream";
import ethUtil = require("ethereumjs-util");

export enum SignatureType {
  ILLEGAL,
  INVALID,
  EIP_712,
  ETH_SIGN,
  WALLET
}

export async function batchSign(
  privateKeys: string[],
  message: Buffer,
  type: SignatureType = SignatureType.EIP_712
) {
  let signatures: string[] = [];
  for (const privateKey of privateKeys) {
    signatures.push(await sign(privateKey, message, type));
  }
  return signatures;
}

export async function sign(
  privateKey: string,
  message: Buffer,
  type: SignatureType = SignatureType.EIP_712
) {
  let signature: string;
  switch (+type) {
    case SignatureType.ETH_SIGN:
      signature = await signEthereum(message, privateKey);
      break;
    case SignatureType.EIP_712:
      signature = await signEIP712(message, privateKey);
      break;
    default:
      throw Error("Unsupported signature type: " + +type);
  }
  // Append the type
  const data = new Bitstream(signature);
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

  try {
    const pub = ethUtil.ecrecover(
      message,
      signature.v,
      signature.r,
      signature.s
    );
    const recoveredAddress = "0x" + ethUtil.pubToAddress(pub).toString("hex");
    console.log("Recovered: " + recoveredAddress);
  } catch {
    return "0x";
  }

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
    verifySignature(signers[i], message, signatures[i]);
  }
}

function verifySignature(signer: string, message: Buffer, signature: string) {
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
