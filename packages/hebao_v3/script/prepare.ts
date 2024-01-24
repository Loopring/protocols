import { ethers } from 'hardhat'
import {
  EntryPoint__factory,
  SmartWalletV3__factory,
  LoopringPaymaster__factory,
  USDT__factory
} from './../typechain-types'
import deploymentJson from '../deployments/deployments.json'
import * as hre from 'hardhat'

interface DeploymentType {
  EntryPoint: string
  LoopringPaymaster: string
  SmartWallet: string
  USDT: string
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

  const signers = await ethers.getSigners()
  const deployer = signers[0]
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
  const ethAmount = ethers.utils.parseEther('0.2')
  const minAmount = ethers.utils.parseEther('0.05')
  const paymaster = LoopringPaymaster__factory.connect(
    paymasterAddr,
    paymasterOwner
  )
  const tokens = [
    usdtTokenAddr,
    '0xaE404C050c3Da571AfefCFF5B6a64af451584000', // LRC
    '0x1FEa9801725853622C33a23a86251e7c81898b25' // USDT
  ]
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
  const operators = ['0xf6c53560e79857ce12dde54782d487b743b70717']
  const signerRole = await paymaster.SIGNER()
  for (const operator of operators) {
    if (await paymaster.hasRole(signerRole, operator)) {
      console.log(`operator ${operator} has permission already`)
    } else {
      await (await paymaster.grantRole(signerRole, operator)).wait()
      console.log(`grant role to ${operator} successfully`)
    }
  }

  // prepare tokens for paymaster and smartwallet
  if ((await entryPoint.balanceOf(paymasterAddr)).lt(minAmount)) {
    await (
      await entryPoint.connect(deployer).depositTo(paymasterAddr, {
        value: ethAmount
      })
    ).wait()
  } else {
    console.log('paymaster has enough eth in entrypoint already')
  }

  const smartWallet = SmartWalletV3__factory.connect(
    smartWalletAddr,
    smartWalletOwner
  )
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
  const usdtToken = USDT__factory.connect(usdtTokenAddr, deployer)
  const tokenAmount = ethers.utils.parseUnits('100000', 6)
  const minTokenAmount = ethers.utils.parseUnits('100', 6)
  const { amount: depositedTokenAmount } =
    await paymaster.depositInfo(usdtTokenAddr, smartWalletAddr)
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
          .approve(paymasterAddr, tokenAmount)
      ).wait()
    }
    await (
      await paymaster
        .connect(deployer)
        .addDepositFor(usdtTokenAddr, smartWalletAddr, tokenAmount)
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
        paymasterAddr,
        tokenAmount,
        false
      )
    ).wait()
  } else {
    console.log('smart wallet has enough usdt already')
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
