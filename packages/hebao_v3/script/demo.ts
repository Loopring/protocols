import { ethers } from 'hardhat'
import { localUserOpSender } from '../test/helper/AASigner'
import { WalletProxy__factory } from '../typechain-types'

import {
  testExecuteTx
  // testExecuteTxWithEth,
  // testExecuteTxWithUSDCPaymaster
} from './demo_utils'
// import { deployAll } from './deploy_utils'

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners()
  const entrypoint = await ethers.getContractAt(
    'EntryPoint',
    '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'
  )
  const smartWallet = await ethers.getContractAt(
    'SmartWalletV3',
    '0xD2f1c204F219db1478e8D92728D584e7A51A5235'
  )
  console.log(await smartWallet.getMasterCopy())

  const code = await ethers.provider.getCode(smartWallet.address)
  console.log('code: ', code)
  console.log('code: ', WalletProxy__factory.bytecode)
  // const create2 = await ethers.getContractAt(
  // 'LoopringCreate2Deployer',
  // '0x391fD52903D1531fd45F41c4A354533c91289F5F'
  // )
  // const smartWalletOwner = new ethers.Wallet(
  // process.env.PRIVATE_KEY as string,
  // ethers.provider
  // )
  // const sendUserOp = localUserOpSender(entrypoint.address, deployer)
  // const fixture = {
  // entrypoint,
  // smartWallet,
  // smartWalletOwner,
  // sendUserOp,
  // create2
  // }
  // // const fixture = await deployAll()
  // await testExecuteTx(fixture)
  // await testExecuteTxWithEth(fixture)
  // await testExecuteTxWithUSDCPaymaster(fixture)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
