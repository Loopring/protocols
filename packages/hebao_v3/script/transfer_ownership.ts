import { ethers } from 'hardhat'
import * as hre from 'hardhat'

import {
  ConnectorRegistry__factory,
  LoopringPaymaster__factory
} from '../typechain-types'
import { connectorRegistryAddr } from './deploy_utils'
import { type SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import deploymentJson from '../deployments/deployments.json'

async function transferOwnershipForConnectorRegistry(
  deployer: SignerWithAddress,
  newOwner: string
): Promise<void> {
  const connectorRegistry = ConnectorRegistry__factory.connect(
    connectorRegistryAddr,
    deployer
  )

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

// eslint-disable-next-line
async function transferOwnershipForPaymaster(
  deployer: SignerWithAddress,
  newOwner: string
): Promise<void> {
  const deployment = (
    deploymentJson as Record<string, { LoopringPaymaster: string }>
  )[hre.network.name]
  const paymaster = LoopringPaymaster__factory.connect(
    deployment.LoopringPaymaster,
    deployer
  )

  const curOwner = await paymaster.owner()

  if (curOwner.toLowerCase() !== newOwner.toLowerCase()) {
    const adminRole = await paymaster.DEFAULT_ADMIN_ROLE()
    const signer = await paymaster.SIGNER()

    await (await paymaster.grantRole(adminRole, newOwner)).wait()
    await (await paymaster.grantRole(signer, newOwner)).wait()

    // revoke previous permission
    await (
      await paymaster.revokeRole(signer, deployer.address)
    ).wait()
    await (
      await paymaster.revokeRole(adminRole, deployer.address)
    ).wait()
    await (await paymaster.transferOwnership(newOwner)).wait()
  }
}

async function main(): Promise<void> {
  const signers = await ethers.getSigners()
  const deployer = signers[0]

  const newOwner = '0x3419349cD15816CD20E36DB47960cDB90f50E5b9'
  // transfer ownership of connector registry
  await transferOwnershipForConnectorRegistry(deployer, newOwner)

  // transfer ownership of loopring paymaster
  // await transferOwnershipForPaymaster(deployer, newOwner)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
