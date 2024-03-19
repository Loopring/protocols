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

  const newOwner = '0x3419349cD15816CD20E36DB47960cDB90f50E5b9'
  const curOwner = await connectorRegistry.owner()
  if (curOwner.toLowerCase() !== newOwner.toLowerCase()) {
    const adminRole = await connectorRegistry.DEFAULT_ADMIN_ROLE()
    const manager = await connectorRegistry.MANAGER()

    await (
      await connectorRegistry.grantRole(adminRole, newOwner)
    ).wait()
    await (
      await connectorRegistry.grantRole(manager, newOwner)
    ).wait()

    // revoke previous permission
    await (
      await connectorRegistry.revokeRole(manager, deployer.address)
    ).wait()
    await (
      await connectorRegistry.revokeRole(adminRole, deployer.address)
    ).wait()

    await (await connectorRegistry.transferOwnership(newOwner)).wait()
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
