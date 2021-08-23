import BN = require("bn.js");
import { Constants, Signature } from "loopringV3.js";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { AuthMethod, TransactionReceiverCallback } from "./types";
import * as sigUtil from "eth-sig-util";
import { SignatureType, sign, verifySignature } from "../util/Signature";
import { roundToFloatValue } from "loopringV3.js";
import { logDebug } from "./logs";

export enum PoolTransactionType {
  NOOP,
  JOIN,
  EXIT,
  SET_VIRTUAL_BALANCES,
  DEPOSIT,
  WITHDRAW
}

export interface PoolJoin {
  txType?: "Join";
  poolAddress: string;
  owner: string;
  joinAmounts: BN[];
  joinStorageIDs: number[];
  mintMinAmount: BN;
  fee: BN;
  validUntil: number;

  signature?: string;
  actualMintAmount?: BN;
  actualAmounts?: BN[];
  txIdx?: number;
  numTxs?: number;
}

export interface PoolExit {
  txType?: "Exit";
  poolAddress: string;
  owner: string;
  burnAmount: BN;
  burnStorageID: number;
  exitMinAmounts: BN[];
  fee: BN;
  validUntil: number;

  signature?: string;
  authMethod: AuthMethod;
  actualAmounts?: BN[];
  txIdx?: number;
  numTxs?: number;
}

export interface PoolVirtualBalances {
  txType?: "SetVirtualBalances";
  poolAddress: string;
  vBalances: BN[];
  data: string;

  owner?: string;
  signature?: string;
  authMethod?: AuthMethod;
  actualAmounts?: BN[];
  txIdx?: number;
  numTxs?: number;
}

export interface PoolDeposit {
  txType?: "Deposit";
  poolAddress: string;
  amounts: BN[];

  owner?: string;
  signature?: string;
  authMethod?: AuthMethod;
  actualAmounts?: BN[];
  txIdx?: number;
  numTxs?: number;
}

export interface PoolWithdrawal {
  txType?: "Withdrawal";
  poolAddress: string;
  amounts: BN[];

  owner?: string;
  signature?: string;
  authMethod?: AuthMethod;
  actualAmounts?: BN[];
  txIdx?: number;
  numTxs?: number;
}

export interface PoolTransaction {
  txType: number;
  data: string;
  signature: string;
}

export interface AuxiliaryData {
  poolTransactions: PoolTransaction[];
}

export interface JoinOptions {
  authMethod?: AuthMethod;
  signer?: string;
  validUntil?: number;
  fee?: BN;
  invalidTxHash?: boolean;
}

export interface ExitOptions {
  authMethod?: AuthMethod;
  signer?: string;
  validUntil?: number;
  fee?: BN;
  forcedExitFee?: BN;
  skip?: boolean;
  invalidTxHash?: boolean;
}

export interface Permit {
  owner: string;
  spender: string;
  value: BN;
  nonce: BN;
  deadline: BN;
}

type TxType =
  | PoolJoin
  | PoolExit
  | PoolVirtualBalances
  | PoolDeposit
  | PoolWithdrawal;

export namespace PoolJoinUtils {
  export function toTypedData(join: PoolJoin, verifyingContract: string) {
    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" }
        ],
        PoolJoin: [
          { name: "owner", type: "address" },
          { name: "joinAmounts", type: "uint96[]" },
          { name: "joinStorageIDs", type: "uint32[]" },
          { name: "mintMinAmount", type: "uint96" },
          { name: "fee", type: "uint96" },
          { name: "validUntil", type: "uint32" }
        ]
      },
      primaryType: "PoolJoin",
      domain: {
        name: "AMM Pool",
        version: "1.0.0",
        chainId: new BN(/*await web3.eth.net.getId()*/ 1),
        verifyingContract
      },
      message: {
        owner: join.owner,
        joinAmounts: join.joinAmounts,
        joinStorageIDs: join.joinStorageIDs,
        mintMinAmount: join.mintMinAmount,
        fee: join.fee,
        validUntil: join.validUntil
      }
    };
    return typedData;
  }

  export function getHash(join: PoolJoin, verifyingContract: string) {
    const typedData = this.toTypedData(join, verifyingContract);
    return sigUtil.TypedDataUtils.sign(typedData);
  }
}

