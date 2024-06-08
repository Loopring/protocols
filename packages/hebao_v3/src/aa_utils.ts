import {
  type Event,
  type ContractReceipt
} from '@ethersproject/contracts'
import { type BytesLike } from '@ethersproject/bytes'
import _ from 'lodash'
import {
  type ApprovalOption,
  signTypedData
} from 'src/LoopringGuardianAPI'
import {
  type Deferrable,
  resolveProperties
} from '@ethersproject/properties'
import {
  type TransactionReceipt,
  type TransactionRequest
} from '@ethersproject/providers'
import {
  Contract,
  BigNumber,
  type BigNumberish,
  type Signer,
  type Wallet,
  constants,
  ethers
} from 'ethers'
import {
  arrayify,
  defaultAbiCoder,
  hexConcat,
  keccak256,
  getCreate2Address,
  hexDataSlice
} from 'ethers/lib/utils'

// import { signCreateWallet } from './signatureUtils'
import type * as typ from './solidityTypes'

export type SendUserOp = (
  userOp: UserOperation
) => Promise<ContractReceipt>

export interface WalletConfig {
  accountOwner: typ.address
  guardians: typ.address[]
  quota: typ.uint
  inheritor: typ.address
}

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

export function callDataCost(data: string): number {
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
export async function fillUserOp(
  op: Partial<UserOperation>,
  walletFactoryAddress: string,
  entryPoint?: Contract
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
        initAddr.toLowerCase() === walletFactoryAddress.toLowerCase()
      ) {
        const ctr = hexDataSlice(initCallData, 32)
        const salt = hexDataSlice(initCallData, 0, 32)
        op1.sender = getCreate2Address(
          walletFactoryAddress,
          salt,
          ctr
        )
      } else {
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
      ['function getNonce() view returns(uint256)'],
      provider
    )
    op1.nonce = await c.getNonce()
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

    // estimateGas assumes direct call from entryPoint. add wrapper cost.
    op1.callGasLimit = gasEtimated.add(55000)
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
  walletFactoryAddress: string,
  entryPoint?: Contract
): Promise<UserOperation> {
  const provider = entryPoint?.provider
  const op2 = await fillUserOp(op, walletFactoryAddress, entryPoint)
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

function getPaymasterHash(userOp: UserOperation): string {
  return keccak256(
    defaultAbiCoder.encode(
      [
        'address',
        'uint256',
        'bytes32',
        'bytes32',
        'uint256',
        'uint256',
        'uint256',
        'uint256',
        'uint256'
      ],
      [
        userOp.sender,
        userOp.nonce,
        keccak256(userOp.initCode),
        keccak256(userOp.callData),
        userOp.callGasLimit,
        userOp.verificationGasLimit,
        userOp.preVerificationGas,
        userOp.maxFeePerGas,
        userOp.maxPriorityFeePerGas
      ]
    )
  )
}

export async function getPaymasterData(
  userOp: UserOperation,
  payMasterAddress: string,
  paymasterOwner: Signer,
  token: string,
  valueOfEth: BigNumberish
): Promise<string> {
  const message = arrayify(getPaymasterHash(userOp))
  const signature = await paymasterOwner.signMessage(message)

  const enc =
    payMasterAddress.toLowerCase() +
    defaultAbiCoder
      .encode(
        ['address', 'uint256', 'bytes'],
        [token, valueOfEth, signature]
      )
      .substring(2)
  return enc
}

export async function getPaymasterAndData(
  payMasterAddress: string,
  paymasterOwner: Signer,
  hash: string,
  usdcToken: string,
  valueOfEth: BigNumberish,
  validUntil: BigNumberish
): Promise<string> {
  const sig = await paymasterOwner.signMessage(arrayify(hash))
  const paymasterCalldata = ethers.utils.defaultAbiCoder.encode(
    ['address', 'uint48', 'uint256', 'bytes'],
    [usdcToken, validUntil, valueOfEth, sig]
  )
  return hexConcat([payMasterAddress, paymasterCalldata])
}

/**
 * process exception of ValidationResult
 * usage: entryPoint.simulationResult(..).catch(simulationResultCatch)
 */
export function simulationResultCatch(e: any): any {
  if (e.errorName !== 'ValidationResult') {
    throw e
  }
  return e.errorArgs
}

export async function evInfo(
  entryPoint: Contract,
  rcpt: TransactionReceipt
): Promise<
  Array<{
    nonce: BigNumber
    gasUsed: BigNumber
    actualGasCost: BigNumber
    actualGasUsed: BigNumber
  }>
> {
  // TODO: checking only latest block...
  const block = rcpt.blockNumber
  const ev = await entryPoint.queryFilter(
    entryPoint.filters.UserOperationEvent(),
    block
  )
  // if (ev.length === 0) return {}
  return ev.map((event) => {
    const { nonce, actualGasUsed, actualGasCost } = event.args!
    return {
      nonce,
      gasUsed: rcpt.gasUsed,
      actualGasUsed,
      actualGasCost
    }
  })
}

export async function evRevertInfo(
  entryPoint: Contract,
  rcpt: TransactionReceipt
): Promise<
  Array<{
    nonce: BigNumber
    gasUsed: BigNumber
    revertReason: string
  }>
> {
  // TODO: checking only latest block...
  const block = rcpt.blockNumber
  const ev = await entryPoint.queryFilter(
    entryPoint.filters.UserOperationRevertReason(),
    block
  )
  // if (ev.length === 0) return {}
  return ev.map((event) => {
    const { nonce, revertReason } = event.args!
    return {
      nonce,
      gasUsed: rcpt.gasUsed,
      revertReason
    }
  })
}

export function computeRequiredPreFund(
  userOp: UserOperation,
  usePaymaster = false
): BigNumber {
  // get required fund
  const requiredGas = BigNumber.from(userOp.verificationGasLimit)
    .mul(usePaymaster ? 3 : 1)
    .add(userOp.callGasLimit)
    .add(userOp.preVerificationGas)

  const requiredPrefund = requiredGas.mul(userOp.maxFeePerGas)
  return requiredPrefund
}

// export async function createSmartWallet(
// owner: Wallet,
// guardians: string[],
// walletFactory: WalletFactory,
// salt: string
// ): Promise<ContractReceipt> {
// const feeRecipient = ethers.constants.AddressZero
// const { chainId } = await ethers.provider.getNetwork()
// // create smart wallet
// const signature = await signCreateWallet(
// walletFactory.address,
// owner,
// guardians,
// BigNumber.from(0),
// ethers.constants.AddressZero,
// feeRecipient,
// ethers.constants.AddressZero,
// BigNumber.from(0),
// salt,
// chainId
// )

// const walletConfig: any = {
// owner: owner.address,
// guardians,
// quota: 0,
// inheritor: ethers.constants.AddressZero,
// feeRecipient,
// feeToken: ethers.constants.AddressZero,
// maxFeeAmount: 0,
// salt,
// signature
// }

// const tx = await walletFactory.createWallet(walletConfig, 0)
// return tx.wait()
// }

export interface PaymasterOption {
  paymaster: Contract
  payToken: Contract
  paymasterOwner: Signer
  valueOfEth: BigNumberish
  validUntil: BigNumberish
}

export async function generateSignedUserOp(
  txs: Array<Deferrable<TransactionRequest>>,
  smartWallet: Contract,
  smartWalletOwner: Signer,
  walletFactoryAddr: string,
  entrypoint: Contract,
  paymasterOption?: PaymasterOption,
  useExecuteApi = true
): Promise<UserOperation> {
  const partialUserOp = await createBatchTransactions(
    txs,
    smartWallet,
    useExecuteApi // wrap raw calldata with callcontract api
  )
  // first call to fill userop
  let signedUserOp = await fillAndSign(
    partialUserOp,
    smartWalletOwner,
    walletFactoryAddr,
    entrypoint
  )

  // handle paymaster
  if (paymasterOption != null) {
    const paymaster = paymasterOption.paymaster
    const payToken = paymasterOption.payToken
    const valueOfEth = paymasterOption.valueOfEth
    const validUntil = paymasterOption.validUntil

    const hash = await paymaster.getHash(
      signedUserOp,
      ethers.utils.solidityKeccak256(
        ['address', 'uint48', 'uint256'],
        [payToken.address, validUntil, valueOfEth]
      )
    )

    const paymasterAndData = await getPaymasterAndData(
      paymaster.address,
      paymasterOption.paymasterOwner,
      hash,
      payToken.address,
      valueOfEth,
      validUntil
    )
    signedUserOp.paymasterAndData = paymasterAndData
    signedUserOp = await fillAndSign(
      signedUserOp,
      smartWalletOwner,
      walletFactoryAddr,
      entrypoint
    )
  }

  return signedUserOp
}

export async function sendTx(
  txs: Array<Deferrable<TransactionRequest>>,
  smartWallet: Contract,
  smartWalletOwner: Signer,
  contractFactory: Contract,
  entrypoint: Contract,
  sendUserOp: SendUserOp,
  paymasterOption?: PaymasterOption,
  useExecuteApi = true
): Promise<ContractReceipt> {
  const signedUserOp = await generateSignedUserOp(
    txs,
    smartWallet,
    smartWalletOwner,
    contractFactory,
    entrypoint,
    paymasterOption,
    useExecuteApi
  )

  // get details if throw error
  await entrypoint.callStatic
    .simulateValidation(signedUserOp)
    .catch(simulationResultCatch)
  const receipt = await sendUserOp(signedUserOp)
  return receipt
}

export async function createBatchTransactions(
  transactions: Array<Deferrable<TransactionRequest>>,
  wallet: Contract,
  useExecuteApi: boolean,
  initCode?: BytesLike
): Promise<Partial<UserOperation>> {
  const txs: TransactionRequest[] = await Promise.all(
    transactions.map(async (tx) => resolveProperties(tx))
  )

  let execFromEntryPoint
  if (txs.length === 1) {
    const tx = txs[0]
    if (useExecuteApi) {
      execFromEntryPoint =
        await wallet.populateTransaction.callContract(
          tx.to!,
          tx.value ?? 0,
          tx.data ?? '0x',
          false
        )
    } else {
      execFromEntryPoint = tx
    }
  } else {
    let datas: BytesLike[] = txs.map((tx) => tx.data ?? '0x')

    if (useExecuteApi) {
      const wrappedTxs = await Promise.all(
        txs.map(async (tx) =>
          wallet.populateTransaction.callContract(
            tx.to!,
            tx.value ?? 0,
            tx.data ?? '0x',
            false
          )
        )
      )
      datas = wrappedTxs.map((wtx) => wtx.data!)
    } else {
      datas = txs.map((tx) => tx.data ?? '0x')
    }
    execFromEntryPoint =
      await wallet.populateTransaction.selfBatchCall(datas)
  }

  let { gasPrice, maxPriorityFeePerGas, maxFeePerGas } =
    execFromEntryPoint
  // gasPrice is legacy, and overrides eip1559 values:

  if (gasPrice !== undefined) {
    maxPriorityFeePerGas = gasPrice
    maxFeePerGas = gasPrice
  }
  const nonce = await wallet.getNonce()
  return {
    sender: wallet.address,
    initCode,
    nonce,
    callData: execFromEntryPoint.data!,
    callGasLimit: execFromEntryPoint.gasLimit,
    maxPriorityFeePerGas,
    maxFeePerGas
  }
}

// eslint-disable-next-line
export function getErrorMessage(revertReason: string) {
  return ethers.utils.defaultAbiCoder.decode(
    ['string'],
    '0x' + revertReason.slice(10)
  )[0]
}

export async function getFirstEvent(
  contract: Contract,
  fromBlock: number,
  eventName: string
): Promise<Event> {
  const events = await contract.queryFilter(
    { address: contract.address },
    fromBlock
  )

  for (const e of events) {
    if (e.event === eventName) return e
  }

  throw new Error()
}

export async function fillAndMultiSign(
  callData: string,
  smartWallet: Contract,
  smartWalletOwner: Wallet,
  smartWalletOrEOASigners: Array<{
    signer: Wallet
    smartWalletAddress?: string
  }>,
  walletFactoryAddress: string,
  verifyingContract: string,
  approvalOption: ApprovalOption,
  entryPoint?: Contract,
  option?: Partial<{
    nonce: BigNumberish
    callGasLimit: BigNumberish
    preVerificationGas: BigNumberish
  }>
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
  const chainId = await provider!
    .getNetwork()
    .then((net) => net.chainId)
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
        await signTypedData(
          calldata,
          g.signer,
          approvalOption,
          domain,
          {
            wallet: smartWallet.address,
            validUntil: approvalOption.validUntil
            // salt: approvalOption.salt
          }
        )
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
    validUntil: approvalOption.validUntil
    // salt: approvalOption.salt
  }
  const ownerSignature = await smartWalletOwner.signMessage(
    arrayify(userOpHash)
  )
  const signature = ethers.utils.defaultAbiCoder.encode(
    [
      'tuple(address[] signers,bytes[] signatures,uint256 validUntil)',
      'bytes'
    ],
    [approval, ownerSignature]
  )
  return {
    ...op2,
    signature
  }
}

/**
 * hexlify all members of object, recursively
 * @param obj
 */
export function deepHexlify(obj: any): any {
  if (typeof obj === 'function') {
    return undefined
  }
  if (
    obj == null ||
    typeof obj === 'string' ||
    typeof obj === 'boolean'
  ) {
    return obj
  } else if (obj._isBigNumber != null || typeof obj !== 'object') {
    return ethers.utils.hexlify(obj).replace(/^0x0/, '0x')
  }
  if (Array.isArray(obj)) {
    return obj.map((member) => deepHexlify(member))
  }
  return Object.keys(obj).reduce(
    (set, key) => ({
      ...set,
      [key]: deepHexlify(obj[key])
    }),
    {}
  )
}
