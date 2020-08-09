# WithdrawCircuit

现在 withdraw 有两种方式：onchain withdraw 和 offchain withdraw。

两个各有优劣：

1 onchain withdraw 缺点是比较慢，要先经过以太主网确认才会到中继进行处理；优点是可以确保被处理（合约设置超过 15 分钟就要被优先处理）

2 offchain withdraw 的优点是快，直接发到中继进行处理；缺点是中继可以选择性的不处理；

## 1 OnchainWithdrawCircuit

### 1.1 流程

![OnchainWithdraw流程](https://imgur.com/7S5ESQb)

1 用户发送 withdraw 请求到 ETH 主链的 Exchange 合约

2 中继监听 Exchange 合约收到用户的 withdraw 请求

3 中继组装 withdraw 请求生成 withdraw 的 block 提交，调用 Exchange 的 commitBlock

4 中继调用电路部分生成 block 的 prove

5 中继调用 Exchange 的 verifyBlock

### 1.2 Prove Input

Prove 的 Input 包含 block 的信息和每个 withdraw 的信息

#### block 的信息：

```
class OnchainWithdrawalBlock
{
public:

    ethsnarks::FieldT exchangeID;

    ethsnarks::FieldT merkleRootBefore;
    ethsnarks::FieldT merkleRootAfter;

    libff::bigint<libff::alt_bn128_r_limbs> startHash;

    ethsnarks::FieldT startIndex;
    ethsnarks::FieldT count;

    std::vector<Loopring::OnchainWithdrawal> withdrawals;
};
```

#### 各个 withdrawal 的信息：

```
class OnchainWithdrawal
{
public:
    ethsnarks::FieldT amountRequested;
    ethsnarks::FieldT fAmountWithdrawn;
    BalanceUpdate balanceUpdate;
    AccountUpdate accountUpdate;
};

class AccountUpdate
{
public:
    ethsnarks::FieldT accountID;
    Proof proof;
    ethsnarks::FieldT rootBefore;
    ethsnarks::FieldT rootAfter;
    AccountLeaf before;
    AccountLeaf after;
};

class Account
{
public:
    ethsnarks::jubjub::EdwardsPoint publicKey;
    ethsnarks::FieldT nonce;
    ethsnarks::FieldT balancesRoot;
};

class BalanceUpdate
{
public:
    ethsnarks::FieldT tokenID;
    Proof proof;
    ethsnarks::FieldT rootBefore;
    ethsnarks::FieldT rootAfter;
    BalanceLeaf before;
    BalanceLeaf after;
};

class BalanceLeaf
{
public:
    ethsnarks::FieldT balance;
    ethsnarks::FieldT tradingHistoryRoot;
};
```

![OnChainWithdraw](https://imgur.com/HvqbRzW)

### 1.3 Circuit

#### 1.3.1 计算 publicDataHash

电路会计算一个 sha256 hash，verifyBlock 的时候输入 hash 与这个 hash 一致即表示 verify 成功。

![OnChainWithdrawCircuit (2)](https://imgur.com/NlhVi1H)

#### 1.3.2 OnchainWithdrawalGadget

每个 withdrawal 的逻辑就是验证 withdraw 的合法性，并且加入了 shutdownmode 的判断，如果是 shutdownmode 就要 withdraw 用户的所有 balance，然后更新 balance 和 account。

具体步骤如下：

```
1 取用户amountRequested和balanceBefore的最小值算出amountToWithdrawMin
2 根据shutdownmode计算amountToWithdraw，如果是shutdownmode结果为balanceBefore,否则为amountToWithdrawMin
3 设置amountWithdrawn，值是输入的fAmountWithdrawn(toFloat(min(amountRequested, balance)), 类型Float28Encoding	// {5, 23, 10};
	 struct FloatEncoding
    {
        unsigned int numBitsExponent;
        unsigned int numBitsMantissa;
        unsigned int exponentBase;
    };
4 ensureAccuracyAmountWithdrawn, 确保amountToWithdraw和fAmountWithdrawn在精度范围内相等。Float28Accuracy	// {12, 10000000};
 	struct Accuracy
    {
        unsigned int numerator;
        unsigned int denominator;
    };
 TODO: amountRequested和fAmountWithdrawn都是输入，有点不合理，Brecht said:
 We also don't covert to float in the circuit, this would be expensive. The float is decoded and it's  checked that the float value is close enough to the actual value.
 现在跟fee的处理不一样，后续会改成一致。
5 根据shutdownmode计算amountToSubtract，true则是amountToWithdraw，否则是amountWithdrawn
6 根据shutdownmode计算tradingHistoryAfter， true则是emptyTradeHistory， 否则是balanceBefore.tradingHistory
7 根据shutdownmode计算publicKeyXAfter， true则是zero，否则是accountBefore.publicKeyX
8 根据shutdownmode计算publicKeyYAfter， true则是zero，否则是accountBefore.publicKeyY
9 根据shutdownmode计算nonceAfter，true则是zero，否则是accountBefore.nonce
(可以看出onchain withdraw不改变nonce，跟deposit一样)
10 确保balanceBefore.balance = balanceAfter.balance + amountToSubtract
11 updateBalance
12 updateAccount
```

withdrawCircuit 中会 check 最后一个用户的 rootAfter 等于输入的 merkleRootAfter

## 2 OffchainWithdrawCircuit

### 2.1 流程

![OffchainWithdraw流程](https://imgur.com/GHnZcjF)

1 用户发送 withdraw 请求到中继

2 中继收到用户 withdraw 请求。

组装 withdraw 请求生成 withdraw 的 block 提交到 ETH 主链，调用 Exchange 的 commitBlock

3 中继调用电路部分生成 block 的 prove

4 中继调用 Exchange 合约的 verifyBlock

### 2.2 Prove Input

Prove 的 Input 包含 block 的信息和每个 withdraw 的信息

#### block 的信息：

```
class OffchainWithdrawalBlock
{
public:

    ethsnarks::FieldT exchangeID;

    ethsnarks::FieldT merkleRootBefore;
    ethsnarks::FieldT merkleRootAfter;

    libff::bigint<libff::alt_bn128_r_limbs> startHash;

    ethsnarks::FieldT startIndex;
    ethsnarks::FieldT count;

    ethsnarks::FieldT operatorAccountID;
    AccountUpdate accountUpdate_O;

    std::vector<Loopring::OffchainWithdrawal> withdrawals;
};
```

#### 各个 withdrawal 的信息：

```
class OffchainWithdrawal
{
public:
    ethsnarks::FieldT amountRequested;
    ethsnarks::FieldT fee;
    ethsnarks::FieldT walletSplitPercentage;
    Signature signature;

    BalanceUpdate balanceUpdateF_A;
    BalanceUpdate balanceUpdateW_A;
    AccountUpdate accountUpdate_A;
    BalanceUpdate balanceUpdateF_W;
    AccountUpdate accountUpdate_W;
    BalanceUpdate balanceUpdateF_O;
};
```

![OffChainWithdraw](https://imgur.com/TT6ye62)

### 2.3 Circuit

#### 2.3.1 计算 publicDataHash

电路会计算一个 sha256 hash，verifyBlock 的时候输入 hash 与这个 hash 一致即表示 verify 成功。

![OffChainWithdrawCircuit](https://imgur.com/Mtgghxe)

#### 2.3.2 OffchainWithdrawalGadget

每个 withdrawal 的逻辑跟 onchainwithdraw 的逻辑类似，但是不需要判断 shutdownmode，增加了 fee 的操作以及验证用户的签名等逻辑。

fee 需要付给 wallet 和 operator，所以这里涉及到 3 个角色：用户、wallet 和 operator

具体步骤如下：

```
1 计算feeToWallet = fee * walletSplitPercentage
2 计算feeToOperator = fee - feeToWallet
3 计算feePaymentWallet.X = balanceFBefore.balance - feeToWallet	//用户的fee token balanceAfter_1
和feePaymentWallet.Y = balanceWalletBefore.balance + feeToWallet	// wallet的balanceAfter
4 计算feePaymentOperator.X = feePaymentWallet.X - feeToOperator	// 用户fee token balanceAfter final
和feePaymentOperator.Y = balanceF_O_before + feeToOperator	// operator的balanceAfter
5 根据用户的amountRequested计算用户的withdraw amount： amountWithdrawn
6 计算用户的balance_after = balanceBefore.balance - amountWithdrawn
7 更新user信息：
	7.1 update fee token的balance
	7.2 update withdraw token的balance
	7.3 updateAccount
8 更新wallet信息
	8.1 update wallet balance
	8.2 update wallet acount
9 更新Operator的balance
	(Operator的account是在withdrawCircuit中最后更新一次)
10 检查用户签名
	这里用的是EdDSAPoseidon
```

withdrawCircuit 中会 check operator 的 rootAfter 等于输入的 merkleRootAfter