export namespace PoolExitUtils {
  export function toTypedData(exit: PoolExit, verifyingContract: string) {
    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" }
        ],
        PoolExit: [
          { name: "owner", type: "address" },
          { name: "burnAmount", type: "uint96" },
          { name: "burnStorageID", type: "uint32" },
          { name: "exitMinAmounts", type: "uint96[]" },
          { name: "fee", type: "uint96" },
          { name: "validUntil", type: "uint32" }
        ]
      },
      primaryType: "PoolExit",
      domain: {
        name: "AMM Pool",
        version: "1.0.0",
        chainId: new BN(/*await web3.eth.net.getId()*/ 1),
        verifyingContract
      },
      message: {
        owner: exit.owner,
        burnAmount: exit.burnAmount,
        burnStorageID: exit.burnStorageID,
        exitMinAmounts: exit.exitMinAmounts,
        fee: exit.fee,
        validUntil: exit.validUntil
      }
    };
    return typedData;
  }

  export function getHash(exit: PoolExit, verifyingContract: string) {
    const typedData = this.toTypedData(exit, verifyingContract);
    return sigUtil.TypedDataUtils.sign(typedData);
  }
}

export namespace PermitUtils {
  export function toTypedData(permit: Permit, verifyingContract: string) {
    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" }
        ],
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      },
      primaryType: "Permit",
      domain: {
        name: "AMM Pool",
        version: "1.0.0",
        chainId: new BN(/*await web3.eth.net.getId()*/ 1),
        verifyingContract
      },
      message: {
        owner: permit.owner,
        spender: permit.spender,
        value: permit.value,
        nonce: permit.nonce,
        deadline: permit.deadline
      }
    };
    return typedData;
  }

  export function getHash(permit: Permit, verifyingContract: string) {
    const typedData = this.toTypedData(permit, verifyingContract);
    return sigUtil.TypedDataUtils.sign(typedData);
  }
}

export class AmmPool {
  public ctx: ExchangeTestUtil;
  public contract: any;
  public accountID: number;
  public sharedConfig: any;

  public feeBips: number;
  public tokens: string[];
  public vTokenBalancesL2: BN[];
  public amplificationFactor: BN;

  public POOL_TOKEN_BASE: BN = new BN("10000000000");
  public POOL_TOKEN_MINTED_SUPPLY: BN = new BN("79228162514264337593543950335"); // uint96(-1)
  public AMPLIFICATION_FACTOR_BASE = new BN("1000000000000000000");

  public L2_SIGNATURE: string = "0x10";

  public totalSupply: BN;

  public tokenBalancesL2: BN[];

  constructor(ctx: ExchangeTestUtil) {
    this.ctx = ctx;
  }

  public async setupPool(
    sharedConfig: any,
    tokens: string[],
    vTokenBalancesL2: BN[],
    feeBips: number,
    amplificationFactor: BN,
    controllerAddress?: string,
    assetManagerAddress?: string
  ) {
    this.sharedConfig = sharedConfig;
    this.feeBips = feeBips;
    this.tokens = tokens;
    this.vTokenBalancesL2 = vTokenBalancesL2;
    this.amplificationFactor = amplificationFactor;

    this.totalSupply = new BN(0);

    controllerAddress = controllerAddress
      ? controllerAddress
      : Constants.zeroAddress;

    //console.log("controllerAddress: " + controllerAddress);

    const AmmPool = artifacts.require("LoopringAmmPool");
    this.contract = await AmmPool.new(
      controllerAddress,
      assetManagerAddress,
      false
    );

    // Create the AMM account
    const owner = this.contract.address;
    const deposit = await this.ctx.deposit(
      this.ctx.testContext.orderOwners[0],
      owner,
      "ETH",
      new BN(1),
      { autoSetKeys: false }
    );

    this.accountID = deposit.accountID;

    // Collect token addresses
    const tokenAddresses: string[] = [];
    for (const token of tokens) {
      tokenAddresses.push(this.ctx.getTokenAddress(token));
    }

    // Collect token addresses
    const strWeights: string[] = [];
    for (const vTokenBalanceL2 of vTokenBalancesL2) {
      strWeights.push(vTokenBalanceL2.toString(10));
    }

    // Register the pool token
    const wrapper = await this.ctx.contracts.ExchangeV3.at(
      this.ctx.operator.address
    );
    await wrapper.registerToken(owner, {
      from: this.ctx.exchangeOwner
    });
    await this.ctx.addTokenToMaps(owner);

    // Setup the pool
    const poolConfig = {
      sharedConfig: sharedConfig.address,
      exchange: this.ctx.exchange.address,
      poolName: "AMM Pool",
      accountID: this.accountID,
      tokens: tokenAddresses,
      weights: strWeights,
      feeBips,
      tokenSymbol: "LP-LRC"
    };
    await this.contract.setupPool(poolConfig);

    // Handle deposit of liquidity tokens done by setup
    await this.ctx.requestDeposit(owner, owner, this.POOL_TOKEN_MINTED_SUPPLY);
  }

