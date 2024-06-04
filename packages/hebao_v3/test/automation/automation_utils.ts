import { ethers } from 'hardhat'
import { fixture } from '../../test/helper/fixture'
import { type Wallet, type BigNumberish } from 'ethers'
import { ChainId, AddressForNetwork } from 'src/constants'
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
  fillUserOp,
  getUserOpHash
} from '../../test/helper/AASigner'

import {
  type EntryPoint,
  type LoopringCreate2Deployer,
  type SmartWalletV3
} from '../../typechain-types'

export const CONSTANTS = {
  ONE_FOR_USDC: ethers.utils.parseUnits('1', 6),
  ONE_FOR_ETH: ethers.utils.parseEther('1')
}

export const RichAddressForNetwork: Record<
  string,
  Record<string, string>
> = {
  [ChainId.ethereum]: {
    USDC_ADDRESS: '0x176F3DAb24a159341c0509bB36B833E7fdd0a132',
    ETH_ADDRESS: '0x176F3DAb24a159341c0509bB36B833E7fdd0a132',
    WETH_ADDRESS: '0x57757E3D981446D585Af0D9Ae4d7DF6D64647806',
    USDT_ADDRESS: '0x176F3DAb24a159341c0509bB36B833E7fdd0a132',
    UNI_ADDRESS: '0x5a52E96BAcdaBb82fd05763E25335261B270Efcb',

    cUSDT_ADDRESS: '0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9',
    WBT_ADDRESS: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    DAI_ADDRESS: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    STETH_ADDRESS: '0x18709E89BD403F470088aBDAcEbE86CC60dda12e',
    WSTETH_ADDRESS: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0'
  },
  [ChainId.sepolia]: {
    USDC_ADDRESS: '0xAe6b19b637FDCB9c5C05238E5279754C39DE76A9',
    ETH_ADDRESS: '0xBaEb92889696217A3A6be2175E5a95dC4cFFC9f7',
    UNI_ADDRESS: '0x41653c7d61609D856f29355E404F310Ec4142Cfb',
    WETH_ADDRESS: '0xBaEb92889696217A3A6be2175E5a95dC4cFFC9f7'
  }
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
  // set mainnet as default network
  const chainId = parseInt(process.env.FORK ?? '1')
  const addressBook = AddressForNetwork[chainId]

  const { connectorRegistry } = initFixture
  const ownedMemory = await (
    await ethers.getContractFactory('OwnedMemory')
  ).deploy()
  const wethConnector = await (
    await ethers.getContractFactory('WETHConnector')
  ).deploy(ownedMemory.address, addressBook.WETH_ADDRESS)
  const uniswapConnector = await (
    await ethers.getContractFactory('UniswapConnector')
  ).deploy(
    addressBook.SWAP_ROUTERV2_ADDRESS,
    ownedMemory.address,
    addressBook.WETH_ADDRESS
  )
  const uniswapv3Connector = await (
    await ethers.getContractFactory('UniswapV3Connector')
  ).deploy(
    addressBook.SWAP_ROUTERV3_ADDRESS,
    ownedMemory.address,
    addressBook.WETH_ADDRESS
  )
  const oneInchV5Connector = await (
    await ethers.getContractFactory('OneInchV5Connector')
  ).deploy(
    addressBook.ONEINCH,
    ownedMemory.address,
    addressBook.WETH_ADDRESS
  )
  const compoundConnector = await (
    await ethers.getContractFactory('CompoundConnector')
  ).deploy(
    addressBook.COMP_TROLLER,
    ownedMemory.address,
    addressBook.WETH_ADDRESS
  )

  const flashLoanPool = await (
    await ethers.getContractFactory('BalancerFlashLoan')
  ).deploy(addressBook.BALANCER_VAULT)

  const flashLoanConnector = await (
    await ethers.getContractFactory('FlashLoanConnector')
  ).deploy(
    flashLoanPool.address,
    ownedMemory.address,
    addressBook.WETH_ADDRESS
  )

  const lidoConnector = await (
    await ethers.getContractFactory('LidoConnector')
  ).deploy(
    addressBook.STETH_ADDRESS,
    addressBook.WSTETH_ADDRESS,
    addressBook.TREASURY,
    ownedMemory.address,
    addressBook.WETH_ADDRESS
  )

  const aaveV3Connector = await (
    await ethers.getContractFactory('AaveV3Connector')
  ).deploy(
    addressBook.AAVE_PROVIDER,
    addressBook.AAVE_DATA,
    ownedMemory.address,
    addressBook.WETH_ADDRESS
  )

  await (
    await connectorRegistry.addConnectors([
      wethConnector.address,
      flashLoanConnector.address,
      uniswapConnector.address,
      compoundConnector.address,
      lidoConnector.address,
      aaveV3Connector.address,
      uniswapv3Connector.address,
      oneInchV5Connector.address
    ])
  ).wait()

  // can only be used in forknet test
  const usdc = await ethers.getContractAt(
    'IERC20Metadata',
    addressBook.USDC_ADDRESS
  )
  const richAddresses = RichAddressForNetwork[chainId]
  return {
    ...initFixture,
    wethConnector,
    uniswapConnector,
    oneInchV5Connector,
    compoundConnector,
    flashLoanConnector,
    lidoConnector,
    aaveV3Connector,
    uniswapv3Connector,
    flashLoanPool,
    usdc,
    addressBook,
    richAddresses
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
  signer: { wallet: Wallet; contract?: string },
  create2Addr: string,
  entrypoint: EntryPoint,
  byExecutor: boolean
): Promise<UserOperation> => {
  const partialUserOp: Partial<UserOperation> = {
    sender: smartWalletAddr,
    nonce,
    callData
  }
  const provider = entrypoint.provider
  const op2 = await fillUserOp(partialUserOp, create2Addr, entrypoint)
  const { chainId } = await provider!.getNetwork()
  const message = ethers.utils.arrayify(
    getUserOpHash(op2, entrypoint.address, chainId)
  )

  const rawSignature = await signer.wallet.signMessage(message)
  const signature = byExecutor
    ? ethers.utils.defaultAbiCoder.encode(
        ['address', 'bytes'],
        [signer.contract ?? signer.wallet.address, rawSignature]
      )
    : rawSignature
  const signedUserOp = {
    ...op2,
    signature
  }
  return signedUserOp
}

export const faucetToken = async (
  tokenAddress: string | 0,
  myAddress: string,
  richAddress: string,
  amount: string
): Promise<TransactionReceipt> => {
  const impersonatedRichAddr =
    await ethers.getImpersonatedSigner(richAddress)
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
  signer: { wallet: Wallet; contract?: string },
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
    entrypoint,
    true
  )
  return await sendUserOp(signedUserOp)
}

export const approveExecutor = async (
  loadedFixture: Fixture,
  executorAddr: string
): Promise<void> => {
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
    [executorAddr, validUntil]
  )
  const signedUserOp = await getSignedUserOp(
    data,
    nonce,
    smartWallet.address,
    { wallet: smartWalletOwner },
    create2.address,
    entrypoint,
    false
  )
  await sendUserOp(signedUserOp)
}

export const makeAnExecutor = async (
  loadedFixture: Fixture
): Promise<Wallet> => {
  const executor = ethers.Wallet.createRandom().connect(
    ethers.provider
  )
  await approveExecutor(loadedFixture, executor.address)
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
    { wallet: smartWalletOwner },
    create2.address,
    entrypoint,
    false
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
