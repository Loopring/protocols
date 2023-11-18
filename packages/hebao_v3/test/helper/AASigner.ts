import { ContractReceipt } from '@ethersproject/contracts'
import {
  BigNumber,
  BigNumberish,
  constants,
  Contract,
  Signer,
  Wallet
} from 'ethers'
import {
  arrayify,
  defaultAbiCoder,
  getCreate2Address,
  hexDataSlice,
  keccak256
} from 'ethers/lib/utils'
import { ethers } from 'hardhat'
import _ from 'lodash'

import {
  EntryPoint,
  EntryPoint__factory,
  SmartWallet
} from '../../typechain-types'

import { ApprovalOption, signTypedData } from './LoopringGuardianAPI'
import * as typ from './solidityTypes'

export const HashZero = ethers.constants.HashZero

export interface UserOperation {
  sender: typ.address
  nonce: typ.uint256
  initCode: typ.bytes
  callData: typ.bytes
  callGasLimit: typ.uint256
  verificationGasLimit: typ.uint256
  preVerificationGas: typ.uint256
  maxFeePerGas: typ.uint256
  maxPriorityFeePerGas: typ.uint256
  paymasterAndData: typ.bytes
  signature: typ.bytes
}
export function packUserOp (op: UserOperation, forSignature = true): string {
  if (forSignature) {
    return defaultAbiCoder.encode(
      [
        'address',
        'uint256',
        'bytes32',
        'bytes32',
        'uint256',
        'uint256',
        'uint256',
        'uint256',
        'uint256',
        'bytes32'
      ],
      [
        op.sender,
        op.nonce,
        keccak256(op.initCode),
        keccak256(op.callData),
        op.callGasLimit,
        op.verificationGasLimit,
        op.preVerificationGas,
        op.maxFeePerGas,
        op.maxPriorityFeePerGas,
        keccak256(op.paymasterAndData)
      ]
    )
  } else {
    // for the purpose of calculating gas cost encode also signature (and no keccak of bytes)
    return defaultAbiCoder.encode(
      [
        'address',
        'uint256',
        'bytes',
        'bytes',
        'uint256',
        'uint256',
        'uint256',
        'uint256',
        'uint256',
        'bytes',
        'bytes'
      ],
      [
        op.sender,
        op.nonce,
        op.initCode,
        op.callData,
        op.callGasLimit,
        op.verificationGasLimit,
        op.preVerificationGas,
        op.maxFeePerGas,
        op.maxPriorityFeePerGas,
        op.paymasterAndData,
        op.signature
      ]
    )
  }
}

export function getUserOpHash (
  op: UserOperation,
  entryPoint: string,
  chainId: number
): string {
  const userOpHash = keccak256(packUserOp(op, true))
  const enc = defaultAbiCoder.encode(
    ['bytes32', 'address', 'uint256'],
    [userOpHash, entryPoint, chainId]
  )
  return keccak256(enc)
}

export const DefaultsForUserOp: UserOperation = {
  sender: constants.AddressZero,
  nonce: 0,
  initCode: '0x',
  callData: '0x',
  callGasLimit: 0,
  verificationGasLimit: 200000, // default verification gas. will add create2 cost (3200+200*length) if initCode exists
  preVerificationGas: 21000, // should also cover calldata cost.
  maxFeePerGas: 0,
  maxPriorityFeePerGas: 1e9,
  paymasterAndData: '0x',
  signature: '0x'
}

export function fillUserOpDefaults (
  op: Partial<UserOperation>,
  defaults = DefaultsForUserOp
): UserOperation {
  const partial: any = { ...op }
  // we want "item:undefined" to be used from defaults, and not override defaults, so we must explicitly
  // remove those so "merge" will succeed.
  for (const key in partial) {
    if (partial[key] == null) {
      delete partial[key]
    }
  }
  const filled = { ...defaults, ...partial }
  return filled
}

export function callDataCost (data: string): number {
  return ethers.utils
    .arrayify(data)
    .map((x) => (x === 0 ? 4 : 16))
    .reduce((sum, x) => sum + x)
}

