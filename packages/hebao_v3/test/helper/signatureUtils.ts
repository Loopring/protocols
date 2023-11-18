import { ethers, BigNumberish } from 'ethers'

import { sign2 } from './Signature'
import * as eip712 from './eip712'

function encodeAddressesPacked (addrs: string[]) {
  const addrsBs = Buffer.concat(
    addrs.map((a) => Buffer.from('00'.repeat(12) + a.slice(2), 'hex'))
  )
  return addrsBs
}

export function signCreateWallet (
  moduleAddress: string,
  owner: string,
  guardians: string[],
  quota: BigNumberish,
  inheritor: string,
  feeRecipient: string,
  feeToken: string,
  maxFeeAmount: BigNumberish,
  salt: BigNumberish,
  privateKey: string,
  chainId: number
) {
  const domainSeprator = eip712.hash(
    'WalletFactory',
    '2.0.0',
    moduleAddress,
    chainId
  )

  const TYPE_STR =
    'createWallet(address owner,address[] guardians,uint256 quota,address inheritor,address feeRecipient,address feeToken,uint256 maxFeeAmount,uint256 salt)'
  const CREATE_WALLET_TYPEHASH = ethers.utils.solidityKeccak256(
    ['string'],
    [TYPE_STR]
  )

  const guardiansHash = ethers.utils.solidityKeccak256(
    ['address[]'],
    [guardians]
  )

  const encodedRequest = ethers.utils.defaultAbiCoder.encode(
    [
      'bytes32',
      'address',
      'bytes32',
      'uint256',
      'address',
      'address',
      'address',
      'uint256',
      'uint256'
    ],
    [
      CREATE_WALLET_TYPEHASH,
      owner,
      guardiansHash,
      quota,
      inheritor,
      feeRecipient,
      feeToken,
      maxFeeAmount,
      salt
    ]
  )

  const hash = eip712.hashPacked(domainSeprator, encodedRequest)
  const txSignature = sign2(owner, privateKey, hash)
  return { txSignature, hash }
}
