import {
  testExecuteTx,
  testExecuteTxWithEth,
  testExecuteTxWithUSDCPaymaster
} from './demo_utils'
import { deployAll } from './deploy_utils'

async function main(): Promise<void> {
  const fixture = await deployAll()
  await testExecuteTx(fixture)
  await testExecuteTxWithEth(fixture)
  await testExecuteTxWithUSDCPaymaster(fixture)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
