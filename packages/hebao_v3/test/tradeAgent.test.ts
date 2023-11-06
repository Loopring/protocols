import { artifacts, ethers } from "hardhat";
import { expect } from "chai";
import {
  Contract,
  utils,
  BigNumber,
  Wallet,
  BigNumberish,
  PopulatedTransaction,
  Signer,
} from "ethers";
import {
  impersonateAccount,
  loadFixture,
} from "@nomicfoundation/hardhat-network-helpers";
import { fixture } from "./helper/fixture";
import {
  Automation__factory,
  ERC20__factory, EntryPoint, LoopringCreate2Deployer, SmartWalletV3, WhitelistLib__factory,
} from "../typechain-types";
import { getVerifiedContractAt } from "./helper/defi";
import { createRandomAccount, evRevertInfo, getErrorMessage } from "./helper/utils";
import { eq } from "lodash";
import { SendUserOp, UserOperation, fillAndSign } from "./helper/AASigner";
import { TransactionReceipt } from "@ethersproject/abstract-provider";
import {  } from "web3-eth-abi";
import { defaultAbiCoder } from "ethers/lib/utils";
import { AddressZero } from "./core/testutils";


const AUTOMATION_EXCUTOR = "0x1111111111111111111111111111111111111111";
const RICH_ADDRESS = "0xA9D1e08C7793af67e9d92fe308d5697FB81d3E43";
const WETH_CONNECTOR_ADDRESS = '0x22075fa719eFb02Ca3cF298AFa9C974B7465E5D3'

const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const UNI_ADDRESS = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'
const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const cUSDT_ADDRESS = '0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9'
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const WBT_ADDRESS = '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'

const COMPOUND_CONNECTOR_ADDRESS = "0x1B1EACaa31abbE544117073f6F8F658a56A3aE25";
const UniswapV2_CONNECTOR_ADDRESS = '0x1E5CE41BdB653734445FeC3553b61FebDdaFC43c'
const oneForUSDC = utils.parseUnits('1', 6);
type Fixture = {
  smartWallet: SmartWalletV3, 
  smartWalletOwner: Signer, 
  create2: LoopringCreate2Deployer, 
  entrypoint: EntryPoint, 
  sendUserOp: SendUserOp 
}
const faucetToken = async (tokenAddress: string | 0, myAddress: string, amount: string) => {
  const impersonatedRichAddr = await ethers.getImpersonatedSigner(RICH_ADDRESS);
  if (tokenAddress === 0) {
    return impersonatedRichAddr.sendTransaction({
      to: myAddress,
      value: utils.parseEther(amount)
    })
  } else {
    const token = new Contract(tokenAddress, ERC20__factory.abi, impersonatedRichAddr)
    const dc = await token.decimals()
    return token.transfer(myAddress, utils.parseUnits(amount, dc)).then(tx => tx.wait())
  }
}
const depositData = async (tokenId: string,amount:BigNumber, getId: number, setId: number) => {
  const compConnector = await getVerifiedContractAt(
    COMPOUND_CONNECTOR_ADDRESS
  );
  return (
    await compConnector.populateTransaction.deposit(
      tokenId,
      amount,
      getId,
      setId
    )
  ).data;
}
const deposit = async (fixture: Fixture, executor: Wallet, tokenId: string, amount:BigNumber, getId: number, setId: number) => {
  // const {
  //   smartWallet,
  //   create2,
  //   entrypoint,
  //   sendUserOp,
  // } = fixture;
  const data = await depositData(tokenId,amount,getId,setId);
  return userOpCast(COMPOUND_CONNECTOR_ADDRESS, data, executor, fixture)
  // return (await smartWallet.spell(COMPOUND_CONNECTOR_ADDRESS, data, AddressZero)).wait();
}
const withdrawData = async (tokenId: string,amount:BigNumber, getId: number, setId: number) => {
  const compConnector = await getVerifiedContractAt(
    COMPOUND_CONNECTOR_ADDRESS
  );
  return (
    await compConnector.populateTransaction.withdraw(
      tokenId,
      amount,
      getId,
      setId
    )
  ).data;

}
const withdraw = async (fixture: Fixture, executor: Wallet, tokenId: string,amount:BigNumber, getId: number, setId: number) => {
  const data = await withdrawData(tokenId,amount, getId, setId)
  const {
    smartWallet,
    create2,
    entrypoint,
    sendUserOp,
  } = fixture;
  return userOpCast(COMPOUND_CONNECTOR_ADDRESS, data, executor, fixture)
  // return (await smartWallet.spell(COMPOUND_CONNECTOR_ADDRESS, data)).wait();
}
const borrow = async (fixture: Fixture, executor: Wallet, tokenId: string, amount:BigNumber, getId: number, setId: number) => {
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
  const {
    smartWallet,
    create2,
    entrypoint,
    sendUserOp,
  } = fixture;
  return userOpCast(COMPOUND_CONNECTOR_ADDRESS, data, executor, fixture)
}
const repayData = async (tokenId: string,amount:BigNumber, getId: number, setId: number) => {
  const compConnector = await getVerifiedContractAt(
    COMPOUND_CONNECTOR_ADDRESS
  );
  return (
    await compConnector.populateTransaction.payback(
      tokenId,
      amount,
      getId,
      setId
    )
  ).data;
}
const repay = async (fixture: Fixture, executor: Wallet, tokenId: string,amount:BigNumber, getId: number, setId: number) => {
  // const {
  //   smartWallet,
  //   create2,
  //   entrypoint,
  //   sendUserOp,
  // } = fixture;
  const data = await repayData(tokenId,amount, getId, setId)
  return userOpCast(COMPOUND_CONNECTOR_ADDRESS, data, executor, fixture);
  // return (await smartWallet.spell(COMPOUND_CONNECTOR_ADDRESS, data)).wait();
}
const uniswapSellData = async (buyAddress: string, sellAddress: string,amount:BigNumber, getId: number, setId: number, unitAmount?: BigNumber) => {
  const connector = await getVerifiedContractAt(
    UniswapV2_CONNECTOR_ADDRESS
  );
  return (await connector.populateTransaction.sell(
    buyAddress,
    sellAddress,
    amount,
    unitAmount ? unitAmount : 0,
    getId,
    setId
  )).data
}


