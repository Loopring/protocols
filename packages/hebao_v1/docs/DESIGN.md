# DESIGN DOC

## 钱包和模块

钱包设计的一个目标就是在功能上具有可扩展性，这样将来添加新的功能或者升级已有的功能就无需重新部署新版本。目前的设计主要围绕着两个核心概念。

### Wallet

Wallet 是我们智能钱包的基础合约，用来真正存储用户的资产。

每个 Wallet 必须有一个 owner，这个 owner 可以是以太坊的外部地址（Externally Owned Account，简称 EOA)，也可以是任意的支持 EIP1271 的合约地址。由于 Wallet 本身已经支持了 EIP1271，因此一个 Wallet 的 owner 甚至可以是另外一个 Wallet。Wallet 在设置新的 owner 的时候不会检查新的 owner 是否真的支持 EIP1271，原因是即使设置错误，也可以通过守护人重置 owner。这个后面会讲到。

Wallet 提供的方法几乎都是和 Module 相关，钱包的几乎所有功能都是通过不同的 Module 实现的。当钱包被创建的时候，除了必须指定 owner 地址外，还必须提供一个默认的 Module 列表，原因是后续添加和移除 Module，必须通过调用`Wallet.addModule`方法来实现，而这个方法要求它的 msg.sender 必须是一个现有的 Module。这也意味着一个钱包的 Module 列表不能为空，否则就无法添加更多的 Module 了。

### Module

钱包的功能按照 Module 做切割，每个 module 相对都比较小巧，保障维护成本较低。每个钱包在生成后，会自动绑定一些默认的 Module，后续钱包可以发交易增加新的或者去掉已有的 Module，但每个 Module 必须是预注册的，也就意味着 Module 必须由我们来批准，不能是任意合约。

### 添加和删除 Module

下面是钱包添加新 Module Y 的流程。

![](./images/add_module.png)

如果 Wallt_A 的 owner 自身没有以太来发起交易，那么就可以通过元交易完成（参考后续章节）。

下面钱包是移除 Module Y 的流程。

![](./images/remove_module.png)

### 钱包通过 Module 读信息

每个 Module 可以提供两类不同的方法，**读方法**和**写方法**。读方法可以通过 Wallet 的`bindStaticMethod`绑定到钱包。每个 Module 都会提供一个`staticMethods`方法，来告诉钱包它提供哪些读方法。当 Module 被加到一个钱包时候，所有的读方法就会自动被绑定到该钱包；当 module 被从一个钱包移除时，绑定的读方法就会被`unbindStaticMethod`解绑。

假设`getSomething`这个只读方法在 Module A 当中并且被绑定到了某个钱包，那么当这个钱包被调用`getSomething`的时候，这个调用就会自动被转给 Module A。

![](./images/call_static.png)

通过这种静态绑定，我们可以为钱包添加更多的读方法。值得注意的是，不同的 Module 的读方法如果要绑定到 Wallet，必须保证方法名称的全局唯一性，否则绑定就会失败，钱包就无法创建成功。

### 钱包通过 Module 写信息（做转账）

写方法就不能绑定了。我们假设 Wallet_A 想调用某个第三方合约 SomeContract 的 transfer 方法，那么 Wallet_A 的 owner 可以找一个支持这种任意调用的 Module_A，通过它提供的 doSomething 方法来完成操作。注意这个 doSometing 名字并不重要，和 transfer 也没什么关系。

首先需要构造一个 bytes data,来表示调用目标合约 SomeContract 中的方法名字和参数，以及需要发的以太数量。然后把 data 通过 doSomething 方法调用传给 Module_A，ModuleA 会验证 msg.sender 是 Wallet_A 的 owner，再调用 Wallet_A 的 transact 方法。而这个 transact 方法是 Wallet 最核心的方法，它可以以 wallet 作为 msg.sender 来调用任意合约的任意方法（通过 call.value()()）。

![](./images/transact.png)

> 注意：所有 Module 中写方法的第一个参数必须是`address wallet`。这是一个重要的约定！

### 元交易

上面的几个示例都是钱包的 owner 作为 msg.sender 发起交易。但实际上我们是尽量避免钱包的 owner 本身有 Ether 的 - 否则 Wallet 和 Owner 都有 Ether 就比较奇怪。也就是说，绝大多数用户都不会用 owner 来发起交易。

我们设计的思路是 100%的交易都是通过元交易来实现。也就是说，钱包的 owner 生成元交易，并附带合适的签名（见下面章节）。然后把这些数据链外发给一个愿意帮忙做转账的一个 relayer（这里的中继和我们交易所的中继不是一个概念）。这个 relayer 调用目标 Module 的`executeMetaTx`方法来发起交易。元交易的 msg.sender 是 relayer，因此 relayer 支付 Ether 做油费；但在调用最后，Wallet 会支付特定的 gasToken 给 relayer 做费用支付。当然，这个 gasToken 也可以是 0x0，代表以太。如果 gasPrice 是 0，代表 Wallat 不想支付任何费用，这时候 relayer 可以决定是不是要帮助执行这个元交易。

```solidity
function executeMetaTx(
    bytes   calldata data, // 元交易数据
    uint    nonce,
    address gasToken,
    uint    gasPrice,
    uint    gasLimit,
    bytes   calldata signatures // 签名
    )
    external
    payable;
```

