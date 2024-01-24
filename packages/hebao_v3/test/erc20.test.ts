import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect, assert } from 'chai'
import { ethers } from 'hardhat'

import { fillAndMultiSign } from './helper/AASigner'
import { ActionType } from './helper/LoopringGuardianAPI'
import { fixture } from './helper/fixture'
import { getFirstEvent, sendTx } from './helper/utils'

describe('erc20 test', () => {
  it('basic success test', async () => {
    // execute approve, transfer and call contract using batch way
    const {
      entrypoint,
      smartWallet,
      smartWalletOwner,
      create2,
      deployer,
      sendUserOp,
      usdtToken,
      testTarget
    } = await loadFixture(fixture)
    // prepare usdt tokens
    const initTokenAmount = ethers.utils.parseUnits('1000', 6)
    await usdtToken.setBalance(smartWallet.address, initTokenAmount)

    const tokenAmount = ethers.utils.parseUnits('100', 6)
    const receiver = deployer.address
    const approve =
      await smartWallet.populateTransaction.approveToken(
        usdtToken.address,
        receiver,
        tokenAmount,
        false
      )
    const transferToken =
      await smartWallet.populateTransaction.transferToken(
        usdtToken.address,
        receiver,
        tokenAmount,
        '0x',
        false
      )

    const functionDefault =
      await testTarget.populateTransaction.functionDefault(0)
    const callcontract =
      await smartWallet.populateTransaction.callContract(
        receiver,
        0,
        functionDefault.data!,
        false
      )

    const callData = testTarget.interface.encodeFunctionData(
      'functionPayable',
      [10]
    )
    const approveThenCall =
      await smartWallet.populateTransaction.approveThenCallContract(
        usdtToken.address,
        testTarget.address,
        ethers.utils.parseEther('10000'),
        ethers.utils.parseEther('0.01'),
        callData,
        false
      )

    await sendTx(
      [approve, transferToken, callcontract, approveThenCall],
      smartWallet,
      smartWalletOwner,
      create2,
      entrypoint,
      sendUserOp,
      undefined,
      false
    )
    expect(await usdtToken.balanceOf(receiver)).to.eq(tokenAmount)
  })

  it('execute from wallet owner', async () => {
    const { smartWallet, deployer, usdtToken, testTarget } =
      await loadFixture(fixture)
    // prepare usdt tokens
    const initTokenAmount = ethers.utils.parseUnits('1000', 6)
    await usdtToken.setBalance(smartWallet.address, initTokenAmount)

    const tokenAmount = ethers.utils.parseUnits('100', 6)
    const receiver = deployer.address
    // approve first
    await smartWallet.populateTransaction.approveToken(
      usdtToken.address,
      receiver,
      tokenAmount,
      false
    )
    // then transfer token
    await smartWallet.transferToken(
      usdtToken.address,
      receiver,
      tokenAmount,
      '0x',
      false
    )
    expect(await usdtToken.balanceOf(receiver)).to.eq(tokenAmount)
    // finally call contract
    const functionDefault =
      await testTarget.populateTransaction.functionDefault(0)
    await expect(
      smartWallet.populateTransaction.callContract(
        receiver,
        0,
        functionDefault.data!,
        false
      )
    ).not.to.reverted

    // approvethencall
    const callData = testTarget.interface.encodeFunctionData(
      'functionPayable',
      [10]
    )
    const tx = await smartWallet.approveThenCallContract(
      usdtToken.address,
      testTarget.address,
      ethers.utils.parseEther('10000'),
      ethers.utils.parseEther('0.01'),
      callData,
      false
    )
    const event = await getFirstEvent(
      testTarget,
      tx.blockNumber!,
      'Invoked'
    )
    assert(event.args)
    expect(event.args.sender).to.equal(smartWallet.address)
  })

  describe('execute tx with approval', () => {
    it('approve token test', async () => {
      const {
        entrypoint,
        smartWallet,
        smartWalletOwner,
        create2,
        deployer,
        sendUserOp,
        smartWalletImpl,
        guardians,
        usdtToken
      } = await loadFixture(fixture)

      const toAddr = deployer.address
      const amount = 100
      const callData = smartWallet.interface.encodeFunctionData(
        'approveTokenWA',
        [usdtToken.address, toAddr, amount]
      )
      const approvalOption = {
        validUntil: 0,
        salt: ethers.utils.randomBytes(32),
        action_type: ActionType.ApproveToken
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
        entrypoint
      )

      await sendUserOp(signedUserOp)
      // check allowance
      const allowance = await usdtToken.allowance(
        smartWallet.address,
        toAddr
      )
      expect(allowance).to.eq(amount)
    })

    it('callcontract test', async () => {
      const {
        entrypoint,
        smartWallet,
        smartWalletOwner,
        create2,
        sendUserOp,
        smartWalletImpl,
        guardians,
        testTarget
      } = await loadFixture(fixture)

      const functionDefault =
        await testTarget.populateTransaction.functionDefault(0)
      const callData = smartWallet.interface.encodeFunctionData(
        'callContractWA',
        [testTarget.address, 0, functionDefault.data]
      )
      const approvalOption = {
        validUntil: 0,
        salt: ethers.utils.randomBytes(32),
        action_type: ActionType.CallContract
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
        entrypoint
      )
      const recipt = await sendUserOp(signedUserOp)
      const event = await getFirstEvent(
        testTarget,
        recipt.blockNumber,
        'Invoked'
      )
      assert(event.args)
      expect(event.args.sender).to.equal(smartWallet.address)
    })

    it('approveThenCallContract test', async () => {
      const {
        sendUserOp,
        entrypoint,
        create2,
        guardians,
        testTarget,
        usdtToken,
        smartWallet: wallet,
        smartWalletOwner,
        smartWalletImpl,
        smartWallet
      } = await loadFixture(fixture)
      const innerCallData = testTarget.interface.encodeFunctionData(
        'functionPayable',
        [10]
      )
      const amount = ethers.utils.parseEther('10000')
      const value = ethers.utils.parseEther('50')
      const callData = smartWallet.interface.encodeFunctionData(
        'approveThenCallContractWA',
        [
          usdtToken.address,
          testTarget.address,
          amount.toString(),
          value,
          innerCallData
        ]
      )
      const approvalOption = {
        validUntil: 0,
        salt: ethers.utils.randomBytes(32),
        action_type: ActionType.ApproveThenCallContract
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
        entrypoint
      )

      const recipt = await sendUserOp(signedUserOp)
      const event = await getFirstEvent(
        testTarget,
        recipt.blockNumber,
        'Invoked'
      )
      assert(event.args)
      expect(event.args.sender).to.equal(wallet.address)
    })
  })
})
