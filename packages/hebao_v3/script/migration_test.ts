import { Contract, Wallet } from 'ethers'
import { ethers } from 'hardhat'

import { deployWalletImpl } from './deploy'

async function main (): Promise<void> {
  // hebaov2 wallet
  const walletV2Addr = '0x'
  const wallet = new Contract(walletV2Addr, '')
  const walletV2Info = await wallet.wallet()
  console.log(walletV2Info)

  // deploy new implementation
  const create2Addr = '0x515aC6B1Cd51BcFe88334039cC32e3919D13b35d'
  const create2 = await ethers.getContractAt('Create2Factory', create2Addr)
  const entrypointAddr = '0x515aC6B1Cd51BcFe88334039cC32e3919D13b35d'
  const entrypoint = await ethers.getContractAt('EntryPoint', entrypointAddr)
  const smartWalletImpl = await deployWalletImpl(
    create2,
    entrypoint.address,
    ethers.constants.AddressZero
  )

  // change mastercopy
  await wallet.changeMasterCopy(smartWalletImpl)
  const walletV3Info = await wallet.wallet()
  console.log(walletV3Info)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
