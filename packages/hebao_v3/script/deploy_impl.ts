import { deployNewImplmentation } from './deploy_utils'
import { saveDeploymentsAddress } from './addresses'
import * as hre from 'hardhat'

async function main(): Promise<void> {
  const { addressBook } = await deployNewImplmentation()
  saveDeploymentsAddress(
    addressBook,
    hre.network.name,
    './deployments'
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
