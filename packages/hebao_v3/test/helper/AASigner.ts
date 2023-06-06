import * as typ from "./solidityTypes";
import {
  Wallet,
  Signer,
  BigNumber,
  BigNumberish,
  Contract,
  constants,
} from "ethers";
import _ from "lodash";
import { ethers } from "hardhat";
import { zeroAddress } from "ethereumjs-util";
import {
  arrayify,
  defaultAbiCoder,
  hexDataSlice,
  keccak256,
  hexConcat,
  hexlify,
  getCreate2Address,
  Interface,
  hexZeroPad,
} from "ethers/lib/utils";
import { BytesLike, hexValue } from "@ethersproject/bytes";
import { TransactionResponse } from "@ethersproject/abstract-provider";
import { Deferrable, resolveProperties } from "@ethersproject/properties";
import {
  BaseProvider,
  Provider,
  TransactionRequest,
  TransactionReceipt,
} from "@ethersproject/providers";
import { ContractReceipt } from "@ethersproject/contracts";
import { getAccountInitCode, WalletConfig } from "./utils";
import {
  EntryPoint,
  SmartWallet,
  EntryPoint__factory,
  SmartWallet__factory,
  WalletFactory,
  WalletFactory__factory,
  WalletProxy__factory,
} from "../../typechain-types";

export const HashZero = ethers.constants.HashZero;

export interface UserOperation {
  sender: typ.address;
  nonce: typ.uint256;
  initCode: typ.bytes;
  callData: typ.bytes;
  callGasLimit: typ.uint256;
  verificationGasLimit: typ.uint256;
  preVerificationGas: typ.uint256;
  maxFeePerGas: typ.uint256;
  maxPriorityFeePerGas: typ.uint256;
  paymasterAndData: typ.bytes;
  signature: typ.bytes;
}

export function packUserOp(op: UserOperation, forSignature = true): string {
  // lighter signature scheme (must match UserOperation#pack): do encode a zero-length signature, but strip afterwards the appended zero-length value
  const userOpType = {
    components: [
      { type: "address", name: "sender" },
      { type: "uint256", name: "nonce" },
      { type: "bytes", name: "initCode" },
      { type: "bytes", name: "callData" },
      { type: "uint256", name: "callGasLimit" },
      { type: "uint256", name: "verificationGasLimit" },
      { type: "uint256", name: "preVerificationGas" },
      { type: "uint256", name: "maxFeePerGas" },
      { type: "uint256", name: "maxPriorityFeePerGas" },
      { type: "bytes", name: "paymasterAndData" },
      { type: "bytes", name: "signature" },
    ],
    name: "userOp",
    type: "tuple",
  };
  let encoded = defaultAbiCoder.encode(
    [userOpType as any],
    [{ ...op, signature: "0x" }]
  );
  if (forSignature) {
    // remove leading word (total length) and trailing word (zero-length signature)
    encoded = "0x" + encoded.slice(66, encoded.length - 64);
  } else {
    encoded = "0x" + encoded;
  }
  return encoded;
}

export function getUserOpHash(
  op: UserOperation,
  entryPoint: string,
  chainId: number
): string {
  const userOpHash = keccak256(packUserOp(op, true));
  const enc = defaultAbiCoder.encode(
    ["bytes32", "address", "uint256"],
    [userOpHash, entryPoint, chainId]
  );
  return keccak256(enc);
}

export const DefaultsForUserOp: UserOperation = {
  sender: constants.AddressZero,
  nonce: 0,
  initCode: "0x",
  callData: "0x",
  callGasLimit: 0,
  verificationGasLimit: 100000, // default verification gas. will add create2 cost (3200+200*length) if initCode exists
  preVerificationGas: 21000, // should also cover calldata cost.
  maxFeePerGas: 0,
  maxPriorityFeePerGas: 1e9,
  paymasterAndData: "0x",
  signature: "0x",
};

export function fillUserOpDefaults(
  op: Partial<UserOperation>,
  defaults = DefaultsForUserOp
): UserOperation {
  const partial: any = { ...op };
  // we want "item:undefined" to be used from defaults, and not override defaults, so we must explicitly
  // remove those so "merge" will succeed.
  for (const key in partial) {
    if (partial[key] == null) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete partial[key];
    }
  }
  const filled = { ...defaults, ...partial };
  return filled;
}