const permissionDeniedMsg = 'todo: permission denied'
const oneForETH = utils.parseEther('1')

const getSignedUserOp = async (
  tx: PopulatedTransaction,
  nonce: BigNumberish,
  smartWallet: SmartWalletV3,
  smartWalletOwner: Signer,
  create2: LoopringCreate2Deployer,
  entrypoint: EntryPoint
) => {
  const partialUserOp: Partial<UserOperation> = {
    sender: smartWallet.address,
    nonce,
    callData: tx.data,
    callGasLimit: "1268800",
  };
  const signedUserOp = await fillAndSign(
    partialUserOp,
    smartWalletOwner,
    create2.address,
    entrypoint
  );
  return signedUserOp;
}
const userOpCast = async (
  addresses: string[] | string, 
  datas: string[] | string,
  // _smartWallet: SmartWalletV3,
  smartWalletSigner: Signer,
  // create2: LoopringCreate2Deployer,
  // entrypoint: EntryPoint,
  // sendUserOp: SendUserOp,
  loadedFixture: Fixture
  ) => {
    const {
      smartWallet: _smartWallet,
      create2,
      entrypoint,
      sendUserOp,
    } = loadedFixture
    const smartWallet = _smartWallet.connect(smartWalletSigner)
    const nonce = await smartWallet.nonce();
    const smartWalletSignerAddr  = await smartWalletSigner.getAddress()

    if (typeof addresses === 'string' && typeof datas === 'string'){
      const populatedTx = await smartWallet.populateTransaction.spell(smartWalletSignerAddr, addresses, datas)
      var signedUserOp = await getSignedUserOp(populatedTx, nonce.add(1), smartWallet, smartWalletSigner, create2, entrypoint)
    } else if (typeof addresses !== 'string' && typeof datas !== 'string') { 
      const populatedTx = await smartWallet.populateTransaction.cast(smartWalletSignerAddr, addresses, datas)
      signedUserOp = await getSignedUserOp(populatedTx, nonce.add(1), smartWallet, smartWalletSigner, create2, entrypoint)
    } else {
      throw 'wrong input'
    }
    return await sendUserOp(signedUserOp)
} 

