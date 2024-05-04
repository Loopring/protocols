import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { Constants } from "loopringV3.js";
import { AccountUpdateUtils, ExchangeTestUtil } from "./testExchangeUtil";
import { AuthMethod } from "./types";
import * as sigUtil from "eth-sig-util";
import { SignatureType, sign } from "../util/Signature";
import { KeyPair } from "loopringV3.js";

const AgentRegistry = artifacts.require("AgentRegistry");
const TestLoopringWalletV2 = artifacts.require("TestLoopringWalletV2");
const WalletFactory = artifacts.require("WalletFactory");
const LoopringWalletAgent = artifacts.require("LoopringWalletAgent");
const DestroyableWalletAgent = artifacts.require("DestroyableWalletAgent");

interface WalletSignatureData {
  signature: string;
  maxFee: BN;
  validUntil: number;

  walletOwner: string;
  salt: BN;
}

export namespace WalletUtils {
  export function toTypedData(walletConfig: any, verifyingContract: string) {
    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" }
        ],
        createWallet: [
          { name: "owner", type: "address" },
          { name: "guardians", type: "address[]" },
          { name: "quota", type: "uint256" },
          { name: "inheritor", type: "address" },
          { name: "feeRecipient", type: "address" },
          { name: "feeToken", type: "address" },
          { name: "feeAmount", type: "uint256" },
          { name: "salt", type: "uint256" }
        ]
      },
      primaryType: "createWallet",
      domain: {
        name: "WalletFactory",
        version: "2.0.0",
        chainId: new BN(/*await web3.eth.net.getId()*/ 1),
        verifyingContract
      },
      message: {
        owner: walletConfig.owner,
        guardians: walletConfig.guardians,
        quota: walletConfig.quota,
        inheritor: walletConfig.inheritor,
        feeRecipient: walletConfig.feeRecipient,
        feeToken: walletConfig.feeToken,
        feeAmount: walletConfig.feeAmount,
        salt: walletConfig.salt
      }
    };
    return typedData;
  }

  export function getHash(walletConfig: any, verifyingContract: string) {
    const typedData = this.toTypedData(walletConfig, verifyingContract);
    return sigUtil.TypedDataUtils.sign(typedData);
  }
}

