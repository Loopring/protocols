import { ethers } from 'hardhat'
import {
  simulationResultCatch,
  sendTx,
  type PaymasterOption,
  generateSignedUserOp
} from '../test/helper/utils'
import { type ContractReceipt } from '@ethersproject/contracts'

export async function testExecuteTxWithEth(
  fixture: any
): Promise<ContractReceipt> {
  const {
    entrypoint,
    smartWallet,
    smartWalletOwner,
    usdtToken,
    deployer,
    sendUserOp,
    create2
  } = fixture
  // prepare mock usdt token first
  await (
    await usdtToken.setBalance(
      smartWallet.address,
      ethers.utils.parseUnits('1000', 6)
    )
  ).wait()

  /// ///////////////////////////////////////
  // usdt token transfer test
  const tokenAmount = ethers.utils.parseUnits('100', 6)
  const transferToken = await usdtToken.populateTransaction.transfer(
    deployer.address,
    tokenAmount
  )

  await sendTx(
    [transferToken],
    smartWallet,
    smartWalletOwner,
    create2,
    entrypoint,
    sendUserOp
  )
  /// /////////////////////////////////
  // eth transfer test
  const ethAmount = 1
  await (
    await deployer.sendTransaction({
      to: smartWallet.address,
      value: ethAmount
    })
  ).wait()
  const transferEth = {
    value: ethAmount,
    to: deployer.address
  }
  await sendTx(
    [transferEth],
    smartWallet,
    smartWalletOwner,
    create2,
    entrypoint,
    sendUserOp
  )
  /// ////////////////////////////
  // batch tx
  // transfer usdt token by three times

  return sendTx(
    [transferToken, transferToken, transferToken],
    smartWallet,
    smartWalletOwner,
    create2,
    entrypoint,
    sendUserOp
  )
}

export async function testExecuteTxWithUSDCPaymaster(
  fixture: any
): Promise<ContractReceipt> {
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
  } = fixture
  // prepare mock usdt token first
  await (
    await usdtToken.setBalance(
      smartWallet.address,
      ethers.utils.parseUnits('1000', 6)
    )
  ).wait()

  /// ///////////////////////////////////////
  // usdt token transfer test
  const tokenAmount = ethers.utils.parseUnits('100', 6)
  await (await paymaster.addToken(usdtToken.address)).wait()
  // approve paymaster before using usdt paymaster service
  const approveToken = await usdtToken.populateTransaction.approve(
    paymaster.address,
    ethers.constants.MaxUint256
  )
  const transferToken = await usdtToken.populateTransaction.transfer(
    deployer.address,
    tokenAmount
  )
  const paymasterOption: PaymasterOption = {
    paymaster,
    payToken: usdtToken,
    paymasterOwner,
    valueOfEth: ethers.utils.parseUnits('625', 12),
    validUntil: 0
  }

  // approve token first
  return sendTx(
    [approveToken, transferToken],
    smartWallet,
    smartWalletOwner,
    create2,
    entrypoint,
    sendUserOp,
    paymasterOption
  )
}

export async function testExecuteTx(
  fixture: any
): Promise<ContractReceipt> {
  const {
    entrypoint,
    smartWallet,
    smartWalletOwner,
    sendUserOp,
    create2
  } = fixture
  /// ///////////////////////////////////////
  // usdt token transfer test
  const nonce = await smartWallet.populateTransaction.getNonce()
  const signedUserOp = await generateSignedUserOp(
    [nonce],
    smartWallet,
    smartWalletOwner,
    create2,
    entrypoint,
    undefined,
    false
  )

  await entrypoint.callStatic
    .simulateValidation(signedUserOp)
    .catch(simulationResultCatch)
  return sendUserOp(signedUserOp)
}