const approveExecutor = async (
  loadedFixture: Fixture,
  executor: string, 
  connectors: string[],
  ) => {
    const {
      smartWallet,
      smartWalletOwner,
      create2,
      entrypoint,
      sendUserOp,
    } = loadedFixture;
    const nonce = await smartWallet.nonce();
    const populatedTx = await smartWallet.populateTransaction.approveExecutor(executor, connectors);
    const signedUserOp = await getSignedUserOp(populatedTx, nonce.add(1), smartWallet, smartWalletOwner, create2, entrypoint)
    return sendUserOp(signedUserOp)
} 
const unApproveExecutor = async (
  executor: string, 
  smartWallet: SmartWalletV3,
  smartWalletOwner: Wallet,
  create2: LoopringCreate2Deployer,
  entrypoint: EntryPoint,
  sendUserOp: SendUserOp
  ) => {
    const nonce = await smartWallet.nonce();
    const populatedTx = await smartWallet.populateTransaction.unApproveExecutor(executor);
    const signedUserOp = await getSignedUserOp(populatedTx, nonce.add(1), smartWallet, smartWalletOwner, create2, entrypoint)
    return sendUserOp(signedUserOp)
} 

const uniswapSell = async (smartWallet: SmartWalletV3, buyAddress: string, sellAddress: string, amount:BigNumber, getId: number, setId: number, unitAmount?: BigNumber) => {
  const data = await uniswapSellData(buyAddress,sellAddress,amount,getId,setId,unitAmount)
  return (await smartWallet.spell(UniswapV2_CONNECTOR_ADDRESS, data)).wait();
}

