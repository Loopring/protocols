import { deployAndVerify } from './helper'

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
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
