import { type Contract } from 'ethers'
import { ethers } from 'hardhat'
import * as hre from 'hardhat'

import { localUserOpSender } from '../test/helper/AASigner'
import { type DeploymentType } from './addresses'
import {
  deploySingle,
  deployWalletImpl,
  createSmartWallet
} from '../test/helper/utils'
import deploymentJson from '../deployments/deployments.json'
import {
  EntryPoint__factory,
  type LoopringCreate2Deployer,
  LoopringPaymaster__factory,
  SmartWalletV3__factory,
  WalletFactory__factory,
  USDT__factory,
  OfficialGuardian__factory
} from '../typechain-types'

// TODO()
export const connectorRegistryAddr =
  '0xd9267CD2BBd228591960F2592dc55fB216f1be38'

// eslint-disable-next-line
export async function deployAll() {
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
  const create2Addr = (
    deploymentJson as unknown as Record<string, DeploymentType>
  )[hre.network.name].LoopringCreate2Deployer
  if (
    create2Addr !== undefined &&
    (await ethers.provider.getCode(create2Addr)) !== '0x'
  ) {
    console.log(
      'create2 factory is deployed already at : ',
      create2Addr
    )
    create2 = await ethers.getContractAt(
      'LoopringCreate2Deployer',
      create2Addr
    )
  } else {
    create2 = await (
      await ethers.getContractFactory('LoopringCreate2Deployer')
    ).deploy()
    console.log('create2 factory is deployed at : ', create2.address)
  }
  addressBook.LoopringCreate2Deployer = create2.address

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
    blankOwner,
    ethers.constants.AddressZero,
    connectorRegistryAddr
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

  const walletFactory = WalletFactory__factory.connect(
    (
      await deploySingle(create2, 'WalletFactory', [
        forwardProxy.address
      ])
    ).address,
    deployer
  )
  addressBook.WalletFactory = walletFactory.address
  // transfer wallet factory ownership to deployer
  const walletFactoryOwner = await walletFactory.owner()
  if (
    create2.address.toLowerCase() === walletFactoryOwner.toLowerCase()
  ) {
    console.log('transfer wallet factory ownership to deployer')
    await (await create2.setTarget(walletFactory.address)).wait()
    const transferWalletFactoryOwnership =
      await walletFactory.populateTransaction.transferOwnership(
        deployer.address
      )
    await (
      await create2.transact(transferWalletFactoryOwnership.data!)
    ).wait()
  } else {
    console.log('ownership of wallet factory is transfered already')
  }

  if (
    !((await walletFactory.isOperator(deployer.address)) as boolean)
  ) {
    await (await walletFactory.addOperator(deployer.address)).wait()
  }

  // transfer DelayedImplementationManager ownership to deployer
  if (create2.address === (await implStorage.owner())) {
    console.log(
      'transfer DelayedImplementationManager ownership to deployer'
    )
    await (await create2.setTarget(implStorage.address)).wait()
    const transferImplStorageOwnership =
      await implStorage.populateTransaction.transferOwnership(
        deployer.address
      )
    await (
      await create2.transact(transferImplStorageOwnership.data!)
    ).wait()
  } else {
    console.log(
      'ownership of DelayedImplementationManager is transfered already'
    )
  }

  // create demo wallet
  console.log('create demo wallet...')

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
      walletFactory,
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
    usdtToken: USDT__factory.connect(usdtToken.address, deployer),
    sendUserOp,
    addressBook
  }
}

