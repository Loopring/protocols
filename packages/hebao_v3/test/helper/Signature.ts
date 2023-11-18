import assert from 'assert'
import fs from 'fs'

import ethUtil = require('ethereumjs-util')

import { Bitstream } from './Bitstream'

export enum SignatureType {
  ILLEGAL,
  INVALID,
  EIP_712,
  ETH_SIGN,
  WALLET // deprecated
}

export function sign2 (
  signer: string,
  privateKey: string,
  rawMessage: string,
  type: SignatureType = SignatureType.EIP_712
) {
  const message = Buffer.from(rawMessage.slice(2), 'hex')
  let signature: string
  switch (+type) {
    case SignatureType.ETH_SIGN: {
      signature = appendType(signEthereum(message, privateKey), type)
      break
    }
    case SignatureType.EIP_712: {
      // console.log(`singer: ${signer}, privateKey: ${privateKey}`);
      signature = appendType(signEIP712(message, privateKey), type)
      break
    }
    default: {
      // console.log("Unsupported signature type: " + type);
      signature = appendType('', type)
    }
  }
  return signature
}

export function appendType (str: string, type: SignatureType) {
  const data = new Bitstream(str)
  data.addNumber(type, 1)
  return data.getData()
}

function signEthereum (message: Buffer, privateKey: string) {
  const parts = [
    Buffer.from('\x19Ethereum Signed Message:\n32', 'utf8'),
    message
  ]
  const totalHash = ethUtil.keccak(Buffer.concat(parts))
  const signature = ethUtil.ecsign(
    totalHash,
    Buffer.from(privateKey, 'hex')
  )

  const data = new Bitstream()
  data.addHex(ethUtil.bufferToHex(signature.r))
  data.addHex(ethUtil.bufferToHex(signature.s))
  data.addNumber(signature.v, 1)
  return data.getData()
}

function signEIP712 (message: Buffer, privateKey: string) {
  const signature = ethUtil.ecsign(
    message,
    Buffer.from(privateKey, 'hex')
  )

  const data = new Bitstream()
  data.addHex(ethUtil.bufferToHex(signature.r))
  data.addHex(ethUtil.bufferToHex(signature.s))
  data.addNumber(signature.v, 1)
  return data.getData()
}
