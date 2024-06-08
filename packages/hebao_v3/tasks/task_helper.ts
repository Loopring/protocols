import { subtask, types } from 'hardhat/config'
import { type Contract, type ContractFactory } from 'ethers'

import {
  isNetworkForVerification,
  deploySingle,
  saveDeploymentsAddress,
  processArgs
} from 'src/deploy_utils'

export const TASK_DEPLOY_CONTRACTS = 'deploy-contracts'
export const TASK_VERIFY_CONTRACTS = 'verify-contracts'

export interface DeployTask {
  key?: string
  contractName: string
  verifiedName?: string
  args?: any[]
  libs?: string[]
  useCreate2?: boolean
  create2Factory?: Contract
  contractFactory?: ContractFactory
}

subtask(TASK_VERIFY_CONTRACTS)
  .addParam('tasks', undefined, [], types.any)
  .setAction(
    async (
      { tasks }: { tasks: DeployTask[] },
      { network, run, config, deployResults, ethers }
    ) => {
      if (isNetworkForVerification(network.name)) {
        for (const task of tasks) {
          const key = task.key ?? task.contractName
          if (ethers.utils.isAddress(deployResults[key])) {
            const libraries: Record<string, string> = {}
            task.libs?.forEach(
              (libName: string) =>
                (libraries[libName] = deployResults[libName])
            )
            const args = processArgs(task.args ?? [], deployResults)
            // handle for some special contracts with fixed addresses
            await run('verify:verify', {
              contract: task.verifiedName,
              address: deployResults[key],
              constructorArguments: args,
              libraries
            })
          } else {
            console.log(
              `unknown deployment task(${key}) to verify contract`
            )
          }
        }
      } else {
        console.log(
          `no need to verify contract when in ${network.name} network`
        )
      }
    }
  )

interface DeployContractsSubtaskArgs {
  tasks: DeployTask[]
  save: boolean
}

subtask(TASK_DEPLOY_CONTRACTS)
  .addParam('tasks', undefined, [], types.any)
  .addOptionalParam('save', undefined, true, types.boolean)
  .setAction(
    async (
      { tasks, save }: DeployContractsSubtaskArgs,
      { ethers, network, run, config, deployResults }
    ) => {
      const isNewDeployed: Record<string, boolean> = {}

      for (const task of tasks) {
        const key = task.key ?? task.contractName
        const libraries: Record<string, string> = {}
        task.libs?.forEach(
          (libName: string) =>
            (libraries[libName] = deployResults[libName])
        )
        const args = processArgs(task.args ?? [], deployResults)
        const contractFactory =
          task.contractFactory ??
          (await ethers.getContractFactory(task.contractName, {
            libraries
          }))

        if (ethers.utils.isAddress(deployResults[key])) {
          // TODO(check if deployed bytecodes onchain is consist with the current one)
          // if(contractFactory.bytecode===await ethers.provider.getCode(deployResults[key])){
          isNewDeployed[key] = false
          console.log(`task:${key} is deployed, skip.`)
          continue
          // }else{
          // console.log(`[${key}] bytecode is changed locally, deploy and upgrade to the newest one`)
          // }
        }
        let contractAddr: string
        if (task.useCreate2 ?? false) {
          if (task.create2Factory === undefined) {
            throw new Error(
              `create2Factory is not provided when deploying ${task.contractName}`
            )
          }
          const {
            contract,
            isNewDeployed: isTheContractNewDeployed
          } = await deploySingle(
            task.create2Factory,
            contractFactory,
            args,
            libraries
          )
          contractAddr = contract.address
          isNewDeployed[key] = isTheContractNewDeployed
        } else {
          const contract = await (
            await contractFactory.deploy(...args)
          ).deployed()
          contractAddr = contract.address
          isNewDeployed[key] = true
        }
        if (isNewDeployed[key] as boolean) {
          console.log(
            `${key}(${contractAddr}) is deployed successfully`
          )
        } else {
          console.log(`${key}(${contractAddr}) is deployed already`)
        }
        deployResults[key] = contractAddr
      }
      // no need to save addresses for some mock contracts
      if (save) {
        saveDeploymentsAddress({ ...deployResults }, network.name)
      }
      return { deployResults, isNewDeployed }
    }
  )
