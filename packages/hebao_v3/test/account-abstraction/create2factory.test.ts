import { type Provider } from '@ethersproject/providers'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { TestToken__factory } from '../../typechain-types'
import { Create2Factory } from '../helper/Create2Factory'

describe('test Create2Factory', () => {
  let factory: Create2Factory
  let provider: Provider
  before(async () => {
    provider = ethers.provider
    factory = new Create2Factory(provider)
  })
  it.skip('should deploy the factory', async () => {
    console.log(await factory._isFactoryDeployed())
    expect(await factory._isFactoryDeployed()).to.equal(
      false,
      'factory exists before test deploy'
    )
    await factory.deployFactory()
    expect(await factory._isFactoryDeployed()).to.equal(
      true,
      'factory failed to deploy'
    )
  })

  it('should deploy to known address', async () => {
    const initCode = TestToken__factory.bytecode

    const addr = Create2Factory.getDeployedAddress(initCode, 0)

    expect(
      await provider.getCode(addr).then((code) => code.length)
    ).to.equal(2)
    await factory.deploy(initCode, 0)
    expect(
      await provider.getCode(addr).then((code) => code.length)
    ).to.gt(100)
  })
  it('should deploy to different address based on salt', async () => {
    const initCode = TestToken__factory.bytecode

    const addr = Create2Factory.getDeployedAddress(initCode, 123)

    expect(
      await provider.getCode(addr).then((code) => code.length)
    ).to.equal(2)
    await factory.deploy(initCode, 123)
    expect(
      await provider.getCode(addr).then((code) => code.length)
    ).to.gt(100)
  })
})
