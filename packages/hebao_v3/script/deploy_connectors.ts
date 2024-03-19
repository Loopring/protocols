import { ethers } from 'hardhat'

import { ConnectorRegistry__factory } from '../typechain-types'
import { connectorRegistryAddr } from './deploy_utils'

async function main(): Promise<void> {
  const signers = await ethers.getSigners()
  const deployer = signers[0]
  const connectorRegistry = ConnectorRegistry__factory.connect(
    connectorRegistryAddr,
    deployer
  )
  await (await connectorRegistry.addConnectors([])).wait()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
