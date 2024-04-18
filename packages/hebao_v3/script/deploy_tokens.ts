import { deployAndVerify } from './helper'
import { ethers } from 'hardhat'

async function main(): Promise<void> {
  const tasks = [
    {
      contractName: 'USDT'
    },
    {
      contractName: 'LRC'
    }
  ]

  const deployment = await deployAndVerify(tasks)
  console.log(deployment)

  const tokenAmount = ethers.utils.parseUnits('1000000', 18)
  const account = '0xd93cfd02340E19AC44C933C3e89f81F5A795c526'
  // prepare some tokens for some addresses
  for (const task of tasks) {
    console.log(deployment[task.contractName])
    const token = await ethers.getContractAt(
      task.contractName,
      deployment[task.contractName]
    )
    await (await token.setBalance(account, tokenAmount)).wait()
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
