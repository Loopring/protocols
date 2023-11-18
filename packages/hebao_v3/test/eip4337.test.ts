import {
  loadFixture,
  setBalance
} from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { BigNumber, BigNumberish, PopulatedTransaction, Wallet } from 'ethers'
import { ethers } from 'hardhat'

import {
  EntryPoint,
  LoopringCreate2Deployer,
  SmartWalletV3,
  SmartWalletV3__factory
} from '../typechain-types'

import {
  fillAndMultiSign,
  fillAndSign,
  UserOperation
} from './helper/AASigner'
import { ActionType } from './helper/LoopringGuardianAPI'
import { fixture } from './helper/fixture'
import {
  createSmartWallet,
  getCurrentQuota,
  sendTx,
  simulationResultCatch
} from './helper/utils'

describe('eip4337 test', () => {
  // execute tx from entrypoint instead of `execute` or `executebatch`
  async function getSignedUserOp (
    tx: PopulatedTransaction,
    nonce: BigNumberish,
    smartWallet: SmartWalletV3,
    smartWalletOwner: Wallet,
    create2: LoopringCreate2Deployer,
    entrypoint: EntryPoint
  ): Promise<UserOperation> {
    const partialUserOp: Partial<UserOperation> = {
      sender: smartWallet.address,
      nonce,
      callData: tx.data,
      callGasLimit: '126880'
    }
    const signedUserOp = await fillAndSign(
      partialUserOp,
      smartWalletOwner,
      create2.address,
      entrypoint
    )
    return signedUserOp
  }

  it('empty calldata', async () => {
    const {
      smartWallet,
      smartWalletOwner,
      create2,
      sendUserOp,
      entrypoint
    } = await loadFixture(fixture)
    const tx = { to: smartWallet.address, data: '0x' }
    const nonce = await smartWallet.getNonce()
    const signedUserOp = await getSignedUserOp(
      tx,
      nonce,
      smartWallet,
      smartWalletOwner,
      create2,
      entrypoint
    )
    await entrypoint.callStatic
      .simulateValidation(signedUserOp)
      .catch(simulationResultCatch)
    await sendUserOp(signedUserOp)
  })

  it('invalid nonce', async () => {
    const {
      smartWallet,
      smartWalletOwner,
      create2,
      entrypoint
    } = await loadFixture(fixture)
    const changeDailyQuota =
      await smartWallet.populateTransaction.changeDailyQuota(100)
    // too small or too larger, neither of them is valid
    const invalidNonces = [ethers.constants.MaxUint256]
    for (let i = 0; i < invalidNonces.length; ++i) {
      const signedUserOp = await getSignedUserOp(
        changeDailyQuota,
        invalidNonces[i],
        smartWallet,
        smartWalletOwner,
        create2,
        entrypoint
      )
      await expect(entrypoint.callStatic.simulateValidation(signedUserOp))
        .to.revertedWithCustomError(entrypoint, 'FailedOp')
        .withArgs(0, 'AA25 invalid account nonce')
    }
  })
  it('execute tx directly from entrypoint', async () => {
    const {
      smartWallet,
      smartWalletOwner,
      create2,
      sendUserOp,
      entrypoint
    } = await loadFixture(fixture)
    const addGuardian = await smartWallet.populateTransaction.addGuardian(
      ethers.constants.AddressZero
    )
    const nonce = await smartWallet.getNonce()
    const signedUserOp = await getSignedUserOp(
      addGuardian,
      nonce,
      smartWallet,
      smartWalletOwner,
      create2,
      entrypoint
    )
    await sendUserOp(signedUserOp)

    // replay it using the same nonce
    await expect(sendUserOp(signedUserOp))
      .to.revertedWithCustomError(entrypoint, 'FailedOp')
      .withArgs(0, 'AA25 invalid account nonce')
  })
  it('cannot execute changeDailyQuota tx when wallet is locked', async () => {
    const {
      smartWallet,
      smartWalletOwner,
      create2,
      sendUserOp,
      entrypoint
    } = await loadFixture(fixture)
    await smartWallet.lock()
    const changeDailyQuota =
      await smartWallet.populateTransaction.changeDailyQuota(100)
    const nonce = await smartWallet.getNonce()
    const signedUserOp = await getSignedUserOp(
      changeDailyQuota,
      nonce,
      smartWallet,
      smartWalletOwner,
      create2,
      entrypoint
    )
    await expect(sendUserOp(signedUserOp))
      .to.revertedWithCustomError(entrypoint, 'FailedOp')
      .withArgs(0, 'AA23 reverted: wallet is locked')
  })

  it('check valid until', async () => {
    const {
      entrypoint,
      smartWallet,
      smartWalletOwner,
      create2,
      sendUserOp,
      smartWalletImpl,
      guardians
    } = await loadFixture(fixture)

    const newQuota = 100
    let validUntil = 1
    const approvalOption = {
      validUntil,
      salt: ethers.utils.randomBytes(32),
      action_type: ActionType.ChangeDailyQuota
    }
    const callData = smartWallet.interface.encodeFunctionData(
      'changeDailyQuotaWA',
      [newQuota]
    )
    const signedUserOp = await fillAndMultiSign(
      callData,
      smartWallet,
      smartWalletOwner,
      [
        { signer: smartWalletOwner },
        {
          signer: guardians[0]
        }
      ],
      create2.address,
      smartWalletImpl.address,
      approvalOption,
      entrypoint
    )

    // new salt
    approvalOption.salt = ethers.utils.randomBytes(32)
    await expect(sendUserOp(signedUserOp))
      .to.revertedWithCustomError(entrypoint, 'FailedOp')
      .withArgs(0, 'AA22 expired or not due')
    const block = await ethers.provider.getBlock('latest')
    validUntil = block.timestamp + 3600

    const signedUserOp2 = await fillAndMultiSign(
      callData,
      smartWallet,
      smartWalletOwner,
      [
        { signer: smartWalletOwner },
        {
          signer: guardians[0]
        }
      ],
      create2.address,
      smartWalletImpl.address,
      approvalOption,
      entrypoint
    )
    await entrypoint.callStatic
      .simulateValidation(signedUserOp2)
      .catch(simulationResultCatch)
  })
  it('transfer token from wallet owner', async () => {
    const {
      smartWallet,
      deployer,
      usdtToken
    } = await loadFixture(fixture)
    const initTokenAmount = ethers.utils.parseUnits('1000', 6)
    await usdtToken.setBalance(smartWallet.address, initTokenAmount)
    const receiver = deployer.address
    const usdtTokenBalanceBefore = await usdtToken.balanceOf(receiver)
    const tokenAmount = ethers.utils.parseUnits('100', 6)
    await smartWallet.transferToken(
      usdtToken.address,
      receiver,
      tokenAmount,
      '0x',
      false
    )
    const usdtTokenBalanceAfter = await usdtToken.balanceOf(receiver)
    expect(usdtTokenBalanceAfter.sub(usdtTokenBalanceBefore)).to.eq(
      tokenAmount
    )
  })
  it('transfer token with eth using entrypoint', async () => {
    const {
      entrypoint,
      smartWallet,
      smartWalletOwner,
      create2,
      deployer,
      sendUserOp,
      usdtToken
    } = await loadFixture(fixture)
    const initTokenAmount = ethers.utils.parseUnits('1000', 6)
    await usdtToken.setBalance(smartWallet.address, initTokenAmount)
    const tokenAmount = ethers.utils.parseUnits('100', 6)
    const transferToken = await usdtToken.populateTransaction.transfer(
      deployer.address,
      tokenAmount
    )

    {
      const preDeposit = await smartWallet.getDeposit()
      const ethBalanceBefore = await ethers.provider.getBalance(
        deployer.address
      )
      const usdtTokenBalanceBefore = await usdtToken.balanceOf(
        deployer.address
      )
      // pay for gas using prefund eth
      const recipt = await sendTx(
        [transferToken],
        smartWallet,
        smartWalletOwner,
        create2,
        entrypoint,
        sendUserOp
      )
      const postDeposit = await smartWallet.getDeposit()
      const ethBalanceAfter = await ethers.provider.getBalance(
        deployer.address
      )
      const usdtTokenBalanceAfter = await usdtToken.balanceOf(deployer.address)
      const gasCost = recipt.effectiveGasPrice.mul(recipt.gasUsed)
      // relayer balance after = relayer balance before + ethReceived - gasCost
      expect(preDeposit.sub(postDeposit)).eq(
        ethBalanceAfter.sub(ethBalanceBefore).add(gasCost)
      )

      // check usdt token balance of receiver
      expect(usdtTokenBalanceAfter.sub(usdtTokenBalanceBefore)).to.eq(
        tokenAmount
      )
    }

    {
      // execute batch
      const usdtTokenBalanceBefore = await usdtToken.balanceOf(
        deployer.address
      )
      const transferToken = await smartWallet.populateTransaction.transferToken(
        usdtToken.address,
        deployer.address,
        tokenAmount,
        '0x',
        false
      )
      await expect(
        sendTx(
          [transferToken, transferToken],
          smartWallet,
          smartWalletOwner,
          create2,
          entrypoint,
          sendUserOp,
          undefined,
          false
        )
      ).not.to.reverted
      const usdtTokenBalanceAfter = await usdtToken.balanceOf(deployer.address)
      // transfer tokens for two times
      expect(usdtTokenBalanceAfter.sub(usdtTokenBalanceBefore)).to.eq(
        tokenAmount.mul(2)
      )
    }

    // pay for gas using eth in smartwallet, transfer eth during userop execution
    // use up all prefund eth
    {
      await smartWallet.withdrawDepositTo(
        ethers.constants.AddressZero,
        await smartWallet.getDeposit()
      )
      const walletEthBalanceBefore = await ethers.provider.getBalance(
        smartWallet.address
      )
      const relayerEthBalanceBefore = await ethers.provider.getBalance(
        deployer.address
      )
      const recipt = await sendTx(
        [transferToken],
        smartWallet,
        smartWalletOwner,
        create2,
        entrypoint,
        sendUserOp
      )
      const walletEthBalanceAfter = await ethers.provider.getBalance(
        smartWallet.address
      )
      const relayerEthBalanceAfter = await ethers.provider.getBalance(
        deployer.address
      )
      // relayer balance after = relayer balance before + ethReceived - gasCost
      const gasCost = recipt.effectiveGasPrice.mul(recipt.gasUsed)
      // left gas will remain in entrypoint for the next usage
      const prefund = await smartWallet.getDeposit()
      expect(walletEthBalanceBefore.sub(walletEthBalanceAfter).sub(prefund)).eq(
        relayerEthBalanceAfter.sub(relayerEthBalanceBefore).add(gasCost)
      )
    }
  })

  it('deposit and withdraw eth in entrypoint', async () => {
    const {
      smartWallet,
      deployer
    } = await loadFixture(fixture)
    const preDeposit = await smartWallet.getDeposit()
    const amount = ethers.utils.parseEther('1')
    await smartWallet.addDeposit({ value: amount })
    const postDeposit = await smartWallet.getDeposit()
    expect(postDeposit.sub(preDeposit)).to.eq(amount)
    // withdraw deposited eth
    const receiver = deployer.address
    const preBalance = await ethers.provider.getBalance(receiver)
    await smartWallet.withdrawDepositTo(receiver, postDeposit)
    const postBalance = await ethers.provider.getBalance(receiver)
    expect(await smartWallet.getDeposit()).to.eq(0)
    expect(postBalance.sub(preBalance)).to.eq(postDeposit)
  })

  it('skip nonce success when changing dailyquota with approval even if wallet is locked', async () => {
    const {
      entrypoint,
      smartWallet,
      smartWalletOwner,
      create2,
      sendUserOp,
      smartWalletImpl,
      guardians
    } = await loadFixture(fixture)
    // lock wallet first
    await smartWallet.lock()

    const newQuota = 100
    // skip nonce by using new key
    const key = 1
    const keyShifted = BigNumber.from(key).shl(64)
    const callData = smartWallet.interface.encodeFunctionData(
      'changeDailyQuotaWA',
      [newQuota]
    )
    const approvalOption = {
      validUntil: 0,
      salt: ethers.utils.randomBytes(32),
      action_type: ActionType.ChangeDailyQuota
    }
    const signedUserOp = await fillAndMultiSign(
      callData,
      smartWallet,
      smartWalletOwner,
      [
        { signer: smartWalletOwner },
        {
          signer: guardians[0]
        }
      ],
      create2.address,
      smartWalletImpl.address,
      approvalOption,
      entrypoint,
      { nonce: keyShifted }
    )
    const recipt = await sendUserOp(signedUserOp)
    const quotaInfo = (await smartWallet.wallet()).quota
    const currentQuota = await getCurrentQuota(quotaInfo, recipt.blockNumber)
    expect(currentQuota).to.equal(newQuota)
    expect(quotaInfo.pendingUntil.toString()).to.equal('0')

    // replay it when using the same aproval hash
    await expect(sendUserOp(signedUserOp))
      .to.revertedWithCustomError(entrypoint, 'FailedOp')
      .withArgs(0, 'AA23 reverted: HASH_EXIST')
  })

  describe('read methods', () => {
    it('quota', async () => {
      const { smartWallet } = await loadFixture(fixture)
      const walletData = await smartWallet.wallet()
      const quotaInfo = walletData.quota
      // TODO(add check for quota info)
      quotaInfo
    })

    it('guardians', async () => {
      const { smartWallet } = await loadFixture(fixture)
      const actualGuardians = await smartWallet.getGuardians(true)
      // TODO(add check here)
      actualGuardians
    })

    it('isWhitelisted', async () => {
      const { smartWallet } = await loadFixture(fixture)
      const isWhitelisted = await smartWallet.isWhitelisted(
        '0x' + '22'.repeat(20)
      )
      // TODO(add check here)
      isWhitelisted
    })

    it('getNonce', async () => {
      const { smartWallet } = await loadFixture(fixture)
      const walletData = await smartWallet.wallet()
      expect(walletData.nonce).to.eq(0)
    })
  })

  describe('owner setter', () => {
    it('should be able to set owner for a blank wallet', async () => {
      const { walletFactory, blankOwner, guardians } =
        await loadFixture(fixture)
      const ownerSetter = blankOwner.address
      const other = ethers.Wallet.createRandom().connect(ethers.provider)
      // prepare gas fee
      await setBalance(other.address, ethers.utils.parseEther('1'))

      const salt = ethers.utils.formatBytes32String('0x5')
      await createSmartWallet(
        blankOwner,
        guardians.map((g) => g.address.toLowerCase()).sort(),
        walletFactory,
        salt
      )

      const smartWalletAddr = await walletFactory.computeWalletAddress(
        blankOwner.address,
        salt
      )
      const smartWallet = SmartWalletV3__factory.connect(
        smartWalletAddr,
        blankOwner
      )

      // check owner before:
      const ownerBefore = (await smartWallet.wallet()).owner
      expect(ownerBefore.toLowerCase()).to.equal(ownerSetter.toLowerCase())

      const newOwner = '0x' + '12'.repeat(20)
      // other accounts can not set owner:
      await expect(
        smartWallet.connect(other).transferOwnership(newOwner)
      ).to.rejectedWith('NOT_ALLOWED_TO_SET_OWNER')

      // ownerSetter should be able to set owner if owner is blankOwner
      await smartWallet.connect(blankOwner).transferOwnership(newOwner)
      const ownerAfter = (await smartWallet.wallet()).owner
      expect(ownerAfter.toLowerCase()).to.equal(newOwner.toLowerCase())

      // ownerSetter should not be able to set owner again
      const newOwner2 = '0x' + '34'.repeat(20)
      await expect(
        smartWallet.connect(blankOwner).transferOwnership(newOwner2)
      ).to.rejectedWith('NOT_ALLOWED_TO_SET_OWNER')
    })
  })
})