  public async join(
    owner: string,
    mintMinAmount: BN,
    joinAmounts: BN[],
    options: JoinOptions = {}
  ) {
    // Fill in defaults
    const authMethod =
      options.authMethod !== undefined ? options.authMethod : AuthMethod.ECDSA;
    const signer = options.signer !== undefined ? options.signer : owner;
    const fee = options.fee !== undefined ? options.fee : new BN(0);
    const validUntil =
      options.validUntil !== undefined ? options.validUntil : 0xffffffff;
    const invalidTxHash =
      options.invalidTxHash !== undefined ? options.invalidTxHash : false;

    const join: PoolJoin = {
      txType: "Join",
      poolAddress: this.contract.address,
      owner,
      joinAmounts,
      joinStorageIDs: [],
      mintMinAmount,
      fee,
      validUntil
    };

    let txHash: Buffer;
    if (authMethod === AuthMethod.APPROVE) {
      await this.contract.joinPool(joinAmounts, mintMinAmount, fee, {
        from: owner
      });
      const event = await this.ctx.assertEventEmitted(
        this.contract,
        "PoolJoinRequested"
      );
      join.validUntil = Number(event.join.validUntil);
    } else if (authMethod === AuthMethod.ECDSA) {
      for (const token of this.tokens) {
        join.joinStorageIDs.push(this.ctx.reserveStorageID());
      }
      const hash = PoolJoinUtils.getHash(join, this.contract.address);
      join.signature = await sign(signer, hash, SignatureType.EIP_712);
      await verifySignature(signer, hash, join.signature);
    } else if (authMethod === AuthMethod.EDDSA) {
      for (const token of this.tokens) {
        join.joinStorageIDs.push(this.ctx.reserveStorageID());
      }
      txHash = PoolJoinUtils.getHash(join, this.contract.address);
      if (invalidTxHash) {
        txHash = Buffer.from(
          new BN(txHash.toString("hex"), 16).add(new BN(8)).toString(16),
          "hex"
        );
      }
      join.signature = this.L2_SIGNATURE;
    }

    await this.process(join, txHash);

    return join;
  }

  public async exit(
    owner: string,
    burnAmount: BN,
    exitMinAmounts: BN[],
    options: ExitOptions = {}
  ) {
    // Fill in defaults
    const authMethod =
      options.authMethod !== undefined ? options.authMethod : AuthMethod.ECDSA;
    const signer = options.signer !== undefined ? options.signer : owner;
    const validUntil =
      options.validUntil !== undefined ? options.validUntil : 0xffffffff;
    const fee = options.fee !== undefined ? options.fee : new BN(0);
    const forcedExitFee =
      options.forcedExitFee !== undefined
        ? options.forcedExitFee
        : await this.sharedConfig.forcedExitFee();
    const skip = options.skip !== undefined ? options.skip : false;
    const invalidTxHash =
      options.invalidTxHash !== undefined ? options.invalidTxHash : false;

    const exit: PoolExit = {
      txType: "Exit",
      poolAddress: this.contract.address,
      owner,
      burnAmount,
      burnStorageID: 0,
      exitMinAmounts,
      fee,
      validUntil,
      authMethod
    };

    let txHash: Buffer;
    if (authMethod === AuthMethod.FORCE) {
      await this.contract.forceExitPool(burnAmount, exitMinAmounts, {
        from: owner,
        value: forcedExitFee,
        gasPrice: 0
      });
      const event = await this.ctx.assertEventEmitted(
        this.contract,
        "PoolExitRequested"
      );

      exit.validUntil = Number(event.exit.validUntil);
    } else if (authMethod === AuthMethod.APPROVE) {
      await this.contract.exitPool(burnAmount, exitMinAmounts, {
        from: owner,
        gasPrice: 0
      });
      const event = await this.ctx.assertEventEmitted(
        this.contract,
        "PoolExitRequested"
      );
      exit.validUntil = Number(event.exit.validUntil);
    } else if (authMethod === AuthMethod.ECDSA) {
      exit.burnStorageID = this.ctx.reserveStorageID();
      const hash = PoolExitUtils.getHash(exit, this.contract.address);
      exit.signature = await sign(signer, hash, SignatureType.EIP_712);
      await verifySignature(signer, hash, exit.signature);
    } else if (authMethod === AuthMethod.EDDSA) {
      exit.burnStorageID = this.ctx.reserveStorageID();
      txHash = PoolExitUtils.getHash(exit, this.contract.address);
      if (invalidTxHash) {
        txHash = Buffer.from(
          new BN(txHash.toString("hex"), 16).add(new BN(8)).toString(16),
          "hex"
        );
      }
      exit.signature = this.L2_SIGNATURE;
    }

    if (!skip) {
      await this.process(exit, txHash);
    }

    return exit;
  }

