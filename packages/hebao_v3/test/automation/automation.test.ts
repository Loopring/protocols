import { ethers } from 'hardhat'
import { expect } from 'chai'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import {
  faucetToken,
  fixtureForAutoMation,
  CONSTANTS,
  userOpCast,
  makeAnExecutor,
  unApproveExecutor,
  encodeSpells,
  encodeFlashcastData
} from './automation_utils'

describe('automation test', () => {
  describe('permission test', () => {
    it.only('not approved executor should be rejected', async () => {
      const loadedFixture = await loadFixture(fixtureForAutoMation)
      const wethConnector = loadedFixture.wethConnector
      const data = wethConnector.interface.encodeFunctionData(
        'deposit',
        [CONSTANTS.ONE_FOR_ETH, 0, 0]
      )
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
    it('weth connector test', async () => {
      const loadedFixture = await loadFixture(fixtureForAutoMation)
      const { smartWallet, wethConnector } = loadedFixture
      const weth = await ethers.getContractAt(
        'TokenInterface',
        CONSTANTS.WETH_ADDRESS
      )
      const executor = await makeAnExecutor(
        [wethConnector.address],
        loadedFixture
      )

      const balance1 = await weth.balanceOf(smartWallet.address)
      const data = wethConnector.interface.encodeFunctionData(
        'deposit',
        [CONSTANTS.ONE_FOR_ETH, 0, 0]
      )
      await expect(
        userOpCast(
          [wethConnector.address],
          [data],
          executor,
          loadedFixture
        )
      ).not.to.reverted
      const balance2 = await weth.balanceOf(smartWallet.address)
      expect(balance2.sub(balance1)).eq(CONSTANTS.ONE_FOR_ETH)
    })

    it('compound connector test', async () => {
      const loadedFixture = await loadFixture(fixtureForAutoMation)
      const { smartWallet, compoundConnector } = loadedFixture
      const executor = await makeAnExecutor(
        [compoundConnector.address],
        loadedFixture
      )

      // USDC-A
      const cTokenAddr = '0x39AA39c021dfbaE8faC545936693aC917d5E7563'
      const cERC20 = await ethers.getContractAt(
        'IERC20Metadata',
        cTokenAddr
      )
      const cToken = await ethers.getContractAt(
        'CTokenInterface',
        cTokenAddr
      )
      const tokenAddr = await cToken.underlying()
      await faucetToken(
        CONSTANTS.USDC_ADDRESS,
        smartWallet.address,
        '1'
      )

      // deposit
      {
        const data = compoundConnector.interface.encodeFunctionData(
          'deposit',
          [tokenAddr, cTokenAddr, CONSTANTS.ONE_FOR_USDC, 0, 0]
        )
        const balanceBefore = await cERC20.balanceOf(
          smartWallet.address
        )
        await expect(
          userOpCast(
            [compoundConnector.address],
            [data],
            executor,
            loadedFixture
          )
        ).not.to.reverted
        const balanceAfter = await cERC20.balanceOf(
          smartWallet.address
        )
        expect(balanceAfter.sub(balanceBefore)).gt(0)
      }

      // borrow
      {
        // "USDT-A"
        const cToken = await ethers.getContractAt(
          'CTokenInterface',
          '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9'
        )
        const tokenAddr = await cToken.underlying()
        const token = await ethers.getContractAt(
          'IERC20Metadata',
          tokenAddr
        )
        const balanceBefore = await token.balanceOf(
          smartWallet.address
        )
        const data = compoundConnector.interface.encodeFunctionData(
          'borrow',
          [
            tokenAddr,
            cToken.address,
            CONSTANTS.ONE_FOR_USDC.div(2),
            0,
            0
          ]
        )
        await expect(
          userOpCast(
            [compoundConnector.address],
            [data],
            executor,
            loadedFixture
          )
        ).not.to.reverted
        const balanceAfter = await token.balanceOf(
          smartWallet.address
        )
        expect(balanceAfter.sub(balanceBefore)).eq(
          CONSTANTS.ONE_FOR_USDC.div(2)
        )

        // repay
        const data2 = compoundConnector.interface.encodeFunctionData(
          'payback',
          [
            tokenAddr,
            cToken.address,
            ethers.constants.MaxUint256, // repay all borrowed tokens
            0,
            0
          ]
        )

        await expect(
          userOpCast(
            [compoundConnector.address],
            [data2],
            executor,
            loadedFixture
          )
        ).not.to.reverted
      }

      // withdraw
      const data = compoundConnector.interface.encodeFunctionData(
        'withdraw',
        [tokenAddr, cTokenAddr, ethers.constants.MaxUint256, 0, 0]
      )

      await expect(
        userOpCast(
          [compoundConnector.address],
          [data],
          executor,
          loadedFixture
        )
      ).not.to.reverted
    })

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
      const data2 = uniswapConnector.interface.encodeFunctionData(
        'sell',
        [
          CONSTANTS.UNI_ADDRESS,
          CONSTANTS.USDC_ADDRESS,
          CONSTANTS.ONE_FOR_USDC,
          0,
          0,
          0
        ]
      )
      await expect(
        userOpCast(
          [uniswapConnector.address],
          [data2],
          executor,
          loadedFixture
        )
      ).not.to.reverted
      const balance2 = await UNI.balanceOf(smartWallet.address)
      expect(balance2.sub(balance1).gt(0)).true

      // sell uni
      const data = uniswapConnector.interface.encodeFunctionData(
        'buy',
        [
          CONSTANTS.UNI_ADDRESS,
          CONSTANTS.USDC_ADDRESS,
          ethers.utils.parseEther('1'), // 1 UNI
          ethers.utils.parseEther('1000'), // ratio
          0,
          0
        ]
      )
      await expect(
        userOpCast(
          [uniswapConnector.address],
          [data],
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
      const loadedFixture = await loadFixture(fixtureForAutoMation)
      const {
        uniswapConnector,
        compoundConnector,
        flashLoanConnector,
        smartWallet,
        usdc
      } = loadedFixture
      const ratio = 3
      const collateral = 200
      const decimal = await usdc.decimals()
      const total = ethers.utils.parseUnits(
        (collateral * ratio).toString(),
        decimal
      )
      const loan = ethers.utils.parseUnits(
        (collateral * (ratio - 1)).toString(),
        decimal
      )
      await faucetToken(
        CONSTANTS.USDC_ADDRESS,
        smartWallet.address,
        collateral.toString()
      )
      const IdOne = '2878734423'
      const spells = [
        {
          connectorName: 'UNISWAP',
          connectorAddr: uniswapConnector.address,
          method: 'sell',
          args: [
            CONSTANTS.ETH_ADDRESS,
            CONSTANTS.USDC_ADDRESS,
            total,
            0,
            0,
            IdOne
          ] // margin trade
        },
        {
          connectorName: 'COMPOUND',
          connectorAddr: compoundConnector.address,
          method: 'deposit',
          args: [
            CONSTANTS.ETH_ADDRESS,
            '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5',
            0,
            IdOne,
            0
          ]
        },
        {
          connectorName: 'COMPOUND',
          connectorAddr: compoundConnector.address,
          method: 'borrow',
          args: [
            CONSTANTS.USDC_ADDRESS,
            '0x39aa39c021dfbae8fac545936693ac917d5e7563',
            loan,
            0,
            0
          ] // borrow usdt, note use token id here
        },
        {
          connectorName: 'FLASHLOAN',
          connectorAddr: flashLoanConnector.address,
          method: 'flashPayback',
          args: [CONSTANTS.USDC_ADDRESS, loan, 0, 0]
        }
      ]

      const calldata = encodeFlashcastData(spells)
      const spells2 = [
        {
          connectorName: 'FLASHLOAN',
          connectorAddr: flashLoanConnector.address,
          method: 'flashBorrowAndCast',
          args: [CONSTANTS.USDC_ADDRESS, loan, calldata]
        }
      ]

      const executor = await makeAnExecutor(
        [
          uniswapConnector.address,
          compoundConnector.address,
          flashLoanConnector.address
        ],
        loadedFixture
      )
      const balanceBefore = await usdc.balanceOf(smartWallet.address)
      await userOpCast(
        ...encodeSpells(spells2),
        executor,
        loadedFixture
      )
      const balanceAfter = await usdc.balanceOf(smartWallet.address)
      expect(balanceBefore.sub(balanceAfter)).eq(
        ethers.utils.parseUnits(collateral.toString(), decimal)
      )
    })
  })

  describe('intergration test', () => {
    it('leverage staking', async () => {})

    it('margin trading', async () => {})
  })
})
