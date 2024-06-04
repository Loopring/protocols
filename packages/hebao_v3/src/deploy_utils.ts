import * as fs from 'fs'
import { type Contract, type ContractFactory } from 'ethers'
import { type JsonRpcProvider } from '@ethersproject/providers'
import { ethers } from 'ethers'
import assert from 'assert'

export type DeploymentsAddress = Record<
  string,
  Record<string, string>
>

function saveSharedDeploymentsAddress(
  sharedFile: string,
  addressBook: Record<string, string>
): void {
  let sharedDeployments: Record<string, string> = {}
  if (fs.existsSync(sharedFile)) {
    sharedDeployments = JSON.parse(
      fs.readFileSync(sharedFile, 'utf-8')
    )
  }
  const sharedFields = [
    // shared amm libraries and its implementation
    'UDST',
    'LRC',
    'EntryPoint',
    'ERC1271Lib',
    'ERC20Lib',
    'GuardianLib',
    'InheritanceLib',
    'QuotaLib',
    'UpgradeLib',
    'WhitelistLib',
    'LockLib',
    'RecoverLib',
    'ApprovalLib',
    'SmartWalletV3'
  ]
  for (const field of sharedFields) {
    if (field in addressBook) {
      sharedDeployments[field] = addressBook[field]
      // remove shared field from address book, the remaining fields is only used for exclusive deployment
      // eslint-disable-next-line
      delete addressBook[field]
    }
  }
  fs.writeFileSync(
    sharedFile,
    JSON.stringify(sharedDeployments, null, 2)
  )
}

export function saveDeploymentsAddress(
  addressBook: Record<string, string>,
  networkName: string,
  deploymentsDir = './deployments',
  env = process.env.ENV ?? 'dev',
  onlyUpdate = true
): void {
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir)
  }

  deploymentsDir = [deploymentsDir, networkName].join('/')
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir)
  }

  // save shared contracts addresses to shared file
  const sharedFile = deploymentsDir + `/deployment_shared.json`
  saveSharedDeploymentsAddress(sharedFile, addressBook)

  const path = deploymentsDir + '/deployments.json'
  let deployments: DeploymentsAddress = {}
  if (fs.existsSync(path)) {
    deployments = JSON.parse(fs.readFileSync(path, 'utf-8'))
  }

  if (onlyUpdate) {
    if (!(env in deployments)) {
      deployments[env] = {}
    }
    // update based on previous existed addresses
    Object.assign(deployments[env], addressBook)
  } else {
    // replace
    deployments[env] = addressBook
  }
  fs.writeFileSync(path, JSON.stringify(deployments, null, 2))
  console.log(`deployments info is saved to ${path}`)
}

export function isNetworkForSaving(network: string): boolean {
  return !['hardhat'].includes(network)
}

export function isNetworkForVerification(network: string): boolean {
  return !['hardhat', 'localhost'].includes(network)
}

export function loadDeployResult(
  networkName: string,
  deploymentsDir = './deployments',
  env = process.env.ENV ?? 'dev'
): Record<string, string> {
  const resDir = [deploymentsDir, networkName].join('/')
  const envFile = resDir + `/deployments.json`
  const sharedFile = resDir + `/deployment_shared.json`
  let sharedResult = {}
  if (fs.existsSync(sharedFile)) {
    sharedResult = JSON.parse(fs.readFileSync(sharedFile, 'ascii'))
  }

  if (fs.existsSync(envFile)) {
    const exclusiveResult =
      JSON.parse(fs.readFileSync(envFile, 'ascii'))[env] ?? {}
    const deployResult = Object.assign(sharedResult, exclusiveResult)
    return deployResult
  }
  return sharedResult
}

export function processArgs(
  args: any[],
  deployResult: Record<string, string>
): any[] {
  const newArgs: any[] = []
  for (const arg of args) {
    if (Array.isArray(arg)) {
      const newArrayArg = processArgs(arg, deployResult)
      newArgs.push(newArrayArg)
    } else {
      if (
        typeof arg === 'string' &&
        (arg as string).startsWith('>>>')
      ) {
        const key = (arg as string).slice(3)
        // get addr from deployResult:
        const contractAddr: string = deployResult[key]
        assert(
          contractAddr,
          'Error: param contract ' + key + ' not deployed yet!'
        )
        newArgs.push(contractAddr)
      } else {
        newArgs.push(arg)
      }
    }
  }
  return newArgs
}

export async function deploySingle(
  deployFactory: Contract,
  contractFactory: ContractFactory,
  args?: any[],
  libraries?: Record<string, any>,
  salt = ethers.utils.formatBytes32String('0x5') // default salt for create2 deployment
): Promise<{ contract: Contract; isNewDeployed: boolean }> {
  let deployableCode = contractFactory.bytecode
  if (args !== undefined && args.length > 0) {
    deployableCode = ethers.utils.hexConcat([
      deployableCode,
      contractFactory.interface.encodeDeploy(args)
    ])
  }

  const deployedAddress = ethers.utils.getCreate2Address(
    deployFactory.address,
    salt,
    ethers.utils.keccak256(deployableCode)
  )
  let isNewDeployed = true
  // check if it is deployed already
  if (
    (await deployFactory.provider.getCode(deployedAddress)) !== '0x'
  ) {
    isNewDeployed = false
  } else {
    await (await deployFactory.deploy(deployableCode, salt)).wait()
  }
  return {
    contract: contractFactory.attach(deployedAddress),
    isNewDeployed
  }
}

export async function checkValidContractAddress(
  newImpl: string,
  provider: ethers.providers.Provider,
  name = 'unknown'
): Promise<void> {
  assert(
    ethers.utils.isAddress(newImpl) &&
      (await provider.getCode(newImpl)) !== '0x',
    `address(${name}) is not a valid contract address: ${newImpl}`
  )
  // TODO(try to call some functions)
}

export async function checkIfContractAddress(
  newImpl: string,
  provider: JsonRpcProvider
): Promise<boolean> {
  return (
    ethers.utils.isAddress(newImpl) &&
    (await provider.getCode(newImpl)) !== '0x'
  )
}

export function taggedName(name: string, tag: string): string {
  return `${name}${tag}`
}

export function processAddressOrName(
  addressOrName: string,
  deployResults: Record<string, string>
): string {
  // assume receiver address is contract name when  is not a valid address
  if (!ethers.utils.isAddress(addressOrName)) {
    addressOrName = deployResults[addressOrName]
    assert(
      addressOrName !== undefined,
      `unknown contract name: ${addressOrName}`
    )
  }
  return addressOrName
}