  public async setVirtualBalances(vBalances: BN[], data: string = "0x") {
    const vb: PoolVirtualBalances = {
      txType: "SetVirtualBalances",
      poolAddress: this.contract.address,
      signature: "0x00",
      owner: Constants.zeroAddress,
      vBalances,
      data
    };

    await this.process(vb, undefined);

    return vb;
  }

  public async deposit(amounts: BN[]) {
    const deposit: PoolDeposit = {
      txType: "Deposit",
      poolAddress: this.contract.address,
      amounts: amounts,
      signature: "0x00",
      owner: Constants.zeroAddress
    };

    await this.process(deposit, undefined);

    return deposit;
  }

  public async withdraw(amounts: BN[]) {
    const withdrawal: PoolWithdrawal = {
      txType: "Withdrawal",
      poolAddress: this.contract.address,
      amounts: amounts,
      signature: "0x00",
      owner: Constants.zeroAddress
    };

    await this.process(withdrawal, undefined);

    return withdrawal;
  }

  public async getBalancesL2() {
    // Test framework not smart enough to immediately have the new balances after submitting a tx.
    // Have to create a block to get the current offchain balance.
    await this.ctx.submitTransactions();

    const owner = this.contract.address;
    const tokenBalancesL2: BN[] = [];
    for (let i = 0; i < this.tokens.length; i++) {
      tokenBalancesL2.push(
        await this.ctx.getOffchainBalance(owner, this.tokens[i])
      );
    }
    return tokenBalancesL2;
  }

  public async getVirtualBalancesL2() {
    // Test framework not smart enough to immediately have the new balances after submitting a tx.
    // Have to create a block to get the current offchain balance.
    await this.ctx.submitTransactions();

    const owner = this.contract.address;
    const vTokenBalancesL2: BN[] = [];
    for (let i = 0; i < this.tokens.length; i++) {
      vTokenBalancesL2.push(
        await this.ctx.getOffchainVirtualBalance(owner, this.tokens[i])
      );
    }
    return vTokenBalancesL2;
  }

  public async prePoolTransactions() {
    // Test framework not smart enough to immediately have the new balances after submitting a tx.
    // Have to create a block to get the current offchain balance.
    await this.ctx.submitTransactions();

    const owner = this.contract.address;
    this.tokenBalancesL2 = [];
    for (let i = 0; i < this.tokens.length; i++) {
      this.tokenBalancesL2.push(
        await this.ctx.getOffchainBalance(owner, this.tokens[i])
      );
      this.vTokenBalancesL2[i] = await this.ctx.getOffchainVirtualBalance(
        owner,
        this.tokens[i]
      );
    }
  }

