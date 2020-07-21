# Circuit Understanding

## 1. 综合讨论（基于 DepositCircuit）

1. 为什么之前提出的节省中间验证的优化不可行？

   之前优化的想法是这样的，中间状态不验证，而只有 block 出入的 merkle tree root 进行验证。

   ![image-20190723091104776](https://user-images.githubusercontent.com/26989346/63236800-c133c800-c271-11e9-9109-81c77a01af3d.png)

   该方案不可行是因为必须保证 Merkle Path 的一致性。如下图所示，本来 Merkle Root 验证电路本身比较简单，输入是 path 和 leaf，输出是 merkle root。

   ![image-20190722192752108](https://user-images.githubusercontent.com/26989346/63237004-c2192980-c272-11e9-914b-0812fac36025.png)

   对于 Loopring 的电路设计，我们有 before 和 after 两个 merkle tree 需要被验证，于是有：

   ![image-20190722205208609](https://user-images.githubusercontent.com/26989346/63237034-e2e17f00-c272-11e9-919d-afae29917f99.png)

这里有个问题，因为 before 和 after 完全没有联系，那么任意构造的 merkle 树都可以单独通过 before 或者 after 的验证，也就是说 before 和 after 可以来自完全不同的两颗 merkle 树，且各自符合 merkle 逻辑。所以为了保证内部的操作在同一棵 merkle tree 上完成，也就必须让 before 和 after 产生联系，目前看来只有这样一种方案，如下图所示：

![image-20190722205053165](https://user-images.githubusercontent.com/26989346/63237047-f0970480-c272-11e9-8d9f-b1cf30a50198.png)

即对 before 和 after 使用同一份 merkle path 做验证，这样保证了对节点状态的改动始终在同一棵 merkle 树上，但是此方案的副作用就是每次只能用来验证一个节点的一次改动，因为合并的多个节点的改动不可能有公用的 merkle path。

2. 为什么需要 sha256 在电路的最后（这里指 deposit/withdraw，ringsettle 似乎没有这个计算），直接使用 merkle root 行不行？为什么合约还要计算 sha256，直接拿 statement 行不行？如果合约不用计算的话，换个 hash 行不行？

   答案都是不行，或者说当前设计下不行。首先看看当前的设计：

   ![image-20190722203724585](https://user-images.githubusercontent.com/26989346/63237063-00aee400-c273-11e9-8685-8f7f8e80c223.png)

   基本上有两块，上面一行是对 merkle 树的验证，下面一行是以 block 为单位的一个 hash。可以对比以太坊来理解这个模型，上面一行 depositGadget 是对 eth stateDB 的操作，将每一个 request 对应到一个 eth 的 tx，而下面这个 sha256hash 就是对应到 eth block hash。

   1. 只使用 merkle root 不行的原因：

      类比 eth，因为对 statedb 的操作和对 block 上 tx 记录的操作无关，如果没有这个 block hash 的 check，那么只要 statedb 的 check 能过，block 里面包含的任意 tx 和 statedb 的改动无关也能通过验证。这样 block 的状态和 statedb 的状态就不能保持一致了。

   2. 为什么合约要计算 sha256hash 这个 statement，直接拿 statement 不是也能通过验证么？

      直接拿 statement 确实能正确地通过验证，但是这里没办法保证通过验证的就是当前提交的 block 的，比如有两个 block 有待验证，合法的 block0 和非法的 block1，在调用合约的时候，我们提交 block1 的 data 和 block0 的 proof，合约验证 block0 的 proof 肯定是通过的，但显然不能按照 block1 的 tx 去执行，也就是需要一个 block 和 proof 的绑定过程，这里可能是零知识证明设计上的一个需要注意的地方，就是不能仅依赖 zksnark proof，还必须有业务层上的一些附加的逻辑。

   3. 因为合约必须对这个 statement 进行检查，所以不可以取消或者换算法（sha256 在合约里面便宜）。

3. 讨论理解电路设计过程。

   Loopring 的电路设计可以隐约看到以太坊的逻辑（个人猜测是受了 ethsnark 的影响，有时间可以过一下 ethsnark 的代码逻辑），原因可能是因为 request 本身已经组织成了一个 blockchain，基本上就是 request 对应 tx，block 对应 block，merkle 树对应 stateDB。

   下面两张图是 eth 的 block 内部两个主要数据结构 tx_root 和 state_root 的组织方式

   ![image-20190722231911683](https://user-images.githubusercontent.com/26989346/63237087-13291d80-c273-11e9-8f9c-8951d9447c0c.png)

   ![image-20190722232012755](https://user-images.githubusercontent.com/26989346/63237106-2cca6500-c273-11e9-8404-2a48766f326e.png)

基本对应关系如下：

| Ethereum    | Loopring circuit         | 验证逻辑                | 补充说明                                                                                               |
| ----------- | ------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------ |
| Transaction | Request                  | Signature(public key)   |                                                                                                        |
| tx root     | PublicDataHash           | Hash equivalence        | eth tx root 采用的 merkle 组织方式。但 loopring 这边不需要这么麻烦，直接计算 full data hash 效果一样。 |
| state root  | merkle Root Before/After | merkle root equivalence | ETH 只有一棵 MPT 用于存储 stateDB，但 loopring 需要证明所有的操作都在同一棵 merkle 树上。              |

这样在电路设计上的考量就比较清楚了，从 0 开始设计电路的流程大概是一个选型的过程，比如是用 UTXO 还是 Account，中间状态用什么存储，状态变化用什么描述？

|                        | 账户模型 | 世界状态模型   | 状态变化描述 | 补充说明                                                                                                                           |
| ---------------------- | -------- | -------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| BTC                    | UTXO     | ？？           | tx           |                                                                                                                                    |
| ETH                    | Account  | MPT            | tx           |                                                                                                                                    |
| Loopring               | Account  | layered merkle | request      | 由于 zksnark，因此还有一些需要业务层的设计来保证，如前面提到的 Layered merkle 树唯一，以及 request block 和 block proof 绑定等等。 |
| Loopring-derivative :) | ??       | ??             | ??           |                                                                                                                                    |

## 2. OrderCancel 电路笔记

![image-20190803160429976](https://user-images.githubusercontent.com/26989346/63237118-3a7fea80-c273-11e9-88ba-cb482c303ea7.png)

###2.1 Input : output

​ 基本设置和 DepositCircuit 相同，输入是 Cancelled Order Block 的描述，输出是全部相关变量的 hash，其实全部 5 种电路的设计都是一样的（虚线需要开启 onChainData）

![image-20190803165832629](https://user-images.githubusercontent.com/26989346/63237549-11605980-c275-11e9-82ed-f016788b212d.png)

具体到代码是这样的：

首先是 Top level 电路的描述，包含这么些东西。

```c++
    std::vector<OrderCancellationGadget> cancels; // down level OrderCancellationGadget

    libsnark::dual_variable_gadget<FieldT> publicDataHash; // Hash value as primary input/statment.
    PublicDataGadget publicData; // Data to be hashed

	// Below variables are all private witnesses.
    Constants constants;
    libsnark::dual_variable_gadget<FieldT> exchangeID;
    libsnark::dual_variable_gadget<FieldT> merkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> merkleRootAfter;

    libsnark::dual_variable_gadget<FieldT> operatorAccountID;
    const jubjub::VariablePointT publicKey;
    VariableT nonce;
    VariableT balancesRoot_before;
    std::unique_ptr<UpdateAccountGadget> updateAccount_O;
```

电路的输入是 OrderCancellationBlock，由 Cancellation 和其他一些 merkle 相关的变量组成。

```c++
class Cancellation
{
public:
    ethsnarks::FieldT fee;
    ethsnarks::FieldT walletSplitPercentage;
    Signature signature;

    TradeHistoryUpdate tradeHistoryUpdate_A;
    BalanceUpdate balanceUpdateT_A;
    BalanceUpdate balanceUpdateF_A;
    AccountUpdate accountUpdate_A;
    BalanceUpdate balanceUpdateF_W;
    AccountUpdate accountUpdate_W;
    BalanceUpdate balanceUpdateF_O;
};

class OrderCancellationBlock
{
public:
    ethsnarks::FieldT exchangeID;

    ethsnarks::FieldT merkleRootBefore;
    ethsnarks::FieldT merkleRootAfter;

    ethsnarks::FieldT operatorAccountID;
    AccountUpdate accountUpdate_O;

    std::vector<Loopring::Cancellation> cancels;
};
```

### 2.2. Unflatten Circuit

​ 这里的电路描述的问题抽象出来是这样的

```c++
1. merkleRootBefore, merkleRootAfter满足block merkle update的条件
2. exchangeID正确
3. operatorAccountID正确
4. 一组由用户发起的Cancellation合法，单个Cancellation包括以下条件
	4.1	fee 和 walletSplitPercentage 合法
	4.2 sign 正确
	4.3 User Trading的History正确，即tradeHistoryUpdate_A
	4.4 User Trading的balance正确，即balanceUpdateT_A
	4.5 User Paid Fee的balance正确，即balanceUpdateF_A
	4.6 User Account操作正确，即accountUpdate_A
	4.7 Wallet Recieved Fee的balance正确，即balanceUpdateF_W
	4.8 Wallet Account操作正确，即accountUpdate_W
	4.9 Operator Recieved Fee的balance正确，即balanceUpdateF_O
5. Operator Account操作正确，即accountUpdate_O （为什么不在4里面对单次做check？？理由似乎是因为Operator只有一个，而User，Wallet可能是不同的。。。但是operator的balance变化了，merkle root就会变化，似乎必须每次check才行？WHY？？）
6. merkleRootBefore，merkleRootAfter，exchangeID，operatorAccountID，以及cancel.publicData()综合起来的hash值正确。（后两者需要rollupMode==true）
```

​ 显然，Cancel 影响到了 3 个账户，User，Wallet 和 Operator，从这里的代码看 Cancel Order 是付费的，而且将来 Fee model 可能会有变化，账户相关的电路操作都在 OrderCancellationGadget 里面，就是上面 step 4 的逻辑，和 state 变化有关的几个值得注意的电路如下所示：

1. fee，一个 float 值，是交易的总手续费，会分配给 wallet 和 operator。

2. feeToWallet，wallet 按照比例收费，是一个计算%的电路。

3. feeToOperator，total fee 去掉给 wallet 就是给 operator 的费用。

4. feePaymentWallet，确保$balanceF\_A\_before-feeToWallet \equiv balanceF\_W\_before+feeToWallet​$

5. feePaymentOperator，类似的，确保$balanceF\_A\_before-feeToWallet-feeToOperator \equiv balanceF\_O\_before + feeToOperator​$

6. updateBalanceT_A，保证 Token 余额变化合法，这里没有 value 的变化，所以只检查$tradingHistoryT$

7. updateBalanceF_A，变化过程是$balanceF\_A\_before, tradingHistoryRootF\_A \to \\balanceF\_A\_before-feeToWallet-feeToOperator, tradingHistoryRootF\_A$

   一个小问题是 tradingHistoryRootF 没有发生变化，是因为 fee 改变不算 trading 么？

8. updateAccount_A，保证 User Account 的变化合法，实际上就是计算新的 merkle root，注意这里的 root 只是临时状态，因为还有其他账户（wallet，operator）没有更新

9. 接下来就是更新 wallet，updateBalanceF_W 和 updateBalanceF_A 一样，用来检查$balanceF\_W\_before \to balanceF\_W\_before + feeToWallet​$，注意这里也不考虑 tradingHistoryW

10. updateAccount_W，类似的，保证 Wallet Account 的变化合法

11. 最后是 updateBalanceF_O，检查$balanceF\_O\_before \to balanceF\_O\_before + feeToOperator$

到此，单个 cancel 的主要逻辑就结束了，几个主要电路的逻辑框图如下：

1. Merkle 验证电路是一系列 updateXXX 电路的主要组成部分，一次验证一个节点的改动

   ![image-20190731121508839](https://user-images.githubusercontent.com/26989346/63238779-94d07980-c27a-11e9-963c-6591510ae323.png)

2. Fee Calculation

   ![image-20190731142721181](https://user-images.githubusercontent.com/26989346/63238796-a6198600-c27a-11e9-885c-b9c07be597e8.png)

3. Balance Check

   ![image-20190731142036411](https://user-images.githubusercontent.com/26989346/63238834-d82ae800-c27a-11e9-9070-c51568d51468.png)

4. Poseidon Hash Gadget

   就是一个计算 Poseidon hash 的电路，算法不复杂，主要说明一下参数

   ```c++
   template<unsigned param_t, unsigned param_c, unsigned param_F, unsigned param_P, unsigned nInputs, unsigned nOutputs, bool constrainOutputs=true>
   class Poseidon_gadget_T : public GadgetT
   {
   	...
   }
   ```

   其中，t 是 sbox 的个数，c 是 padding capacity，用于保证 hash 的安全性，一般来说选择 2x 的安全比特数，比如 128bit security 需要选择 c=256。F 是 full round 个数，P 是 partial round 个数，似乎没有特别的要求（论文提到$F\geq6$，可以看到代码里 F 都等于 6），后面 input 和 output 就是输入输出的参数个数，目前电路代码内部的变量字长是 256bit，因此选择 t 和 c 的时候要结合一起考虑。

   ```c++
   using HashMerkleTree = Poseidon_gadget_T<5, 1, 6, 52, 4, 1>;
   using HashAccountLeaf = Poseidon_gadget_T<5, 1, 6, 52, 4, 1>;
   using HashBalanceLeaf = Poseidon_gadget_T<5, 1, 6, 52, 2, 1>;
   using HashTradingHistoryLeaf = Poseidon_gadget_T<5, 1, 6, 52, 3, 1>;
   ```

5. merkle_path_selector_4

   这个是验证 poseidon hash merkle tree 的电路的一部分，有一点值得注意的地方就是下面这个真值表的计算。

   ```c++
   class merkle_path_selector_4 : public GadgetT
   {
   public:
       OrGadget bit0_or_bit1;
       AndGadget bit0_and_bit1;

       TernaryGadget child0;
       TernaryGadget child1p;
       TernaryGadget child1;
       TernaryGadget child2p;
       TernaryGadget child2;
       TernaryGadget child3;

       VariableT m_bit0;
       VariableT m_bit1;

       // 00   x  y0  y1 y2
       // 01   y0 x   y1 y2
       // 10   y0 y1   x y2
       // 11   y0 y1  y2  x
       merkle_path_selector_4(...)
       ...
   }
   ```

   这里是用 index（0 ～ 3）对应表示的 path，一个更加直观的设计是用 bool 电路，即 1000 表示第一个位置，0100 表示第二个位置，逻辑上看起来简单一些，但是对于 4x 的 merkle tree，需要多 2 个电路变量（variables），这里的设计逻辑略复杂，但是节约了变量（其实还有另外一个好处，ID 的>>2 & 0x3[0b11]正好是 merkle path 上的 index，因此不需要额外的逻辑处理 index，直接用 ID 加上各个位置的 mask 即可），这个复杂的逻辑长这样：

   ```c++
       child0(pb, bit0_or_bit1.result(), sideNodes[0], input, FMT(prefix, ".child0")),
       child1p(pb, bit0, input, sideNodes[0], FMT(prefix, ".child1p")),
       child1(pb, bit1, sideNodes[1], child1p.result(), FMT(prefix, ".child1")),
       child2p(pb, bit0, sideNodes[2], input, FMT(prefix, ".child2p")),
       child2(pb, bit1, child2p.result(), sideNodes[1], FMT(prefix, ".child2")),
       child3(pb, bit0_and_bit1.result(), input, sideNodes[2], FMT(prefix, ".child3"))
   ```

   难以理解的地方在于 1p 和 2p。下面用设计图来说明该选择算法：

   ![image-20190803163045704](https://user-images.githubusercontent.com/26989346/63238850-f395f300-c27a-11e9-9df9-ea86c5a400cf.png)

   左边表示的是 4x 树的 path selector 算法，对于 child0 来说，他只有 input 和 sibling0 两个选择，由于 input 和 sibling 信息都是顺序排列的，所以 child0 不可能选择 sibling1，因此 1bit 信息（这里用的 bit0 | bit1）就可以区分。而对于 child1 来说，他有 3 个选择，因此需要 2bit 的信息才能区分，同样的，child2 也存在这个问题，而 child3 和 child0 一样，1bit 信息足够。所以代码里面 child0 和 child3 不需要额外的处理，而 child1 和 child2 分别需要 child1p 和 child2p（各自包含 1bit 信息）来区分他们走的那一条 path。基于这个设计思路，我们可以比较容易（理论上）的构造一个 8x 的 merkle path selector，如右图所示，很显然，我们要做的就是通过 3 个 bit 的信息，构造出 child0, child1/1p, child2/2p, ..., child6/6p 和 child7。

## 3. RingSettlement 电路笔记

### 3.1 相关各方：

1. 账户：A(maker/taker)，B(maker/taker)，Matcher，Protocaler 和 Operator（收税）
2. Token：TokenSold，TokenBuy，TokenFee。

他们之间的关系基本如下，未来不同的 fee model 可能有区别。

![image-20190802163217743](https://user-images.githubusercontent.com/26989346/63238877-0c060d80-c27b-11e9-906b-82a62e4a4ed4.png)

### 3.2 基本逻辑

电路的基本逻辑和之前的 Deposit，OrderCancel 一样，输入是 RingSettlementBlock，输出是一批 publicData 的 hash 值，中间电路由若干 RingSettlementGadget 组成，加上一批外围验证的逻辑，top level 框图如下，可以看到电路的基本设计是一致的：

![image-20190801221206000](https://user-images.githubusercontent.com/26989346/63238893-1cb68380-c27b-11e9-9ee8-f78e10c2e626.png)

中间有些 value 需要开启 rollupMode 才会加入到 hash 计算中，因此用虚线标注，但不影响整体逻辑。

### 3.3 Unflatten Circuit

显然我们主要关注 RingSettlementGadget 的实现，结合后段的数据结构来看：

```js
class Ring
{
    orderA: Order,
    orderB: Order,

    ringMatcherAccountID: number,
    tokenID: number,
    fee: string,
    nonce: number,

    ringMatcherSignature: Signature,
    dualAuthASignature: Signature,
    dualAuthBSignature: Signature,
}

class RingSettlement
{
    ring: Ring,

    # The starting merkle root
    accountsMerkleRoot: string,

    # Trade history update data of the orders
    tradeHistoryUpdate_A: TradeHistoryUpdate,
    tradeHistoryUpdate_B: TradeHistoryUpdate,

    # OrderA:
    # Balance update data for tokenS, tokenB and tokenF
    # Account update data
    balanceUpdateS_A: BalanceUpdate,
    balanceUpdateB_A: BalanceUpdate,
    accountUpdate_A: AccountUpdate,

    # OrderB:
    # Balance update data for tokenS, tokenB and tokenF
    # Account update data
    balanceUpdateS_B: BalanceUpdate,
    balanceUpdateB_B: BalanceUpdate,
    accountUpdate_B: AccountUpdate,

    # Ring-matcher:
    # Balance update data for tokenB of orderA and orderB (fee/rebate/protocol fee)
    # and token used for paying the operator
    # Account update data
    balanceUpdateA_M: BalanceUpdate,
    balanceUpdateB_M: BalanceUpdate,
    balanceUpdateO_M: BalanceUpdate,
    accountUpdate_M: AccountUpdate,

    # Balance update data for protocol fee payments
    balanceUpdateA_P: BalanceUpdate,
    balanceUpdateB_P: BalanceUpdate,

    # Balance update data for fee payment by the ring-matcher
    balanceUpdateF_O: BalanceUpdate,
}

class RingSettlementBlock
{
    exchangeID: number,

    merkleRootBefore: string,
    merkleRootAfter: string,

    # Timestamp used in this block
    timestamp: number,

    # Protocol fees used in this block
    protocolTakerFeeBips: number;
    protocolMakerFeeBips: number;

    # Protocol fee account update data (account 0)
    accountUpdate_P: AccountUpdate,

    # Operator:
    # Account update data
    operatorAccountID: number,
    accountUpdate_O: AccountUpdate,

    ringSettlements: RingSettlement[],
}
```

关系如下：

![image-20190801223937621](https://user-images.githubusercontent.com/26989346/63239054-e62d3880-c27b-11e9-890e-22faa97f3659.png)

其中 RingSettlementBlock 作为 RingSettlementCircuit 电路的输入，其中主要部分 RingSettlementGadget 就是在验证对 RingSettlement 的操作是否有效。RingSettleGadget 的声明（部分）如下，显然是在验证 RingSettlement 的计算。

```c++
class RingSettlementGadget : public GadgetT
{
public:
    const jubjub::VariablePointT publicKey;
    libsnark::dual_variable_gadget<FieldT> ringMatcherAccountID;
    VariableArrayT tokenID;
    libsnark::dual_variable_gadget<FieldT> fee;
    FloatGadget fFee;
    EnsureAccuracyGadget ensureAccuracyFee;
    libsnark::dual_variable_gadget<FieldT> nonce_before;
    UnsafeAddGadget nonce_after;

    OrderGadget orderA;
    OrderGadget orderB;

    OrderMatchingGadget orderMatching;

    TernaryGadget uFillS_A;
    TernaryGadget uFillS_B;

    FloatGadget fillS_A;
    FloatGadget fillS_B;

    EnsureAccuracyGadget ensureAccuracyFillS_A;
    EnsureAccuracyGadget ensureAccuracyFillS_B;

    TernaryGadget filledA;
    TernaryGadget filledB;
    UnsafeAddGadget filledAfterA;
    UnsafeAddGadget filledAfterB;

    FeeCalculatorGadget feeCalculatorA;
    FeeCalculatorGadget feeCalculatorB;

    DynamicVariableGadget balanceS_A;
    DynamicVariableGadget balanceB_A;
    DynamicVariableGadget balanceS_B;
    DynamicVariableGadget balanceB_B;
    DynamicVariableGadget balanceA_P;
    DynamicVariableGadget balanceB_P;
    DynamicVariableGadget balanceA_M;
    DynamicVariableGadget balanceB_M;
    DynamicVariableGadget balanceO_M;
    DynamicVariableGadget balanceF_O;

    TransferGadget fillBB_from_balanceSA_to_balanceBB;
    TransferGadget fillSB_from_balanceSB_to_balanceBA;
    TransferGadget feeA_from_balanceBA_to_balanceAM;
    TransferGadget feeB_from_balanceBB_to_balanceBM;
    TransferGadget rebateA_from_balanceAM_to_balanceBA;
    TransferGadget rebateB_from_balanceBM_to_balanceBB;
    TransferGadget protocolFeeA_from_balanceAM_to_balanceAP;
    TransferGadget protocolFeeB_from_balanceBM_to_balanceBP;
    TransferGadget ringFee_from_balanceOM_to_balanceO;

    UpdateTradeHistoryGadget updateTradeHistoryA;
    UpdateTradeHistoryGadget updateTradeHistoryB;

    UpdateBalanceGadget updateBalanceS_A;
    UpdateBalanceGadget updateBalanceB_A;
    VariableT nonce_A;
    UpdateAccountGadget updateAccount_A;

    UpdateBalanceGadget updateBalanceS_B;
    UpdateBalanceGadget updateBalanceB_B;
    VariableT nonce_B;
    UpdateAccountGadget updateAccount_B;

    UpdateBalanceGadget updateBalanceA_M;
    UpdateBalanceGadget updateBalanceB_M;
    UpdateBalanceGadget updateBalanceO_M;
    UpdateAccountGadget updateAccount_M;

    UpdateBalanceGadget updateBalanceA_P;
    UpdateBalanceGadget updateBalanceB_P;

    UpdateBalanceGadget updateBalanceF_O;
    ...
}
```

这里 UpdateXXX，TernaryGadget，feeCalculate 之前都出现过。简单描述一下几个新加入的电路逻辑：

1. OrderGadget 和 OrderMatchingGadget

   内部验证 order 的创建，签名，各种参数，比如 tokenS_neq_tokenB 保证$tokenA \neq tokenB$。以及 taker/maker 的 buy/sell/fill 参数是否正确，具体要结合业务逻辑看，电路本身比较简单，基本都是判断等于，小于这样的关系。

2. DynamicVariableGadget

   个人感觉这个是一个电路实现上的技巧，首先声明和创建对象的地方是这样的

   ```c++
   class DynamicVariableGadget : public GadgetT
   {
   public:
       std::vector<VariableT> variables; // only 1 member
   }

   class RingSettlementGadget : public GadgetT
   {
   ...
   public:
       DynamicVariableGadget balanceS_A;
       DynamicVariableGadget balanceB_A;
       DynamicVariableGadget balanceS_B;
       DynamicVariableGadget balanceB_B;
       DynamicVariableGadget balanceA_P;
       DynamicVariableGadget balanceB_P;
       DynamicVariableGadget balanceA_M;
       DynamicVariableGadget balanceB_M;
       DynamicVariableGadget balanceO_M;
       DynamicVariableGadget balanceF_O;
   ...
   }
   ```

   使用起来是这样的：

   ```c++
           // Transfers tokens
           fillBB_from_balanceSA_to_balanceBB(pb, balanceS_A, balanceB_B, fillS_A.value(), FMT(prefix, ".fillBB_from_balanceSA_to_balanceBB")),
           fillSB_from_balanceSB_to_balanceBA(pb, balanceS_B, balanceB_A, fillS_B.value(), FMT(prefix, ".fillSB_from_balanceSB_to_balanceBA")),
           // Fees
           feeA_from_balanceBA_to_balanceAM(pb, balanceB_A, balanceA_M, feeCalculatorA.getFee(), FMT(prefix, ".feeA_from_balanceBA_to_balanceAM")),
           feeB_from_balanceBB_to_balanceBM(pb, balanceB_B, balanceB_M, feeCalculatorB.getFee(), FMT(prefix, ".feeB_from_balanceBB_to_balanceBM")),
           // Rebates
           rebateA_from_balanceAM_to_balanceBA(pb, balanceA_M, balanceB_A, feeCalculatorA.getRebate(), FMT(prefix, ".rebateA_from_balanceAM_to_balanceBA")),
           rebateB_from_balanceBM_to_balanceBB(pb, balanceB_M, balanceB_B, feeCalculatorB.getRebate(), FMT(prefix, ".rebateB_from_balanceBM_to_balanceBB")),
           // Protocol fees
           protocolFeeA_from_balanceAM_to_balanceAP(pb, balanceA_M, balanceA_P, feeCalculatorA.getProtocolFee(), FMT(prefix, ".protocolFeeA_from_balanceAM_to_balanceAP")),
           protocolFeeB_from_balanceBM_to_balanceBP(pb, balanceB_M, balanceB_P, feeCalculatorB.getProtocolFee(), FMT(prefix, ".protocolFeeB_from_balanceBM_to_balanceBP")),
           // Ring fee
           ringFee_from_balanceOM_to_balanceO(pb, balanceO_M, balanceF_O, fFee.value(), FMT(prefix, ".ringFee_from_balanceOM_to_balanceO")),
   ```

   这里注意每一个 transfer 电路都会去拿这些 balance 的最新的值，即 balanceX_X.back()，然后每个电路的输出会把输出（也就是新的值的 variableT）push_back()到这个 vector 里面去。注意这里其实并不是动态的挑选 variable，因为每个电路的输出都是预先定义好的，理论上只要仔细加上命名合理，全部用中间的 out 结果是没问题的。但是这样做在代码的组织上就比较好看了，是一个值得学习的小技巧。基本的逻辑如下所示：

   ![image-20190802175614989](https://user-images.githubusercontent.com/26989346/63238909-31931700-c27b-11e9-893d-efc6db991d9e.png)

   当然直接拿这些中间电路的 out variable 是一样的，比如 OrderCancel 电路里面计算 fee 的时候就没有用这个技巧，应该是因为那边计算的级数没有这里多，所以改善代码的意义不大。

3. TransferGadget

   比较简单，就是一步一步处理交易，收取/分发各种费用。内部就是 before 和 after 的各种 check 了

   ```c++
      1 TransferGadget fillBB_from_balanceSA_to_balanceBB;
      2 TransferGadget fillSB_from_balanceSB_to_balanceBA;
      3 TransferGadget feeA_from_balanceBA_to_balanceAM;
      4 TransferGadget feeB_from_balanceBB_to_balanceBM;
      5 TransferGadget rebateA_from_balanceAM_to_balanceBA;
      6 TransferGadget rebateB_from_balanceBM_to_balanceBB;
      7 TransferGadget protocolFeeA_from_balanceAM_to_balanceAP;
      8 TransferGadget protocolFeeB_from_balanceBM_to_balanceBP;
      9 TransferGadget ringFee_from_balanceOM_to_balanceO;
   ```

   ![image-20190802163757644](https://user-images.githubusercontent.com/26989346/63238920-440d5080-c27b-11e9-8b13-def16e077235.png)
