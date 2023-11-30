import { type Contract } from 'ethers'
import { ethers } from 'hardhat'
import * as hre from 'hardhat'

import { localUserOpSender } from '../test/helper/AASigner'
import { saveDeploymentsAddress } from './addresses'
import {
  deploySingle,
  deployWalletImpl,
  createSmartWallet,
  simulationResultCatch,
  sendTx,
  type PaymasterOption,
  generateSignedUserOp
} from '../test/helper/utils'
import {
  EntryPoint__factory,
  type LoopringCreate2Deployer,
  LoopringPaymaster__factory,
  SmartWalletV3__factory,
  WalletFactory__factory
} from '../typechain-types'

// eslint-disable-next-line
async function deployAll() {
  const addressBook: Record<string, string> = {}
  const signers = await ethers.getSigners()
  const deployer = signers[0]
  let paymasterOwner
  if (hre.network.name === 'hardhat') {
    // as a paymaster owner, enough eth is necessary
    paymasterOwner = signers[1]
  } else {
    paymasterOwner = new ethers.Wallet(
      process.env.PAYMASTER_OWNER_PRIVATE_KEY ??
        (process.env.PRIVATE_KEY as string),
      ethers.provider
    )
  }
  const blankOwner = process.env.BLANK_OWNER ?? deployer.address

  // create2 factory
  let create2: LoopringCreate2Deployer
  // NOTE(update address when create2 factory contract is modified)
  const create2Addr = '0xd57d71A16D850038e7266E3885140A7E7d1Ba3fD'
  if ((await ethers.provider.getCode(create2Addr)) !== '0x') {
    create2 = await ethers.getContractAt(
      'LoopringCreate2Deployer',
      create2Addr
    )
  } else {
    create2 = await (
      await ethers.getContractFactory('LoopringCreate2Deployer')
    ).deploy()
  }

  // entrypoint and paymaster
  // NOTE(uncomment when you need to deploy a new entrypoint contract)
  let entrypoint: Contract
  // const entrypointAddr = ethers.constants.AddressZero;
  const entrypointAddr = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'
  if ((await ethers.provider.getCode(entrypointAddr)) !== '0x') {
    entrypoint = await ethers.getContractAt(
      'EntryPoint',
      entrypointAddr
    )
  } else {
    entrypoint = await deploySingle(create2, 'EntryPoint')
  }
  addressBook.EntryPoint = entrypoint.address

  const paymaster = await deploySingle(create2, 'LoopringPaymaster', [
    entrypoint.address,
    paymasterOwner.address
  ])
  addressBook.LoopringPaymaster = paymaster.address

  const smartWalletImpl = await deployWalletImpl(
    create2,
    entrypoint.address,
    blankOwner
  )
  addressBook.SmartWalletImpl = smartWalletImpl.address

  const implStorage = await deploySingle(
    create2,
    'DelayedImplementationManager',
    // deployer as implementation manager
    [smartWalletImpl.address]
  )
  addressBook.DelayedImplementationManager = implStorage.address

  const forwardProxy = await deploySingle(create2, 'ForwardProxy', [
    implStorage.address
  ])
  addressBook.ForwardProxy = forwardProxy.address

  const walletFactory = await deploySingle(create2, 'WalletFactory', [
    forwardProxy.address
  ])
  addressBook.WalletFactory = walletFactory.address
  // transfer wallet factory ownership to deployer
  const walletFactoryOwner = await walletFactory.owner()
  if (create2.address === walletFactoryOwner) {
    await (await create2.setTarget(walletFactory.address)).wait()
    const transferWalletFactoryOwnership =
      await walletFactory.populateTransaction.transferOwnership(
        deployer.address
      )
    await (
      await create2.transact(transferWalletFactoryOwnership.data!)
    ).wait()
  }

  if (
    !((await walletFactory.isOperator(deployer.address)) as boolean)
  ) {
    await (await walletFactory.addOperator(deployer.address)).wait()
  }

  // transfer DelayedImplementationManager ownership to deployer
  if (create2.address === (await implStorage.owner())) {
    await (await create2.setTarget(implStorage.address)).wait()
    const transferImplStorageOwnership =
      await implStorage.populateTransaction.transferOwnership(
        deployer.address
      )
    await (
      await create2.transact(transferImplStorageOwnership.data!)
    ).wait()
  }

  // create demo wallet
  const smartWalletOwner = new ethers.Wallet(
    process.env.TEST_ACCOUNT_PRIVATE_KEY ?? deployer.address,
    ethers.provider
  )
  const sendUserOp = localUserOpSender(entrypoint.address, deployer)

  // owner cannot be guardians
  const guardians: string[] = [
    '0x456ecAca6A1Bc3a71fC1955562d1d9BF662974D8'
  ]
  const salt = ethers.utils.formatBytes32String('0x5')
  const smartWalletAddr = await walletFactory.computeWalletAddress(
    smartWalletOwner.address,
    salt
  )
  if ((await ethers.provider.getCode(smartWalletAddr)) === '0x') {
    await createSmartWallet(
      smartWalletOwner,
      guardians,
      WalletFactory__factory.connect(walletFactory.address, deployer),
      salt
    )
  }

  const smartWallet = SmartWalletV3__factory.connect(
    smartWalletAddr,
    smartWalletOwner
  )
  addressBook.SmartWallet = smartWallet.address

  // deploy mock usdt token for test.
  const usdtToken = await deploySingle(
    create2,
    'USDT',
    undefined,
    undefined,
    'contracts/test/tokens/USDT.sol:USDT'
  )
  addressBook.USDT = usdtToken.address
  return {
    entrypoint: EntryPoint__factory.connect(
      entrypoint.address,
      deployer
    ),
    paymaster: LoopringPaymaster__factory.connect(
      paymaster.address,
      paymasterOwner
    ),
    forwardProxy,
    smartWallet,
    create2,
    deployer,
    paymasterOwner,
    blankOwner,
    smartWalletOwner,
    usdtToken,
    sendUserOp,
    addressBook
  }
}

