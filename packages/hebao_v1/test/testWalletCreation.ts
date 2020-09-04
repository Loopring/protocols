import {
  Context,
  getContext,
  createContext,
  executeTransaction,
  toAmount,
  getEnsApproval
} from "./helpers/TestUtils";
import { transferFrom } from "./helpers/TokenUtils";
import {
  assertEventEmitted,
  assertNoEventEmitted,
  assertEventsEmitted
} from "../util/Events";
import { expectThrow } from "../util/expectThrow";
import BN = require("bn.js");
import { Constants } from "./helpers/Constants";
import { sign } from "./helpers/Signature";
import { signCreateWallet } from "./helpers/SignatureUtils";
import ethUtil = require("ethereumjs-util");

contract("WalletFactory", () => {
  let defaultCtx: Context;
  let ctx: Context;

  let useMetaTx: boolean = false;
  const walletDomain = ".loopring.eth";

  let modules: string[];

  const createWalletChecked = async (
    owner: string,
    walletName: string = "",
    ensRegisterReverse: boolean = true
  ) => {
    const wallet = await ctx.walletFactory.computeWalletAddress(owner, 0);

    if (useMetaTx) {
      // Transfer 0.1 ETH to the wallet to pay for the wallet creation
      await transferFrom(ctx, owner, wallet, "ETH", toAmount("0.1"));
    }

    const signer = ctx.owners[0];

    const ensApproval = await getEnsApproval(wallet, owner, walletName, signer);

    const { txSignature } = signCreateWallet(
      ctx.walletFactory.address,
      owner,
      0,
      Constants.zeroAddress,
      walletName,
      ensRegisterReverse,
      modules
    );

    const opt = useMetaTx
      ? { owner, wallet, gasPrice: new BN(1) }
      : { from: owner };

    const tx = await executeTransaction(
      ctx.walletFactory.contract.methods.createWallet(
        owner,
        0,
        walletName,
        ensApproval,
        ensRegisterReverse,
        modules,
        txSignature
      ),
      ctx,
      useMetaTx,
      wallet,
      [],
      opt
    );

    await assertEventEmitted(
      ctx.walletFactory,
      "WalletCreated",
      (event: any) => {
        return event.wallet === wallet && event.owner === owner;
      }
    );

    if (walletName !== "") {
      await assertEventEmitted(
        ctx.baseENSManager,
        "Registered",
        (event: any) => {
          return (
            event._ens === walletName + walletDomain &&
            event._wallet === wallet &&
            event._owner === owner
          );
        }
      );
    } else {
      await assertNoEventEmitted(ctx.baseENSManager, "Registered");
    }

    const walletContract = await ctx.contracts.WalletImpl.at(wallet);
    assert.equal(await walletContract.owner(), owner, "wallet owner incorrect");

    if (!useMetaTx) {
      // Try to create the wallet again
      await expectThrow(
        executeTransaction(
          ctx.walletFactory.contract.methods.createWallet(
            owner,
            0,
            walletName,
            ensApproval,
            ensRegisterReverse,
            modules,
            txSignature
          ),
          ctx,
          useMetaTx,
          wallet,
          [],
          { owner, wallet, from: owner, gasPrice: new BN(1) }
        ),
        useMetaTx ? "UNAUTHORIZED" : "CREATE2_FAILED"
      );
    }
  };

  const createWalletWithTxAwareHashChecked = async (
    owner: string,
    walletName: string = "",
    ensRegisterReverse: boolean = true
  ) => {
    const wallet = await ctx.walletFactory.computeWalletAddress(owner, 0);

    await transferFrom(ctx, owner, wallet, "ETH", toAmount("0.1"));

    const signer = ctx.owners[0];

    const ensApproval = await getEnsApproval(wallet, owner, walletName, signer);

    const { txSignature, hash } = signCreateWallet(
      ctx.walletFactory.address,
      owner,
      0,
      Constants.zeroAddress,
      walletName,
      ensRegisterReverse,
      modules
    );

    const opt = { owner, wallet, gasPrice: new BN(1), txAwareHash: hash };

    const tx = await executeTransaction(
      ctx.walletFactory.contract.methods.createWallet(
        owner,
        0,
        walletName,
        ensApproval,
        ensRegisterReverse,
        modules,
        txSignature
      ),
      ctx,
      true,
      wallet,
      [],
      opt
    );

    await assertEventEmitted(
      ctx.walletFactory,
      "WalletCreated",
      (event: any) => {
        return event.wallet === wallet && event.owner === owner;
      }
    );

    if (walletName !== "") {
      await assertEventEmitted(
        ctx.baseENSManager,
        "Registered",
        (event: any) => {
          return (
            event._ens === walletName + walletDomain &&
            event._wallet === wallet &&
            event._owner === owner
          );
        }
      );
    } else {
      await assertNoEventEmitted(ctx.baseENSManager, "Registered");
    }

    const walletContract = await ctx.contracts.WalletImpl.at(wallet);
    assert.equal(await walletContract.owner(), owner, "wallet owner incorrect");
  };

  const createWallet2Checked = async (
    owner: string,
    walletName: string = "",
    ensRegisterReverse: boolean = true
  ) => {
    await ctx.walletFactory.createBlanks(modules, [0], {
      from: owner
    });
    const blankWalletAddr = (
      await assertEventEmitted(ctx.walletFactory, "BlankDeployed")
    ).blank;

    const wallet = blankWalletAddr;

    if (useMetaTx) {
      // Transfer 0.1 ETH to the blankWalletAddr to pay for the blankWalletAddr creation
      await transferFrom(ctx, owner, blankWalletAddr, "ETH", toAmount("0.1"));
    }

    const signer = ctx.owners[0];
    const ensApproval = await getEnsApproval(
      blankWalletAddr,
      owner,
      walletName,
      signer
    );
    const { txSignature } = signCreateWallet(
      ctx.walletFactory.address,
      owner,
      0,
      blankWalletAddr,
      walletName,
      ensRegisterReverse,
      modules
    );

    const opt = useMetaTx
      ? { owner, wallet: blankWalletAddr, gasPrice: new BN(1) }
      : { from: owner };

    const tx = await executeTransaction(
      ctx.walletFactory.contract.methods.createWallet2(
        owner,
        blankWalletAddr,
        walletName,
        ensApproval,
        ensRegisterReverse,
        modules,
        txSignature
      ),
      ctx,
      useMetaTx,
      blankWalletAddr,
      [],
      opt
    );

    await assertEventEmitted(
      ctx.walletFactory,
      "WalletCreated",
      (event: any) => {
        return (
          event.wallet === blankWalletAddr &&
          event.owner === owner &&
          event.blankUsed == true
        );
      }
    );

    if (walletName !== "") {
      await assertEventEmitted(
        ctx.baseENSManager,
        "Registered",
        (event: any) => {
          return (
            event._ens === walletName + walletDomain &&
            event._wallet === wallet &&
            event._owner === owner
          );
        }
      );
    } else {
      await assertNoEventEmitted(ctx.baseENSManager, "Registered");
    }

    const walletContract = await ctx.contracts.WalletImpl.at(blankWalletAddr);
    assert.equal(await walletContract.owner(), owner, "wallet owner incorrect");

    if (!useMetaTx) {
      // Try to create the wallet again
      await expectThrow(
        executeTransaction(
          ctx.walletFactory.contract.methods.createWallet2(
            owner,
            blankWalletAddr,
            walletName,
            ensApproval,
            ensRegisterReverse,
            modules,
            txSignature
          ),
          ctx,
          useMetaTx,
          blankWalletAddr,
          [],
          { owner, wallet: blankWalletAddr, from: owner, gasPrice: new BN(1) }
        ),
        "INVALID_ADOBE"
      );
    }
  };

  const registerENSChecked = async (owner: string, walletName: string = "") => {
    const wallet = await ctx.walletFactory.computeWalletAddress(owner, 0);

    const signer = ctx.owners[0];

    const ensApproval = await getEnsApproval(wallet, owner, walletName, signer);

    const opt = { owner, wallet, gasPrice: new BN(1) };

    const tx = await executeTransaction(
      ctx.walletFactory.contract.methods.registerENS(
        wallet,
        owner,
        walletName,
        ensApproval,
        true
      ),
      ctx,
      useMetaTx,
      wallet,
      [],
      opt
    );

    if (walletName !== "") {
      await assertEventEmitted(
        ctx.baseENSManager,
        "Registered",
        (event: any) => {
          return (
            event._ens === walletName + walletDomain &&
            event._wallet === wallet &&
            event._owner === owner
          );
        }
      );
    } else {
      await assertNoEventEmitted(ctx.baseENSManager, "Registered");
    }
  };

  const description = (descr: string, metaTx: boolean = useMetaTx) => {
    return descr + (metaTx ? " (meta tx)" : "");
  };

  before(async () => {
    defaultCtx = await getContext();
  });

  beforeEach(async () => {
    ctx = await createContext(defaultCtx);
    modules = [
      ctx.finalSecurityModule.address,
      ctx.finalTransferModule.address,
      ctx.finalCoreModule.address
    ];
  });

  [false, true].forEach(function(metaTx) {
    it(
      description("user should be able to create a wallet without ENS", metaTx),
      async () => {
        useMetaTx = metaTx;
        await createWalletChecked(ctx.owners[0]);
        await registerENSChecked(
          ctx.owners[0],
          "testwallet" + new Date().getTime()
        );
      }
    );

    it(
      description("user should be able to create a wallet with ENS", metaTx),
      async () => {
        useMetaTx = metaTx;
        await createWalletChecked(
          ctx.owners[0],
          "mywallet" + new Date().getTime()
        );
      }
    );

    it(
      description(
        "user should be able to create a wallet with ENS from Blank",
        metaTx
      ),
      async () => {
        useMetaTx = metaTx;
        await createWallet2Checked(
          ctx.owners[0],
          "mywallet" + new Date().getTime()
        );
      }
    );
  });

  it(
    description(
      "user should be able to create a wallet using txAwareHash",
      true
    ),
    async () => {
      useMetaTx = true;
      await createWalletWithTxAwareHashChecked(
        ctx.owners[2],
        "mywallet" + new Date().getTime()
      );
    }
  );

  it("anyone should be able to create a group of blank wallets", async () => {
    const walletImplementation = ctx.walletImpl.address;
    const sender = ctx.miscAddresses[0];

    const version =
      "0x" +
      ethUtil
        .keccak(web3.eth.abi.encodeParameters(["address[]"], [modules]))
        .toString("hex");

    await ctx.walletFactory.createBlanks(
      modules,
      [...Array(10).keys()], // [0, ..., 9]
      { from: sender }
    );

    await assertEventsEmitted(
      ctx.walletFactory,
      "BlankDeployed",
      10,
      (event: any) => {
        return event.version == version;
      }
    );
  });
});