  private async process(transaction: TxType, txHash: Buffer) {
    const owner = this.contract.address;

    const blockCallback = this.ctx.addBlockCallback(owner, true);

    let numTxs = 0;

    const doAmmUpdates =
      transaction.txType === "Join" ||
      transaction.txType === "Exit" ||
      transaction.txType === "SetVirtualBalances";

    if (doAmmUpdates) {
      for (let i = 0; i < this.tokens.length; i++) {
        await this.ctx.requestAmmUpdate(
          owner,
          this.tokens[i],
          this.feeBips,
          this.vTokenBalancesL2[i],
          { authMethod: AuthMethod.NONE }
        );
        numTxs++;
      }
    }

    if (transaction.signature === this.L2_SIGNATURE) {
      await this.ctx.requestSignatureVerification(
        transaction.owner,
        this.ctx.hashToFieldElement("0x" + txHash.toString("hex"))
      );
      numTxs++;
    }

    // Process the transaction
    if (transaction.txType === "Join") {
      const join = transaction;

      // Calculate expected amounts for specified liquidity tokens
      const poolTotal = this.totalSupply;

      let mintAmount = new BN(0);
      let amounts: BN[] = [];
      if (poolTotal.eq(new BN(0))) {
        mintAmount = this.POOL_TOKEN_BASE;
        amounts.push(...join.joinAmounts);

        // Set virtual balances
        for (let i = 0; i < this.tokens.length; i++) {
          this.vTokenBalancesL2[i] = join.joinAmounts[i]
            .mul(this.amplificationFactor)
            .div(this.AMPLIFICATION_FACTOR_BASE);
        }
      } else {
        // Calculate the amount of liquidity tokens that should be minted
        let initialValueSet = false;
        for (let i = 0; i < this.tokens.length; i++) {
          if (this.tokenBalancesL2[i].gt(new BN(0))) {
            const amountOut = join.joinAmounts[i]
              .mul(poolTotal)
              .div(this.tokenBalancesL2[i]);
            if (!initialValueSet || amountOut.lt(mintAmount)) {
              mintAmount = amountOut;
              initialValueSet = true;
            }
          }
        }
        if (mintAmount.isZero()) {
          logDebug("Nothing to mint!");
        }
        if (!mintAmount.gte(join.mintMinAmount)) {
          logDebug("Min pool amount out not achieved!");
        }

        // Calculate the amounts to deposit
        let ratio = mintAmount.mul(this.POOL_TOKEN_BASE).div(poolTotal);
        const newTotalSupply = poolTotal.add(mintAmount);
        for (let i = 0; i < this.tokens.length; i++) {
          amounts.push(
            this.tokenBalancesL2[i].mul(ratio).div(this.POOL_TOKEN_BASE)
          );

          // Update virtual balances
          this.vTokenBalancesL2[i] = this.vTokenBalancesL2[i]
            .mul(newTotalSupply)
            .div(this.totalSupply);
        }
      }

      // Deposit
      for (let i = 0; i < this.tokens.length; i++) {
        const amount = roundToFloatValue(amounts[i], Constants.Float24Encoding);
        const storageID =
          join.joinStorageIDs.length > 0 ? join.joinStorageIDs[i] : undefined;
        await this.ctx.transfer(
          join.owner,
          owner,
          this.tokens[i],
          amount,
          this.tokens[i],
          i === this.tokens.length - 1 ? join.fee : new BN(0),
          {
            authMethod: AuthMethod.NONE,
            amountToDeposit: new BN(0),
            feeToDeposit: new BN(0),
            storageID
          }
        );
        numTxs++;
        this.tokenBalancesL2[i].iadd(amount);
        logDebug("pool join: " + amount.toString(10));
      }

      // Mint
      await this.ctx.transfer(
        owner,
        join.owner,
        owner,
        mintAmount,
        "ETH",
        new BN(0),
        {
          authMethod: AuthMethod.NONE,
          amountToDeposit: new BN(0)
        }
      );
      numTxs++;
      mintAmount = roundToFloatValue(mintAmount, Constants.Float24Encoding);
      poolTotal.iadd(mintAmount);

      join.actualMintAmount = mintAmount;
      join.actualAmounts = amounts;
    } else if (transaction.txType === "Exit") {
      const exit = transaction;

      const poolTotal = this.totalSupply;
      const ratio = exit.burnAmount.mul(this.POOL_TOKEN_BASE).div(poolTotal);

      let valid = true;
      let amounts: BN[] = [];
      for (let i = 0; i < this.tokens.length; i++) {
        amounts[i] = this.tokenBalancesL2[i]
          .mul(ratio)
          .div(this.POOL_TOKEN_BASE);
        valid = valid && amounts[i].gte(exit.exitMinAmounts[i]);
      }
      if (!valid) {
        logDebug("Exit min amounts not reached!");
      }

      if (exit.authMethod !== AuthMethod.FORCE) {
        if (!valid) {
          logDebug("Invalid slippage!");
        }
      }

      if (valid) {
        // Update virtual balances
        assert(exit.burnAmount.lte(poolTotal), "burnAmount too big");
        const newTotalSupply = poolTotal.sub(exit.burnAmount);
        for (let i = 0; i < this.tokens.length; i++) {
          this.vTokenBalancesL2[i] = this.vTokenBalancesL2[i]
            .mul(newTotalSupply)
            .div(this.totalSupply);
        }
        if (exit.authMethod !== AuthMethod.FORCE) {
          const storageID =
            exit.authMethod === AuthMethod.ECDSA ||
            exit.authMethod === AuthMethod.EDDSA
              ? exit.burnStorageID
              : undefined;
          // Burn
          await this.ctx.transfer(
            exit.owner,
            owner,
            owner,
            exit.burnAmount,
            "ETH",
            new BN(0),
            {
              authMethod: AuthMethod.NONE,
              amountToDeposit: new BN(0),
              storageID
            }
          );
          numTxs++;
        }

        // Withdraw
        for (let i = 0; i < this.tokens.length; i++) {
          const amount = roundToFloatValue(
            amounts[i],
            Constants.Float24Encoding
          );
          await this.ctx.transfer(
            owner,
            exit.owner,
            this.tokens[i],
            i === this.tokens.length - 1 ? amount.sub(exit.fee) : amount,
            i === this.tokens.length - 1
              ? this.tokens[this.tokens.length - 1]
              : "ETH",
            i === this.tokens.length - 1 ? exit.fee : new BN(0),
            {
              authMethod: AuthMethod.NONE,
              amountToDeposit: new BN(0),
              feeToDeposit: new BN(0),
              transferToNew: true
            }
          );
          numTxs++;
          this.tokenBalancesL2[i].isub(amount);
          logDebug("pool exit: " + amount.toString(10));
        }

        exit.actualAmounts = amounts;
      }

      poolTotal.isub(
        roundToFloatValue(
          valid ? exit.burnAmount : new BN(0),
          Constants.Float24Encoding
        )
      );
    } else if (transaction.txType === "SetVirtualBalances") {
      const poolVirtualBalances = transaction;
      this.vTokenBalancesL2 = poolVirtualBalances.vBalances;
      for (const vBalance of poolVirtualBalances.vBalances) {
        logDebug("setVirtualBalance: " + vBalance.toString(10));
      }
    } else if (transaction.txType === "Deposit") {
      const deposit = transaction;
      // Set virtual balances
      for (let i = 0; i < this.tokens.length; i++) {
        if (!deposit.amounts[i].isZero()) {
          await this.ctx.requestDeposit(
            owner,
            this.tokens[i],
            deposit.amounts[i]
          );
          numTxs++;
        }
      }
    } else if (transaction.txType === "Withdrawal") {
      const withdrawal = transaction;
      // Set virtual balances
      for (let i = 0; i < this.tokens.length; i++) {
        if (!withdrawal.amounts[i].isZero()) {
          await this.ctx.requestWithdrawal(
            owner,
            this.tokens[i],
            withdrawal.amounts[i],
            Constants.zeroAddress,
            new BN(0),
            {
              authMethod: AuthMethod.NONE
            }
          );
          numTxs++;
        }
      }
    }

    if (doAmmUpdates) {
      for (let i = 0; i < this.tokens.length; i++) {
        await this.ctx.requestAmmUpdate(
          owner,
          this.tokens[i],
          this.feeBips,
          this.vTokenBalancesL2[i],
          { authMethod: AuthMethod.NONE }
        );
        numTxs++;
      }
    }

    // Set the pool transaction data on the callback
    blockCallback.auxiliaryData = AmmPool.getAuxiliaryData(transaction);
    blockCallback.numTxs = numTxs;
    blockCallback.tx = transaction;
    blockCallback.tx.txIdx = blockCallback.txIdx;
    blockCallback.tx.numTxs = blockCallback.numTxs;
  }

