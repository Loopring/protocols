import { scope, types } from 'hardhat/config'
import {
  TASK_DEPLOY_CONTRACTS,
  type DeployTask
} from 'tasks/task_helper'
import { checkValidContractAddress } from 'src/deploy_utils'
import { AddressForNetwork } from 'src/constants'
import assert from 'assert'

export const SCOPE_CONNECTOR_REGISTRY = 'connector-registry'
export const TASK_DEPLOY = 'deploy'
export const TASK_REGISTER_CONNECTOR = 'register-connector'
export const TASK_TRANSFER_OWNERSHIP = 'transfer-ownership'

const connectorRegistryScope = scope(
  SCOPE_CONNECTOR_REGISTRY,
  'connector registry'
)

connectorRegistryScope
  .task(TASK_DEPLOY, 'deploy connector registry')
  .setAction(async (_, { run }) => {
    const tasks: DeployTask[] = [
      {
        contractName: 'ConnectorRegistry'
      }
    ]
    await run(TASK_DEPLOY_CONTRACTS, { tasks })
  })

connectorRegistryScope
  .task(TASK_REGISTER_CONNECTOR, 'register connectors')
  .setAction(async (_, { run, deployResults, ethers }) => {
    // validate
    await checkValidContractAddress(
      deployResults.ConnectorRegistry,
      ethers.provider
    )
    const connectorRegistry = await ethers.getContractAt(
      'ConnectorRegistry',
      deployResults.ConnectorRegistry
    )

    const { chainId } = await ethers.provider.getNetwork()
    const addressBook = AddressForNetwork[chainId]
    await checkValidContractAddress(
      addressBook.SWAP_ROUTERV3_ADDRESS,
      ethers.provider
    )

    const tasks = [
      {
        contractName: 'OwnedMemory'
      },
      {
        contractName: 'UniswapV3Connector',
        args: [
          addressBook.SWAP_ROUTERV3_ADDRESS,
          '>>>OwnedMemory',
          addressBook.WETH_ADDRESS
        ]
      }
    ]
    await run(TASK_DEPLOY_CONTRACTS, { tasks })

    // check available in this network
    await (
      await connectorRegistry.addConnectors([
        deployResults.UniswapV3Connector
      ])
    ).wait()
  })

connectorRegistryScope
  .task(TASK_TRANSFER_OWNERSHIP)
  .addParam(
    'owner',
    'new owner to transfer to',
    undefined,
    types.string
  )
  .addFlag(
    'revoke',
    'revoke all roles of current owner including admin and signer'
  )
  .setAction(
    async (
      { owner: newOwner, revoke }: { owner: string; revoke: boolean },
      { ethers, deployResults }
    ) => {
      const connectorRegistry = await ethers.getContractAt(
        'ConnectorRegistry',
        deployResults.ConnectorRegistry
      )

      const curOwner = await connectorRegistry.owner()
      const [deployer] = await ethers.getSigners()
      assert(
        curOwner === deployer.address,
        `you are not current owner of connector registry`
      )
      if (curOwner !== newOwner) {
        const adminRole = await connectorRegistry.DEFAULT_ADMIN_ROLE()
        const manager = await connectorRegistry.MANAGER()

        await (
          await connectorRegistry.grantRole(adminRole, newOwner)
        ).wait()
        await (
          await connectorRegistry.grantRole(manager, newOwner)
        ).wait()

        if (revoke) {
          // revoke previous permission
          await (
            await connectorRegistry.revokeRole(
              manager,
              deployer.address
            )
          ).wait()
          await (
            await connectorRegistry.revokeRole(
              adminRole,
              deployer.address
            )
          ).wait()
        }

        await (
          await connectorRegistry.transferOwnership(newOwner)
        ).wait()
      }
    }
  )