// helper to fill structure:
// - default callGasLimit to estimate call from entryPoint to account (TODO: add overhead)
// if there is initCode:
//  - calculate sender by eth_call the deployment code
//  - default verificationGasLimit estimateGas of deployment code plus default 100000
// no initCode:
//  - update nonce from account.nonce()
// entryPoint param is only required to fill in "sender address when specifying "initCode"
// nonce: assume contract as "nonce()" function, and fill in.
// sender - only in case of construction: fill sender from initCode.
// callGasLimit: VERY crude estimation (by estimating call to account, and add rough entryPoint overhead
// verificationGasLimit: hard-code default at 100k. should add "create2" cost
export async function fillUserOp (
  op: Partial<UserOperation>,
  walletFactoryAddress: string,
  entryPoint?: EntryPoint
): Promise<UserOperation> {
  const op1 = { ...op }
  const provider = entryPoint?.provider
  if (op.initCode != null) {
    const initAddr = hexDataSlice(op1.initCode!, 0, 20)
    const initCallData = hexDataSlice(op1.initCode!, 20)
    if (op1.nonce == null) op1.nonce = 0
    if (op1.sender == null) {
      // hack: if the init contract is our known deployer, then we know what the address would be, without a view call
      if (initAddr.toLowerCase() === walletFactoryAddress.toLowerCase()) {
        const ctr = hexDataSlice(initCallData, 32)
        const salt = hexDataSlice(initCallData, 0, 32)
        op1.sender = getCreate2Address(walletFactoryAddress, salt, ctr)
      } else {
        if (provider == null) throw new Error('no entrypoint/provider')
        op1.sender = await entryPoint!.callStatic
          .getSenderAddress(op1.initCode!)
          .catch((e) => e.errorArgs.sender)
      }
    }
    if (op1.verificationGasLimit == null) {
      if (provider == null) throw new Error('no entrypoint/provider')
      const initEstimate = await provider.estimateGas({
        from: entryPoint?.address,
        to: initAddr,
        data: initCallData,
        gasLimit: 10e6
      })
      op1.verificationGasLimit = BigNumber.from(
        DefaultsForUserOp.verificationGasLimit
      ).add(initEstimate)
    }
  }
  if (op1.nonce == null) {
    if (provider == null) { throw new Error('must have entryPoint to autofill nonce') }
    const c = new Contract(
      op.sender!,
      ['function getNonce() view returns(uint256)'],
      provider
    )
    op1.nonce = await c.getNonce()
  }
  if (op1.callGasLimit == null && op.callData != null) {
    if (provider == null) { throw new Error('must have entryPoint for callGasLimit estimate') }
    const gasEtimated = await provider.estimateGas({
      from: entryPoint?.address,
      to: op1.sender,
      data: op1.callData
    })

    // estimateGas assumes direct call from entryPoint. add wrapper cost.
    op1.callGasLimit = gasEtimated.add(55000)
  }
  if (op1.maxFeePerGas == null) {
    if (provider == null) { throw new Error('must have entryPoint to autofill maxFeePerGas') }
    const block = await provider.getBlock('latest')
    op1.maxFeePerGas = block.baseFeePerGas!.add(
      op1.maxPriorityFeePerGas ?? DefaultsForUserOp.maxPriorityFeePerGas
    )
  }
  // TODO: this is exactly what fillUserOp below should do - but it doesn't.
  // adding this manually
  if (op1.maxPriorityFeePerGas == null) {
    op1.maxPriorityFeePerGas = DefaultsForUserOp.maxPriorityFeePerGas
  }
  const op2 = fillUserOpDefaults(op1)

  if (BigNumber.from(op2.preVerificationGas).eq(0)) {
    // TODO: we don't add overhead, which is ~21000 for a single TX, but much lower in a batch.
    op2.preVerificationGas = callDataCost(packUserOp(op2, false))
  }
  return op2
}

