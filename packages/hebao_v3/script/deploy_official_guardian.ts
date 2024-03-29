import { deployOfficialGuardian } from './deploy_utils'
import { saveDeploymentsAddress } from './addresses'
import {
  OfficialGuardian__factory,
  OwnedUpgradeabilityProxy__factory
} from '../typechain-types'
import * as hre from 'hardhat'
import { ethers } from 'hardhat'

async function main(): Promise<void> {
  const signers = await ethers.getSigners()
  const deployer = signers[0]
  const proxyAddress = await deployOfficialGuardian()
  const officialGuardian = OfficialGuardian__factory.connect(
    proxyAddress,
    deployer
  )
  const manager = '0xf6c53560e79857ce12dde54782d487b743b70717'
  if (!(await officialGuardian.isManager(manager))) {
    await (await officialGuardian.addManager(manager)).wait()
  }
  saveDeploymentsAddress(
    { OfficialGuardian: officialGuardian.address },
    hre.network.name,
    './deployments',
    true
  )
  const newOwner = manager
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
    proxyAddress,
    deployer
  )
  if ((await proxy.proxyOwner()) === deployer.address) {
    await (await proxy.transferProxyOwnership(newOwner)).wait()
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