export function callDataCost(data: string): number {
  return ethers.utils
    .arrayify(data)
    .map((x) => (x === 0 ? 4 : 16))
    .reduce((sum, x) => sum + x);
}

// helper to fill structure:
// - default callGasLimit to estimate call from entryPoint to account (TODO: add overhead)
// if there is initCode:
//  - calculate sender by eth_call the deployment code
//  - default verificationGasLimit estimateGas of deployment code plus default 100000
// no initCode:
//  - update nonce from account.nonce()
// entryPoint param is only required to fill in "sender address when specifying "initCode"
// nonce: assume contract as "nonce()" function, and fill in.
// sender - only in case of construction: fill sender from initCode.
// callGasLimit: VERY crude estimation (by estimating call to account, and add rough entryPoint overhead
// verificationGasLimit: hard-code default at 100k. should add "create2" cost
export async function fillUserOp(
  op: Partial<UserOperation>,
  walletFactoryAddress: string,
  entryPoint?: EntryPoint
): Promise<UserOperation> {
  const op1 = { ...op };
  const provider = entryPoint?.provider;
  if (op.initCode != null) {
    const initAddr = hexDataSlice(op1.initCode!, 0, 20);
    const initCallData = hexDataSlice(op1.initCode!, 20);
    if (op1.nonce == null) op1.nonce = 0;
    if (op1.sender == null) {
      // hack: if the init contract is our known deployer, then we know what the address would be, without a view call
      if (initAddr.toLowerCase() === walletFactoryAddress.toLowerCase()) {
        const ctr = hexDataSlice(initCallData, 32);
        const salt = hexDataSlice(initCallData, 0, 32);
        op1.sender = getCreate2Address(walletFactoryAddress, salt, ctr);
      } else {
        if (provider == null) throw new Error("no entrypoint/provider");
        op1.sender = await entryPoint!.callStatic
          .getSenderAddress(op1.initCode!)
          .catch((e) => e.errorArgs.sender);
      }
    }
    if (op1.verificationGasLimit == null) {
      if (provider == null) throw new Error("no entrypoint/provider");
      const initEstimate = await provider.estimateGas({
        from: entryPoint?.address,
        to: initAddr,
        data: initCallData,
        gasLimit: 10e6,
      });
      op1.verificationGasLimit = BigNumber.from(
        DefaultsForUserOp.verificationGasLimit
      ).add(initEstimate);
    }
  }
  if (op1.nonce == null) {
    if (provider == null)
      throw new Error("must have entryPoint to autofill nonce");
    const c = new Contract(
      op.sender!,
      ["function nonce() view returns(address)"],
      provider
    );
    op1.nonce = await c.nonce();
  }
  if (op1.callGasLimit == null && op.callData != null) {
    if (provider == null)
      throw new Error("must have entryPoint for callGasLimit estimate");
    const gasEtimated = await provider.estimateGas({
      from: entryPoint?.address,
      to: op1.sender,
      data: op1.callData,
    });

    // estimateGas assumes direct call from entryPoint. add wrapper cost.
    op1.callGasLimit = gasEtimated.add(55000);
  }
  if (op1.maxFeePerGas == null) {
    if (provider == null)
      throw new Error("must have entryPoint to autofill maxFeePerGas");
    const block = await provider.getBlock("latest");
    op1.maxFeePerGas = block.baseFeePerGas!.add(
      op1.maxPriorityFeePerGas ?? DefaultsForUserOp.maxPriorityFeePerGas
    );
  }
  // TODO: this is exactly what fillUserOp below should do - but it doesn't.
  // adding this manually
  if (op1.maxPriorityFeePerGas == null) {
    op1.maxPriorityFeePerGas = DefaultsForUserOp.maxPriorityFeePerGas;
  }
  const op2 = fillUserOpDefaults(op1);
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  if (op2.preVerificationGas.toString() === "0") {
    // TODO: we don't add overhead, which is ~21000 for a single TX, but much lower in a batch.
    op2.preVerificationGas = callDataCost(packUserOp(op2, false));
  }
  return op2;
}

