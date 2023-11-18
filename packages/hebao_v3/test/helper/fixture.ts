import * as helpers from '@nomicfoundation/hardhat-network-helpers'
import { Wallet } from 'ethers'
import { ethers } from 'hardhat'

import {
  DelayedImplementationManager__factory,
  EntryPoint__factory,
  LoopringPaymaster__factory,
  SmartWalletV3__factory,
  USDT__factory,
  WalletFactory__factory
} from '../../typechain-types'

import { localUserOpSender } from './AASigner'
import {
  createSmartWallet,
  deploySingle,
  deployWalletImpl
} from './utils'

export async function fixture () {
  const signers = await ethers.getSigners()
  const deployer = signers[0]
  const paymasterOwner = signers[1]
  const somebody = signers[2]
  const blankOwner = await ethers.Wallet.createRandom().connect(
    ethers.provider
  )
  await helpers.setBalance(
    blankOwner.address,
    ethers.utils.parseEther('100')
  )

  // create2 factory

  const create2 = await (
    await ethers.getContractFactory('LoopringCreate2Deployer')
  ).deploy()

  // entrypoint and paymaster
  const entrypoint = EntryPoint__factory.connect(
    (await deploySingle(create2, 'EntryPoint')).address,
    deployer
  )
  // const entrypointAddr = "0x515aC6B1Cd51BcFe88334039cC32e3919D13b35d";
  // const entrypoint = await ethers.getContractAt("EntryPoint", entrypointAddr);

  const paymaster = await deploySingle(create2, 'LoopringPaymaster', [
    entrypoint.address,
    paymasterOwner.address
  ])

  const smartWalletImpl = await deployWalletImpl(
    create2,
    entrypoint.address,
    blankOwner.address
  )

  const implStorage = DelayedImplementationManager__factory.connect(
    (
      await deploySingle(
        create2,
        'DelayedImplementationManager',
        // deployer as implementation manager
        [smartWalletImpl.address]
      )
    ).address,
    deployer
  )

  const forwardProxy = await deploySingle(create2, 'ForwardProxy', [
    implStorage.address
  ])

  const walletFactory = WalletFactory__factory.connect(
    (
      await deploySingle(create2, 'WalletFactory', [
        forwardProxy.address
      ])
    ).address,
    deployer
  )
  // transfer wallet factory ownership to deployer
  await create2.setTarget(walletFactory.address)
  const transferWalletFactoryOwnership =
    await walletFactory.populateTransaction.transferOwnership(
      deployer.address
    )
  await create2.transact(transferWalletFactoryOwnership.data!)
  await walletFactory.addOperator(deployer.address)

  // transfer DelayedImplementationManager ownership to deployer
  await create2.setTarget(implStorage.address)
  const transferImplStorageOwnership =
    await implStorage.populateTransaction.transferOwnership(
      deployer.address
    )
  await create2.transact(transferImplStorageOwnership.data!)

  // create demo wallet
  const smartWalletOwner = await ethers.Wallet.createRandom().connect(
    ethers.provider
  )
  // prepare eth for walletowner
  await helpers.setBalance(
    smartWalletOwner.address,
    ethers.utils.parseEther('100')
  )
  const sendUserOp = localUserOpSender(entrypoint.address, deployer)

  const guardians: Wallet[] = []
  for (let i = 0; i < 2; i++) {
    guardians.push(
      await ethers.Wallet.createRandom().connect(ethers.provider)
    )
  }
  guardians.sort((a, b) =>
    a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1
  )

  const salt = ethers.utils.formatBytes32String('0x5')
  await createSmartWallet(
    smartWalletOwner,
    guardians.map((g) => g.address.toLowerCase()),
    walletFactory,
    salt
  )

  const smartWalletAddr = await walletFactory.computeWalletAddress(
    smartWalletOwner.address,
    salt
  )
  const smartWallet = SmartWalletV3__factory.connect(
    smartWalletAddr,
    smartWalletOwner
  )
  // prepare eth for smartwallet
  await helpers.setBalance(
    smartWallet.address,
    ethers.utils.parseEther('100')
  )

  // predeposit for smartwallet and paymaster in entrypoint
  await entrypoint.depositTo(smartWallet.address, {
    value: ethers.utils.parseEther('100')
  })
  await entrypoint.depositTo(paymaster.address, {
    value: ethers.utils.parseEther('100')
  })

  // deploy mock usdt token for test.
  const usdtToken = USDT__factory.connect(
    (await deploySingle(create2, 'USDT')).address,
    deployer
  )

  // used for any call contract test
  const testTarget = await (
    await ethers.getContractFactory('TestTargetContract')
  ).deploy()

  return {
    entrypoint,
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
    smartWalletImpl,
    guardians,
    walletFactory,
    implStorage,
    testTarget,
    somebody
  }
}
