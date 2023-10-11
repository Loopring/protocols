import { ethers } from "hardhat";
import { expect } from "chai";
import {
  Contract,
  utils,
  BigNumber,
} from "ethers";
import {
  loadFixture,
} from "@nomicfoundation/hardhat-network-helpers";
import { fixture } from "./helper/fixture";
import {
  ERC20__factory, SmartWalletV3,
} from "../typechain-types";
import { getVerifiedContractAt } from "./helper/defi";


const RICH_ADDRESS = "0xA9D1e08C7793af67e9d92fe308d5697FB81d3E43";
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const COMPOUND_CONNECTOR_ADDRESS = "0x1B1EACaa31abbE544117073f6F8F658a56A3aE25";
const oneForUSDC = utils.parseUnits('1', 6)
const faucetToken = async (tokenAddress: string, myAddress: string, amount: string) => {
  const impersonatedRichAddr = await ethers.getImpersonatedSigner(RICH_ADDRESS);
  const token = new Contract(tokenAddress, ERC20__factory.abi, impersonatedRichAddr)
  const dc = await token.decimals()
  return token.transfer(myAddress, utils.parseUnits(amount, dc)).then(tx => tx.wait())
}
const deposit = async (smartWallet: SmartWalletV3, tokenId: string,amount:BigNumber, getId: number, setId: number) => {
  const compConnector = await getVerifiedContractAt(
    COMPOUND_CONNECTOR_ADDRESS
  );
  const data = (
    await compConnector.populateTransaction.deposit(
      tokenId,
      amount,
      getId,
      setId
    )
  ).data;
  return (await smartWallet.spell(COMPOUND_CONNECTOR_ADDRESS, data)).wait();
}
const borrow = async (smartWallet: SmartWalletV3, tokenId: string,amount:BigNumber, getId: number, setId: number) => {
  const compConnector = await getVerifiedContractAt(
    COMPOUND_CONNECTOR_ADDRESS
  );
  const data = (
    await compConnector.populateTransaction.borrow(
      tokenId,
      amount,
      getId,
      setId
    )
  ).data;
  return (await smartWallet.spell(COMPOUND_CONNECTOR_ADDRESS, data)).wait();
}
const repay = async (smartWallet: SmartWalletV3, tokenId: string,amount:BigNumber, getId: number, setId: number) => {
  const compConnector = await getVerifiedContractAt(
    COMPOUND_CONNECTOR_ADDRESS
  );
  const data = (
    await compConnector.populateTransaction.payback(
      tokenId,
      amount,
      getId,
      setId
    )
  ).data;
  return (await smartWallet.spell(COMPOUND_CONNECTOR_ADDRESS, data)).wait();
}

