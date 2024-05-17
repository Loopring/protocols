import { ethers } from 'hardhat'
import * as hre from 'hardhat'
import { ConnectorRegistry__factory } from '../typechain-types'
import { type DeploymentType } from './addresses'
import deploymentJson from '../deployments/deployments.json'
import { AddressForNetwork } from '../test/automation/automation_utils'

async function main(): Promise<void> {
  const signers = await ethers.getSigners()
  const deployer = signers[0]
  const connectorRegistryAddr = (
    deploymentJson as unknown as Record<string, DeploymentType>
  )[hre.network.name].ConnectorRegistry
  const connectorRegistry = ConnectorRegistry__factory.connect(
    connectorRegistryAddr,
    deployer
  )
  const ownedMemory = await (
    await (await ethers.getContractFactory('OwnedMemory')).deploy()
  ).deployed()
  console.log(`owned memory: `, ownedMemory.address)
  await hre.run('verify:verify', {
    address: ownedMemory.address
  })

  const { chainId } = await ethers.provider.getNetwork()
  const addressBook = AddressForNetwork[chainId]
  // check available in this network
  if (
    addressBook.SWAP_ROUTERV3_ADDRESS !== undefined &&
    (await ethers.provider.getCode(
      addressBook.SWAP_ROUTERV3_ADDRESS
    )) !== '0x'
  ) {
    const uniswapv3Connector = await (
      await (
        await ethers.getContractFactory('UniswapV3Connector')
      ).deploy(
        addressBook.SWAP_ROUTERV3_ADDRESS,
        ownedMemory.address,
        addressBook.WETH_ADDRESS
      )
    ).deployed()
    console.log(`uniswapv3 connector: `, uniswapv3Connector.address)
    await hre.run('verify:verify', {
      address: uniswapv3Connector.address,
      constructorArguments: [
        addressBook.SWAP_ROUTERV3_ADDRESS,
        ownedMemory.address,
        addressBook.WETH_ADDRESS
      ]
    })
    await (
      await connectorRegistry.addConnectors([
        uniswapv3Connector.address
      ])
    ).wait()
  } else {
    console.log('uniswapv3 is not supported, skip its connector')
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
