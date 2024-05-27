import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { SmartWalletV3__factory } from '../typechain-types'

import { fixture } from './helper/fixture'
import {
  createSmartWallet,
  getBlockTimestamp,
  getFirstEvent
} from './helper/utils'

describe('walletFactory', () => {
  describe('A EOA', () => {
    it("should be able to create a new wallet with owner's signature", async () => {
      const { smartWalletOwner, guardians, walletFactory } =
        await loadFixture(fixture)

      const salt = ethers.utils.formatBytes32String('0x1')
      const recipt = await createSmartWallet(
        smartWalletOwner,
        guardians.map((g) => g.address.toLowerCase()).sort(),
        walletFactory,
        salt
      )

      // get WalletCreated event:
      const fromBlock = recipt.blockNumber
      const walletCreatedEvent = await getFirstEvent(
        walletFactory,
        fromBlock,
        'WalletCreated'
      )

      const smartWalletAddr =
        await walletFactory.computeWalletAddress(
          smartWalletOwner.address,
          salt
        )
      expect(smartWalletOwner.address).to.equal(
        walletCreatedEvent.args!.owner
      )
      expect(smartWalletAddr).to.equal(
        walletCreatedEvent.args!.wallet
      )

      const smartWallet = SmartWalletV3__factory.connect(
        smartWalletAddr,
        smartWalletOwner
      )

      // Check creation timestamp
      const blockTime = await getBlockTimestamp(recipt.blockNumber)
      const creationTimestamp =
        await smartWallet.getCreationTimestamp()
      expect(creationTimestamp.toNumber()).to.equal(blockTime)

      // Check owner
      const walletOwner = await smartWallet.getOwner()
      expect(walletOwner).to.equal(smartWalletOwner.address)
    })

    it('should be able to charge fees when creating a new wallet', async () => {
      // const { walletFactory, smartWalletOwner } = await loadFixture(fixture)
    })

    it('require(feeAmount <= maxFeeAmount) when creating a new wallet', async () => {
      // const { walletFactory, smartWalletOwner } = await loadFixture(fixture)
    })
  })

  describe('operator management', () => {
    it('only owner can add operators', async () => {
      const { walletFactory } = await loadFixture(fixture)
      const account2 = ethers.Wallet.createRandom().connect(
        ethers.provider
      )
      const account3 = ethers.Wallet.createRandom().connect(
        ethers.provider
      )
      expect(await walletFactory.isOperator(account2.address)).to.be
        .false
      await walletFactory.addOperator(account2.address)
      expect(await walletFactory.isOperator(account2.address)).to.be
        .true

      // others cannot add operators
      await expect(
        walletFactory.connect(account2).addOperator(account3.address)
      ).to.rejectedWith('UNAUTHORIZED')
    })

    it('can create wallet only by operator', async () => {
      const { smartWalletOwner, walletFactory } =
        await loadFixture(fixture)
      const [, account2] = await ethers.getSigners()
      const account2Addr = await account2.getAddress()
      // create wallet
      const owner = account2Addr
      const salt = 1

      const walletConfig: any = {
        owner,
        initOwner: owner,
        guardians: [],
        quota: 0,
        inheritor: ethers.constants.AddressZero,
        feeRecipient: ethers.constants.AddressZero,
        feeToken: ethers.constants.AddressZero,
        maxFeeAmount: 0,
        salt
      }

      const walletAddrComputed =
        await walletFactory.computeWalletAddress(owner, salt)

      await expect(
        walletFactory
          .connect(account2)
          .createWalletByOperator(walletConfig, 0)
      ).to.revertedWith('NOT A OPERATOR')
      await walletFactory.addOperator(account2Addr)
      await walletFactory
        .connect(account2)
        .createWalletByOperator(walletConfig, 0)

      // check wallet is created successfully
      const smartWallet = SmartWalletV3__factory.connect(
        walletAddrComputed,
        smartWalletOwner
      )
      expect(await smartWallet.getOwner()).to.eq(account2Addr)

      await walletFactory.removeOperator(account2Addr)
      await expect(
        walletFactory
          .connect(account2)
          .createWalletByOperator(walletConfig, 0)
      ).to.revertedWith('NOT A OPERATOR')
    })
  })
})