  public static getPoolJoinAuxData(join: PoolJoin) {
    const amounts: string[] = [];
    for (const amount of join.joinAmounts) {
      amounts.push(amount.toString(10));
    }
    return web3.eth.abi.encodeParameter(
      "tuple(address,uint96[],uint32[],uint96,uint96,uint32)",
      [
        join.owner,
        amounts,
        join.joinStorageIDs,
        join.mintMinAmount.toString(10),
        join.fee.toString(10),
        join.validUntil
      ]
    );
  }

  public static getPoolExitAuxData(exit: PoolExit) {
    const amounts: string[] = [];
    for (const amount of exit.exitMinAmounts) {
      amounts.push(amount.toString(10));
    }
    return web3.eth.abi.encodeParameter(
      "tuple(address,uint96,uint32,uint96[],uint96,uint32)",
      [
        exit.owner,
        exit.burnAmount.toString(10),
        exit.burnStorageID,
        amounts,
        exit.fee.toString(10),
        exit.validUntil
      ]
    );
  }

  public static getPoolSetVirtualBalancesAuxData(
    poolVirtualBalances: PoolVirtualBalances
  ) {
    const vBalances: string[] = [];
    for (const vBalance of poolVirtualBalances.vBalances) {
      vBalances.push(vBalance.toString(10));
    }
    return web3.eth.abi.encodeParameter("tuple(uint96[],bytes)", [
      vBalances,
      poolVirtualBalances.data
    ]);
  }

