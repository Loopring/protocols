import { expect } from 'chai'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { ethers } from 'hardhat'
import { type SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { type LoopringCreate2Deployer } from '../typechain-types'

describe('loopring create test', () => {
  async function fixture(): Promise<{
    deployFactory: LoopringCreate2Deployer
    salt: string
    deployer: SignerWithAddress
    other: SignerWithAddress
  }> {
    const create2 = await (
      await ethers.getContractFactory('LoopringCreate2Deployer')
    ).deploy()
    const salt = ethers.utils.formatBytes32String('0x5')

    const [deployer, other] = await ethers.getSigners()
    return { deployFactory: create2, salt, deployer, other }
  }

  it('deploy contracts', async () => {
    const { deployFactory, salt } = await loadFixture(fixture)
    const contract = await ethers.getContractFactory('LRC')
    const tx = contract.getDeployTransaction()
    await deployFactory.deploy(tx.data!, salt)

    const deployedAddress = ethers.utils.getCreate2Address(
      deployFactory.address,
      salt,
      ethers.utils.keccak256(tx.data!)
    )
    // test deployed contract
    const lrc = contract.attach(deployedAddress)
    expect(await lrc.name()).to.eq('LRC_TEST')
  })

  it('deploy complex contract', async () => {
    const { deployFactory, salt, deployer } =
      await loadFixture(fixture)
    const contract = await ethers.getContractFactory('WalletFactory')
    const deployableCode = contract.getDeployTransaction(
      ethers.constants.AddressZero
    ).data!
    await deployFactory.deploy(deployableCode, salt)

    const deployedAddress = ethers.utils.getCreate2Address(
      deployFactory.address,
      salt,
      ethers.utils.keccak256(deployableCode)
    )

    const walletFactory = contract.attach(deployedAddress)

    await deployFactory.setTarget(walletFactory.address)
    const transferOwnership =
      walletFactory.interface.encodeFunctionData(
        'transferOwnership',
        [deployer.address]
      )

    expect(await walletFactory.owner()).to.eq(deployFactory.address)
    await deployFactory.transact(transferOwnership)
    expect(await walletFactory.owner()).to.eq(deployer.address)
  })

  it('transfer ownership', async () => {
    const { deployFactory, deployer, other } =
      await loadFixture(fixture)
    expect(await deployFactory.owner()).to.eq(deployer.address)
    await deployFactory.transferOwnership(other.address)
    await deployFactory.connect(other).claimOwnership()
    expect(await deployFactory.owner()).to.eq(other.address)
  })

  it('permission checks', async () => {
    const { deployFactory, deployer, other } =
      await loadFixture(fixture)
    const bytes4 = '0x12345678'
    expect(await deployFactory.hasAccessTo(deployer.address, bytes4))
      .to.be.true
    expect(await deployFactory.hasAccessTo(other.address, bytes4)).to
      .be.false

    await expect(deployFactory.setTarget(other.address)).not.to
      .reverted
    await expect(
      deployFactory.connect(other).setTarget(other.address)
    ).to.revertedWith('UNAUTHORIZED')

    await expect(deployFactory.transact(bytes4)).not.to.reverted
    await expect(
      deployFactory.connect(other).transact(bytes4)
    ).to.revertedWith('PERMISSION_DENIED')

    await deployFactory.grantAccess(other.address, bytes4, true)
    await expect(deployFactory.connect(other).transact(bytes4)).not.to
      .reverted

    await deployFactory.grantAccess(other.address, bytes4, false)
    await expect(
      deployFactory.connect(other).transact(bytes4)
    ).to.revertedWith('PERMISSION_DENIED')
  })
})