// eslint-disable-next-line
export async function deployNewImplmentation() {
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
  const deployment = (
    deploymentJson as unknown as Record<string, DeploymentType>
  )[hre.network.name]
  // NOTE(update address when create2 factory contract is modified)
  const create2Addr = deployment.LoopringCreate2Deployer
  if (
    create2Addr !== undefined &&
    (await ethers.provider.getCode(create2Addr)) !== '0x'
  ) {
    console.log(
      'create2 factory is deployed already at : ',
      create2Addr
    )
    create2 = await ethers.getContractAt(
      'LoopringCreate2Deployer',
      create2Addr
    )

    //  check ownership first
    if ((await create2.owner()) !== deployer.address) {
      if ((await create2.pendingOwner()) === deployer.address) {
        // try to claim
        await (await create2.claimOwnership()).wait()
      } else {
        throw new Error(
          `need call transferOwnership by current owner first`
        )
      }
    }
  } else {
    create2 = await (
      await ethers.getContractFactory('LoopringCreate2Deployer')
    ).deploy()
    console.log('create2 factory is deployed at : ', create2.address)
  }
  addressBook.LoopringCreate2Deployer = create2.address

  // entrypoint and paymaster
  // NOTE(uncomment when you need to deploy a new entrypoint contract)
  let entrypoint: Contract
  // const entrypointAddr = ethers.constants.AddressZero;
  const entrypointAddr = deployment.EntryPoint
  if (
    entrypointAddr !== undefined &&
    (await ethers.provider.getCode(entrypointAddr)) !== '0x'
  ) {
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

  const connectorRegistry = LoopringPaymaster__factory.connect(
    (await deploySingle(create2, 'ConnectorRegistry')).address,
    deployer
  )
  addressBook.ConnectorRegistry = connectorRegistry.address

  // transfer ConnectorRegistry ownership to deployer
  if (create2.address === (await connectorRegistry.owner())) {
    console.log('transfer ConnectorRegistry ownership to deployer')
    await (await create2.setTarget(connectorRegistry.address)).wait()
    const transferOwnership =
      await connectorRegistry.populateTransaction.transferOwnership(
        deployer.address
      )
    await (await create2.transact(transferOwnership.data!)).wait()
  } else {
    console.log(
      'ownership of ConnectorRegistry is transfered already'
    )
  }

  const smartWalletImpl = await deployWalletImpl(
    create2,
    entrypoint.address,
    blankOwner,
    ethers.constants.AddressZero,
    connectorRegistry.address
  )
  addressBook.SmartWalletImpl = smartWalletImpl.address
  return {
    entrypoint: EntryPoint__factory.connect(
      entrypoint.address,
      deployer
    ),
    paymaster: LoopringPaymaster__factory.connect(
      paymaster.address,
      paymasterOwner
    ),
    connectorRegistry,
    create2,
    deployer,
    paymasterOwner,
    blankOwner,
    addressBook
  }
}

export async function deployOfficialGuardian(): Promise<string> {
  const signers = await ethers.getSigners()
  const deployer = signers[0]

  let proxyAddress: string
  const deployment = (
    deploymentJson as unknown as Record<string, DeploymentType>
  )[hre.network.name]

  if (deployment.OfficialGuardian === undefined) {
    const proxy = await (
      await ethers.getContractFactory('OwnedUpgradeabilityProxy')
    ).deploy()

    const officialGuardian = await (
      await ethers.getContractFactory('OfficialGuardian')
    ).deploy()

    await (await proxy.upgradeTo(officialGuardian.address)).wait()
    proxyAddress = proxy.address
  } else {
    proxyAddress = deployment.OfficialGuardian
    const proxy = await ethers.getContractAt(
      'OwnedUpgradeabilityProxy',
      proxyAddress
    )
    // verify proxy and official guardian
    await hre.run('verify:verify', {
      address: proxyAddress,
      constructorArguments: []
    })

    await hre.run('verify:verify', {
      address: await proxy.implementation(),
      constructorArguments: []
    })
  }
  const proxyAsOfficialGuardian = OfficialGuardian__factory.connect(
    proxyAddress,
    deployer
  )

  if (
    (await proxyAsOfficialGuardian.owner()) ===
    ethers.constants.AddressZero
  ) {
    await (
      await proxyAsOfficialGuardian.initOwner(deployer.address)
    ).wait()
  }
  return proxyAddress
}
