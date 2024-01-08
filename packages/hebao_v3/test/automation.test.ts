import { ethers } from 'hardhat'
import { expect } from 'chai'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { fixture } from '../test/helper/fixture'
import { fillAndSign } from './helper/AASigner'

describe('automation test', () => {
  const CONSTANTS = {
    RICH_ADDRESS: '0xA9D1e08C7793af67e9d92fe308d5697FB81d3E43',
    WETH_CONNECTOR_ADDRESS:
      '0x22075fa719eFb02Ca3cF298AFa9C974B7465E5D3',
    USDC_ADDRESS: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    UNI_ADDRESS: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    USDT_ADDRESS: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    cUSDT_ADDRESS: '0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9',
    WETH_ADDRESS: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    WBT_ADDRESS: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    COMPOUND_CONNECTOR_ADDRESS:
      '0x1B1EACaa31abbE544117073f6F8F658a56A3aE25',
    UniswapV2_CONNECTOR_ADDRESS:
      '0x1E5CE41BdB653734445FeC3553b61FebDdaFC43c',
    ONE_FOR_ETH: ethers.utils.parseEther('1'),
    ONE_FOR_USDC: ethers.utils.parseUnits('1', 6)
  }

  // eslint-disable-next-line
  async function fixtureForAutoMation() {
    const initFixture = await fixture()
    const wethConnector = await (
      await ethers.getContractFactory('WETHConnector')
    ).deploy()
    return {
      ...initFixture,
      wethConnector
    }
  }
  describe('permission test', () => {
    it('not approved executor should be rejected', async () => {
      const {
        wethConnector,
        smartWallet,
        entrypoint,
        sendUserOp,
        create2
      } = await loadFixture(fixtureForAutoMation)
      // wETHConnector
      const data = (
        await wethConnector.populateTransaction.deposit(
          CONSTANTS.ONE_FOR_ETH,
          0,
          0
        )
      ).data!
      const executor = ethers.Wallet.createRandom()
      const populatedTx = await smartWallet.populateTransaction.cast(
        executor.address,
        [wethConnector.address],
        [data]
      )

      const nonce = await smartWallet.getNonce()
      const partialUserOp = {
        sender: smartWallet.address,
        nonce,
        callData: populatedTx.data
      }
      const signedUserOp = await fillAndSign(
        partialUserOp,
        executor,
        create2.address,
        entrypoint
      )
      await expect(
        sendUserOp(signedUserOp)
      ).to.revertedWithCustomError(
        entrypoint,
        'SignatureValidationFailed'
      )
    })
  })

  describe('basic connectors test', () => {
    it('compound test', async () => {})

    it('uniswap test', async () => {})
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
