import { ethers } from 'hardhat'
import { SmartWalletV3__factory } from '../typechain-types'

import { deployWalletImpl } from '../test/helper/utils'

async function main (): Promise<void> {
  const signers = await ethers.getSigners()
  const deployer = signers[0]
  const smartWalletOwner = new ethers.Wallet(
    process.env.TEST_ACCOUNT_PRIVATE_KEY ?? deployer.address,
    ethers.provider
  )
  const smartWalletAddr = '0x44e7527ab6cFeB896e53e1F45B6177E81FC985a8'
  const smartWallet = SmartWalletV3__factory.connect(
    smartWalletAddr,
    smartWalletOwner
  )
  const walletV2Info = await smartWallet.wallet()
  console.log('wallet info before update', walletV2Info)

  let smartWalletImplAddr: string =
    '0xC920EcfaE7ed1665976d3262E2600A1B3d964cC5'
  if ((await ethers.provider.getCode(smartWalletImplAddr)) === '0x') {
    // deploy new implementation when not exist
    const create2Addr = '0xd57d71A16D850038e7266E3885140A7E7d1Ba3fD'
    const create2 = await ethers.getContractAt(
      'LoopringCreate2Deployer',
      create2Addr
    )
    const entrypointAddr =
      '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'
    const entrypoint = await ethers.getContractAt(
      'EntryPoint',
      entrypointAddr
    )
    const smartWalletImpl = await deployWalletImpl(
      create2,
      entrypoint.address,
      ethers.constants.AddressZero
    )
    smartWalletImplAddr = smartWalletImpl.address
  }

  // TODO(change mastercopy using guardians approval)
  // await smartWallet.changeMasterCopy(smartWalletImplAddr)
  // const walletV3Info = await smartWallet.wallet()
  // console.log('wallet info after update', walletV3Info)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
