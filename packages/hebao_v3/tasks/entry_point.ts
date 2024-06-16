import { scope, types } from 'hardhat/config'
import {
  TASK_DEPLOY_CONTRACTS,
  TASK_VERIFY_CONTRACTS,
  type DeployTask
} from 'tasks/task_helper'
import {
  checkValidContractAddress,
  checkIfContractAddress,
  saveDeploymentsAddress,
  processAddressOrName
} from 'src/deploy_utils'
import { entrypointAddr } from 'src/constants'

export const SCOPE_ENTRYPOINT = 'entrypoint'
export const TASK_DEPLOY = 'deploy'
export const TASK_DEPOSIT = 'deposit'
export const TASK_VERIFY = 'verify'

const entryPointScope = scope(SCOPE_ENTRYPOINT, 'entrypoint')

entryPointScope
  .task(TASK_DEPLOY, 'deploy entrypoint')
  .setAction(async (_, { ethers, network, run }) => {
    if (
      await checkIfContractAddress(entrypointAddr, ethers.provider)
    ) {
      // deployed already by offical
      saveDeploymentsAddress(
        { EntryPoint: entrypointAddr },
        network.name
      )
    } else {
      const tasks: DeployTask[] = [
        {
          contractName: 'EntryPoint'
        }
      ]
      await run(TASK_DEPLOY_CONTRACTS, { tasks })
    }
  })

entryPointScope
  .task(TASK_VERIFY, 'verify entrypoint code')
  .setAction(async (_, { ethers, network, run }) => {
    // only verify contract that is not deployed by official
    if (
      !(await checkIfContractAddress(entrypointAddr, ethers.provider))
    ) {
      const tasks: DeployTask[] = [
        {
          contractName: 'EntryPoint'
        }
      ]
      await run(TASK_VERIFY_CONTRACTS, { tasks })
    } else {
      console.log('no need to verify entrypoint deployed by official')
    }
  })

entryPointScope
  .task(TASK_DEPOSIT, 'deposit eth')
  .addParam(
    'amount',
    'eth amount to deposit',
    undefined,
    types.string
  )
  .addParam(
    'receiver',
    'address or contract name(e.g, smart wallet or paymaster) to deposit token for',
    undefined,
    types.string
  )
  .setAction(
    async (
      { receiver, amount }: { receiver: string; amount: string },
      { ethers, network, run, deployResults }
    ) => {
      await checkValidContractAddress(
        deployResults.EntryPoint,
        ethers.provider
      )
      const entrypoint = await ethers.getContractAt(
        'EntryPoint',
        deployResults.EntryPoint
      )
      receiver = processAddressOrName(receiver, deployResults)
      // only contract address is accepted
      await checkValidContractAddress(
        receiver,
        ethers.provider,
        'receiver'
      )
      await (
        await entrypoint.depositTo(receiver, {
          value: ethers.utils.parseEther(amount)
        })
      ).wait()
    }
  )
