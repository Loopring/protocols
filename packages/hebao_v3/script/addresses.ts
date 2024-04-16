import * as fs from 'fs'

export type DeploymentsAddress = Record<
  string,
  Record<string, string>
>

export interface DeploymentType {
  EntryPoint: string
  LoopringPaymaster: string
  ConnectorRegistry: string
  SmartWallet?: string
  WalletFactory?: string
  OfficialGuardian?: string
  LoopringCreate2Deployer?: string
  USDT?: string
}

export function saveDeploymentsAddress(
  addressBook: Record<string, string>,
  network: string,
  deploymentsDir: string,
  onlyUpdate = true
): void {
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir)
  }

  const path = deploymentsDir + '/deployments.json'
  let deployments: DeploymentsAddress = {}
  if (fs.existsSync(path)) {
    deployments = JSON.parse(fs.readFileSync(path, 'utf-8'))
  }
  if (onlyUpdate) {
    // update based on previous existed addresses
    Object.assign(deployments[network], addressBook)
  } else {
    // replace
    deployments[network] = addressBook
  }
  fs.writeFileSync(path, JSON.stringify(deployments, null, 2))
  console.log(`deployments info is saved to ${path}`)
}
