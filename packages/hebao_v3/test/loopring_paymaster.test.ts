import {
  loadFixture,
  time
} from '@nomicfoundation/hardhat-network-helpers'
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { fixture } from './helper/fixture'
import { type PaymasterOption, sendTx } from './helper/utils'

describe('LoopringPaymaster test', () => {
  describe('admin operation success', () => {
    it('adjust paramster params by owner', async () => {
      const { paymaster, somebody, lrcToken } = await loadFixture(
        fixture
      )

      await expect(
        paymaster.connect(somebody).addToken(lrcToken.address)
      ).to.revertedWith('Ownable: caller is not the owner')
      await paymaster.addToken(lrcToken.address)
      await expect(
        paymaster.addToken(lrcToken.address)
      ).to.revertedWith('registered already')
      expect(await paymaster.registeredToken(lrcToken.address)).to.be
        .true
      await paymaster.removeToken(lrcToken.address)
      await expect(
        paymaster.removeToken(lrcToken.address)
      ).to.revertedWith('unregistered already')
      expect(await paymaster.registeredToken(lrcToken.address)).to.be
        .false
    })

    it('roles management', async () => {
      const { paymaster, paymasterOwner: owner } = await loadFixture(
        fixture
      )
      // expect owner to be admin
      expect(
        await paymaster.hasRole(paymaster.SIGNER(), owner.address)
      ).to.be.true
      // add other to be admin
      const other = ethers.Wallet.createRandom()
      expect(
        await paymaster.hasRole(paymaster.SIGNER(), other.address)
      ).to.be.false
      await paymaster.grantRole(paymaster.SIGNER(), other.address)
      expect(
        await paymaster.hasRole(paymaster.SIGNER(), other.address)
      ).to.be.true
    })
  })

  describe('send userOp with paymaster', () => {
    it('transfer usdtToken with paymaster', async () => {
      const {
        entrypoint,
        smartWallet,
        smartWalletOwner,
        usdtToken,
        deployer,
        sendUserOp,
        create2,
        paymaster,
        paymasterOwner
      } = await loadFixture(fixture)
      // prepare mock usdt token first
      const initTokenAmount = ethers.utils.parseUnits('1000', 6)
      await usdtToken.setBalance(smartWallet.address, initTokenAmount)

      /// ///////////////////////////////////////
      // usdt token transfer test
      const tokenAmount = ethers.utils.parseUnits('100', 6)
      // approve paymaster before using usdt paymaster service
      const approveToken =
        await usdtToken.populateTransaction.approve(
          paymaster.address,
          ethers.constants.MaxUint256
        )
      const transferToken =
        await usdtToken.populateTransaction.transfer(
          deployer.address,
          tokenAmount
        )
      const valueOfEth = ethers.utils.parseUnits('625', 12)
      const paymasterOption: PaymasterOption = {
        paymaster,
        payToken: usdtToken,
        paymasterOwner,
        valueOfEth,
        validUntil: 0
      }

      expect(await usdtToken.balanceOf(deployer.address)).to.eq(0)

      // approve token and transfer at the same time
      const ethBalanceBefore = await ethers.provider.getBalance(
        smartWallet.address
      )
      await sendTx(
        [approveToken, transferToken],
        smartWallet,
        smartWalletOwner,
        create2,
        entrypoint,
        sendUserOp,
        paymasterOption
      )

      expect(await usdtToken.balanceOf(deployer.address)).to.eq(
        tokenAmount
      )
      // no any gas used by smart wallet
      expect(
        await ethers.provider.getBalance(smartWallet.address)
      ).to.eq(ethBalanceBefore)

      const afterBalance = await usdtToken.balanceOf(
        smartWallet.address
      )
      // fee is transfered to paymaster contract
      expect(await usdtToken.balanceOf(paymaster.address)).to.eq(
        initTokenAmount.sub(afterBalance).sub(tokenAmount)
      )
      // TODO(check eth balance for paymaster)

      // sendtx for free
      paymasterOption.valueOfEth = 0

      // eslint-disable-next-line
      expect(
        await sendTx(
          [transferToken],
          smartWallet,
          smartWalletOwner,
          create2,
          entrypoint,
          sendUserOp,
          paymasterOption
        )
      )
        .to.emit(paymaster, 'PaymasterEvent')
        .withArgs(
          anyValue,
          anyValue,
          anyValue,
          anyValue,
          ethers.constants.Zero
        )
      // no fee for sending tx
      expect(await usdtToken.balanceOf(smartWallet.address)).to.eq(
        afterBalance.sub(tokenAmount)
      )

      // if usdt token is unregistered, user cannot pay the tokens to paymaster any more
      await paymaster.removeToken(usdtToken.address)
      await expect(
        sendTx(
          [transferToken],
          smartWallet,
          smartWalletOwner,
          create2,
          entrypoint,
          sendUserOp,
          paymasterOption
        )
      )
        .to.revertedWithCustomError(entrypoint, 'FailedOp')
        .withArgs(
          0,
          'AA33 reverted: LoopringPaymaster: unsupported tokens'
        )
    })

    it('check valid until', async () => {
      const {
        entrypoint,
        smartWallet,
        smartWalletOwner,
        usdtToken,
        sendUserOp,
        create2,
        paymaster,
        paymasterOwner
      } = await loadFixture(fixture)
      // prepare mock usdt token first
      const initTokenAmount = ethers.utils.parseUnits('1000', 6)
      await usdtToken.setBalance(smartWallet.address, initTokenAmount)
      const value = ethers.utils.parseEther('10')
      const to = ethers.constants.AddressZero
      const transferEth = { value, to }
      const valueOfEth = ethers.utils.parseUnits('625', 12)
      const block = await ethers.provider.getBlock('latest')
      const paymasterOption: PaymasterOption = {
        paymaster,
        payToken: usdtToken,
        paymasterOwner,
        valueOfEth,
        validUntil: 1
      }
      // approve first
      const approveToken =
        await usdtToken.populateTransaction.approve(
          paymaster.address,
          ethers.constants.MaxUint256
        )

      await expect(
        sendTx(
          [approveToken],
          smartWallet,
          smartWalletOwner,
          create2,
          entrypoint,
          sendUserOp
        )
      ).not.to.reverted

      await expect(
        sendTx(
          [transferEth],
          smartWallet,
          smartWalletOwner,
          create2,
          entrypoint,
          sendUserOp,
          paymasterOption
        )
      )
        .to.revertedWithCustomError(entrypoint, 'FailedOp')
        .withArgs(0, 'AA32 paymaster expired or not due')
      paymasterOption.validUntil = 3600 + block.timestamp
      await expect(
        sendTx(
          [transferEth],
          smartWallet,
          smartWalletOwner,
          create2,
          entrypoint,
          sendUserOp,
          paymasterOption
        )
      ).not.to.reverted
    })

    it('deposit and withdraw eth for paymaster in entrypoint', async () => {
      const { deployer, paymaster } = await loadFixture(fixture)
      const amount = ethers.utils.parseEther('1')
      const depositAmountBefore = await paymaster.getDeposit()
      await paymaster.deposit({ value: amount })
      const depositAmountAfter = await paymaster.getDeposit()
      expect(depositAmountAfter.sub(depositAmountBefore)).to.eq(
        amount
      )

      // withdraw eth to deployer
      const withdrawer = deployer.address
      const balanceBefore = await ethers.provider.getBalance(
        withdrawer
      )
      await paymaster.withdrawTo(withdrawer, depositAmountAfter)
      const balanceAfter = await ethers.provider.getBalance(
        withdrawer
      )
      expect(balanceAfter.sub(balanceBefore)).eq(depositAmountAfter)
    })

    it('stake and unstake eth for paymaster in entrypoint', async () => {
      const { deployer, paymaster } = await loadFixture(fixture)
      const amount = ethers.utils.parseEther('1')
      const unstakeDelaySec = 10
      await paymaster.addStake(unstakeDelaySec, { value: amount })

      // withdraw eth to deployer
      await paymaster.unlockStake()
      // advance time after unlock
      await time.increase(unstakeDelaySec)
      const withdrawer = deployer.address
      const balanceBefore = await ethers.provider.getBalance(
        withdrawer
      )
      await paymaster.withdrawStake(withdrawer)
      const balanceAfter = await ethers.provider.getBalance(
        withdrawer
      )
      expect(balanceAfter.sub(balanceBefore)).eq(amount)
    })

    it('reject eth and any erc20 token directly', async () => {
      const { deployer, paymaster } = await loadFixture(fixture)
      const value = ethers.utils.parseEther('1')
      await expect(
        deployer.sendTransaction({ to: paymaster.address, value })
      ).to.revertedWith('eth rejected')
    })
  })

  describe('gas tank', () => {
    it('deposit and withdraw for user', async () => {
      const { deployer, paymaster, lrcToken } = await loadFixture(
        fixture
      )
      const amount = ethers.utils.parseUnits(
        '1000',
        await lrcToken.decimals()
      )
      await lrcToken.setBalance(deployer.address, amount)
      await lrcToken.approve(paymaster.address, amount)
      await expect(
        paymaster
          .connect(deployer)
          .addDepositFor(lrcToken.address, deployer.address, amount)
      ).to.revertedWith('LoopringPaymaster: unsupported token')

      // add token before deposit
      await paymaster.addToken(lrcToken.address)
      await paymaster
        .connect(deployer)
        .addDepositFor(lrcToken.address, deployer.address, amount)
      // check deposit info
      const depositInfo = await paymaster.depositInfo(
        lrcToken.address,
        deployer.address
      )
      // token is already locked in paymaster contract
      expect(depositInfo._unlockBlock).to.eq(0)
      expect(depositInfo.amount).to.eq(amount)

      // unlock and withdraw token
      await expect(
        paymaster
          .connect(deployer)
          .withdrawTokensTo(
            lrcToken.address,
            deployer.address,
            amount
          )
      ).to.revertedWith('LoopringPaymaster: must unlockTokenDeposit')
      await paymaster.connect(deployer).unlockTokenDeposit()
      await paymaster
        .connect(deployer)
        .withdrawTokensTo(lrcToken.address, deployer.address, amount)
      expect(await lrcToken.balanceOf(deployer.address)).to.eq(amount)
    })

    it('transfer usdtToken with gastank', async () => {
      const {
        entrypoint,
        smartWallet,
        smartWalletOwner,
        usdtToken,
        deployer,
        sendUserOp,
        create2,
        paymaster,
        paymasterOwner
      } = await loadFixture(fixture)
      // prepare enviroment first
      const initAmount = ethers.utils.parseUnits('1000', 6)
      await usdtToken.setBalance(deployer.address, initAmount)
      await usdtToken.approve(paymaster.address, initAmount)

      // predeposit usdt token to paymaster for smartwallet
      await paymaster
        .connect(deployer)
        .addDepositFor(
          usdtToken.address,
          smartWallet.address,
          initAmount
        )

      const value = ethers.utils.parseEther('10')
      const to = ethers.constants.AddressZero
      const transferEth = { value, to }
      const valueOfEth = ethers.utils.parseUnits('625', 12)
      const paymasterOption: PaymasterOption = {
        paymaster,
        payToken: usdtToken,
        paymasterOwner,
        valueOfEth,
        validUntil: 0
      }
      const unlock =
        await paymaster.populateTransaction.unlockTokenDeposit()

      await sendTx(
        [unlock],
        smartWallet,
        smartWalletOwner,
        create2,
        entrypoint,
        sendUserOp,
        paymasterOption
      )
      await expect(
        sendTx(
          [transferEth],
          smartWallet,
          smartWalletOwner,
          create2,
          entrypoint,
          sendUserOp,
          paymasterOption
        )
      )
        .to.revertedWithCustomError(entrypoint, 'FailedOp')
        .withArgs(
          0,
          'AA33 reverted: LoopringPaymaster: no enough available tokens'
        )

      // only locked fund can be used for gas fee. so lock it again here.
      // note that cannot lock fund using paymaster service
      const lock =
        await paymaster.populateTransaction.lockTokenDeposit()
      await sendTx(
        [lock],
        smartWallet,
        smartWalletOwner,
        create2,
        entrypoint,
        sendUserOp
      )
      await sendTx(
        [transferEth],
        smartWallet,
        smartWalletOwner,
        create2,
        entrypoint,
        sendUserOp,
        paymasterOption
      )

      // withdraw token by paymaster owner
      const receiver = paymasterOwner.address
      const depositInfo = await paymaster.depositInfo(
        usdtToken.address,
        paymasterOwner.address
      )
      expect(depositInfo.amount).to.gt(0)
      // unlock before withdraw
      await paymaster.unlockTokenDeposit()
      await paymaster.withdrawTokensTo(
        usdtToken.address,
        receiver,
        depositInfo.amount
      )
      expect(await usdtToken.balanceOf(receiver)).to.eq(
        depositInfo.amount
      )
    })
  })
})
