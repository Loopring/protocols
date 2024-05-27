import {
  ecsign,
  keccak256 as keccak256_buffer,
  toRpcSig
} from 'ethereumjs-util'
import { BigNumber, Contract, type Signer, type Wallet } from 'ethers'
import {
  arrayify,
  defaultAbiCoder,
  hexDataSlice,
  keccak256
} from 'ethers/lib/utils'

import { type EntryPoint } from '../../typechain-types'
import { Create2Factory } from '../helper/Create2Factory'

import { type UserOperation } from './UserOperation'
import { AddressZero, callDataCost, rethrow } from './testutils'

export function packUserOp(
  op: UserOperation,
  forSignature = true
): string {
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

export function packUserOp1(op: UserOperation): string {
  return defaultAbiCoder.encode(
    [
      'address', // sender
      'uint256', // nonce
      'bytes32', // initCode
      'bytes32', // callData
      'uint256', // callGasLimit
      'uint256', // verificationGasLimit
      'uint256', // preVerificationGas
      'uint256', // maxFeePerGas
      'uint256', // maxPriorityFeePerGas
      'bytes32' // paymasterAndData
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
}

export function getUserOpHash(
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
  sender: AddressZero,
  nonce: 0,
  initCode: '0x',
  callData: '0x',
  callGasLimit: 0,
  verificationGasLimit: 150000, // default verification gas. will add create2 cost (3200+200*length) if initCode exists
  preVerificationGas: 21000, // should also cover calldata cost.
  maxFeePerGas: 0,
  maxPriorityFeePerGas: 1e9,
  paymasterAndData: '0x',
  signature: '0x'
}

export function signUserOp(
  op: UserOperation,
  signer: Wallet,
  entryPoint: string,
  chainId: number
): UserOperation {
  const message = getUserOpHash(op, entryPoint, chainId)
  const msg1 = Buffer.concat([
    Buffer.from('\x19Ethereum Signed Message:\n32', 'ascii'),
    Buffer.from(arrayify(message))
  ])

  const sig = ecsign(
    keccak256_buffer(msg1),
    Buffer.from(arrayify(signer.privateKey))
  )
  // that's equivalent of:  await signer.signMessage(message);
  // (but without "async"
  const signedMessage1 = toRpcSig(sig.v, sig.r, sig.s)
  return {
    ...op,
    signature: signedMessage1
  }
}

export function fillUserOpDefaults(
  op: Partial<UserOperation>,
  defaults = DefaultsForUserOp
): UserOperation {
  const partial: any = { ...op }
  // we want "item:undefined" to be used from defaults, and not override defaults, so we must explicitly
  // remove those so "merge" will succeed.
  for (const key in partial) {
    if (partial[key] == null) {
      // eslint-disable-next-line
      delete partial[key]
    }
  }
  const filled = { ...defaults, ...partial }
  return filled
}

// helper to fill structure:
// - default callGasLimit to estimate call from entryPoint to account (TODO: add overhead)
// if there is initCode:
//  - calculate sender by eth_call the deployment code
//  - default verificationGasLimit estimateGas of deployment code plus default 100000
// no initCode:
//  - update nonce from account.getNonce()
// entryPoint param is only required to fill in "sender address when specifying "initCode"
// nonce: assume contract as "getNonce()" function, and fill in.
// sender - only in case of construction: fill sender from initCode.
// callGasLimit: VERY crude estimation (by estimating call to account, and add rough entryPoint overhead
// verificationGasLimit: hard-code default at 100k. should add "create2" cost
export async function fillUserOp(
  op: Partial<UserOperation>,
  entryPoint?: EntryPoint,
  getNonceFunction = 'getNonce'
): Promise<UserOperation> {
  const op1 = { ...op }
  const provider = entryPoint?.provider
  if (op.initCode != null) {
    const initAddr = hexDataSlice(op1.initCode!, 0, 20)
    const initCallData = hexDataSlice(op1.initCode!, 20)
    if (op1.nonce == null) op1.nonce = 0
    if (op1.sender == null) {
      // hack: if the init contract is our known deployer, then we know what the address would be, without a view call
      if (
        initAddr.toLowerCase() ===
        Create2Factory.contractAddress.toLowerCase()
      ) {
        const ctr = hexDataSlice(initCallData, 32)
        const salt = hexDataSlice(initCallData, 0, 32)
        op1.sender = Create2Factory.getDeployedAddress(ctr, salt)
      } else {
        // console.log('\t== not our deployer. our=', Create2Factory.contractAddress, 'got', initAddr)
        if (provider == null) {
          throw new Error('no entrypoint/provider')
        }
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
    if (provider == null) {
      throw new Error('must have entryPoint to autofill nonce')
    }
    const c = new Contract(
      op.sender!,
      [`function ${getNonceFunction}() view returns(uint256)`],
      provider
    )
    op1.nonce = await c[getNonceFunction]().catch(rethrow())
  }
  if (op1.callGasLimit == null && op.callData != null) {
    if (provider == null) {
      throw new Error(
        'must have entryPoint for callGasLimit estimate'
      )
    }
    const gasEtimated = await provider.estimateGas({
      from: entryPoint?.address,
      to: op1.sender,
      data: op1.callData
    })

    // console.log('estim', op1.sender,'len=', op1.callData!.length, 'res=', gasEtimated)
    // estimateGas assumes direct call from entryPoint. add wrapper cost.
    op1.callGasLimit = gasEtimated // .add(55000)
  }
  if (op1.maxFeePerGas == null) {
    if (provider == null) {
      throw new Error('must have entryPoint to autofill maxFeePerGas')
    }
    const block = await provider.getBlock('latest')
    op1.maxFeePerGas = block.baseFeePerGas!.add(
      op1.maxPriorityFeePerGas ??
        DefaultsForUserOp.maxPriorityFeePerGas
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

export async function fillAndSign(
  op: Partial<UserOperation>,
  signer: Wallet | Signer,
  entryPoint?: EntryPoint,
  getNonceFunction = 'getNonce'
): Promise<UserOperation> {
  const provider = entryPoint?.provider
  const op2 = await fillUserOp(op, entryPoint, getNonceFunction)

  const chainId = await provider!
    .getNetwork()
    .then((net) => net.chainId)
  const message = arrayify(
    getUserOpHash(op2, entryPoint!.address, chainId)
  )

  return {
    ...op2,
    signature: await signer.signMessage(message)
  }
}
