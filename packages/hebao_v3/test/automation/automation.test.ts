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
  encodeFlashcastData,
  approveExecutor
} from './automation_utils'

describe('automation test', () => {
  describe('connectorRegistry test', () => {
    it('connector management', async () => {
      const { connectorRegistry, deployer } = await loadFixture(
        fixtureForAutoMation
      )
      const role = await connectorRegistry.MANAGER()
      // deployer is default manager
      expect(await connectorRegistry.hasRole(role, deployer.address))
        .to.be.true

      const mockConnectors = [ethers.constants.AddressZero]
      expect(await connectorRegistry.isConnectors(mockConnectors)).to
        .be.false
      await connectorRegistry.addConnectors(mockConnectors)
      expect(await connectorRegistry.isConnectors(mockConnectors)).to
        .be.true
      await connectorRegistry.removeConnectors(mockConnectors)
      expect(await connectorRegistry.isConnectors(mockConnectors)).to
        .be.false

      // add already valid connectors again
      await expect(connectorRegistry.addConnectors(mockConnectors))
        .not.to.reverted
    })

    it('permission test', async () => {
      const { connectorRegistry, somebody } = await loadFixture(
        fixtureForAutoMation
      )
      const role = await connectorRegistry.MANAGER()

      expect(await connectorRegistry.hasRole(role, somebody.address))
        .to.be.false
      const mockConnectors = [ethers.constants.AddressZero]
      // only manager can add new connector
      await expect(
        connectorRegistry
          .connect(somebody)
          .addConnectors(mockConnectors)
      ).to.revertedWith('not a manager')
      await expect(
        connectorRegistry
          .connect(somebody)
          .removeConnectors(mockConnectors)
      ).to.revertedWith('not a manager')

      await connectorRegistry.grantRole(role, somebody.address)
      expect(await connectorRegistry.hasRole(role, somebody.address))
        .to.be.true
      await expect(
        connectorRegistry
          .connect(somebody)
          .addConnectors(mockConnectors)
      ).not.to.reverted
    })
  })
  describe('permission test', () => {
    it('not approved executor should be rejected', async () => {
      const loadedFixture = await loadFixture(fixtureForAutoMation)
      const { smartWallet } = loadedFixture
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
          { wallet: someone },
          loadedFixture
        )
      )
        .to.revertedWithCustomError(
          loadedFixture.entrypoint,
          'FailedOp'
        )
        .withArgs(0, 'AA24 signature error')

      const executor = await makeAnExecutor(loadedFixture)

      await expect(
        userOpCast(
          [wethConnector.address],
          [data],
          { wallet: executor },
          loadedFixture
        )
      ).not.to.reverted

      // prepare eth for executor
      await loadedFixture.deployer.sendTransaction({
        to: executor.address,
        value: CONSTANTS.ONE_FOR_ETH
      })
      await expect(
        smartWallet
          .connect(executor)
          .castFromExecutor([wethConnector.address], [data])
      ).not.to.reverted

      // cannot automation after unapprove
      await unApproveExecutor(loadedFixture, executor.address)

      await expect(
        userOpCast(
          [wethConnector.address],
          [data],
          { wallet: someone },
          loadedFixture
        )
      )
        .to.revertedWithCustomError(
          loadedFixture.entrypoint,
          'FailedOp'
        )
        .withArgs(0, 'AA24 signature error')
    })
    it('use contract as a executor', async () => {
      // create a official guardian
      const loadedFixture = await loadFixture(fixtureForAutoMation)
      // prepare a contract as executor
      const someone = ethers.Wallet.createRandom().connect(
        ethers.provider
      )
      await loadedFixture.deployer.sendTransaction({
        to: someone.address,
        value: CONSTANTS.ONE_FOR_ETH
      })
      const officialGuardian = await (
        await ethers.getContractFactory('OfficialGuardian')
      ).deploy()
      await officialGuardian
        .connect(loadedFixture.deployer)
        .addManager(someone.address)
      // smartwallet approve the officialGuardian first
      await approveExecutor(loadedFixture, officialGuardian.address)

      const wethConnector = loadedFixture.wethConnector
      const data = wethConnector.interface.encodeFunctionData(
        'deposit',
        [CONSTANTS.ONE_FOR_ETH, 0, 0]
      )
      await expect(
        userOpCast(
          [wethConnector.address],
          [data],
          { wallet: someone, contract: officialGuardian.address },
          loadedFixture
        )
      ).not.to.reverted
    })
    it('executor call directly', async () => {})
    it('cant cast when wallet is locked', async () => {
      const loadedFixture = await loadFixture(fixtureForAutoMation)
      const { smartWallet, wethConnector, entrypoint } = loadedFixture
      const executor = await makeAnExecutor(loadedFixture)
      await (await smartWallet.lock()).wait()

      const data = wethConnector.interface.encodeFunctionData(
        'deposit',
        [CONSTANTS.ONE_FOR_ETH, 0, 0]
      )
      await expect(
        userOpCast(
          [wethConnector.address],
          [data],
          { wallet: executor },
          loadedFixture
        )
      )
        .to.revertedWithCustomError(entrypoint, 'FailedOp')
        .withArgs(0, 'AA23 reverted: wallet is locked')
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
      const executor = await makeAnExecutor(loadedFixture)

      const balance1 = await weth.balanceOf(smartWallet.address)
      const data = wethConnector.interface.encodeFunctionData(
        'deposit',
        [CONSTANTS.ONE_FOR_ETH, 0, 0]
      )
      await expect(
        userOpCast(
          [wethConnector.address],
          [data],
          { wallet: executor },
          loadedFixture
        )
      ).not.to.reverted
      const balance2 = await weth.balanceOf(smartWallet.address)
      expect(balance2.sub(balance1)).eq(CONSTANTS.ONE_FOR_ETH)
    })

    it('compound connector test', async () => {
      const loadedFixture = await loadFixture(fixtureForAutoMation)
      const { smartWallet, compoundConnector } = loadedFixture
      const executor = await makeAnExecutor(loadedFixture)

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
            { wallet: executor },
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
            { wallet: executor },
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
            { wallet: executor },
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
          { wallet: executor },
          loadedFixture
        )
      ).not.to.reverted
    })
    it('aaveV3 connector test', async () => {
      const loadedFixture = await loadFixture(fixtureForAutoMation)
      const { smartWallet, aaveV3Connector } = loadedFixture
      const data = aaveV3Connector.interface.encodeFunctionData(
        'deposit',
        [
          CONSTANTS.WSTETH_ADDRESS,
          CONSTANTS.ONE_FOR_ETH.mul(10),
          0,
          0
        ]
      )
      await faucetToken(
        CONSTANTS.WSTETH_ADDRESS,
        smartWallet.address,
        '100'
      )
      const wstETH = await ethers.getContractAt(
        'IERC20Metadata',
        CONSTANTS.WSTETH_ADDRESS
      )
      const wstETHBalanceBefore = await wstETH.balanceOf(
        smartWallet.address
      )
      const executor = await makeAnExecutor(loadedFixture)
      await expect(
        userOpCast(
          [aaveV3Connector.address],
          [data],
          { wallet: executor },
          loadedFixture
        )
      ).not.to.reverted
      const wstETHBalanceAfter = await wstETH.balanceOf(
        smartWallet.address
      )
      expect(wstETHBalanceBefore.sub(wstETHBalanceAfter)).eq(
        CONSTANTS.ONE_FOR_ETH.mul(10)
      )

      // borrow weth from aavev3
      const borrowData = aaveV3Connector.interface.encodeFunctionData(
        'borrow',
        [CONSTANTS.USDC_ADDRESS, CONSTANTS.ONE_FOR_USDC, 2, 0, 0]
      )
      await expect(
        userOpCast(
          [aaveV3Connector.address],
          [borrowData],
          { wallet: executor },
          loadedFixture
        )
      ).not.to.reverted

      // payback all debts
      // need some weth token to pay for interests
      await faucetToken(
        CONSTANTS.USDC_ADDRESS,
        smartWallet.address,
        '10'
      )
      const paybackData =
        aaveV3Connector.interface.encodeFunctionData('payback', [
          CONSTANTS.USDC_ADDRESS,
          ethers.constants.MaxUint256,
          2,
          0,
          0
        ])
      await expect(
        userOpCast(
          [aaveV3Connector.address],
          [paybackData],
          { wallet: executor },
          loadedFixture
        )
      ).not.to.reverted
      // withdraw
      const withdrawData =
        aaveV3Connector.interface.encodeFunctionData('withdraw', [
          CONSTANTS.WSTETH_ADDRESS,
          ethers.constants.MaxUint256,
          0,
          0
        ])
      await expect(
        userOpCast(
          [aaveV3Connector.address],
          [withdrawData],
          { wallet: executor },
          loadedFixture
        )
      ).not.to.reverted
    })

    it('lido connector test', async () => {
      const loadedFixture = await loadFixture(fixtureForAutoMation)
      const { smartWallet, lidoConnector, deployer } = loadedFixture
      const data = lidoConnector.interface.encodeFunctionData(
        'deposit',
        [CONSTANTS.ONE_FOR_ETH, 0, 0]
      )

      // deposit eth to smartWallet first
      await deployer.sendTransaction({
        to: smartWallet.address,
        value: CONSTANTS.ONE_FOR_ETH.mul(3)
      })

      const ethBalanceBefore = await ethers.provider.getBalance(
        smartWallet.address
      )

      const executor = await makeAnExecutor(loadedFixture)
      await expect(
        userOpCast(
          [lidoConnector.address],
          [data],
          { wallet: executor },
          loadedFixture
        )
      ).not.to.reverted
      const ethBalanceAfter = await ethers.provider.getBalance(
        smartWallet.address
      )
      // check ETH and stETH balance
      expect(ethBalanceBefore.sub(ethBalanceAfter)).eq(
        CONSTANTS.ONE_FOR_ETH
      )

      const stETH = await ethers.getContractAt(
        'IERC20Metadata',
        CONSTANTS.STETH_ADDRESS
      )
      const stETHBalance = await stETH.balanceOf(smartWallet.address)
      expect(stETHBalance).to.gt(0)
      // wrapAndStaking test
      const wrapAndStakingData =
        lidoConnector.interface.encodeFunctionData('wrapAndStaking', [
          CONSTANTS.ONE_FOR_ETH,
          0,
          0
        ])

      const wstETH = await ethers.getContractAt(
        'IERC20Metadata',
        CONSTANTS.WSTETH_ADDRESS
      )
      const wstETHBalanceBefore = await wstETH.balanceOf(
        smartWallet.address
      )
      await expect(
        userOpCast(
          [lidoConnector.address],
          [wrapAndStakingData],
          { wallet: executor },
          loadedFixture
        )
      ).not.to.reverted
      const wstETHBalanceAfter = await wstETH.balanceOf(
        smartWallet.address
      )
      expect(wstETHBalanceAfter.sub(wstETHBalanceBefore)).gt(0)
      // unwrap all wstETH
      const unwrapData = lidoConnector.interface.encodeFunctionData(
        'unwrap',
        [ethers.constants.MaxUint256, 0, 0]
      )
      await expect(
        userOpCast(
          [lidoConnector.address],
          [unwrapData],
          { wallet: executor },
          loadedFixture
        )
      ).not.to.reverted
      expect(await wstETH.balanceOf(smartWallet.address)).eq(0)
    })

    it('1inchv5 connector test', async () => {
      const loadedFixture = await loadFixture(fixtureForAutoMation)
      const executor = await makeAnExecutor(loadedFixture)
      const { smartWallet, oneInchV5Connector } = loadedFixture
      await faucetToken(
        CONSTANTS.USDC_ADDRESS,
        smartWallet.address,
        '100'
      )
      const UNI = await ethers.getContractAt(
        'IERC20Metadata',
        CONSTANTS.UNI_ADDRESS
      )
      // TODO(get a valid calldata from 1inch swap api)
      const callData = '0x'
      const data = oneInchV5Connector.interface.encodeFunctionData(
        'sell',
        [
          CONSTANTS.UNI_ADDRESS,
          CONSTANTS.USDC_ADDRESS,
          3000,
          0,
          callData,
          0
        ]
      )

      const balanceBefore = await UNI.balanceOf(smartWallet.address)
      await expect(
        userOpCast(
          [oneInchV5Connector.address],
          [data],
          { wallet: executor },
          loadedFixture
        )
      ).not.to.reverted
      const balanceAfter = await UNI.balanceOf(smartWallet.address)
      // TODO(fix it when using a valid calldata)
      expect(balanceAfter.sub(balanceBefore).gt(0)).false
    })

    it('uniswapv3 connector test', async () => {
      const loadedFixture = await loadFixture(fixtureForAutoMation)
      const { smartWallet, uniswapv3Connector } = loadedFixture
      const UNI = await ethers.getContractAt(
        'IERC20Metadata',
        CONSTANTS.UNI_ADDRESS
      )
      const balance1 = await UNI.balanceOf(smartWallet.address)
      const executor = await makeAnExecutor(loadedFixture)
      await faucetToken(
        CONSTANTS.USDC_ADDRESS,
        smartWallet.address,
        '100'
      )

      // buy uni with usdc
      const data2 = uniswapv3Connector.interface.encodeFunctionData(
        'sell',
        [
          CONSTANTS.UNI_ADDRESS,
          CONSTANTS.USDC_ADDRESS,
          3000,
          0,
          CONSTANTS.ONE_FOR_USDC,
          0,
          0
        ]
      )
      await expect(
        userOpCast(
          [uniswapv3Connector.address],
          [data2],
          { wallet: executor },
          loadedFixture
        )
      ).not.to.reverted
      const balance2 = await UNI.balanceOf(smartWallet.address)
      expect(balance2.sub(balance1).gt(0)).true

      // sell uni
      const data = uniswapv3Connector.interface.encodeFunctionData(
        'buy',
        [
          CONSTANTS.UNI_ADDRESS,
          CONSTANTS.USDC_ADDRESS,
          3000,
          ethers.utils.parseEther('1000'), // ratio
          ethers.utils.parseEther('1'), // 1 UNI
          0,
          0
        ]
      )
      await expect(
        userOpCast(
          [uniswapv3Connector.address],
          [data],
          { wallet: executor },
          loadedFixture
        )
      ).not.to.reverted
      const balance3 = await UNI.balanceOf(smartWallet.address)
      expect(balance3.sub(balance2).gt(0)).true
    })

    it('uniswapv2 connector test', async () => {
      const loadedFixture = await loadFixture(fixtureForAutoMation)
      const { smartWallet, uniswapConnector } = loadedFixture
      const UNI = await ethers.getContractAt(
        'IERC20Metadata',
        CONSTANTS.UNI_ADDRESS
      )
      const balance1 = await UNI.balanceOf(smartWallet.address)
      const executor = await makeAnExecutor(loadedFixture)
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
          { wallet: executor },
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
          { wallet: executor },
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
    it('margin trading', async () => {
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

      const executor = await makeAnExecutor(loadedFixture)
      const balanceBefore = await usdc.balanceOf(smartWallet.address)
      await userOpCast(
        ...encodeSpells(spells2),
        { wallet: executor },
        loadedFixture
      )
      const balanceAfter = await usdc.balanceOf(smartWallet.address)
      expect(balanceBefore.sub(balanceAfter)).eq(
        ethers.utils.parseUnits(collateral.toString(), decimal)
      )
    })
    it('leverage staking', async () => {
      const loadedFixture = await loadFixture(fixtureForAutoMation)
      const {
        flashLoanConnector,
        aaveV3Connector,
        lidoConnector,
        wethConnector,
        smartWallet,
        deployer
      } = loadedFixture

      const ratio = 3
      const collateral = CONSTANTS.ONE_FOR_ETH
      const total = collateral.mul(ratio)
      const loan = total.sub(collateral)

      // prepare init eth for smart wallet
      await deployer.sendTransaction({
        to: smartWallet.address,
        value: collateral
      })
      const wstETH = CONSTANTS.WSTETH_ADDRESS
      const spells = [
        {
          connectorName: 'WETH',
          connectorAddr: wethConnector.address,
          method: 'withdraw',
          args: [loan, 0, 0]
        },
        {
          connectorName: 'LIDO',
          connectorAddr: lidoConnector.address,
          method: 'wrapAndStaking',
          args: [total, 0, 0]
        },
        {
          connectorName: 'AAVEV3',
          connectorAddr: aaveV3Connector.address,
          method: 'deposit',
          args: [wstETH, ethers.constants.MaxUint256, 0, 0] // margin trade
        },
        {
          connectorName: 'AAVEV3',
          connectorAddr: aaveV3Connector.address,
          method: 'borrow',
          args: [CONSTANTS.WETH_ADDRESS, loan, 2, 0, 0]
        },
        {
          connectorName: 'FLASHLOAN',
          connectorAddr: flashLoanConnector.address,
          method: 'flashPayback',
          args: [CONSTANTS.WETH_ADDRESS, loan, 0, 0]
        }
      ]

      const calldata = encodeFlashcastData(spells)
      const spells2 = [
        {
          connectorName: 'FLASHLOAN',
          connectorAddr: flashLoanConnector.address,
          method: 'flashBorrowAndCast',
          args: [CONSTANTS.WETH_ADDRESS, loan, calldata]
        }
      ]

      const executor = await makeAnExecutor(loadedFixture)
      await userOpCast(
        ...encodeSpells(spells2),
        { wallet: executor },
        loadedFixture
      )
    })
  })
})