// eslint-disable-next-line
async function testExecuteTxWithEth(): Promise<void> {
  const {
    entrypoint,
    smartWallet,
    smartWalletOwner,
    usdtToken,
    deployer,
    sendUserOp,
    create2
  } = await deployAll()
  // prepare mock usdt token first
  await (
    await usdtToken.setBalance(
      smartWallet.address,
      ethers.utils.parseUnits('1000', 6)
    )
  ).wait()

  /// ///////////////////////////////////////
  // usdt token transfer test
  const tokenAmount = ethers.utils.parseUnits('100', 6)
  const transferToken = await usdtToken.populateTransaction.transfer(
    deployer.address,
    tokenAmount
  )

  await sendTx(
    [transferToken],
    smartWallet,
    smartWalletOwner,
    create2,
    entrypoint,
    sendUserOp
  )
  /// /////////////////////////////////
  // eth transfer test
  const ethAmount = 1
  await (
    await deployer.sendTransaction({
      to: smartWallet.address,
      value: ethAmount
    })
  ).wait()
  const transferEth = {
    value: ethAmount,
    to: deployer.address
  }
  await sendTx(
    [transferEth],
    smartWallet,
    smartWalletOwner,
    create2,
    entrypoint,
    sendUserOp
  )
  /// ////////////////////////////
  // batch tx
  // transfer usdt token by three times

  await sendTx(
    [transferToken, transferToken, transferToken],
    smartWallet,
    smartWalletOwner,
    create2,
    entrypoint,
    sendUserOp
  )
}

// eslint-disable-next-line
async function testExecuteTxWithUSDCPaymaster(): Promise<void> {
  const {
    entrypoint,
    smartWallet,
    smartWalletOwner,
    usdtToken,
    deployer,
    sendUserOp,
    create2,
    paymaster,
    paymasterOwner
  } = await deployAll()
  // prepare mock usdt token first
  await (
    await usdtToken.setBalance(
      smartWallet.address,
      ethers.utils.parseUnits('1000', 6)
    )
  ).wait()

  /// ///////////////////////////////////////
  // usdt token transfer test
  const tokenAmount = ethers.utils.parseUnits('100', 6)
  await (await paymaster.addToken(usdtToken.address)).wait()
  // approve paymaster before using usdt paymaster service
  const approveToken = await usdtToken.populateTransaction.approve(
    paymaster.address,
    ethers.constants.MaxUint256
  )
  const transferToken = await usdtToken.populateTransaction.transfer(
    deployer.address,
    tokenAmount
  )
  const paymasterOption: PaymasterOption = {
    paymaster,
    payToken: usdtToken,
    paymasterOwner,
    valueOfEth: ethers.utils.parseUnits('625', 12),
    validUntil: 0
  }

  // approve token first
  // TODO(cannot approve token using paymaster service here, maybe it is not friendly for user)
  await sendTx(
    [approveToken],
    smartWallet,
    smartWalletOwner,
    create2,
    entrypoint,
    sendUserOp
  )

  await sendTx(
    [transferToken],
    smartWallet,
    smartWalletOwner,
    create2,
    entrypoint,
    sendUserOp,
    paymasterOption
  )
}

// eslint-disable-next-line
async function testExecuteTx(): Promise<void> {
  const {
    entrypoint,
    smartWallet,
    smartWalletOwner,
    sendUserOp,
    create2
  } = await deployAll()
  /// ///////////////////////////////////////
  // usdt token transfer test
  const nonce = await smartWallet.populateTransaction.getNonce()
  const signedUserOp = await generateSignedUserOp(
    [nonce],
    smartWallet,
    smartWalletOwner,
    create2,
    entrypoint,
    undefined,
    false
  )

  await entrypoint.callStatic
    .simulateValidation(signedUserOp)
    .catch(simulationResultCatch)
  await sendUserOp(signedUserOp)
}

async function main(): Promise<void> {
  const { addressBook } = await deployAll()
  saveDeploymentsAddress(
    addressBook,
    hre.network.name,
    './deployments'
  )
  // uncomment below to get gascost info of some sample txs on chain
  // await testExecuteTx()
  // await testExecuteTxWithEth()
  // await testExecuteTxWithUSDCPaymaster()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
