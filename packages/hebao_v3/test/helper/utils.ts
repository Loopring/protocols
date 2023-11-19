import {
  type Event,
  type ContractReceipt
} from '@ethersproject/contracts'
import { type BytesLike } from '@ethersproject/bytes'
import {
  type Deferrable,
  resolveProperties
} from '@ethersproject/properties'
import {
  type BaseProvider,
  type TransactionReceipt,
  type TransactionRequest
} from '@ethersproject/providers'
import {
  type Contract,
  BigNumber,
  type BigNumberish,
  type Signer,
  type Wallet
} from 'ethers'
import {
  arrayify,
  defaultAbiCoder,
  hexConcat,
  keccak256
} from 'ethers/lib/utils'
import { ethers } from 'hardhat'
import * as hre from 'hardhat'

import {
  type EntryPoint,
  type LoopringCreate2Deployer,
  type LoopringPaymaster,
  type SmartWalletV3,
  type WalletFactory
} from '../../typechain-types'

import {
  fillAndSign,
  type SendUserOp,
  type UserOperation
} from './AASigner'
import { signCreateWallet } from './signatureUtils'
import type * as typ from './solidityTypes'

export interface WalletConfig {
  accountOwner: typ.address
  guardians: typ.address[]
  quota: typ.uint
  inheritor: typ.address
}

function getPaymasterHash (userOp: UserOperation): string {
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

export async function getPaymasterData (
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

export async function getPaymasterAndData (
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
export function simulationResultCatch (e: any): any {
  if (e.errorName !== 'ValidationResult') {
    throw e
  }
  return e.errorArgs
}

export async function evInfo (
  entryPoint: EntryPoint,
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
    const { nonce, actualGasUsed, actualGasCost } = event.args
    return {
      nonce,
      gasUsed: rcpt.gasUsed,
      actualGasUsed,
      actualGasCost
    }
  })
}

export async function evRevertInfo (
  entryPoint: EntryPoint,
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
    const { nonce, revertReason } = event.args
    return {
      nonce,
      gasUsed: rcpt.gasUsed,
      revertReason
    }
  })
}

