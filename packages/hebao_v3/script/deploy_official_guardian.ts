import { deployOfficialGuardian } from './deploy_utils'
import { saveDeploymentsAddress } from './addresses'
import { type SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import {
  OfficialGuardian__factory,
  OwnedUpgradeabilityProxy__factory,
  type OfficialGuardian
} from '../typechain-types'
import * as hre from 'hardhat'
import { ethers } from 'hardhat'
import systemConfig from '../deployments/system_config.json'

// eslint-disable-next-line
async function transferOwnership(
  officialGuardian: OfficialGuardian,
  deployer: SignerWithAddress,
  newOwner: string
): Promise<void> {
  // transfer ownership of offician guardians
  if (
    (await officialGuardian.pendingOwner()) ===
      ethers.constants.AddressZero &&
    (await officialGuardian.owner()).toLowerCase() ===
      deployer.address.toLowerCase()
  ) {
    await (await officialGuardian.transferOwnership(newOwner)).wait()
  }

  // called by new owner
  // await (await officialGuardian.claimOwnership()).wait()

  // transfer ownership of proxy
  const proxy = OwnedUpgradeabilityProxy__factory.connect(
    officialGuardian.address,
    deployer
  )
  if ((await proxy.proxyOwner()) === deployer.address) {
    await (await proxy.transferProxyOwnership(newOwner)).wait()
  }
}

async function main(): Promise<void> {
  const signers = await ethers.getSigners()
  const deployer = signers[0]
  const proxyAddress = await deployOfficialGuardian(deployer)
  const officialGuardian = OfficialGuardian__factory.connect(
    proxyAddress,
    deployer
  )
  const manager = systemConfig.manager
  if (!(await officialGuardian.isManager(manager))) {
    await (await officialGuardian.addManager(manager)).wait()
  }
  saveDeploymentsAddress(
    { OfficialGuardian: officialGuardian.address },
    hre.network.name,
    './deployments'
  )
  // including ownership of proxy and its implementation
  // TODO(modify it)
  // const newOwner = manager
  // await transferOwnership(officialGuardian, deployer, newOwner)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
