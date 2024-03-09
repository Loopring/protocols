import { expect } from 'chai'
import { type SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ethers } from 'hardhat'
import {
  loadFixture,
  setBalance
} from '@nomicfoundation/hardhat-network-helpers'
import { type OfficialGuardian } from '../typechain-types'
import { type Wallet } from 'ethers'

describe('official guardian test', () => {
  async function fixture(): Promise<{
    officialGuardian: OfficialGuardian
    someone: Wallet
    deployer: SignerWithAddress
  }> {
    const deployer = (await ethers.getSigners())[0]
    const officialGuardian = await (
      await ethers.getContractFactory('OfficialGuardian')
    ).deploy()
    const someone = ethers.Wallet.createRandom().connect(
      ethers.provider
    )
    // prepare gas fee
    await setBalance(someone.address, ethers.utils.parseEther('10'))
    return { someone, officialGuardian, deployer }
  }

  it('basic usage test', async () => {
    const { deployer, officialGuardian, someone } =
      await loadFixture(fixture)
    expect(await officialGuardian.owner()).to.eq(deployer.address)

    // call transact
    await officialGuardian.addManager(someone.address)
    await setBalance(
      officialGuardian.address,
      ethers.utils.parseEther('10')
    )
    const amount = ethers.utils.parseEther('1')
    // new address is ok
    const receiver = ethers.constants.AddressZero
    await expect(
      officialGuardian
        .connect(deployer)
        .transact(receiver, amount, '0x')
    ).to.revertedWith('NOT_MANAGER')
    await officialGuardian
      .connect(someone)
      .transact(receiver, amount, '0x')
    expect(await ethers.provider.getBalance(receiver)).to.eq(amount)

    // call init owner
    await expect(
      officialGuardian.initOwner(ethers.constants.AddressZero)
    ).to.revertedWith('LRC#104')
    await expect(
      officialGuardian.initOwner(someone.address)
    ).to.revertedWith('LRC#306')

    // TODO(call initOwner when using proxy contract)
  })
  it('ownership management', async () => {
    const { officialGuardian, someone, deployer } =
      await loadFixture(fixture)
    await expect(
      officialGuardian
        .connect(someone)
        .transferOwnership(someone.address)
    ).to.revertedWith('UNAUTHORIZED')
    await officialGuardian
      .connect(deployer)
      .transferOwnership(someone.address)
    await officialGuardian.connect(someone).claimOwnership()
    expect(await officialGuardian.owner()).to.eq(someone.address)
  })

  it('manager management', async () => {
    const { officialGuardian, someone } = await loadFixture(fixture)
    expect(await officialGuardian.numManagers()).to.eq(0)
    expect(await officialGuardian.isManager(someone.address)).to.be
      .false
    await officialGuardian.addManager(someone.address)
    expect(await officialGuardian.isManager(someone.address)).to.be
      .true
    expect(await officialGuardian.numManagers()).to.eq(1)
    await officialGuardian.removeManager(someone.address)
    expect(await officialGuardian.isManager(someone.address)).to.be
      .false
    expect(await officialGuardian.numManagers()).to.eq(0)
  })
})