export async function fillAndMultiSign(
  op: Partial<UserOperation>,
  signers: Wallet[],
  walletFactoryAddress: string,
  entryPoint?: EntryPoint,
  validUntil = 0
): Promise<UserOperation> {
  const provider = entryPoint?.provider;
  const op2 = await fillUserOp(op, walletFactoryAddress, entryPoint);
  const chainId = await provider!.getNetwork().then((net) => net.chainId);
  const userOpHash = getUserOpHash(op2, entryPoint!.address, chainId);
  // const approvedHash = userOpHash;
  const approvedHash = ethers.utils.solidityKeccak256(
    ["bytes32", "uint256"],
    [userOpHash, validUntil]
  );
  const message = arrayify(approvedHash);

  const signatures = await Promise.all(
    signers.map((g) => g.signMessage(message))
  );
  const [sortedSigners, sortedSignatures] = _.unzip(
    _.sortBy(
      _.zip(
        signers.map((g) => g.address),
        signatures
      ),
      (item) => item[0]
    )
  );

  const approval = {
    signers: sortedSigners,
    signatures: sortedSignatures,
    validUntil,
  };
  const signature = ethers.utils.defaultAbiCoder.encode(
    ["tuple(address[] signers,bytes[] signatures,uint256 validUntil)"],
    [approval]
  );
  return {
    ...op2,
    signature,
  };
}
export async function fillAndMultiSign2(
  op: Partial<UserOperation>,
  smartWalletOrEOASigners: {signer: Wallet, smartWalletAddress?: string}[],
  walletFactoryAddress: string,
  entryPoint?: EntryPoint,
  validUntil = 0,
): Promise<UserOperation> {
  const provider = entryPoint?.provider;
  const op2 = await fillUserOp(op, walletFactoryAddress, entryPoint);
  op2.verificationGasLimit = BigNumber.from('2').mul(DefaultsForUserOp.verificationGasLimit) 
  const chainId = await provider!.getNetwork().then((net) => net.chainId);
  const userOpHash = getUserOpHash(op2, entryPoint!.address, chainId);
  const approvedHash = ethers.utils.solidityKeccak256(
    ["bytes32", "uint256"],
    [userOpHash, validUntil]
  );
  const message = arrayify(approvedHash);
  const signatures = await Promise.all(
    smartWalletOrEOASigners.map((g) => g.signer.signMessage(message))
  );
  const [sortedSigners, sortedSignatures] = _.unzip(
    _.sortBy(
      _.zip(
        smartWalletOrEOASigners.map((g) => g.smartWalletAddress ? g.smartWalletAddress : g.signer.address),
        signatures
      ),
      (item) => item[0]
    )
  );

  const approval = {
    signers: sortedSigners,
    signatures: sortedSignatures,
    validUntil,
  };
  const signature = ethers.utils.defaultAbiCoder.encode(
    ["tuple(address[] signers,bytes[] signatures,uint256 validUntil)"],
    [approval]
  );
  return {
    ...op2,
    signature,
  };
}

export async function fillAndSign(
  op: Partial<UserOperation>,
  signer: Wallet | Signer,
  walletFactoryAddress: string,
  entryPoint?: EntryPoint
): Promise<UserOperation> {
  const provider = entryPoint?.provider;
  const op2 = await fillUserOp(op, walletFactoryAddress, entryPoint);
  const chainId = await provider!.getNetwork().then((net) => net.chainId);
  const message = arrayify(getUserOpHash(op2, entryPoint!.address, chainId));

  return {
    ...op2,
    signature: await signer.signMessage(message),
  };
}

export type SendUserOp = (userOp: UserOperation) => Promise<ContractReceipt>;

/**
 * send UserOp using handleOps, but locally.
 * for testing: instead of connecting through RPC to a remote host, directly send the transaction
 * @param entryPointAddress the entryPoint address to use.
 * @param signer ethers provider to send the request (must have eth balance to send)
 * @param beneficiary the account to receive the payment (from account/paymaster). defaults to the signer's address
 */
export function localUserOpSender(
  entryPointAddress: string,
  signer: Signer,
  beneficiary?: string
): SendUserOp {
  const entryPoint = EntryPoint__factory.connect(entryPointAddress, signer);
  return async function (userOp) {
    const gasLimit = BigNumber.from(userOp.preVerificationGas)
      .add(userOp.verificationGasLimit)
      .add(userOp.callGasLimit);
    const ret = await entryPoint.handleOps(
      [userOp],
      beneficiary ?? (await signer.getAddress()),
      {
        maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
        maxFeePerGas: userOp.maxFeePerGas,
      }
    );
    const recipt = await ret.wait();
    return recipt;
  };
}