describe("trade agent test", () => {
  it("mainnet fork test", async () => {
    const KRAKEN_ADDRESS = "0xDA9dfA130Df4dE4673b89022EE50ff26f6EA73Cf";
    const RANDOM_ADDRESS = ethers.Wallet.createRandom().address;
    const b = await ethers.provider.getBalance(RANDOM_ADDRESS);
    const impersonatedSigner = await ethers.getImpersonatedSigner(
      KRAKEN_ADDRESS
    );
    await (
      await impersonatedSigner.sendTransaction({
        to: RANDOM_ADDRESS,
        value: ethers.utils.parseEther("1"),
      })
    ).wait();
    const b2 = await ethers.provider.getBalance(RANDOM_ADDRESS);
    expect(b2.sub(b)).eq(ethers.utils.parseEther("1"));
  });

  

  describe("Compound connector", () => {
    
    const depositAndPrepare = async () => {
      const { smartWallet } = await loadFixture(fixture);
      const RICH_ADDRESS = "0xA9D1e08C7793af67e9d92fe308d5697FB81d3E43";
      const impersonatedRichAddr = await ethers.getImpersonatedSigner(
        RICH_ADDRESS
      );
      const COMPOUND_CONNECTOR_ADDRESS =
        "0x1B1EACaa31abbE544117073f6F8F658a56A3aE25";
      const oneForUSDC = utils.parseUnits("1", 6);
      const compConnector = await getVerifiedContractAt(
        COMPOUND_CONNECTOR_ADDRESS
      );
      const ERC20_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
      const cERC20_ADDRESS = "0x39AA39c021dfbaE8faC545936693aC917d5E7563";
      const cERC20 = await getVerifiedContractAt(cERC20_ADDRESS);
      const ERC20 = new Contract(
        ERC20_ADDRESS,
        ERC20__factory.abi,
        impersonatedRichAddr
      );
      await (await ERC20.transfer(smartWallet.address, oneForUSDC)).wait();
      const balance1: BigNumber = await cERC20.balanceOf(smartWallet.address);
      await deposit(smartWallet, 'USDC-A',oneForUSDC, 0, 0);
      const balance2: BigNumber = await cERC20.balanceOf(smartWallet.address);
      return {
        balance1,
        balance2,
        compConnector,
        oneForUSDC,
        smartWallet,
        COMPOUND_CONNECTOR_ADDRESS,
        cERC20,
      };
    };
    it("deposit", async () => {
      const { balance1, balance2 } = await depositAndPrepare();
      expect(balance2.sub(balance1)).gt(0);
    });
    it("withdraw", async () => {
      const {
        compConnector,
        oneForUSDC,
        balance2,
        smartWallet,
        COMPOUND_CONNECTOR_ADDRESS,
        cERC20,
      } = await depositAndPrepare();
      const data2 = (
        await compConnector.populateTransaction.withdraw(
          "USDC-A",
          oneForUSDC,
          0,
          0
        )
      ).data;
      await (await smartWallet.spell(COMPOUND_CONNECTOR_ADDRESS, data2)).wait();
      const balance3: BigNumber = await cERC20.balanceOf(smartWallet.address);
      expect(balance2.sub(balance3)).gt(0);
    });
    it("borrow", async () => {
      const {
        oneForUSDC,
        smartWallet,
      } = await depositAndPrepare();
      const USDT_ADDRESS = '0xdac17f958d2ee523a2206206994597c13d831ec7'
      const USDT = new Contract(
        USDT_ADDRESS,
        ERC20__factory.abi,
        smartWallet.provider
      );
      const balance1: BigNumber = await USDT.balanceOf(smartWallet.address);
      await borrow(smartWallet, 'USDT-A', oneForUSDC.div(2), 0, 0)
      const balance2: BigNumber = await USDT.balanceOf(smartWallet.address);
      expect(balance2.sub(balance1)).eq(oneForUSDC.div(2));
    });
    it("repay", async () => {
      const {
        compConnector,
        oneForUSDC,
        smartWallet,
      } = await depositAndPrepare();
      const USDT_ADDRESS = '0xdac17f958d2ee523a2206206994597c13d831ec7'
      const USDT = new Contract(
        USDT_ADDRESS,
        ERC20__factory.abi,
        smartWallet.provider
      );
      const balance1: BigNumber = await USDT.balanceOf(smartWallet.address);
      await borrow(smartWallet, 'USDT-A', oneForUSDC.div(2),0,0)
      const balance2: BigNumber = await USDT.balanceOf(smartWallet.address);
      expect(balance2.sub(balance1)).eq(oneForUSDC.div(2));
      
      // repay
      await repay(smartWallet, 'USDT-A', oneForUSDC.div(2),0,0)
      const balance3: BigNumber = await USDT.balanceOf(smartWallet.address);
      expect(balance3).eq(0)
    });
  });

  it("WETH Connector", async () => {
    const {
      smartWallet,
    } = await loadFixture(fixture);

    // Wrap ETH without dsa connector
    const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
    const WETH_CONNECTOR_ADDRESS = '0x22075fa719eFb02Ca3cF298AFa9C974B7465E5D3'
    const wETH = await getVerifiedContractAt(WETH_ADDRESS)
    const oneForETH = utils.parseEther('1')
    const data = (await wETH.populateTransaction.deposit()).data
    const balance1: BigNumber = await wETH.balanceOf(smartWallet.address)
    await (await smartWallet.callContract(wETH.address, oneForETH, data, false)).wait()
    const balance2: BigNumber = await wETH.balanceOf(smartWallet.address)
    expect(balance2.sub(balance1)).eq(oneForETH)

    // Wrap ETH with dsa connector
    const wETHConnector = await getVerifiedContractAt(WETH_CONNECTOR_ADDRESS)
    const data2 = (await wETHConnector.populateTransaction.deposit(oneForETH, 0, 0)).data
    await (await smartWallet.spell(WETH_CONNECTOR_ADDRESS, data2)).wait()
    const balance3: BigNumber = await wETH.balanceOf(smartWallet.address)
    expect(balance3.sub(balance2)).eq(oneForETH)
  });

  it("UniswapV2 Connector", async () => {
    const {
      smartWallet,
    } = await loadFixture(fixture);
    const RICH_ADDRESS = '0xA9D1e08C7793af67e9d92fe308d5697FB81d3E43'
    const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    const UNI_ADDRESS = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'
    const impersonatedRichAddr = await ethers.getImpersonatedSigner(RICH_ADDRESS);
    const UniswapV2_CONNECTOR_ADDRESS = '0x1E5CE41BdB653734445FeC3553b61FebDdaFC43c'
    const oneForUSDC = utils.parseUnits('1', 6)
    const connector = await getVerifiedContractAt(UniswapV2_CONNECTOR_ADDRESS)
    const data = (await connector.populateTransaction.sell(
      UNI_ADDRESS,
      USDC_ADDRESS,
      oneForUSDC,
      0,
      0,
      0
    )).data
    const USDC = new Contract(USDC_ADDRESS, ERC20__factory.abi, impersonatedRichAddr)
    const UNI = new Contract(UNI_ADDRESS, ERC20__factory.abi, impersonatedRichAddr)
    await (await USDC.transfer(smartWallet.address, oneForUSDC)).wait()
    const balance1: BigNumber = await UNI.balanceOf(smartWallet.address)
    await (await smartWallet.spell(UniswapV2_CONNECTOR_ADDRESS, data)).wait()
    const balance2: BigNumber = await UNI.balanceOf(smartWallet.address)
    expect(balance2.sub(balance1)).gt(0)
  });

  describe('cast', () => {
    it(('naive cast'), async () => {
      const {
        smartWallet,
      } = await loadFixture(fixture);
  
      const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
      const WETH_CONNECTOR_ADDRESS = '0x22075fa719eFb02Ca3cF298AFa9C974B7465E5D3'
      const wETH = await getVerifiedContractAt(WETH_ADDRESS)
      const oneForETH = utils.parseEther('1')
      const balance1: BigNumber = await wETH.balanceOf(smartWallet.address)
  
      // Wrap ETH with dsa connector
      const wETHConnector = await getVerifiedContractAt(WETH_CONNECTOR_ADDRESS)
      const data2 = (await wETHConnector.populateTransaction.deposit(oneForETH, 0, 0)).data
      await (await smartWallet.cast([WETH_CONNECTOR_ADDRESS], [data2])).wait()
      const balance2: BigNumber = await wETH.balanceOf(smartWallet.address)
      expect(balance2.sub(balance1)).eq(oneForETH)

    })
    it(('composed cast'), async () => {
      const {
        smartWallet,
      } = await loadFixture(fixture);

      const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
      const WBT_ADDRESS = '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'
      const UNI_ADDRESS = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";
      const UniswapV2_CONNECTOR_ADDRESS =
        "0x1E5CE41BdB653734445FeC3553b61FebDdaFC43c";
      const oneForUNI = utils.parseUnits("1", 18);
      const UniswapV2Connector = await getVerifiedContractAt(
        UniswapV2_CONNECTOR_ADDRESS
      );

      const swapData = (
        await UniswapV2Connector.populateTransaction.sell(
          WETH_ADDRESS,
          UNI_ADDRESS,
          oneForUNI,
          0,
          0,
          1
        )
      ).data;
      const swapData2 = (
        await UniswapV2Connector.populateTransaction.sell(
          WBT_ADDRESS,
          WETH_ADDRESS,
          0,
          0,
          1,
          0
        )
      ).data;
      await faucetToken(UNI_ADDRESS, smartWallet.address, '1')
      const WBTC = new Contract(WBT_ADDRESS, ERC20__factory.abi, smartWallet.provider)
      const balance1: BigNumber = await WBTC.balanceOf(smartWallet.address)
      await (await smartWallet.cast([UniswapV2_CONNECTOR_ADDRESS, UniswapV2_CONNECTOR_ADDRESS], [swapData, swapData2])).wait()
      const balance2: BigNumber = await WBTC.balanceOf(smartWallet.address)
      expect(balance2.sub(balance1)).gt(0)
    })
  })
  
  describe('intergaration', () => {
    const prepare = async (smartWallet: SmartWalletV3) => {
      await faucetToken(USDC_ADDRESS, smartWallet.address, '1')
      await deposit(smartWallet, 'USDC-A', oneForUSDC, 0, 0)
      await borrow(smartWallet, 'USDT-A', oneForUSDC.div(2), 0, 0)
    }
    it.only(('sell Collateral token for borrow token and repay'), async () => {
      const {
        smartWallet,
      } = await loadFixture(fixture);
      await prepare(smartWallet)
      // debugger

      // const {
      //   smartWallet,
      // } = await loadFixture(fixture);
  
      // const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
      // const WETH_CONNECTOR_ADDRESS = '0x22075fa719eFb02Ca3cF298AFa9C974B7465E5D3'
      // const wETH = await getVerifiedContractAt(WETH_ADDRESS)
      // const oneForETH = utils.parseEther('1')
      // const balance1: BigNumber = await wETH.balanceOf(smartWallet.address)
  
      // // Wrap ETH with dsa connector
      // const wETHConnector = await getVerifiedContractAt(WETH_CONNECTOR_ADDRESS)
      // const data2 = (await wETHConnector.populateTransaction.deposit(oneForETH, 0, 0)).data
      // await (await smartWallet.cast([WETH_CONNECTOR_ADDRESS], [data2])).wait()
      // const balance2: BigNumber = await wETH.balanceOf(smartWallet.address)
      // expect(balance2.sub(balance1)).eq(oneForETH)

    })
  })


  // it("skrrr", async () => {

  //   const {
  //     smartWallet,
  //     smartWalletOwner,
  //     create2,
  //     deployer,
  //     sendUserOp,
  //     entrypoint,
  //   } = await loadFixture(fixture);
  //   const addGuardian = await smartWallet.populateTransaction.addGuardian(
  //     ethers.constants.AddressZero
  //   );
  //   const nonce = (await smartWallet.nonce()).add(1);
  //   const signedUserOp = await getSignedUserOp(
  //     addGuardian,
  //     nonce,
  //     smartWallet,
  //     smartWalletOwner,
  //     create2,
  //     entrypoint
  //   );
  //   await sendUserOp(signedUserOp);
  //   await expect(sendUserOp(signedUserOp))
  //     .to.revertedWithCustomError(entrypoint, "FailedOp")
  //     .withArgs(0, ethers.constants.AddressZero, "invalid nonce");

  //   const RICH_ADDRESS = '0xA9D1e08C7793af67e9d92fe308d5697FB81d3E43'
  //   const ERC20_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  //   const cERC20_ADDRESS = '0x39AA39c021dfbaE8faC545936693aC917d5E7563'
  //   const impersonatedKraken = await ethers.getImpersonatedSigner(RICH_ADDRESS);
  //   const cERC20 = await getVerifiedContractAt(cERC20_ADDRESS, impersonatedKraken);
  //   // const ERC20 = await getVerifiedContractAt(ERC20_ADDRESS, impersonatedKraken);
  //   const ERC20 = new Contract(ERC20_ADDRESS, ERC20__factory.abi, impersonatedKraken)
  //   // debugger
    
  //   const b0 = await cERC20.balanceOf(impersonatedKraken.address)
  //   const b01 = await ERC20.balanceOf(impersonatedKraken.address)
  //   const r1 = await (await ERC20.approve(cERC20.address, utils.parseUnits('1', 6))).wait()
  //   const r2 = await (await cERC20.mint(utils.parseUnits('1', 6))).wait()
  //   const b1 = await cERC20.balanceOf(impersonatedKraken.address)
  //   const b11 = await ERC20.balanceOf(impersonatedKraken.address)
  //   await (await ERC20.transfer(smartWallet.address, utils.parseUnits('1', 6))).wait()
  //   const a1 = await ERC20.allowance(smartWallet.address, cERC20.address)
  //   const bb1 = await ERC20.balanceOf(smartWallet.address)
  //   const bbb1 = await cERC20.balanceOf(smartWallet.address)
  //   await (await smartWallet.approveToken(ERC20_ADDRESS, cERC20.address, utils.parseUnits('1', 6), false)).wait()
  //   // const a = cERC20.mint(utils.parseUnits('1', 6))
  //   const data = (await cERC20.populateTransaction.mint(utils.parseUnits('1', 6))).data
  //   debugger
  //   await (await smartWallet.callContract(cERC20.address, '0', data, false)).wait()
  //   const a2 = await ERC20.allowance(smartWallet.address, cERC20.address)
  //   const bb2 = await ERC20.balanceOf(smartWallet.address)
  //   const bbb2 = await cERC20.balanceOf(smartWallet.address)
  //   const oneForUSDC = utils.parseUnits('1', 6)

    
  //   const COMPOUND_CONNECTOR_ADDRESS = '0x1B1EACaa31abbE544117073f6F8F658a56A3aE25'
  //   const compConnector = await getVerifiedContractAt(COMPOUND_CONNECTOR_ADDRESS, impersonatedKraken)
  //   smartWallet.selfBatchCall
  //   await (await ERC20.approve(cERC20.address, utils.parseUnits('1', 6))).wait()
  //   await (await compConnector.deposit(
  //     'USDC-A',
  //     oneForUSDC,
  //     0,
  //     0
  //   )).wait()


    

  //   // impersonatedKraken.depositRaw

  //   // ERC20.tra
  //   // smartWallet

  //   debugger

  //   // ethers.getv
  //   // new Contract('', a)
  //   // impersonatedKraken.
    
  // });
});
