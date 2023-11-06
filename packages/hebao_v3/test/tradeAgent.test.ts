import { ethers } from "hardhat";
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
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { fixture } from "./helper/fixture";
import {
  ERC20__factory,
  EntryPoint,
  LoopringCreate2Deployer,
  SmartWalletV3,
} from "../typechain-types";
import { getVerifiedContractAt } from "./helper/defi";
import { evRevertInfo, getErrorMessage } from "./helper/utils";
import { SendUserOp, UserOperation, fillAndSign } from "./helper/AASigner";
import { TransactionReceipt } from "@ethersproject/abstract-provider";

describe("trade agent test", () => {
  const CONSTANTS = {
    RICH_ADDRESS: "0xA9D1e08C7793af67e9d92fe308d5697FB81d3E43",
    WETH_CONNECTOR_ADDRESS: "0x22075fa719eFb02Ca3cF298AFa9C974B7465E5D3",
    USDC_ADDRESS: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    UNI_ADDRESS: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    USDT_ADDRESS: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    cUSDT_ADDRESS: "0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9",
    WETH_ADDRESS: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    WBT_ADDRESS: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
    COMPOUND_CONNECTOR_ADDRESS: "0x1B1EACaa31abbE544117073f6F8F658a56A3aE25",
    UniswapV2_CONNECTOR_ADDRESS: "0x1E5CE41BdB653734445FeC3553b61FebDdaFC43c",
    ONE_FOR_ETH: utils.parseEther("1"),
    ONE_FOR_USDC: utils.parseUnits("1", 6),
  }  
  type Fixture = {
    smartWallet: SmartWalletV3;
    smartWalletOwner: Signer;
    create2: LoopringCreate2Deployer;
    entrypoint: EntryPoint;
    sendUserOp: SendUserOp;
  };
  const faucetToken = async (
    tokenAddress: string | 0,
    myAddress: string,
    amount: string
  ) => {
    const impersonatedRichAddr = await ethers.getImpersonatedSigner(
      CONSTANTS.RICH_ADDRESS
    );
    if (tokenAddress === 0) {
      return impersonatedRichAddr.sendTransaction({
        to: myAddress,
        value: utils.parseEther(amount),
      });
    } else {
      const token = new Contract(
        tokenAddress,
        ERC20__factory.abi,
        impersonatedRichAddr
      );
      const dc = await token.decimals();
      return token
        .transfer(myAddress, utils.parseUnits(amount, dc))
        .then((tx) => tx.wait());
    }
  };
  const depositData = async (
    tokenId: string,
    amount: BigNumber,
    getId: number,
    setId: number
  ) => {
    const compConnector = await getVerifiedContractAt(
      CONSTANTS.COMPOUND_CONNECTOR_ADDRESS
    );
    return (
      await compConnector.populateTransaction.deposit(
        tokenId,
        amount,
        getId,
        setId
      )
    ).data;
  };
  const deposit = async (
    fixture: Fixture,
    executor: Wallet,
    tokenId: string,
    amount: BigNumber,
    getId: number,
    setId: number
  ) => {
    const data = await depositData(tokenId, amount, getId, setId);
    return userOpCast(CONSTANTS.COMPOUND_CONNECTOR_ADDRESS, data, executor, fixture);
  };
  const withdrawData = async (
    tokenId: string,
    amount: BigNumber,
    getId: number,
    setId: number
  ) => {
    const compConnector = await getVerifiedContractAt(
      CONSTANTS.COMPOUND_CONNECTOR_ADDRESS
    );
    return (
      await compConnector.populateTransaction.withdraw(
        tokenId,
        amount,
        getId,
        setId
      )
    ).data;
  };

  const borrow = async (
    fixture: Fixture,
    executor: Wallet,
    tokenId: string,
    amount: BigNumber,
    getId: number,
    setId: number
  ) => {
    const compConnector = await getVerifiedContractAt(
      CONSTANTS.COMPOUND_CONNECTOR_ADDRESS
    );
    const data = (
      await compConnector.populateTransaction.borrow(
        tokenId,
        amount,
        getId,
        setId
      )
    ).data;
    return userOpCast(CONSTANTS.COMPOUND_CONNECTOR_ADDRESS, data, executor, fixture);
  };

  const repayData = async (
    tokenId: string,
    amount: BigNumber,
    getId: number,
    setId: number
  ) => {
    const compConnector = await getVerifiedContractAt(
      CONSTANTS.COMPOUND_CONNECTOR_ADDRESS
    );
    return (
      await compConnector.populateTransaction.payback(
        tokenId,
        amount,
        getId,
        setId
      )
    ).data;
  };
  const repay = async (
    fixture: Fixture,
    executor: Wallet,
    tokenId: string,
    amount: BigNumber,
    getId: number,
    setId: number
  ) => {
    const data = await repayData(tokenId, amount, getId, setId);
    return userOpCast(CONSTANTS.COMPOUND_CONNECTOR_ADDRESS, data, executor, fixture);
  };
  const uniswapSellData = async (
    buyAddress: string,
    sellAddress: string,
    amount: BigNumber,
    getId: number,
    setId: number,
    unitAmount?: BigNumber
  ) => {
    const connector = await getVerifiedContractAt(CONSTANTS.UniswapV2_CONNECTOR_ADDRESS);
    return (
      await connector.populateTransaction.sell(
        buyAddress,
        sellAddress,
        amount,
        unitAmount ? unitAmount : 0,
        getId,
        setId
      )
    ).data;
  };

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
  };
  const userOpCast = async (
    addresses: string[] | string,
    datas: string[] | string,
    smartWalletSigner: Signer,
    loadedFixture: Fixture
  ) => {
    const {
      smartWallet: _smartWallet,
      create2,
      entrypoint,
      sendUserOp,
    } = loadedFixture;
    const smartWallet = _smartWallet.connect(smartWalletSigner);
    const nonce = await smartWallet.nonce();
    const smartWalletSignerAddr = await smartWalletSigner.getAddress();

    if (typeof addresses === "string" && typeof datas === "string") {
      const populatedTx = await smartWallet.populateTransaction.spell(
        smartWalletSignerAddr,
        addresses,
        datas
      );
      var signedUserOp = await getSignedUserOp(
        populatedTx,
        nonce.add(1),
        smartWallet,
        smartWalletSigner,
        create2,
        entrypoint
      );
    } else if (typeof addresses !== "string" && typeof datas !== "string") {
      const populatedTx = await smartWallet.populateTransaction.cast(
        smartWalletSignerAddr,
        addresses,
        datas
      );
      signedUserOp = await getSignedUserOp(
        populatedTx,
        nonce.add(1),
        smartWallet,
        smartWalletSigner,
        create2,
        entrypoint
      );
    } else {
      throw "wrong input";
    }
    return await sendUserOp(signedUserOp);
  };

  const approveExecutor = async (
    loadedFixture: Fixture,
    executor: string,
    connectors: string[]
  ) => {
    const { smartWallet, smartWalletOwner, create2, entrypoint, sendUserOp } =
      loadedFixture;
    const nonce = await smartWallet.nonce();
    const populatedTx = await smartWallet.populateTransaction.approveExecutor(
      executor,
      connectors
    );
    const signedUserOp = await getSignedUserOp(
      populatedTx,
      nonce.add(1),
      smartWallet,
      smartWalletOwner,
      create2,
      entrypoint
    );
    return sendUserOp(signedUserOp);
  };
  const unApproveExecutor = async (
    loadedFixture: Fixture,
    executor: string
  ) => {
    const { smartWallet, smartWalletOwner, create2, entrypoint, sendUserOp } =
      loadedFixture;
    const nonce = await smartWallet.nonce();
    const populatedTx = await smartWallet.populateTransaction.unApproveExecutor(
      executor
    );
    const signedUserOp = await getSignedUserOp(
      populatedTx,
      nonce.add(1),
      smartWallet,
      smartWalletOwner,
      create2,
      entrypoint
    );
    return sendUserOp(signedUserOp);
  };

  const getFirstUserOpErrMsg = async (
    txReceipt: TransactionReceipt,
    entrypoint: EntryPoint
  ) => {
    const revertInfo = await evRevertInfo(entrypoint, txReceipt);
    return revertInfo[0]?.revertReason
      ? getErrorMessage(revertInfo[0].revertReason)
      : undefined;
  };

  const makeAnExecutor = async (
    connectors: string[],
    loadedFixture: Fixture
  ) => {
    const executor = Wallet.createRandom().connect(ethers.provider);
    const txReceipt1 = await approveExecutor(
      loadedFixture,
      executor.address,
      connectors
    );
    const msg = await getFirstUserOpErrMsg(
      txReceipt1,
      loadedFixture.entrypoint
    );
    expect(msg).undefined;
    return executor;
  };

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

  describe.only("permission", () => {
    
    it("not approved executor should be rejected", async () => {
      const loadedFixture = await loadFixture(fixture);
      const wETHConnector = await getVerifiedContractAt(CONSTANTS.WETH_CONNECTOR_ADDRESS);
      const data = (
        await wETHConnector.populateTransaction.deposit(CONSTANTS.ONE_FOR_ETH, 0, 0)
      ).data;
      const executor = Wallet.createRandom();
      expect(userOpCast(
        CONSTANTS.WETH_CONNECTOR_ADDRESS,
        data,
        executor,
        loadedFixture
      )).to.revertedWithCustomError(loadedFixture.entrypoint, "SignatureValidationFailed");;
    });
    it("approved executor should be not rejected", async () => {
      const loadedFixture = await loadFixture(fixture);
      const wETHConnector = await getVerifiedContractAt(CONSTANTS.WETH_CONNECTOR_ADDRESS);
      const data = (
        await wETHConnector.populateTransaction.deposit(CONSTANTS.ONE_FOR_ETH, 0, 0)
      ).data;
      const executor = await makeAnExecutor([CONSTANTS.WETH_CONNECTOR_ADDRESS], loadedFixture);
      const txReceipt = await userOpCast(
        CONSTANTS.WETH_CONNECTOR_ADDRESS,
        data,
        executor,
        loadedFixture
      )
      const msg = await getFirstUserOpErrMsg(txReceipt, loadedFixture.entrypoint) 
      expect(msg).undefined
    });
    it("unapproved executor should be rejected", async () => {
      const loadedFixture = await loadFixture(fixture);
      const wETHConnector = await getVerifiedContractAt(CONSTANTS.WETH_CONNECTOR_ADDRESS);
      const data = (
        await wETHConnector.populateTransaction.deposit(CONSTANTS.ONE_FOR_ETH, 0, 0)
      ).data;
      const executor = await makeAnExecutor([CONSTANTS.WETH_CONNECTOR_ADDRESS], loadedFixture);
      await unApproveExecutor(loadedFixture, executor.address)
      expect(userOpCast(
        CONSTANTS.WETH_CONNECTOR_ADDRESS,
        data,
        executor,
        loadedFixture
      )).to.revertedWithCustomError(loadedFixture.entrypoint, "SignatureValidationFailed");;
    });

  });

  describe("Compound connector", () => {
    const depositAndPrepare = async () => {
      const loadedFixture = await loadFixture(fixture);
      const { smartWallet, entrypoint } =
        loadedFixture;
      const compConnector = await getVerifiedContractAt(
        CONSTANTS.COMPOUND_CONNECTOR_ADDRESS
      );
      const cERC20_ADDRESS = "0x39AA39c021dfbaE8faC545936693aC917d5E7563";
      const cERC20 = await getVerifiedContractAt(cERC20_ADDRESS);
      const executor = await makeAnExecutor(
        [CONSTANTS.COMPOUND_CONNECTOR_ADDRESS],
        loadedFixture
      );
      await faucetToken(CONSTANTS.USDC_ADDRESS, smartWallet.address, "1");
      const data = await depositData("USDC-A", CONSTANTS.ONE_FOR_USDC, 0, 0);
      const balance1: BigNumber = await cERC20.balanceOf(smartWallet.address);
      const txReceipt = await userOpCast(
        CONSTANTS.COMPOUND_CONNECTOR_ADDRESS,
        data,
        executor,
        loadedFixture
      );
      const msg = await getFirstUserOpErrMsg(txReceipt, entrypoint);
      expect(msg).undefined;
      const balance2: BigNumber = await cERC20.balanceOf(smartWallet.address);
      return {
        loadedFixture,
        balance1,
        balance2,
        compConnector,
        cERC20,
        executor,
      };
    };
    it("deposit", async () => {
      const { balance1, balance2 } = await depositAndPrepare();
      expect(balance2.sub(balance1).gt(0)).true;
    });
    it("withdraw", async () => {
      const {
        balance2,
        loadedFixture,
        cERC20,
        executor,
      } = await depositAndPrepare();
      const { smartWallet, entrypoint } = loadedFixture;
      const data = await withdrawData("USDC-A", CONSTANTS.ONE_FOR_USDC, 0, 0);
      const txReceipt = await userOpCast(
        CONSTANTS.COMPOUND_CONNECTOR_ADDRESS,
        data,
        executor,
        loadedFixture
      );
      const msg = await getFirstUserOpErrMsg(txReceipt, entrypoint);
      expect(msg).undefined;
      const balance3: BigNumber = await cERC20.balanceOf(smartWallet.address);
      expect(balance2.sub(balance3)).gt(0);
    });
    it("borrow", async () => {
      const {
        compConnector,
        loadedFixture,
        executor,
      } = await depositAndPrepare();
      const { smartWallet, entrypoint } = loadedFixture;
      const USDT = new Contract(
        CONSTANTS.USDT_ADDRESS,
        ERC20__factory.abi,
        smartWallet.provider
      );
      const balance1: BigNumber = await USDT.balanceOf(smartWallet.address);
      const data = (
        await compConnector.populateTransaction.borrow(
          "USDT-A",
          CONSTANTS.ONE_FOR_USDC.div(2),
          0,
          0
        )
      ).data;
      const txReceipt = await userOpCast(
        CONSTANTS.COMPOUND_CONNECTOR_ADDRESS,
        data,
        executor,
        loadedFixture
      );
      const msg = await getFirstUserOpErrMsg(txReceipt, entrypoint);
      expect(msg).undefined;
      const balance2: BigNumber = await USDT.balanceOf(smartWallet.address);
      expect(balance2.sub(balance1)).eq(CONSTANTS.ONE_FOR_USDC.div(2));
    });
    it("repay", async () => {
      const {
        loadedFixture,
        executor,
      } = await depositAndPrepare();
      const { smartWallet } = loadedFixture;
      const USDT = new Contract(
        CONSTANTS.USDT_ADDRESS,
        ERC20__factory.abi,
        smartWallet.provider
      );
      const balance1: BigNumber = await USDT.balanceOf(smartWallet.address);
      await borrow(loadedFixture, executor, "USDT-A", CONSTANTS.ONE_FOR_USDC.div(2), 0, 0);
      const balance2: BigNumber = await USDT.balanceOf(smartWallet.address);
      expect(balance2.sub(balance1)).eq(CONSTANTS.ONE_FOR_USDC.div(2));

      // repay
      await repay(loadedFixture, executor, "USDT-A", CONSTANTS.ONE_FOR_USDC.div(2), 0, 0);
      const balance3: BigNumber = await USDT.balanceOf(smartWallet.address);
      expect(balance3).eq(0);
    });
  });

  it("WETH Connector", async () => {
    const loadedFixture = await loadFixture(fixture);
    const { smartWallet, entrypoint } =
      loadedFixture;
    const wETH = await getVerifiedContractAt(CONSTANTS.WETH_ADDRESS);
    const executor = await makeAnExecutor(
      [CONSTANTS.WETH_CONNECTOR_ADDRESS],
      loadedFixture
    );

    const balance1: BigNumber = await wETH.balanceOf(smartWallet.address);
    const wETHConnector = await getVerifiedContractAt(CONSTANTS.WETH_CONNECTOR_ADDRESS);
    const data2 = (
      await wETHConnector.populateTransaction.deposit(CONSTANTS.ONE_FOR_ETH, 0, 0)
    ).data;
    const txReceipt = await userOpCast(
      CONSTANTS.WETH_CONNECTOR_ADDRESS,
      data2,
      executor,
      loadedFixture
    );
    const msg2 = await getFirstUserOpErrMsg(txReceipt, entrypoint);
    expect(msg2).undefined;
    const balance2: BigNumber = await wETH.balanceOf(smartWallet.address);
    expect(balance2.sub(balance1)).eq(CONSTANTS.ONE_FOR_ETH);
  });

  it("UniswapV2 Connector", async () => {
    const loadedFixture = await loadFixture(fixture);
    const { smartWallet, entrypoint } = loadedFixture;
    const UNI = new Contract(CONSTANTS.UNI_ADDRESS, ERC20__factory.abi, ethers.provider);
    const balance1: BigNumber = await UNI.balanceOf(smartWallet.address);
    const executor = await makeAnExecutor(
      [CONSTANTS.UniswapV2_CONNECTOR_ADDRESS],
      loadedFixture
    );
    await faucetToken(CONSTANTS.USDC_ADDRESS, smartWallet.address, "1");

    const data = await uniswapSellData(
      CONSTANTS.UNI_ADDRESS,
      CONSTANTS.USDC_ADDRESS,
      CONSTANTS.ONE_FOR_USDC,
      0,
      0
    );
    const txReceipt = await userOpCast(
      CONSTANTS.UniswapV2_CONNECTOR_ADDRESS,
      data,
      executor,
      loadedFixture
    );
    const msg2 = await getFirstUserOpErrMsg(txReceipt, entrypoint);
    expect(msg2).undefined;
    const balance2: BigNumber = await UNI.balanceOf(smartWallet.address);
    expect(balance2.sub(balance1).gt(0)).true;
  });

  describe("cast", () => {
    it("composed cast", async () => {
      const loadedFixture = await loadFixture(fixture);
      const { smartWallet, smartWalletOwner, entrypoint, create2, sendUserOp } =
        loadedFixture;
      const oneForUNI = utils.parseUnits("1", 18);
      const UniswapV2Connector = await getVerifiedContractAt(
        CONSTANTS.UniswapV2_CONNECTOR_ADDRESS
      );
      const swapData = (
        await UniswapV2Connector.populateTransaction.sell(
          CONSTANTS.WETH_ADDRESS,
          CONSTANTS.UNI_ADDRESS,
          oneForUNI,
          0,
          0,
          1
        )
      ).data;
      const swapData2 = (
        await UniswapV2Connector.populateTransaction.sell(
          CONSTANTS.WBT_ADDRESS,
          CONSTANTS.WETH_ADDRESS,
          0,
          0,
          1,
          0
        )
      ).data;
      await faucetToken(CONSTANTS.UNI_ADDRESS, smartWallet.address, "1");
      // await faucetToken(UNI_ADDRESS, smartWallet.address, '1')
      const executor = await makeAnExecutor(
        [CONSTANTS.UniswapV2_CONNECTOR_ADDRESS],
        loadedFixture
      );
      const WBTC = new Contract(
        CONSTANTS.WBT_ADDRESS,
        ERC20__factory.abi,
        smartWallet.provider
      );
      const balance1: BigNumber = await WBTC.balanceOf(smartWallet.address);
      await userOpCast(
        [CONSTANTS.UniswapV2_CONNECTOR_ADDRESS, CONSTANTS.UniswapV2_CONNECTOR_ADDRESS],
        [swapData, swapData2],
        executor,
        loadedFixture
      );
      const balance2: BigNumber = await WBTC.balanceOf(smartWallet.address);
      expect(balance2.sub(balance1)).gt(0);
    });
  });

  describe("intergaration", () => {
    const prepare = async (loadedFixture: Fixture, executor: Wallet) => {
      await faucetToken(CONSTANTS.USDC_ADDRESS, loadedFixture.smartWallet.address, "1");
      await deposit(loadedFixture, executor, "USDC-A", CONSTANTS.ONE_FOR_USDC, 0, 0);
      await borrow(loadedFixture, executor, "USDT-A", CONSTANTS.ONE_FOR_USDC.div(2), 0, 0);
    };
    it("sell Collateral token for borrow token and repay", async () => {
      const loadedFixture = await loadFixture(fixture);
      const { smartWallet } = loadedFixture;
      const getState = async () => {
        const USDT = new Contract(
          CONSTANTS.USDT_ADDRESS,
          ERC20__factory.abi,
          smartWallet.provider
        );
        const snapshot = await cUSDT.getAccountSnapshot(smartWallet.address);
        const USDTBalance = await USDT.balanceOf(smartWallet.address);
        return {
          snapshot,
          debt: snapshot[2],
          USDTBalance: USDTBalance,
        };
      };
      const cUSDT = await getVerifiedContractAt(CONSTANTS.cUSDT_ADDRESS);
      const executor = await makeAnExecutor(
        [CONSTANTS.COMPOUND_CONNECTOR_ADDRESS, CONSTANTS.UniswapV2_CONNECTOR_ADDRESS],
        loadedFixture
      );
      await prepare(loadedFixture, executor);
      const state2 = await getState();
      const data1 = await withdrawData("USDC-A", CONSTANTS.ONE_FOR_USDC.div(100), 0, 1);
      const data2 = await uniswapSellData(
        CONSTANTS.USDT_ADDRESS,
        CONSTANTS.USDC_ADDRESS,
        BigNumber.from("0"),
        1,
        2
      );
      const data3 = await repayData("USDT-A", BigNumber.from("0"), 2, 0);
      const castAddresses = [
        CONSTANTS.COMPOUND_CONNECTOR_ADDRESS,
        CONSTANTS.UniswapV2_CONNECTOR_ADDRESS,
        CONSTANTS.COMPOUND_CONNECTOR_ADDRESS,
      ];
      const castDatas = [data1, data2, data3];
      await userOpCast(castAddresses, castDatas, executor, loadedFixture);
      const state3 = await getState();
      expect(state2.debt).gt(state3.debt);
    });
    it("automation execution with non executor", async () => {
      const loadedFixture = await loadFixture(fixture);
      const { smartWallet, entrypoint } = loadedFixture;
      const nonExecutor = ethers.Wallet.createRandom().connect(
        smartWallet.provider
      );
      await faucetToken(0, nonExecutor.address, "1");
      await faucetToken(CONSTANTS.USDC_ADDRESS, smartWallet.address, "1");

      const data1 = await depositData("USDC-A", CONSTANTS.ONE_FOR_USDC, 0, 1);
      const castAddresses = [CONSTANTS.COMPOUND_CONNECTOR_ADDRESS];
      const castDatas = [data1];
      expect(
        userOpCast(castAddresses, castDatas, nonExecutor, loadedFixture)
      ).to.revertedWithCustomError(entrypoint, "SignatureValidationFailed");
    });
  });

});