function getDeployTransactionCallData(
  initCode: string,
  salt: BigNumberish = 0
): string {
  const saltBytes32 = hexZeroPad(hexlify(salt), 32);
  return hexConcat([saltBytes32, initCode]);
}

export class AASigner {
  _account?: SmartWallet;

  private _isPhantom = true;
  private salt: BigNumberish;
  public entryPoint: EntryPoint;
  public walletFactory: WalletFactory;

  private _chainId: Promise<number> | undefined;

  constructor(
    readonly signer: Signer,
    readonly entryPointAddress: string,
    readonly walletFactoryAddress: string,
    readonly walletConfig: WalletConfig,
    readonly sendUserOp: SendUserOp,
    readonly provider = signer.provider
  ) {
    this.entryPoint = EntryPoint__factory.connect(entryPointAddress, signer);
    this.walletFactory = WalletFactory__factory.connect(
      walletFactoryAddress,
      signer
    );
    this.salt = ethers.utils.randomBytes(32);
  }

  async syncAccount(): Promise<void> {
    if (this._account == null) {
      const address = await this._deploymentAddress();
      this._account = SmartWallet__factory.connect(address, this.signer);
    }

    this._chainId = this.provider?.getNetwork().then((net) => net.chainId);
    // once an account is deployed, it can no longer be a phantom.
    // but until then, we need to re-check
    if (this._isPhantom) {
      const size = await this.signer.provider
        ?.getCode(this._account.address)
        .then((x) => x.length);
      this._isPhantom = size === 2;
      // !await this.entryPoint.isContractDeployed(await this.getAddress());
    }
  }

  async getAddress(): Promise<string> {
    await this.syncAccount();
    return this._account!.address;
  }

  async _deploymentAddress(): Promise<string> {
    return getCreate2Address(
      this.walletFactoryAddress,
      hexZeroPad(hexlify(this.salt), 32),
      keccak256(await this._deploymentTransaction())
    );
  }

  // TODO TODO: THERE IS UTILS.getAccountInitCode - why not use that?
  async _deploymentTransaction(): Promise<BytesLike> {
    const implementationAddress =
      await this.walletFactory.accountImplementation(); // TODO: pass implementation in here
    // const ownerAddress = await this.signer.getAddress();
    const initializeCall = new Interface(
      SmartWallet__factory.abi
    ).encodeFunctionData("initialize", [
      this.walletConfig.accountOwner,
      this.walletConfig.guardians,
      this.walletConfig.quota,
      this.walletConfig.inheritor,
    ]);
    return new WalletProxy__factory(this.signer).getDeployTransaction(
      implementationAddress,
      initializeCall
    ).data!;
  }

  // return true if account not yet created.
  async isPhantom(): Promise<boolean> {
    await this.syncAccount();
    return this._isPhantom;
  }

  async sendTransaction(transaction: Deferrable<TransactionRequest>) {
    const userOp = await this._createUserOperation(transaction);
    // get response BEFORE sending request: the response waits for events, which might be triggered before the actual send returns.
    // const reponse = await this.userEventResponse(userOp)
    return this.sendUserOp(userOp);
    // return reponse
  }

  async _createUserOperation(
    transaction: Deferrable<TransactionRequest>
  ): Promise<UserOperation> {
    const tx: TransactionRequest = await resolveProperties(transaction);
    await this.syncAccount();

    let initCode: BytesLike | undefined;
    if (this._isPhantom) {
      initCode = getAccountInitCode(
        this.walletConfig,
        this.walletFactory,
        this.salt
      );
    }
    const execFromEntryPoint = await this._account!.populateTransaction.execute(
      tx.to!,
      tx.value ?? 0,
      tx.data!
    );

    let { gasPrice, maxPriorityFeePerGas, maxFeePerGas } = tx;
    // gasPrice is legacy, and overrides eip1559 values:
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (gasPrice) {
      maxPriorityFeePerGas = gasPrice;
      maxFeePerGas = gasPrice;
    }
    const userOp = await fillAndSign(
      {
        sender: this._account!.address,
        initCode,
        nonce: initCode == null ? tx.nonce : 100, // TODO fix it
        callData: execFromEntryPoint.data!,
        callGasLimit: tx.gasLimit,
        maxPriorityFeePerGas,
        maxFeePerGas,
      },
      this.signer,
      this.walletFactoryAddress,
      this.entryPoint
    );

    return userOp;
  }
}