export async function fillAndMultiSign (
  callData: string,
  smartWallet: SmartWallet,
  smartWalletOwner: Wallet,
  smartWalletOrEOASigners: Array<{ signer: Wallet, smartWalletAddress?: string }>,
  walletFactoryAddress: string,
  verifyingContract: string,
  approvalOption: ApprovalOption,
  entryPoint?: EntryPoint,
  option?: Partial<{ nonce: BigNumberish, callGasLimit: BigNumberish }>
): Promise<UserOperation> {
  const provider = entryPoint?.provider
  const nonce = await smartWallet.getNonce()
  const op = {
    sender: smartWallet.address,
    nonce,
    callData,
    ...option
  }
  const op2 = await fillUserOp(op, walletFactoryAddress, entryPoint)
  const chainId = await provider!.getNetwork().then((net) => net.chainId)
  const userOpHash = getUserOpHash(op2, entryPoint!.address, chainId)
  const calldata = ethers.utils.hexDataSlice(op.callData, 4)
  const domain = {
    name: 'LoopringWallet',
    version: '2.0.0',
    chainId,
    verifyingContract
  }

  const signatures = await Promise.all(
    smartWalletOrEOASigners.map(
      async (g) =>
        await signTypedData(calldata, g.signer, approvalOption, domain, {
          wallet: smartWallet.address,
          validUntil: approvalOption.validUntil,
          salt: approvalOption.salt
        })
    )
  )
  const [sortedSigners, sortedSignatures] = _.unzip(
    _.sortBy(
      _.zip(
        smartWalletOrEOASigners.map((g) =>
          g.smartWalletAddress !== undefined
            ? g.smartWalletAddress.toLowerCase()
            : g.signer.address.toLowerCase()
        ),
        signatures
      ),
      (item) => item[0]
    )
  )

  const approval = {
    signers: sortedSigners,
    signatures: sortedSignatures,
    validUntil: approvalOption.validUntil,
    salt: approvalOption.salt
  }
  const ownerSignature = await smartWalletOwner.signMessage(
    arrayify(userOpHash)
  )
  const signature = ethers.utils.defaultAbiCoder.encode(
    [
      'tuple(address[] signers,bytes[] signatures,uint256 validUntil,bytes32 salt)',
      'bytes'
    ],
    [approval, ownerSignature]
  )
  return {
    ...op2,
    signature
  }
}

export async function fillAndSign (
  op: Partial<UserOperation>,
  signer: Wallet | Signer,
  walletFactoryAddress: string,
  entryPoint?: EntryPoint
): Promise<UserOperation> {
  const provider = entryPoint?.provider
  const op2 = await fillUserOp(op, walletFactoryAddress, entryPoint)
  const chainId = await provider!.getNetwork().then((net) => net.chainId)
  const message = arrayify(getUserOpHash(op2, entryPoint!.address, chainId))

  return {
    ...op2,
    signature: await signer.signMessage(message)
  }
}

export type SendUserOp = (userOp: UserOperation) => Promise<ContractReceipt>

/**
 * send UserOp using handleOps, but locally.
 * for testing: instead of connecting through RPC to a remote host, directly send the transaction
 * @param entryPointAddress the entryPoint address to use.
 * @param signer ethers provider to send the request (must have eth balance to send)
 * @param beneficiary the account to receive the payment (from account/paymaster). defaults to the signer's address
 */
export function localUserOpSender (
  entryPointAddress: string,
  signer: Signer,
  beneficiary?: string
): SendUserOp {
  const entryPoint = EntryPoint__factory.connect(entryPointAddress, signer)
  return async function (userOp) {
    const gasLimit = BigNumber.from(userOp.preVerificationGas)
      .add(userOp.verificationGasLimit)
      .add(userOp.callGasLimit)
    // TODO(handle gasLimit)
    gasLimit
    const ret = await entryPoint.handleOps(
      [userOp],
      beneficiary ?? (await signer.getAddress()),
      {
        maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
        maxFeePerGas: userOp.maxFeePerGas
      }
    )
    const recipt = await ret.wait()
    return recipt
  }
}
