import { expect } from 'chai'
import { ethers } from 'hardhat'

describe('price oracle test', () => {
  // only valid price(should be positive number) is considered
  function getTokenValue (tokenPrices: number[], amount: number): number {
    tokenPrices = tokenPrices.filter((tp) => tp > 0)
    return (
      tokenPrices.reduce((acc, cur) => acc + cur * amount, 0) /
      tokenPrices.length
    )
  }

  it('aggregational price oracle', async () => {
    const testPriceOraclesAddr = []
    // const num = 2;
    const prices = [1, 10, 0]
    for (let i = 0; i < prices.length; ++i) {
      const testPriceOracle = await (
        await ethers.getContractFactory('TestPriceOracle')
      ).deploy(prices[i])
      testPriceOraclesAddr.push(testPriceOracle.address)
    }

    const aggregationalPriceOracle = await (
      await ethers.getContractFactory('AggregationalPriceOracle')
    ).deploy(testPriceOraclesAddr)
    const token = ethers.constants.AddressZero
    const amount = 1000
    const tokenValue = await aggregationalPriceOracle.tokenValue(token, amount)
    expect(tokenValue).to.eq(getTokenValue(prices, amount))
  })

  it('cached price oracle', async () => {
    const signers = await ethers.getSigners()
    const manager = signers[1]
    const oraclePrice = 1
    const testPriceOracle = await (
      await ethers.getContractFactory('TestPriceOracle')
    ).deploy(oraclePrice)

    const cachedPriceOracle = await (
      await ethers.getContractFactory('CachedPriceOracle')
    ).deploy(testPriceOracle.address)

    const token = ethers.constants.AddressZero
    const amount = 1000
    expect(await cachedPriceOracle.tokenValue(token, amount)).to.eq(0)

    await expect(
      cachedPriceOracle.updateTokenPrice(token, amount)
    ).to.revertedWith('NOT_MANAGER')
    await cachedPriceOracle.addManager(manager.address)

    const initPrice = 10
    await cachedPriceOracle
      .connect(manager)
      .setTokenPrice(token, amount, amount * initPrice)
    expect(await cachedPriceOracle.tokenValue(token, amount)).to.eq(
      amount * initPrice
    )
    // calculate token value using the fixed ratio(fixed token price as to say)
    expect(await cachedPriceOracle.tokenValue(token, 2 * amount)).to.eq(
      2 * amount * initPrice
    )
    expect(await cachedPriceOracle.tokenValue(token, 0.5 * amount)).to.eq(
      0.5 * amount * initPrice
    )

    // update token price by price oracle
    await cachedPriceOracle.connect(manager).updateTokenPrice(token, amount)
    expect(await cachedPriceOracle.tokenValue(token, amount)).to.eq(
      amount * oraclePrice
    )

    // change oracle price
    const newOraclePrice = 20
    const newPriceOracle = await (
      await ethers.getContractFactory('TestPriceOracle')
    ).deploy(newOraclePrice)
    await cachedPriceOracle.connect(manager).setOracle(newPriceOracle.address)
    // token value is not changed before oracle update price
    expect(await cachedPriceOracle.tokenValue(token, amount)).to.eq(
      amount * oraclePrice
    )

    // change to new oracle price
    await cachedPriceOracle.connect(manager).updateTokenPrice(token, amount)
    expect(await cachedPriceOracle.tokenValue(token, amount)).to.eq(
      amount * newOraclePrice
    )
  })

  it('uniswapv2 price oracle test', async () => {
    const uniswapv2Factory = await (
      await ethers.getContractFactory('TestUniswapV2Factory')
    ).deploy()
    const wethAddr = '0x' + '01'.repeat(20)
    const uniswapV2PriceOracle = await (
      await ethers.getContractFactory('UniswapV2PriceOracle')
    ).deploy(uniswapv2Factory.address, wethAddr)
    const nativeTokenAddr = ethers.constants.AddressZero
    const erc20Addr = '0x' + '02'.repeat(20)
    const amount = 1000

    // token value of eth/weth
    expect(
      await uniswapV2PriceOracle.tokenValue(nativeTokenAddr, amount)
    ).to.eq(amount * 1)
    expect(await uniswapV2PriceOracle.tokenValue(wethAddr, amount)).to.eq(
      amount * 1
    )
    // token value of common erc20
    expect(await uniswapV2PriceOracle.tokenValue(erc20Addr, amount)).to.eq(
      amount * 0
    )

    // create a mocked token pair and add it to uniswapv2 factory
    const testUniswapV2Pair = await (
      await ethers.getContractFactory('TestUniswapV2Pair')
    ).deploy(1 /* weth reserves */, 10 /* erc20 reserves */)
    await uniswapv2Factory.addPair(
      erc20Addr,
      wethAddr,
      testUniswapV2Pair.address
    )
    expect(await uniswapV2PriceOracle.tokenValue(erc20Addr, amount)).to.eq(
      amount / 10
    )
  })

  it('kyber price oracle test', async () => {
    const price = 10
    const kyberFactory = await (
      await ethers.getContractFactory('TestKyberNetworkProxy')
    ).deploy(price)
    const kyberPriceOracle = await (
      await ethers.getContractFactory('KyberNetworkPriceOracle')
    ).deploy(kyberFactory.address)

    const nativeTokenAddr = ethers.constants.AddressZero
    const erc20Addr = '0x' + '02'.repeat(20)
    const wethAddr = '0x' + 'ee'.repeat(20)
    const amount = 1000

    // token value of eth/weth
    expect(await kyberPriceOracle.tokenValue(nativeTokenAddr, amount)).to.eq(
      amount * 1
    )
    expect(await kyberPriceOracle.tokenValue(wethAddr, amount)).to.eq(
      amount * 1
    )
    expect(await kyberPriceOracle.tokenValue(erc20Addr, amount)).to.eq(
      amount * price
    )
  })
})
