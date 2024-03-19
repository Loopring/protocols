import { ethers } from 'hardhat'
import { type SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import {
  EntryPoint__factory,
  SmartWalletV3__factory,
  LoopringPaymaster__factory,
  WalletFactory__factory,
  USDT__factory,
  type SmartWalletV3,
  type EntryPoint,
  type LoopringPaymaster
} from './../typechain-types'
import deploymentJson from '../deployments/deployments.json'
import * as hre from 'hardhat'

interface DeploymentType {
  EntryPoint: string
  LoopringPaymaster: string
  SmartWallet?: string
  WalletFactory?: string
  USDT?: string
}

// eth config
const ethAmount = ethers.utils.parseEther('0.2')
const minAmount = ethers.utils.parseEther('0.05')

async function prepareSmartWallet(
  smartWallet: SmartWalletV3,
  entryPoint: EntryPoint,
  paymaster: LoopringPaymaster,
  usdtTokenAddr: string,
  deployer: SignerWithAddress
): Promise<void> {
  const usdtToken = USDT__factory.connect(usdtTokenAddr, deployer)
  const tokenAmount = ethers.utils.parseUnits('100000', 6)
  const minTokenAmount = ethers.utils.parseUnits('100', 6)
  const { amount: depositedTokenAmount } =
    await paymaster.depositInfo(usdtTokenAddr, smartWallet.address)
  // two options, one is deposit for user, the other is mint tokens to user
  if (depositedTokenAmount.lt(minTokenAmount)) {
    if (
      (await usdtToken.balanceOf(deployer.address)).lt(tokenAmount)
    ) {
      await (
        await usdtToken.setBalance(deployer.address, tokenAmount)
      ).wait()
      // deployer approve tokens to paymaster
      await (
        await usdtToken
          .connect(deployer)
          .approve(paymaster.address, tokenAmount)
      ).wait()
    }
    await (
      await paymaster
        .connect(deployer)
        .addDepositFor(
          usdtTokenAddr,
          smartWallet.address,
          tokenAmount
        )
    ).wait()
  } else {
    console.log('smart wallet has enough usdt in paymaster already')
  }

  const usdtBalance = await usdtToken.balanceOf(smartWallet.address)
  if (usdtBalance.lt(minTokenAmount)) {
    // prepare tokens for smartwallet
    await (
      await usdtToken.setBalance(smartWallet.address, tokenAmount)
    ).wait()
    // approve tokens to paymaster
    await (
      await smartWallet.approveToken(
        usdtTokenAddr,
        paymaster.address,
        tokenAmount,
        false
      )
    ).wait()
  } else {
    console.log('smart wallet has enough usdt already')
  }

  if (
    (await entryPoint.balanceOf(smartWallet.address)).lt(minAmount)
  ) {
    await (
      await entryPoint
        .connect(deployer)
        .depositTo(smartWallet.address, {
          value: ethAmount
        })
    ).wait()
  } else {
    console.log('smart wallet has enough eth in entrypoint already')
  }
}

async function prepareOperators(
  walletFactoryAddr: string,
  deployer: any
): Promise<void> {
  const operators = [
    '0x3435259218bf656186F123B6d9129BF8D19c2941',
    '0xd465F61eB0c067e648B81e43f97af8cCD54b3D17'
  ]
  const walletFactory = WalletFactory__factory.connect(
    walletFactoryAddr,
    deployer
  )
  for (const operator of operators) {
    if (await walletFactory.isOperator(operator)) {
      console.log(`operator ${operator} has permission already`)
    } else {
      await (await walletFactory.addOperator(operator)).wait()
      console.log(`grant role to ${operator} successfully`)
    }
  }
}

async function main(): Promise<void> {
  // some addresses
  // official entrypoint
  if (!(hre.network.name in deploymentJson)) {
    throw new Error(`unsupported network ${hre.network.name}`)
  }
  const deployment = (
    deploymentJson as Record<string, DeploymentType>
  )[hre.network.name]
  const entryPointAddr = deployment.EntryPoint
  // loopring paymaster
  const paymasterAddr = deployment.LoopringPaymaster
  // loopring smart wallet
  const smartWalletAddr = deployment.SmartWallet
  // fake tokens
  const usdtTokenAddr = deployment.USDT

  const deployer = (await ethers.getSigners())[0]
  const smartWalletOwner = new ethers.Wallet(
    process.env.TEST_ACCOUNT_PRIVATE_KEY ?? deployer.address,
    ethers.provider
  )
  const paymasterOwner = new ethers.Wallet(
    process.env.PAYMASTER_OWNER_PRIVATE_KEY ?? deployer.address,
    ethers.provider
  )
  const entryPoint = EntryPoint__factory.connect(
    entryPointAddr,
    deployer
  )
  const paymaster = LoopringPaymaster__factory.connect(
    paymasterAddr,
    paymasterOwner
  )
  const tokens = [
    '0xaE404C050c3Da571AfefCFF5B6a64af451584000', // LRC
    '0x1FEa9801725853622C33a23a86251e7c81898b25' // USDT
  ]
  if (usdtTokenAddr !== undefined) {
    tokens.push(usdtTokenAddr)
  }
  // make sure usdt token is supported in paymaster
  for (const token of tokens) {
    if (await paymaster.registeredToken(token)) {
      console.log(`token: ${token} is registerd already`)
    } else {
      await (await paymaster.addToken(token)).wait()
      console.log(`token: ${token} is registerd successfully`)
    }
    // check success
  }

  // signer for paymaster
  const signers = ['0xf6c53560e79857ce12dde54782d487b743b70717']
  const signerRole = await paymaster.SIGNER()
  for (const signer of signers) {
    if (await paymaster.hasRole(signerRole, signer)) {
      console.log(`operator ${signer} has permission already`)
    } else {
      await (await paymaster.grantRole(signerRole, signer)).wait()
      console.log(`grant role to ${signer} successfully`)
    }
  }

  // add operator for wallet factory
  if (deployment.WalletFactory !== undefined) {
    await prepareOperators(deployment.WalletFactory, deployer)
  }

  // prepare tokens for paymaster
  if ((await entryPoint.balanceOf(paymasterAddr)).lt(minAmount)) {
    await (
      await entryPoint.connect(deployer).depositTo(paymasterAddr, {
        value: ethAmount
      })
    ).wait()
  } else {
    console.log('paymaster has enough eth in entrypoint already')
  }

  if (smartWalletAddr !== undefined && usdtTokenAddr !== undefined) {
    const smartWallet = SmartWalletV3__factory.connect(
      smartWalletAddr,
      smartWalletOwner
    )
    await prepareSmartWallet(
      smartWallet,
      entryPoint,
      paymaster,
      usdtTokenAddr,
      deployer
    )
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
