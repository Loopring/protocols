import deploymentJson from '../deployments/deployments.json'
import * as hre from 'hardhat'
import { type Libraries } from '@nomiclabs/hardhat-ethers/types'
import { saveDeploymentsAddress } from './addresses'
import { deploySingle } from '../test/helper/utils'
import { type Contract } from 'ethers'

export function getDeploymentsForNetwork(): Record<string, string> {
  if (hre.network.name in deploymentJson) {
    return (
      deploymentJson as unknown as Record<
        string,
        Record<string, string>
      >
    )[hre.network.name]
  }
  return {}
}
interface Task {
  contractName: string
  args?: any[]
  useCreate2?: boolean
  create2Factory?: Contract
  libraries?: Libraries
}

function supportedNetworkForVerification(name: string): boolean {
  return name in ['sepolia', 'ethereum', 'base']
}

export async function deployAndVerify(
  tasks: Task[]
): Promise<Record<string, string>> {
  const addressBook: Record<string, string> = {}
  const deployments = getDeploymentsForNetwork()
  for (const task of tasks) {
    let contractAddr: string
    // deployed already
    if (task.contractName in deployments) {
      if (supportedNetworkForVerification(hre.network.name)) {
        await hre.run('verify:verify', {
          address: deployments[task.contractName],
          constructorArguments: task.args,
          libraries: task.libraries
        })
      }
      contractAddr = deployments[task.contractName]
    } else {
      if (task.useCreate2 ?? false) {
        if (task.create2Factory === undefined) {
          throw new Error(
            `create2Factory is not provided when deploying ${task.contractName}`
          )
        }
        contractAddr = (
          await deploySingle(
            task.create2Factory,
            task.contractName,
            task.args,
            task.libraries
          )
        ).address
      } else {
        contractAddr = (
          await (
            await hre.ethers.getContractFactory(task.contractName, {
              libraries: task.libraries
            })
          ).deploy(task.args)
        ).address
      }
    }
    addressBook[task.contractName] = contractAddr
  }

  saveDeploymentsAddress(
    addressBook,
    hre.network.name,
    './deployments'
  )
  return addressBook
}
