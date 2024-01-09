import { ethers } from 'hardhat'
import { expect } from 'chai'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { fixture } from '../../test/helper/fixture'
import { type Signer, type BigNumberish } from 'ethers'
import { type TransactionReceipt } from '@ethersproject/providers'

import {
  type EntryPoint,
  type LoopringCreate2Deployer,
  type SmartWalletV3
} from '../../typechain-types'
import { range } from 'lodash'

import {
  type SendUserOp,
  type UserOperation,
  fillAndSign
} from '../../test/helper/AASigner'

describe('automation test', () => {
  const CONSTANTS = {
    RICH_ADDRESS: '0xA9D1e08C7793af67e9d92fe308d5697FB81d3E43',
    USDC_ADDRESS: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    UNI_ADDRESS: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    USDT_ADDRESS: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    cUSDT_ADDRESS: '0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9',
    WETH_ADDRESS: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    WBT_ADDRESS: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    COMPOUND_CONNECTOR_ADDRESS:
      '0x1B1EACaa31abbE544117073f6F8F658a56A3aE25',
    ONE_FOR_ETH: ethers.utils.parseEther('1'),
    ONE_FOR_USDC: ethers.utils.parseUnits('1', 6)
  }

  // eslint-disable-next-line
  async function fixtureForAutoMation() {
    const initFixture = await fixture()
    const wethConnector = await (
      await ethers.getContractFactory('WETHConnector')
    ).deploy(ethers.constants.AddressZero)
    const uniswapConnector = await (
      await ethers.getContractFactory('UniswapConnector')
    ).deploy(ethers.constants.AddressZero)
    const compoundConnector = await (
      await ethers.getContractFactory('CompoundConnector')
    ).deploy(ethers.constants.AddressZero)
    return {
      ...initFixture,
      wethConnector,
      uniswapConnector,
      compoundConnector
    }
  }

  interface Fixture {
    smartWallet: SmartWalletV3
    smartWalletOwner: Signer
    create2: LoopringCreate2Deployer
    entrypoint: EntryPoint
    sendUserOp: SendUserOp
  }

  const getSignedUserOp = async (
    callData: string,
    nonce: BigNumberish,
    smartWalletAddr: string,
    smartWalletOwner: Signer,
    create2Addr: string,
    entrypoint: EntryPoint
  ): Promise<UserOperation> => {
    const partialUserOp: Partial<UserOperation> = {
      sender: smartWalletAddr,
      nonce,
      callData
    }
    const signedUserOp = await fillAndSign(
      partialUserOp,
      smartWalletOwner,
      create2Addr,
      entrypoint
    )
    return signedUserOp
  }

  const faucetToken = async (
    tokenAddress: string | 0,
    myAddress: string,
    amount: string
  ): Promise<TransactionReceipt> => {
    const impersonatedRichAddr = await ethers.getImpersonatedSigner(
      CONSTANTS.RICH_ADDRESS
    )
    if (tokenAddress === 0) {
      return impersonatedRichAddr
        .sendTransaction({
          to: myAddress,
          value: ethers.utils.parseEther(amount)
        })
        .then(async (tx) => tx.wait())
    } else {
      const token = await ethers.getContractAt(
        'IERC20Metadata',
        tokenAddress,
        impersonatedRichAddr
      )
      const dc = await token.decimals()
      return token
        .transfer(myAddress, ethers.utils.parseUnits(amount, dc))
        .then(async (tx) => tx.wait())
    }
  }

  const userOpCast = async (
    addresses: string[],
    datas: string[],
    signer: Signer,
    loadedFixture: Fixture
  ): Promise<TransactionReceipt> => {
    const { smartWallet, create2, entrypoint, sendUserOp } =
      loadedFixture
    const nonce = await smartWallet.getNonce()
    const smartWalletSignerAddr = await signer.getAddress()

    const tx = await smartWallet.populateTransaction.cast(
      smartWalletSignerAddr,
      addresses,
      datas
    )
    const signedUserOp = await getSignedUserOp(
      tx.data!,
      nonce,
      smartWallet.address,
      signer,
      create2.address,
      entrypoint
    )
    return await sendUserOp(signedUserOp)
  }

  const makeAnExecutor = async (
    connectors: string[],
    loadedFixture: Fixture
  ): Promise<Signer> => {
    const executor = ethers.Wallet.createRandom().connect(
      ethers.provider
    )
    const {
      smartWallet,
      smartWalletOwner,
      create2,
      entrypoint,
      sendUserOp
    } = loadedFixture
    const nonce = await smartWallet.getNonce()
    const validUntils = range(connectors.length).map(() =>
      Math.floor(Date.now() / 1000 + 24 * 60 * 60).toString()
    )
    const tx = await smartWallet.populateTransaction.approveExecutor(
      executor.address,
      connectors,
      validUntils
    )
    const signedUserOp = await getSignedUserOp(
      tx.data!,
      nonce,
      smartWallet.address,
      smartWalletOwner,
      create2.address,
      entrypoint
    )
    await sendUserOp(signedUserOp)

    return executor
  }

  const unApproveExecutor = async (
    loadedFixture: Fixture,
    executor: string
  ): Promise<TransactionReceipt> => {
    const {
      smartWallet,
      smartWalletOwner,
      create2,
      entrypoint,
      sendUserOp
    } = loadedFixture
    const nonce = await smartWallet.getNonce()
    const populatedTx =
      await smartWallet.populateTransaction.unApproveExecutor(
        executor
      )
    const signedUserOp = await getSignedUserOp(
      populatedTx.data!,
      nonce,
      smartWallet.address,
      smartWalletOwner,
      create2.address,
      entrypoint
    )
    return sendUserOp(signedUserOp)
  }

  describe('permission test', () => {
    it('not approved executor should be rejected', async () => {
      const loadedFixture = await loadFixture(fixtureForAutoMation)
      const wethConnector = loadedFixture.wethConnector
      const data = (
        await wethConnector.populateTransaction.deposit(
          CONSTANTS.ONE_FOR_ETH,
          0,
          0
        )
      ).data!
      const someone = ethers.Wallet.createRandom()

      await expect(
        userOpCast(
          [wethConnector.address],
          [data],
          someone,
          loadedFixture
        )
      )
        .to.revertedWithCustomError(
          loadedFixture.entrypoint,
          'FailedOp'
        )
        .withArgs(0, 'AA24 signature error')

      const executor = await makeAnExecutor(
        [wethConnector.address],
        loadedFixture
      )

      await expect(
        userOpCast(
          [wethConnector.address],
          [data],
          executor,
          loadedFixture
        )
      ).not.to.reverted

      // cannot automation after unapprove
      await unApproveExecutor(loadedFixture, executor.address)

      await expect(
        userOpCast(
          [wethConnector.address],
          [data],
          executor,
          loadedFixture
        )
      )
        .to.revertedWithCustomError(
          loadedFixture.entrypoint,
          'FailedOp'
        )
        .withArgs(0, 'AA24 signature error')
    })
  })

  describe('basic connectors test', () => {
    it('compound connector test', async () => {})

    it('uniswap connector test', async () => {
      const loadedFixture = await loadFixture(fixtureForAutoMation)
      const { smartWallet, uniswapConnector } = loadedFixture
      const UNI = await ethers.getContractAt(
        'IERC20Metadata',
        CONSTANTS.UNI_ADDRESS
      )
      const balance1 = await UNI.balanceOf(smartWallet.address)
      const executor = await makeAnExecutor(
        [uniswapConnector.address],
        loadedFixture
      )
      await faucetToken(
        CONSTANTS.USDC_ADDRESS,
        smartWallet.address,
        '100'
      )

      // buy uni with usdc
      const tx1 = await uniswapConnector.populateTransaction.sell(
        CONSTANTS.UNI_ADDRESS,
        CONSTANTS.USDC_ADDRESS,
        CONSTANTS.ONE_FOR_USDC,
        0,
        0,
        0
      )
      await expect(
        userOpCast(
          [uniswapConnector.address],
          [tx1.data!],
          executor,
          loadedFixture
        )
      ).not.to.reverted
      const balance2 = await UNI.balanceOf(smartWallet.address)
      expect(balance2.sub(balance1).gt(0)).true

      // sell uni
      const tx2 = await uniswapConnector.populateTransaction.buy(
        CONSTANTS.UNI_ADDRESS,
        CONSTANTS.USDC_ADDRESS,
        ethers.utils.parseEther('1'), // 1 UNI
        ethers.utils.parseEther('1000'), // ratio
        0,
        0
      )
      await expect(
        userOpCast(
          [uniswapConnector.address],
          [tx2.data!],
          executor,
          loadedFixture
        )
      ).not.to.reverted
      const balance3 = await UNI.balanceOf(smartWallet.address)
      expect(balance3.sub(balance2).gt(0)).true
    })

    // add liquidity
    // remove liquidity
  })

  describe('flashloan test', () => {
    it('using balancerv2', async () => {
      const vaultAddr = '0xBA12222222228d8Ba445958a75a0704d566BF2C8'
      const userData = '0x'
      const balancerFlashLoan = await (
        await ethers.getContractFactory('BalancerFlashLoan')
      ).deploy(vaultAddr)
      const tokens = [CONSTANTS.WETH_ADDRESS]
      const amounts = [ethers.utils.parseEther('1')]
      await balancerFlashLoan.flashLoan(tokens, amounts, userData)
    })
  })

  describe('intergaration test', () => {
    it('leverage staking', async () => {})

    it('margin trading', async () => {})
  })
})