元交易的本质是把 msg.sender 换成任何一个愿意帮忙发起交易的账号（这个账号最可能是我们自己的一个账号）。然后 relayer 付以太油费，Wallet 付给 relayer 以太或者 ERC20 费用。元交易中 gasPrice 和 gasLimit 和以太坊原生的概念十分类似，只不过有两点细节不同：第一是 gasPrice 是用 gasToken 为单位计费的，第二是 gasLimit 计算不是完全准确，会有一些小误差，因此需要设置的相对宽松一些。元交易中的 nonce 可以设置成 0，在这种情况下，交易数据本身需要具有唯一性；否则就需要使用（非严格）递增的 nonce。

下面这个就是使用元交易来完成上面同样第三方合约调用的流程。

![](./images/meta_transact.png)

> 注意： 所有模块只支持`executeMetaTx`调用自己的某个公开的方法，而不是调用任何其他合约的方法；在自己的公开方法里面，才可以去调用第三方合约。换种说法：如果你想通过元交易调用某个 Module A 的方法，这个 Module A 本身必须支持元交易，而无法通过其它 Module 来调用。

### 验签

一些元交易需要 wallet 的 owner 对交易数据进行签名，另一些元交易只需要钱包的守护人来签名。但 owner 和守护人可能是其他的合约地址，而不是 EOA。这就要求我们支持合约地址的验签。因此在我们的代码中，凡是涉及到验证签名的地方，必须即提供签名，也要提供签名对应的地址,然后根据地址是否为合约地址来决定怎样验签。

- 如果是合约地址：尝试使用 ERC1271 验签，如果地址不支持 ERC1271 或者签名不对，就会 throw；
- 如果是 EOA 地址，就用 ecrecover 验签。

> 注意：所有 Module 支持元交易的写方法必须接受签名和签名所对应的地址。

## 安全设计

### 守护人

守护人的概念是智能钱包安全的核心。一个钱包可以有 0 到 20 个守护人。第一个守护人可以直接由 owner 添加成功，后续的守护人需要等待一段时间（这个时间可设定），然后在另一个时间段内可以通过钱包 owner 确定或者取消。移除守护人需要等待，之后再确认或者取消。目前计划**等待时间**和**确认时间**分别设置成 24 小时和 48 小时。
钱包的守护人管理是通过 GuardianModule 来完成的，并支持元交易。

守护人的主要功能是为钱包设置新的 owner，因此当 app 不小心删掉或者 owner 私钥丢失之后，需要至少`ceil(n/2)`个守护人通过多重签名来。钱包 owner 的恢复是通过 RecoveryModule 模块来实现的，并支持元交易。

一个改进的方案是按照分组来改进 Recovery 方案。每个分组可以包含一个或者多个守护人，恢复钱包需要`ceil(n/2)`个分组批准，每个分组同样需要`ceil(n/2)`个分组内的人批准。

### 钱包锁定

任何一个守护人都可以把钱包锁定一段时间（目前计划设置为 24 小时）。在这段时间内很多操作就不能进行（但守护人和钱包恢复依然可以）。在钱包锁定时间，如果再次发起锁定操作，那么 lock 的时间就会延迟。任何一个守护人也可以将钱包 unlock，或者过了 24 小时候钱包就会自动 unlock。钱包锁定逻辑是通过 LockModule 实现的，并支持元交易。

### 基于时间锁的继承

钱包的 owner 可以设置一个继承人地址，该继承人可以在钱包 onwer 连续不活动一段时间之后（目前计划设置为 1 年）变成钱包新的 owner。每当钱包 owner 调用 Module 中的方法发起交易的时候，就会更新最优一次活动的时间，**但调用 addModule/removeModule 除外**。

### 限额与交易批准

Quota 模块用来负责记录用户的每日开销（比如 10 个以太）。目前设计是按照北京时间凌晨 12 点为日间分割。超过限额部分要么会失败，要么可以选择 pending 起来，方便在第二天任意人来触发该 pending 交易。

## Storage 存储合约

Module 之间通过 Storage 来共享数据。一些 Storage 有 owner，owner 可以授权哪些 module 可以读写该 storage。

## dapp 集成

### 借贷获息

- Compound
- BZX
- DyDX
- MakerDAO DSR
- Topo finance
- Meta Money Market

### 交易

- Loopring
- Uniswap

### 博彩

- PoolTogether

## 几个和钱包相关的重要 EIPs

- [EIP:681: URL Format for Transaction Requests](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-681.md)
- [IIP:712: Ethereum typed structured data hashing and signing](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-712.md) also see https://medium.com/metamask/eip712-is-coming-what-to-expect-and-how-to-use-it-bb92fd1a7a26
- [EIP725 : Ethereum Identity Standard](https://docs.ethhub.io/built-on-ethereum/identity/ERC725/)
- [EIP1077: Executable Signed Messages refunded by the contract](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1077.md)
- [EIP1078: Universal login / signup using ENS subdomains](https://github.com/alexvandesande/EIPs/blob/ee2347027e94b93708939f2e448447d030ca2d76/EIPS/eip-1078.md)
- [EIP1271: Standard Signature Validation Method for Contracts](https://eips.ethereum.org/EIPS/eip-1271)
- [EIP:2126: Signature Type Recognition](https://github.com/ethereum/EIPs/blob/202d578acb76bb4b8d0f46630eff4965ca61c092/EIPS/eip-2126.md)
