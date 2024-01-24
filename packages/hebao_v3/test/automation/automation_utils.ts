import { ethers } from 'hardhat'
import { fixture } from '../../test/helper/fixture'
import { type Wallet, type BigNumberish } from 'ethers'
import { type Interface } from '@ethersproject/abi'
import { type TransactionReceipt } from '@ethersproject/providers'
import {
  CompoundConnector__factory,
  UniswapConnector__factory,
  WETHConnector__factory,
  FlashLoanConnector__factory,
  LidoConnector__factory,
  AaveV3Connector__factory
} from '../../typechain-types'

import {
  type SendUserOp,
  type UserOperation,
  fillAndSign
} from '../../test/helper/AASigner'

import {
  type EntryPoint,
  type LoopringCreate2Deployer,
  type SmartWalletV3
} from '../../typechain-types'

export const CONSTANTS = {
  RICH_ADDRESS: '0x176F3DAb24a159341c0509bB36B833E7fdd0a132',
  USDC_ADDRESS: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  UNI_ADDRESS: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
  USDT_ADDRESS: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  cUSDT_ADDRESS: '0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9',
  WETH_ADDRESS: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  WBT_ADDRESS: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  ETH_ADDRESS: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  STETH_ADDRESS: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
  WSTETH_ADDRESS: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
  ONE_FOR_ETH: ethers.utils.parseEther('1'),
  ONE_FOR_USDC: ethers.utils.parseUnits('1', 6)
}

export const tokenMapping = {
  BAT: {
    cToken: '0x6c8c6b02e7b2be14d4fa6022dfd6d75921d90e4e',
    token: ''
  },
  COMP: {
    cToken: '0x70e36f6bf80a52b3b46b3af8e106cc0ed743e8e4',
    token: ''
  },
  DAI: '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643',
  REP: '0x158079ee67fce2f58472a96584a73c7ab9ac95c1',
  UNI: '0x35a18000230da775cac24873d00ff85bccded550',
  USDC: '0x39aa39c021dfbae8fac545936693ac917d5e7563',
  USDT: '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9',
  WBTC: '0xc11b1268c1a384e55c48c2391d8d480264a3a7f4',
  ZRX: '0xb3319f5d18bc0d84dd1b4825dcde5d5f7266d407',
  TUSD: '0x12392F67bdf24faE0AF363c24aC620a2f67DAd86',
  LINK: '0xFAce851a4921ce59e912d19329929CE6da6EB0c7'
}

// eslint-disable-next-line
export async function fixtureForAutoMation() {
  const initFixture = await fixture()
  const { connectorRegistry } = initFixture
  const ownedMemory = await (
    await ethers.getContractFactory('OwnedMemory')
  ).deploy()
  const wethConnector = await (
    await ethers.getContractFactory('WETHConnector')
  ).deploy(ownedMemory.address)
  const uniswapConnector = await (
    await ethers.getContractFactory('UniswapConnector')
  ).deploy(ownedMemory.address)
  const compoundConnector = await (
    await ethers.getContractFactory('CompoundConnector')
  ).deploy(ownedMemory.address)

  const vaultAddr = '0xBA12222222228d8Ba445958a75a0704d566BF2C8'
  const flashLoanPool = await (
    await ethers.getContractFactory('BalancerFlashLoan')
  ).deploy(vaultAddr)

  const flashLoanConnector = await (
    await ethers.getContractFactory('FlashLoanConnector')
  ).deploy(ownedMemory.address, flashLoanPool.address)

  const lidoConnector = await (
    await ethers.getContractFactory('LidoConnector')
  ).deploy(ownedMemory.address)

  const aaveV3Connector = await (
    await ethers.getContractFactory('AaveV3Connector')
  ).deploy(ownedMemory.address)

  await (
    await connectorRegistry.addConnectors([
      wethConnector.address,
      flashLoanConnector.address,
      uniswapConnector.address,
      compoundConnector.address,
      lidoConnector.address,
      aaveV3Connector.address
    ])
  ).wait()

  // can only be used in forknet test
  const usdc = await ethers.getContractAt(
    'IERC20Metadata',
    CONSTANTS.USDC_ADDRESS
  )
  return {
    ...initFixture,
    wethConnector,
    uniswapConnector,
    compoundConnector,
    flashLoanConnector,
    lidoConnector,
    aaveV3Connector,
    flashLoanPool,
    usdc
  }
}

interface Fixture {
  smartWallet: SmartWalletV3
  smartWalletOwner: Wallet
  create2: LoopringCreate2Deployer
  entrypoint: EntryPoint
  sendUserOp: SendUserOp
}

const getSignedUserOp = async (
  callData: string,
  nonce: BigNumberish,
  smartWalletAddr: string,
  smartWalletOwner: Wallet,
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

export const faucetToken = async (
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

export const userOpCast = async (
  addresses: string[],
  datas: string[],
  signer: Wallet,
  loadedFixture: Fixture
): Promise<TransactionReceipt> => {
  const { smartWallet, create2, entrypoint, sendUserOp } =
    loadedFixture
  const nonce = await smartWallet.getNonce()

  const data = smartWallet.interface.encodeFunctionData(
    'castFromEntryPoint',
    [addresses, datas]
  )
  const signedUserOp = await getSignedUserOp(
    data,
    nonce,
    smartWallet.address,
    signer,
    create2.address,
    entrypoint
  )
  return await sendUserOp(signedUserOp)
}

export const makeAnExecutor = async (
  loadedFixture: Fixture
): Promise<Wallet> => {
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
  const validUntil = Math.floor(
    Date.now() / 1000 + 24 * 60 * 60
  ).toString()
  const data = smartWallet.interface.encodeFunctionData(
    'approveExecutor',
    [executor.address, validUntil]
  )
  const signedUserOp = await getSignedUserOp(
    data,
    nonce,
    smartWallet.address,
    smartWalletOwner,
    create2.address,
    entrypoint
  )
  await sendUserOp(signedUserOp)

  return executor
}

export const unApproveExecutor = async (
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
  const data = smartWallet.interface.encodeFunctionData(
    'unApproveExecutor',
    [executor]
  )
  const signedUserOp = await getSignedUserOp(
    data,
    nonce,
    smartWallet.address,
    smartWalletOwner,
    create2.address,
    entrypoint
  )
  return sendUserOp(signedUserOp)
}

export const connectMapping: Record<string, Interface> = {
  COMPOUND: CompoundConnector__factory.createInterface(),
  UNISWAP: UniswapConnector__factory.createInterface(),
  WETH: WETHConnector__factory.createInterface(),
  FLASHLOAN: FlashLoanConnector__factory.createInterface(),
  AAVEV3: AaveV3Connector__factory.createInterface(),
  LIDO: LidoConnector__factory.createInterface()
}

interface SpellType {
  connectorName: string
  connectorAddr: string
  method: string
  args: any[]
}

export const encodeSpells = (
  spells: SpellType[]
): [string[], string[]] => {
  const targets = spells.map((a) => a.connectorAddr)
  const calldatas = spells.map((a) => {
    if (!(a.connectorName in connectMapping)) {
      throw new Error(`Couldn't find connector: ${a.connectorName}`)
    }
    return connectMapping[a.connectorName].encodeFunctionData(
      a.method,
      a.args
    )
  })
  return [targets, calldatas]
}

export function encodeFlashcastData(spells: SpellType[]): string {
  const encodeSpellsData = encodeSpells(spells)
  const argTypes = ['address[]', 'bytes[]']
  return ethers.utils.defaultAbiCoder.encode(argTypes, [
    encodeSpellsData[0],
    encodeSpellsData[1]
  ])
}
