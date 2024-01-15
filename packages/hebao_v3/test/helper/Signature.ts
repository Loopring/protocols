import { Bitstream } from "./Bitstream";
import ethUtil = require("ethereumjs-util");
import fs = require("fs");
const assert = require("assert");

export enum SignatureType {
  ILLEGAL,
  INVALID,
  EIP_712,
  ETH_SIGN,
  WALLET, // deprecated
}

export function batchSign(
  signers: string[],
  message: Buffer,
  types: SignatureType[]
) {
  assert(types.length >= signers.length, "invalid input arrays");
  let signatures: string[] = [];
  for (const [i, signer] of signers.entries()) {
    signatures.push(sign(signer, message, types[i]));
  }
  return signatures;
}

export function sign(
  signer: string,
  message: Buffer,
  type: SignatureType = SignatureType.EIP_712
) {
  const privateKey = getPrivateKey(signer);
  return sign2(signer, privateKey, message, type);
}

export function sign2(
  signer: string,
  privateKey: string,
  message: Buffer,
  type: SignatureType = SignatureType.EIP_712
) {
  let signature: string;
  switch (+type) {
    case SignatureType.ETH_SIGN: {
      signature = appendType(signEthereum(message, privateKey), type);
      break;
    }
    case SignatureType.EIP_712: {
      // console.log(`singer: ${signer}, privateKey: ${privateKey}`);
      signature = appendType(signEIP712(message, privateKey), type);
      break;
    }
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

function signEthereum(message: Buffer, privateKey: string) {
  const parts = [
    Buffer.from("\x19Ethereum Signed Message:\n32", "utf8"),
    message,
  ];
  const totalHash = ethUtil.keccak(Buffer.concat(parts));
  const signature = ethUtil.ecsign(totalHash, Buffer.from(privateKey, "hex"));

  const data = new Bitstream();
  data.addHex(ethUtil.bufferToHex(signature.r));
  data.addHex(ethUtil.bufferToHex(signature.s));
  data.addNumber(signature.v, 1);
  return data.getData();
}

function signEIP712(message: Buffer, privateKey: string) {
  const signature = ethUtil.ecsign(message, Buffer.from(privateKey, "hex"));

  const data = new Bitstream();
  data.addHex(ethUtil.bufferToHex(signature.r));
  data.addHex(ethUtil.bufferToHex(signature.s));
  data.addNumber(signature.v, 1);
  return data.getData();
}

export function verifySignatures(
  signers: string[],
  message: Buffer,
  signatures: string[]
) {
  assert(signers.length == signatures.length, "invalid input");
  for (let i = 0; i < signatures.length; i++) {
    verifySignature(signers[i], message, signatures[i]);
  }
}

export function verifySignature(
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
  } else {
    assert(false, "invalid signature type");
  }
}

export function recoverECDSA(message: Buffer, signature: string) {
  const data = new Bitstream(signature);
  const r = data.extractBytes32(0);
  const s = data.extractBytes32(32);
  const v = data.extractUint8(64);
  try {
    const pub = ethUtil.ecrecover(message, v, r, s);
    const recoveredAddress = "0x" + ethUtil.pubToAddress(pub).toString("hex");
    return recoveredAddress;
  } catch (err) {
    console.error(err);
    return "0x" + "00".repeat(20);
  }
}

function verifyECDSA(message: Buffer, data: Bitstream, signer: string) {
  const r = data.extractBytes32(0);
  const s = data.extractBytes32(32);
  const v = data.extractUint8(64);
  try {
    const pub = ethUtil.ecrecover(message, v, r, s);
    const recoveredAddress = "0x" + ethUtil.pubToAddress(pub).toString("hex");
    console.log("recovered address:", recoveredAddress);
    return signer.toLowerCase() === recoveredAddress.toLowerCase();
  } catch {
    return false;
  }
}

function getPrivateKey(address: string) {
  const textData = fs.readFileSync("./test_account_keys.json", "ascii");
  const data = JSON.parse(textData);
  return data.private_keys[String(address).toLowerCase()];
}