const getFirstUserOpErrMsg = async (txReceipt: TransactionReceipt, entrypoint: EntryPoint) => {
  const revertInfo = await evRevertInfo(entrypoint, txReceipt)
  return revertInfo[0]?.revertReason ? getErrorMessage(revertInfo[0].revertReason) : undefined
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

  const makeAExecutor = async (connectors: string[], loadedFixture: Fixture) => {
    const executor = Wallet.createRandom().connect(ethers.provider)
    const txReceipt1 = await approveExecutor(loadedFixture,executor.address, connectors);
    const msg = await getFirstUserOpErrMsg(txReceipt1, loadedFixture.entrypoint)
    expect(msg).undefined
    return executor
  }

  describe("Compound connector", () => {
    
    const depositAndPrepare = async () => {
      const loadedFixture = await loadFixture(fixture);
      const { 
        smartWallet ,
        smartWalletOwner,
        entrypoint,
        sendUserOp,
        create2
      } = loadedFixture;
      const compConnector = await getVerifiedContractAt(
        COMPOUND_CONNECTOR_ADDRESS
      );
      const cERC20_ADDRESS = "0x39AA39c021dfbaE8faC545936693aC917d5E7563";
      const cERC20 = await getVerifiedContractAt(cERC20_ADDRESS);
      const executor = await makeAExecutor([COMPOUND_CONNECTOR_ADDRESS], loadedFixture);
      await faucetToken(USDC_ADDRESS, smartWallet.address, '1');
      const data = await depositData('USDC-A', oneForUSDC, 0, 0)
      const balance1: BigNumber = await cERC20.balanceOf(smartWallet.address);
      const txReceipt = await userOpCast(COMPOUND_CONNECTOR_ADDRESS, data, executor, loadedFixture)
      const msg = await getFirstUserOpErrMsg(txReceipt, entrypoint)
      expect(msg).undefined
      const balance2: BigNumber = await cERC20.balanceOf(smartWallet.address);
      return {
        loadedFixture, 
        balance1,
        balance2,
        compConnector,
        oneForUSDC,
        // smartWallet,
        COMPOUND_CONNECTOR_ADDRESS,
        cERC20,
        // sendUserOp,
        // create2,
        // entrypoint,
        executor
      };
    };
    it("deposit", async () => {
      const { balance1, balance2 } = await depositAndPrepare();
      expect(balance2.sub(balance1).gt(0)).true;
    });
    it("withdraw", async () => {
      const {
        compConnector,
        oneForUSDC,
        balance2,
        loadedFixture,

        COMPOUND_CONNECTOR_ADDRESS,
        cERC20,
        // sendUserOp,
        // create2,
        // entrypoint,
        executor
      } = await depositAndPrepare();
      const {
        smartWallet,
        sendUserOp,
        create2,
        entrypoint,
      } = loadedFixture;
      const data = await withdrawData('USDC-A', oneForUSDC, 0, 0)
      const txReceipt = await userOpCast(COMPOUND_CONNECTOR_ADDRESS, data, executor, loadedFixture)
      const msg = await getFirstUserOpErrMsg(txReceipt, entrypoint)
      expect(msg).undefined
      const balance3: BigNumber = await cERC20.balanceOf(smartWallet.address);
      expect(balance2.sub(balance3)).gt(0);
    });
    it("borrow", async () => {
      const {
        compConnector,
        oneForUSDC,
        loadedFixture,

        COMPOUND_CONNECTOR_ADDRESS,
        cERC20,
        // sendUserOp,
        // create2,
        // entrypoint,
        executor
      } = await depositAndPrepare();
      const {
        smartWallet,
        sendUserOp,
        create2,
        entrypoint,
      } = loadedFixture;
      const USDT_ADDRESS = '0xdac17f958d2ee523a2206206994597c13d831ec7'
      const USDT = new Contract(
        USDT_ADDRESS,
        ERC20__factory.abi,
        smartWallet.provider
      );
      const balance1: BigNumber = await USDT.balanceOf(smartWallet.address);
      const data = (await compConnector.populateTransaction.borrow(
        'USDT-A', oneForUSDC.div(2), 0, 0
      )).data
      // const data = await 
      // borrowData('USDC-A', oneForUSDC, 0, 0)
      const txReceipt = await userOpCast(COMPOUND_CONNECTOR_ADDRESS, data, executor, loadedFixture)
      const msg = await getFirstUserOpErrMsg(txReceipt, entrypoint)
      expect(msg).undefined
      // await borrow(smartWallet, 'USDT-A', oneForUSDC.div(2), 0, 0)
      const balance2: BigNumber = await USDT.balanceOf(smartWallet.address);
      expect(balance2.sub(balance1)).eq(oneForUSDC.div(2));
    });
    it("repay", async () => {
      const {
        compConnector,
        oneForUSDC,
        loadedFixture,

        COMPOUND_CONNECTOR_ADDRESS,
        cERC20,
        // sendUserOp,
        // create2,
        // entrypoint,
        executor
      } = await depositAndPrepare();
      const {
        smartWallet,
        sendUserOp,
        create2,
        entrypoint,
      } = loadedFixture;
      const USDT_ADDRESS = '0xdac17f958d2ee523a2206206994597c13d831ec7'
      const USDT = new Contract(
        USDT_ADDRESS,
        ERC20__factory.abi,
        smartWallet.provider
      );
      const balance1: BigNumber = await USDT.balanceOf(smartWallet.address);
      await borrow(loadedFixture, executor, 'USDT-A', oneForUSDC.div(2),0,0)
      const balance2: BigNumber = await USDT.balanceOf(smartWallet.address);
      expect(balance2.sub(balance1)).eq(oneForUSDC.div(2));
      
      // repay
      await repay(loadedFixture, executor, 'USDT-A', oneForUSDC.div(2),0,0)
      const balance3: BigNumber = await USDT.balanceOf(smartWallet.address);
      expect(balance3).eq(0)
    });
  });
  

  it("WETH Connector", async () => {
    const loadedFixture =
      await loadFixture(fixture);
    const { smartWallet, smartWalletOwner, create2, entrypoint, sendUserOp } =
    loadedFixture;
    const wETH = await getVerifiedContractAt(WETH_ADDRESS)
    const executor = await makeAExecutor([WETH_CONNECTOR_ADDRESS], loadedFixture);
    // const executor = Wallet.createRandom().connect(ethers.provider)
    // const txReceipt1 = await approveExecutor(executor.address, [WETH_CONNECTOR_ADDRESS], smartWallet, smartWalletOwner, create2, entrypoint, sendUserOp);
    // const msg = await getFirstUserOpErrMsg(txReceipt1, entrypoint)
    // expect(msg).undefined

    const balance1: BigNumber = await wETH.balanceOf(smartWallet.address)
    const wETHConnector = await getVerifiedContractAt(WETH_CONNECTOR_ADDRESS)
    const data2 = (await wETHConnector.populateTransaction.deposit(oneForETH, 0, 0)).data
    const txReceipt = await userOpCast(WETH_CONNECTOR_ADDRESS, data2, executor, loadedFixture)
    const msg2 = await getFirstUserOpErrMsg(txReceipt, entrypoint)
    expect(msg2).undefined
    const balance2: BigNumber = await wETH.balanceOf(smartWallet.address)
    expect(balance2.sub(balance1)).eq(oneForETH)
  });

  it("UniswapV2 Connector", async () => {
    // const {
    //   smartWallet,
    //   create2,
    //   entrypoint,
    //   sendUserOp
    // } 
    const loadedFixture = await loadFixture(fixture);
    const {
      smartWallet,
      create2,
      entrypoint,
      sendUserOp,
      smartWalletOwner
    } = loadedFixture;
    // const impersonatedRichAddr = await ethers.getImpersonatedSigner(RICH_ADDRESS);
    const USDC = new Contract(USDC_ADDRESS, ERC20__factory.abi, ethers.provider);
    const UNI = new Contract(UNI_ADDRESS, ERC20__factory.abi, ethers.provider);
    // const kkk = await (await USDC.transfer(smartWallet.address, oneForUSDC)).wait()
    const balance1: BigNumber = await UNI.balanceOf(smartWallet.address);
    const executor = await makeAExecutor([UniswapV2_CONNECTOR_ADDRESS], loadedFixture);
    await faucetToken(USDC_ADDRESS, smartWallet.address, '1');
    const balanceC1: BigNumber = await USDC.balanceOf(smartWallet.address);
    // const balance111: BigNumber = await USDC.balanceOf(RICH_ADDRESS)
    
    const data = await uniswapSellData(UNI_ADDRESS, USDC_ADDRESS, oneForUSDC, 0, 0);
    const txReceipt = await userOpCast(UniswapV2_CONNECTOR_ADDRESS, data, executor, loadedFixture)
    const msg2 = await getFirstUserOpErrMsg(txReceipt, entrypoint)
    expect(msg2).undefined
    const balance2: BigNumber = await UNI.balanceOf(smartWallet.address)
    const balanceC2: BigNumber = await USDC.balanceOf(smartWallet.address)
    expect(balance2.sub(balance1).gt(0)).true
  });

  describe('cast', () => {
    // it(('naive cast'), async () => {
    //   const {
    //     smartWallet,
    //   } = await loadFixture(fixture);
  
    //   const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
    //   const WETH_CONNECTOR_ADDRESS = '0x22075fa719eFb02Ca3cF298AFa9C974B7465E5D3'
    //   const wETH = await getVerifiedContractAt(WETH_ADDRESS)
    //   const oneForETH = utils.parseEther('1')
    //   const balance1: BigNumber = await wETH.balanceOf(smartWallet.address)
  
    //   // Wrap ETH with dsa connector
    //   const wETHConnector = await getVerifiedContractAt(WETH_CONNECTOR_ADDRESS)
    //   const data2 = (await wETHConnector.populateTransaction.deposit(oneForETH, 0, 0)).data
    //   await (await smartWallet.cast([WETH_CONNECTOR_ADDRESS], [data2])).wait()
    //   const balance2: BigNumber = await wETH.balanceOf(smartWallet.address)
    //   expect(balance2.sub(balance1)).eq(oneForETH)

    // })
    it(('composed cast'), async () => {
      const loadedFixture = await loadFixture(fixture);
      const {
        smartWallet,
        smartWalletOwner,
        entrypoint,
        create2,
        sendUserOp
      } = loadedFixture;
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
      // await faucetToken(UNI_ADDRESS, smartWallet.address, '1')
      const executor = await makeAExecutor([UniswapV2_CONNECTOR_ADDRESS], loadedFixture)
      const WBTC = new Contract(WBT_ADDRESS, ERC20__factory.abi, smartWallet.provider)
      const balance1: BigNumber = await WBTC.balanceOf(smartWallet.address)
      
      const txScript = await userOpCast([UniswapV2_CONNECTOR_ADDRESS, UniswapV2_CONNECTOR_ADDRESS], [swapData, swapData2], executor, loadedFixture)
      // await (await smartWallet.cast([UniswapV2_CONNECTOR_ADDRESS, UniswapV2_CONNECTOR_ADDRESS], [swapData, swapData2])).wait()
      const balance2: BigNumber = await WBTC.balanceOf(smartWallet.address)
      expect(balance2.sub(balance1)).gt(0)
    })
  })
  
  describe('intergaration', () => {
    const prepare = async (loadedFixture: Fixture, executor: Wallet) => {
      await faucetToken(USDC_ADDRESS, loadedFixture.smartWallet.address, '1')
      await deposit(loadedFixture, executor, 'USDC-A', oneForUSDC, 0, 0)
      await borrow(loadedFixture,executor, 'USDT-A', oneForUSDC.div(2), 0, 0)
    }
    it('sell Collateral token for borrow token and repay', async () => {
      const loadedFixture = await loadFixture(fixture);
      const {
        smartWallet,
      } = loadedFixture;
      const getState = async () => {
        const USDT = new Contract(USDT_ADDRESS, ERC20__factory.abi, smartWallet.provider)
        const snapshot = await cUSDT.getAccountSnapshot(smartWallet.address);
        const USDTBalance = await USDT.balanceOf(smartWallet.address);
        return {
          snapshot,
          debt: snapshot[2],
          USDTBalance: USDTBalance
        }
      }
      const cUSDT = await getVerifiedContractAt(cUSDT_ADDRESS);
      const executor = await makeAExecutor([COMPOUND_CONNECTOR_ADDRESS, UniswapV2_CONNECTOR_ADDRESS], loadedFixture)
      await prepare(loadedFixture, executor);
      const state2 = await getState()
      const data1 = await withdrawData('USDC-A', oneForUSDC.div(100), 0, 1);
      const data2 = await uniswapSellData(USDT_ADDRESS, USDC_ADDRESS, BigNumber.from('0'), 1, 2);
      const data3 = await repayData('USDT-A', BigNumber.from('0'), 2, 0);
      const castAddresses = [
        COMPOUND_CONNECTOR_ADDRESS, 
        UniswapV2_CONNECTOR_ADDRESS,
        COMPOUND_CONNECTOR_ADDRESS
      ]
      const castDatas = [
        data1, 
        data2,
        data3
      ]
      await userOpCast(castAddresses, castDatas, executor, loadedFixture);
      // await (await smartWallet.cast(castAddresses, castDatas)).wait()
      const state3 = await getState()
      expect(state2.debt).gt(state3.debt)
    })
    // it('automation execution', async () => {
    //   const {
    //     smartWallet,
    //     automation
    //   } = await loadFixture(fixture);
    //   const randomAcc = ethers.Wallet.createRandom().connect(smartWallet.provider)
    //   const impersonatedAutomationExecutor = await ethers.getImpersonatedSigner(AUTOMATION_EXCUTOR);
    //   const automationWithExecutor = automation.connect(impersonatedAutomationExecutor)
      
    //   const getState = async () => {
    //     const USDT = new Contract(USDT_ADDRESS, ERC20__factory.abi, smartWallet.provider)
    //     const USDC = new Contract(USDC_ADDRESS, ERC20__factory.abi, smartWallet.provider)
    //     const snapshot = await cUSDT.getAccountSnapshot(smartWallet.address);
    //     const USDTBalance = await USDT.balanceOf(smartWallet.address);
    //     const USDCBalance = await USDC.balanceOf(smartWallet.address);
    //     return {
    //       snapshot,
    //       debt: snapshot[2],
    //       USDTBalance: USDTBalance as BigNumber,
    //       USDCBalance: USDCBalance as BigNumber
    //     }
    //   }
    //   // await faucetToken(,smartWallet.address,'1')
    //   await prepare(load)
    //   await faucetToken(0,impersonatedAutomationExecutor.address,'1')
    //   await faucetToken(0,randomAcc.address,'1')
    //   await faucetToken(USDC_ADDRESS,smartWallet.address,'1')
      
    //   const cUSDT = await getVerifiedContractAt(cUSDT_ADDRESS);

    //   const data1 = await withdrawData('USDC-A', oneForUSDC.div(100), 0, 1);
    //   const data2 = await uniswapSellData(USDT_ADDRESS, USDC_ADDRESS, BigNumber.from('0'), 1, 2);
    //   const data3 = await repayData('USDT-A', BigNumber.from('0'), 2, 0);
      
    //   // const data1 = await depositData('USDC-A', oneForUSDC, 0, 1);
    //   // const data2 = await uniswapSellData(USDT_ADDRESS, USDC_ADDRESS, BigNumber.from('0'), 1, 2);
    //   // const data3 = await repayData('USDT-A', BigNumber.from('0'), 2, 0);
    //   const castAddresses = [
    //     COMPOUND_CONNECTOR_ADDRESS, 
    //     UniswapV2_CONNECTOR_ADDRESS,
    //     COMPOUND_CONNECTOR_ADDRESS
    //   ]
      
    //   const castDatas = [
    //     data1,
    //     data2,
    //     data3
    //   ]
    //   const state2 = await getState()
    //   await (await automationWithExecutor.cast(smartWallet.address, castAddresses, castDatas)).wait()
    //   const state3 = await getState()
    //   expect(state2.debt).gt(state3.debt)
    // })
    it('automation execution with non executor', async () => {
      const loadedFixture = await loadFixture(fixture);
      const {
        smartWallet,
        entrypoint
      } = loadedFixture;
      const nonExecutor = ethers.Wallet.createRandom().connect(smartWallet.provider)
      // const impersonatedAutomationExecutor = await ethers.getImpersonatedSigner(AUTOMATION_EXCUTOR);
      // const automationWithNonExecutor = automation.connect(randomAcc)
      // await faucetToken(0,impersonatedAutomationExecutor.address,'1')
      await faucetToken(0, nonExecutor.address,'1')
      await faucetToken(USDC_ADDRESS,smartWallet.address,'1')
      
      const data1 = await depositData('USDC-A', oneForUSDC, 0, 1);
      // const 
      
      const castAddresses = [
        COMPOUND_CONNECTOR_ADDRESS, 
      ]
      
      const castDatas = [
        data1, 
      ]
      // const txReceipt = await userOpCast(castAddresses, castDatas, nonExecutor, loadedFixture);
      // const msg = await getFirstUserOpErrMsg(txReceipt, entrypoint);
      // debugger

      expect(userOpCast(castAddresses, castDatas, nonExecutor, loadedFixture))
        .to.revertedWithCustomError(entrypoint, "SignatureValidationFailed")
    })
  })

  // it.only(('Do not add this test'), async () => {
  //   const {
  //     smartWallet,
  //     automation
  //   } = await loadFixture(fixture);
  //   const randomAcc = ethers.Wallet.createRandom().connect(smartWallet.provider)
  //   const impersonatedAutomationExecutor = await ethers.getImpersonatedSigner('0x735503b71b5bb1cd2ab4b9cd9f00613e9b07fb3b');
  //   const con = await getVerifiedContractAt('0xa9abc45a98ac6f5bd44944babb425ef480abd3fe', impersonatedAutomationExecutor)
  //   debugger
  // })




});
