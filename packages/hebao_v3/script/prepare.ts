import { ethers } from 'hardhat'
import {
  EntryPoint__factory,
  SmartWalletV3__factory,
  LoopringPaymaster__factory,
  USDT__factory
} from './../typechain-types'

async function main(): Promise<void> {
  // some addresses
  // official entrypoint
  const entryPointAddr = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'
  // loopring paymaster
  const paymasterAddr = '0xC71B4d08B838e8525CA07Ac3d0C763152a3448A1'
  // loopring smart wallet
  const smartWalletAddr = '0x44e7527ab6cFeB896e53e1F45B6177E81FC985a8'
  // fake tokens
  const usdtTokenAddr = '0x116C55AFEaB4f16CcC5e91B563D450A4aE14CA15'

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
  const ethAmount = ethers.utils.parseEther('0.01')
  const minAmount = ethers.utils.parseEther('0.001')
  const paymaster = LoopringPaymaster__factory.connect(
    paymasterAddr,
    paymasterOwner
  )
  // usdt is supported
  await (await paymaster.addToken(usdtTokenAddr)).wait()

  // prepare tokens for paymaster and smartwallet
  if ((await entryPoint.balanceOf(paymasterAddr)).lt(minAmount)) {
    await (
      await entryPoint.connect(deployer).depositTo(paymasterAddr, {
        value: ethAmount
      })
    ).wait()
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
  }
  const usdtToken = USDT__factory.connect(usdtTokenAddr, deployer)
  const tokenAmount = ethers.utils.parseUnits('100000', 6)
  const minTokenAmount = ethers.utils.parseUnits('100', 6)
  const { amount: depositedTokenAmount } =
    await paymaster.depositInfo(usdtTokenAddr, smartWalletAddr)
  if (depositedTokenAmount.lt(minTokenAmount)) {
    if (
      (await usdtToken.balanceOf(deployer.address)).lt(tokenAmount)
    ) {
      await (
        await usdtToken.setBalance(
          deployer.address,
          tokenAmount.mul(3)
        )
      ).wait()
    }
    // two options, one is deposit for user, the other is mint tokens to user
    await (
      await paymaster
        .connect(deployer)
        .addDepositFor(usdtTokenAddr, smartWalletAddr, tokenAmount)
    ).wait()

    // prepare tokens for smartwallet
    // await (await usdtToken.setBalance(smartWallet.address, tokenAmount)).wait()
    // approve tokens to paymaster
    // await (await smartWallet.approveToken(usdtTokenAddr, paymasterAddr, tokenAmount, false)).wait()
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