  public static getPoolDepositAuxData(deposit: PoolDeposit) {
    const amounts: string[] = [];
    for (const amount of deposit.amounts) {
      amounts.push(amount.toString(10));
    }
    return web3.eth.abi.encodeParameter("tuple(uint96[])", [amounts]);
  }

  public static getPoolWithdrawalAuxData(withdrawal: PoolWithdrawal) {
    const amounts: string[] = [];
    for (const amount of withdrawal.amounts) {
      amounts.push(amount.toString(10));
    }
    return web3.eth.abi.encodeParameter("tuple(uint96[])", [amounts]);
  }

  public static getAuxiliaryData(transaction: TxType) {
    let poolTx: PoolTransaction;
    // Hack: fix json deserializing when the owner address is serialized as a decimal string
    if (!transaction.owner.startsWith("0x")) {
      transaction.owner = "0x" + new BN(transaction.owner).toString(16, 40);
    }
    if (transaction.txType === "Join") {
      poolTx = {
        txType: PoolTransactionType.JOIN,
        data: this.getPoolJoinAuxData(transaction),
        signature: transaction.signature
      };
    } else if (transaction.txType === "Exit") {
      poolTx = {
        txType: PoolTransactionType.EXIT,
        data: this.getPoolExitAuxData(transaction),
        signature: transaction.signature
      };
    } else if (transaction.txType === "SetVirtualBalances") {
      poolTx = {
        txType: PoolTransactionType.SET_VIRTUAL_BALANCES,
        data: this.getPoolSetVirtualBalancesAuxData(transaction),
        signature: transaction.signature
      };
    } else if (transaction.txType === "Deposit") {
      poolTx = {
        txType: PoolTransactionType.DEPOSIT,
        data: this.getPoolDepositAuxData(transaction),
        signature: transaction.signature
      };
    } else if (transaction.txType === "Withdrawal") {
      poolTx = {
        txType: PoolTransactionType.WITHDRAW,
        data: this.getPoolWithdrawalAuxData(transaction),
        signature: transaction.signature
      };
    } else {
      assert(false);
    }
    //logDebug(poolTx);

    return web3.eth.abi.encodeParameter("tuple(uint256,bytes,bytes)", [
      poolTx.txType,
      poolTx.data,
      poolTx.signature ? poolTx.signature : "0x"
    ]);
  }

  public static getTransactionReceiverCallback(transaction: TxType) {
    const transactionReceiverCallback: TransactionReceiverCallback = {
      target: transaction.poolAddress,
      txIdx: transaction.txIdx,
      numTxs: transaction.numTxs,
      auxiliaryData: AmmPool.getAuxiliaryData(transaction),
      tx: transaction,
      beforeBlockSubmission: true
    };
    return transactionReceiverCallback;
  }

  public async verifySupply(expectedTotalSupply?: BN) {
    const onchainTotalSupply = await this.contract.totalSupply();
    if (expectedTotalSupply !== undefined) {
      assert(
        this.totalSupply.eq(expectedTotalSupply),
        "unexpected total supply"
      );
    }
    assert(this.totalSupply.eq(onchainTotalSupply), "unexpected total supply");
  }
}