export function computeRequiredPreFund (
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

export async function deploySingle (
  deployFactory: Contract,
  contractName: string,
  args?: any[],
  libs?: Map<string, any>,
  print = false
): Promise<Contract> {
  // use same salt for all deployments:
  const salt = ethers.utils.formatBytes32String('0x5')

  const libraries: Record<string, string> = {}
  libs?.forEach((value, key) => (libraries[key] = value))

  const contract = await ethers.getContractFactory(contractName, {
    libraries
  })

  let deployableCode = contract.bytecode
  if (args != null && args.length > 0) {
    deployableCode = ethers.utils.hexConcat([
      deployableCode,
      contract.interface.encodeDeploy(args)
    ])
  }

  const deployedAddress = ethers.utils.getCreate2Address(
    deployFactory.address,
    salt,
    ethers.utils.keccak256(deployableCode)
  )
  // check if it is deployed already
  if ((await ethers.provider.getCode(deployedAddress)) !== '0x') {
    console.log(
      contractName,
      ' is deployed already at: ',
      deployedAddress
    )
  } else {
    const gasLimit = await deployFactory.estimateGas.deploy(
      deployableCode,
      salt
    )
    const tx = await deployFactory.deploy(deployableCode, salt, {
      gasLimit
    })
    await tx.wait()
    console.log(contractName, 'deployed address: ', deployedAddress)
  }

  if (
    hre.network.name === 'goerli' ||
    hre.network.name === 'sepolia' ||
    hre.network.name === 'ethereum'
  ) {
    await hre.run('verify:verify', {
      address: deployedAddress,
      constructorArguments: args,
      libraries
    })
  }

  return contract.attach(deployedAddress)
}

export async function deployWalletImpl (
  deployFactory: LoopringCreate2Deployer,
  entryPointAddr: string,
  blankOwner: string,
  priceOracleAddr = ethers.constants.AddressZero
): Promise<Contract> {
  const ERC1271Lib = await deploySingle(deployFactory, 'ERC1271Lib')
  const ERC20Lib = await deploySingle(deployFactory, 'ERC20Lib')
  const GuardianLib = await deploySingle(deployFactory, 'GuardianLib')
  const InheritanceLib = await deploySingle(
    deployFactory,
    'InheritanceLib',
    undefined,
    new Map([['GuardianLib', GuardianLib.address]])
  )
  const QuotaLib = await deploySingle(deployFactory, 'QuotaLib')
  const UpgradeLib = await deploySingle(deployFactory, 'UpgradeLib')
  const WhitelistLib = await deploySingle(
    deployFactory,
    'WhitelistLib'
  )
  const LockLib = await deploySingle(
    deployFactory,
    'LockLib',
    undefined,
    new Map([['GuardianLib', GuardianLib.address]])
  )
  const RecoverLib = await deploySingle(
    deployFactory,
    'RecoverLib',
    undefined,
    new Map([['GuardianLib', GuardianLib.address]])
  )

  const smartWallet = await deploySingle(
    deployFactory,
    'SmartWalletV3',
    [priceOracleAddr, blankOwner, entryPointAddr],
    new Map([
      ['ERC1271Lib', ERC1271Lib.address],
      ['ERC20Lib', ERC20Lib.address],
      ['GuardianLib', GuardianLib.address],
      ['InheritanceLib', InheritanceLib.address],
      ['LockLib', LockLib.address],
      ['QuotaLib', QuotaLib.address],
      ['RecoverLib', RecoverLib.address],
      ['UpgradeLib', UpgradeLib.address],
      ['WhitelistLib', WhitelistLib.address]
    ])
  )
  return smartWallet
}

export async function createSmartWallet (
  owner: Wallet,
  guardians: string[],
  walletFactory: WalletFactory,
  salt: string
): Promise<ContractReceipt> {
  const feeRecipient = ethers.constants.AddressZero
  const { chainId } = await ethers.provider.getNetwork()
  // create smart wallet
  const signature = await signCreateWallet(
    walletFactory.address,
    owner,
    guardians,
    BigNumber.from(0),
    ethers.constants.AddressZero,
    feeRecipient,
    ethers.constants.AddressZero,
    BigNumber.from(0),
    salt,
    chainId
  )

  const walletConfig: any = {
    owner: owner.address,
    guardians,
    quota: 0,
    inheritor: ethers.constants.AddressZero,
    feeRecipient,
    feeToken: ethers.constants.AddressZero,
    maxFeeAmount: 0,
    salt,
    signature
  }

  const tx = await walletFactory.createWallet(walletConfig, 0)
  return tx.wait()
}

export interface PaymasterOption {
  paymaster: LoopringPaymaster
  payToken: Contract
  paymasterOwner: Signer
  valueOfEth: BigNumberish
  validUntil: BigNumberish
}

export async function generateSignedUserOp (
  txs: Array<Deferrable<TransactionRequest>>,
  smartWallet: SmartWalletV3,
  smartWalletOwner: Signer,
  contractFactory: Contract,
  entrypoint: EntryPoint,
  paymasterOption?: PaymasterOption,
  useExecuteApi = true
): Promise<UserOperation> {
  const ethSent = txs.reduce(
    (acc, tx) => acc.add(BigNumber.from(tx.value ?? 0)),
    BigNumber.from(0)
  )
  const partialUserOp = await createBatchTransactions(
    txs,
    ethers.provider,
    smartWallet,
    useExecuteApi // wrap raw calldata with callcontract api
  )
  // first call to fill userop
  let signedUserOp = await fillAndSign(
    partialUserOp,
    smartWalletOwner,
    contractFactory.address,
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
      contractFactory.address,
      entrypoint
    )
  }

  // prepare gas before send userop
  const requiredPrefund = computeRequiredPreFund(
    signedUserOp,
    paymasterOption !== undefined
  ).add(ethSent)
  // only consider deposited balance in entrypoint contract when using paymaster
  const currentBalance =
    paymasterOption != null
      ? await entrypoint.balanceOf(paymasterOption.paymaster.address)
      : await getEthBalance(smartWallet)

  if (requiredPrefund.gt(currentBalance)) {
    const missingValue = requiredPrefund.sub(currentBalance)
    const payer =
      paymasterOption != null
        ? paymasterOption.paymaster.address
        : smartWallet.address
    await (
      await entrypoint.depositTo(payer, {
        value: missingValue
      })
    ).wait()
    console.log('prefund missing amount ', missingValue)
  }
  return signedUserOp
}

export async function sendTx (
  txs: Array<Deferrable<TransactionRequest>>,
  smartWallet: SmartWalletV3,
  smartWalletOwner: Signer,
  contractFactory: Contract,
  entrypoint: EntryPoint,
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
  const recipt = await sendUserOp(signedUserOp)
  return recipt
}

export async function createBatchTransactions (
  transactions: Array<Deferrable<TransactionRequest>>,
  ethersProvider: BaseProvider,
  wallet: SmartWalletV3,
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

async function getEthBalance (
  smartWallet: SmartWalletV3
): Promise<BigNumber> {
  const ethBalance = await ethers.provider.getBalance(
    smartWallet.address
  )
  const depositBalance = await smartWallet.getDeposit()
  const totalBalance = ethBalance.add(depositBalance)
  return totalBalance
}

// eslint-disable-next-line
export function getErrorMessage(revertReason: string) {
  return ethers.utils.defaultAbiCoder.decode(
    ['string'],
    '0x' + revertReason.slice(10)
  )[0]
}

export async function getBlockTimestamp (
  blockNumber: number
): Promise<number> {
  const block = await ethers.provider.getBlock(blockNumber)
  return block.timestamp
}

export async function getCurrentQuota (
  quotaInfo: any,
  blockNumber: number
): Promise<number> {
  const blockTime = await getBlockTimestamp(blockNumber)
  const pendingUntil = quotaInfo.pendingUntil.toNumber()

  return pendingUntil <= blockTime
    ? quotaInfo.pendingQuota
    : quotaInfo.currentQuota
}

export async function getFirstEvent (
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