contract("SmartWallet", (accounts: string[]) => {
  let ctx: ExchangeTestUtil;

  let agentRegistry: any;
  let registryOwner: string;
  let walletImplementation: any;
  let walletFactory: any;
  let loopringWalletAgent: any;
  let destroyableWalletAgent: any;

  let ownerA: string;
  let ownerB: string;

  let MAX_TIME_VALID_AFTER_CREATION: BN;

  const setupSmartWallet = async () => {
    walletImplementation = await TestLoopringWalletV2.new();
    walletFactory = await WalletFactory.new(walletImplementation.address);

    loopringWalletAgent = await LoopringWalletAgent.new(
      walletImplementation.address,
      walletFactory.address,
      ctx.exchange.address
    );

    MAX_TIME_VALID_AFTER_CREATION = await loopringWalletAgent.MAX_TIME_VALID_AFTER_CREATION();

    await agentRegistry.registerUniversalAgent(
      loopringWalletAgent.address,
      true,
      {
        from: registryOwner
      }
    );
  };

  const deploySmartWallet = async (
    walletOwner: string,
    salt: BN,
    expectedWalletAddress: string
  ) => {
    const walletConfig: any = {
      owner: walletOwner,
      guardians: [],
      quota: 0,
      inheritor: Constants.zeroAddress,
      feeRecipient: Constants.zeroAddress,
      feeToken: Constants.zeroAddress,
      feeAmount: 0,
      salt,
      signature: "0x"
    };
    const createWalletHash = WalletUtils.getHash(
      walletConfig,
      walletFactory.address
    );
    walletConfig.signature = await sign(
      walletOwner,
      createWalletHash,
      SignatureType.EIP_712
    );
    await walletFactory.createWallet(walletConfig, salt);
    const event = await ctx.assertEventEmitted(walletFactory, "WalletCreated");
    assert.equal(
      event.wallet,
      expectedWalletAddress,
      "wallet address doesn't match"
    );
    assert.equal(event.owner, walletOwner, "wallet owner doesn't match");
  };

  const requestAccountUpdateWithAgent = async (
    agent: any,
    walletAddress: string,
    keyPair: KeyPair,
    token: string,
    fee: BN,
    walletOwner: string,
    salt: BN,
    signer: string = walletOwner,
    withCallback: boolean = true
  ) => {
    const blockCallback = withCallback
      ? ctx.addBlockCallback(agent.address, true)
      : undefined;

    const accountUpdate = await ctx.requestAccountUpdate(
      walletAddress,
      token,
      fee,
      keyPair,
      {
        authMethod: AuthMethod.ECDSA,
        signer
      }
    );
    const signature = accountUpdate.onchainSignature;
    accountUpdate.onchainSignature = undefined;

    const data: WalletSignatureData = {
      signature,
      maxFee: accountUpdate.maxFee,
      validUntil: accountUpdate.validUntil,
      walletOwner,
      salt
    };
    const auxiliaryData = encodeAuxData(data);

    if (withCallback) {
      // Set the pool transaction data on the callback
      blockCallback.auxiliaryData = auxiliaryData;
      blockCallback.numTxs = 1;
      blockCallback.tx = accountUpdate;
      blockCallback.tx.txIdx = blockCallback.txIdx;
      blockCallback.tx.numTxs = blockCallback.numTxs;
    }

    const txHash = AccountUpdateUtils.getHash(
      accountUpdate,
      ctx.exchange.address
    );

    return { accountUpdate, auxiliaryData, txHash, data };
  };

  const encodeAuxData = (data: WalletSignatureData) => {
    return web3.eth.abi.encodeParameter(
      "tuple(bytes,uint96,uint32,address,uint256)",
      [
        data.signature,
        data.maxFee.toString(10),
        data.validUntil,
        data.walletOwner,
        data.salt.toString(10)
      ]
    );
  };

  before(async () => {
    ctx = new ExchangeTestUtil();
    await ctx.initialize(accounts);

    ownerA = ctx.testContext.orderOwners[10];
    ownerB = ctx.testContext.orderOwners[11];
  });

  after(async () => {
    await ctx.stop();
  });

  beforeEach(async () => {
    // Fresh Exchange for each test
    await ctx.createExchange(ctx.testContext.stateOwners[0], {
      setupTestState: true,
      deterministic: true
    });

    // Create the agent registry
    registryOwner = accounts[7];
    agentRegistry = await AgentRegistry.new({ from: registryOwner });

    // Register it on the exchange contract
    const wrapper = await ctx.contracts.ExchangeV3.at(ctx.operator.address);
    await wrapper.setAgentRegistry(agentRegistry.address, {
      from: ctx.exchangeOwner
    });

    destroyableWalletAgent = await DestroyableWalletAgent.new(
      ctx.exchange.address
    );

    await agentRegistry.registerUniversalAgent(
      destroyableWalletAgent.address,
      true,
      {
        from: registryOwner
      }
    );
  });

  describe("SmartWallet", function() {
    this.timeout(0);

    [true, false].forEach(function(valid) {
      it(
        "Authorize L2 transaction in block callback (" + valid + ")",
        async () => {
          await setupSmartWallet();

          const token = "WETH";
          const balance = new BN(web3.utils.toWei("100.0", "ether"));
          const fee = new BN(web3.utils.toWei("0.01", "ether"));

          // Fund some accounts
          await ctx.deposit(ownerA, ownerA, token, balance);

          const walletOwner = ownerB;
          const salt = new BN("123456789");

          const walletAddress = await walletFactory.computeWalletAddress(
            walletOwner,
            salt
          );

          // Do a transfer the smart wallet
          await ctx.transfer(
            ownerA,
            walletAddress,
            token,
            new BN(web3.utils.toWei("1.0", "ether")),
            token,
            new BN(0),
            { transferToNew: true }
          );

          const requestData = await requestAccountUpdateWithAgent(
            loopringWalletAgent,
            walletAddress,
            ctx.getKeyPairEDDSA(),
            token,
            fee,
            walletOwner,
            salt,
            valid ? walletOwner : ownerA
          );

          const validUntilBefore = await loopringWalletAgent.getSignatureExpiry(
            walletAddress,
            requestData.txHash,
            requestData.auxiliaryData
          );
          assert(
            validUntilBefore.eq(
              valid ? new BN(2).pow(new BN(256)).sub(new BN(1)) : new BN(0)
            ),
            "unexpected valid until"
          );

          // Do a transfer on L2
          await ctx.transfer(walletOwner, ownerA, token, fee, token, fee);

          // Withdraw to L1 (while still undeployed)
          await ctx.requestWithdrawal(
            walletAddress,
            token,
            new BN(web3.utils.toWei("0.1", "ether")),
            token,
            fee
          );

          await ctx.submitTransactions(16);
          if (valid) {
            await ctx.submitPendingBlocks();
          } else {
            await expectThrow(ctx.submitPendingBlocks(), "INVALID_SIGNATURE");
          }

          await deploySmartWallet(walletOwner, salt, walletAddress);
          const wallet = await TestLoopringWalletV2.at(walletAddress);

          const creationTimestamp = await wallet.getCreationTimestamp();
          const validUntil = creationTimestamp.add(
            MAX_TIME_VALID_AFTER_CREATION
          );

          const ownerValidUntil = await loopringWalletAgent.getInitialOwnerExpiry(
            walletAddress
          );
          assert(
            ownerValidUntil.eq(validUntil),
            "unexpected valid until owner"
          );

          const expectedValidUntil = valid ? validUntil : new BN(0);
          const validUntilAfter = await loopringWalletAgent.getSignatureExpiry(
            walletAddress,
            requestData.txHash,
            requestData.auxiliaryData
          );
          assert(
            validUntilAfter.eq(expectedValidUntil),
            "unexpected valid until signature"
          );

          // Wait
          await ctx.advanceBlockTimestamp(
            MAX_TIME_VALID_AFTER_CREATION.toNumber() - 100
          );

          // Should still be usable
          assert.equal(
            await loopringWalletAgent.isUsableSignatureForWallet(
              walletAddress,
              requestData.txHash,
              requestData.auxiliaryData
            ),
            valid
          );

          // Wait a bit longer
          await ctx.advanceBlockTimestamp(200);

          // Shouldn't be usable anymore
          assert.equal(
            await loopringWalletAgent.isUsableSignatureForWallet(
              walletAddress,
              requestData.txHash,
              requestData.auxiliaryData
            ),
            false
          );

          // Signature validity should still remain the same though
          assert.equal(
            await loopringWalletAgent.isValidSignatureForWallet(
              walletAddress,
              requestData.txHash,
              requestData.auxiliaryData
            ),
            valid
          );
        }
      );
    });

    [AuthMethod.APPROVE, AuthMethod.ECDSA].forEach(function(authMethod) {
      it(
        "Authorize L2 transaction using approved transaction (" +
          authMethod +
          ")",
        async () => {
          await setupSmartWallet();

          const token = "WETH";
          const balance = new BN(web3.utils.toWei("100.0", "ether"));
          const fee = new BN(web3.utils.toWei("0.01", "ether"));

          // Fund some accounts
          await ctx.deposit(ownerA, ownerA, token, balance);

          const walletOwner = ownerB;
          const salt = new BN("123456789");

          const walletAddress = await walletFactory.computeWalletAddress(
            walletOwner,
            salt
          );

          // Do a transfer the smart wallet
          await ctx.transfer(
            ownerA,
            walletAddress,
            token,
            new BN(web3.utils.toWei("1.0", "ether")),
            token,
            new BN(0),
            { transferToNew: true }
          );

          const requestData = await requestAccountUpdateWithAgent(
            loopringWalletAgent,
            walletAddress,
            ctx.getKeyPairEDDSA(),
            token,
            fee,
            walletOwner,
            salt,
            walletOwner,
            false
          );

          requestData.data.signature =
            authMethod === AuthMethod.ECDSA
              ? requestData.data.signature
              : "0x" + "01".repeat(66);
          requestData.auxiliaryData = encodeAuxData(requestData.data);

          if (authMethod === AuthMethod.ECDSA) {
            // Try to approve the transaction with an invalid signature
            const invalidData = requestData.data;
            invalidData.signature =
              invalidData.signature.slice(0, -10) + "0101010101";
            const invalidAuxData = encodeAuxData(invalidData);
            await expectThrow(
              loopringWalletAgent.approveTransactionsFor(
                [walletAddress],
                [requestData.txHash],
                [invalidAuxData],
                { from: ownerA }
              ),
              "INVALID_SIGNATURE"
            );
          } else {
            // Try to approve the transaction from a different address
            await expectThrow(
              loopringWalletAgent.approveTransactionsFor(
                [walletAddress],
                [requestData.txHash],
                [requestData.auxiliaryData],
                { from: ownerA }
              ),
              "INVALID_SIGNATURE"
            );
          }

          // Approve the transaction
          await loopringWalletAgent.approveTransactionsFor(
            [walletAddress],
            [requestData.txHash],
            [requestData.auxiliaryData],
            { from: authMethod === AuthMethod.ECDSA ? ownerA : ownerB }
          );

          // Do a transfer on L2
          await ctx.transfer(walletOwner, ownerA, token, fee, token, fee);

          // Withdraw to L1 (while still undeployed)
          await ctx.requestWithdrawal(
            walletAddress,
            token,
            new BN(web3.utils.toWei("0.1", "ether")),
            token,
            fee
          );

          await ctx.submitTransactions();
          await ctx.submitPendingBlocks();

          // Deploy the smart wallet
          await deploySmartWallet(walletOwner, salt, walletAddress);
          const wallet = await TestLoopringWalletV2.at(walletAddress);

          // Wait
          await ctx.advanceBlockTimestamp(
            MAX_TIME_VALID_AFTER_CREATION.toNumber() + 100
          );

          // Try to approve again when the initial owner cannot be used anymore
          await expectThrow(
            loopringWalletAgent.approveTransactionsFor(
              [walletAddress],
              [requestData.txHash],
              [requestData.auxiliaryData],
              { from: authMethod === AuthMethod.ECDSA ? ownerA : ownerB }
            ),
            "INVALID_SIGNATURE"
          );
        }
      );
    });
  });

  describe("DestructableSmartWallet", function() {
    this.timeout(0);

    it("Authorize L2 transaction in block callback", async () => {
      const token = "WETH";
      const balance = new BN(web3.utils.toWei("100.0", "ether"));
      const fee = new BN(web3.utils.toWei("0", "ether"));

      // Fund some accounts
      await ctx.deposit(ownerA, ownerA, token, balance);

      const walletOwner = ownerB;
      const salt = new BN("123456789");

      const walletAddress = await destroyableWalletAgent.computeWalletAddress(
        walletOwner,
        salt
      );

      // Setup the account
      const requestDataA = await requestAccountUpdateWithAgent(
        destroyableWalletAgent,
        walletAddress,
        ctx.getKeyPairEDDSA(),
        token,
        fee,
        walletOwner,
        salt
      );

      // Update the keys
      const requestDataB = await requestAccountUpdateWithAgent(
        destroyableWalletAgent,
        walletAddress,
        ctx.getKeyPairEDDSA(),
        token,
        fee,
        walletOwner,
        salt
      );

      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();

      assert.equal(
        await destroyableWalletAgent.isDestroyed(walletAddress),
        false
      );

      // Disable the account
      const requestDataC = await requestAccountUpdateWithAgent(
        destroyableWalletAgent,
        walletAddress,
        ctx.getZeroKeyPairEDDSA(),
        token,
        fee,
        walletOwner,
        salt
      );

      const usableBefore = await destroyableWalletAgent.isUsableSignatureForWallet(
        walletAddress,
        requestDataA.txHash,
        requestDataA.auxiliaryData
      );
      assert.equal(usableBefore, true);

      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();

      assert.equal(
        await destroyableWalletAgent.isDestroyed(walletAddress),
        true
      );
      const usableAfter = await destroyableWalletAgent.isUsableSignatureForWallet(
        walletAddress,
        requestDataA.txHash,
        requestDataA.auxiliaryData
      );
      assert.equal(usableAfter, false);
    });
  });
});
