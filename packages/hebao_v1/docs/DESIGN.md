# DESIGN DOC

## 钱包和模块

钱包设计的一个目标就是在功能上具有可扩展性，这样将来添加新的功能或者升级已有的功能就无需重新部署新版本。目前的设计主要围绕着两个核心概念。

### Wallet

Wallet 是我们智能钱包的基础合约，用来真正存储用户的资产。

每个 Wallet 必须有一个 owner，这个 owner 可以是以太坊的外部地址（Externally Owned Account，简称 EOA)，也可以是任意的支持 EIP1271 的合约地址。由于 Wallet 本身已经支持了 EIP1271，因此一个 Wallet 的 owner 甚至可以是另外一个 Wallet。Wallet 在设置新的 owner 的时候不会减产新的 owner 是否真的支持 EIP1271，原因是即使设置错误，也可以通过守护人重置 owner。这个后面会讲到。

Wallet 提供的方法几乎都是和 Module 相关，钱包的几乎所有功能都是通过不同的 Module 实现的。当钱包被创建的时候，除了必须制定 owner 地址外，还必须提供一个默认的 Module 列表，原因是后续添加和移除 Module，必须通过调用`Wallet.addModule`方法来实现，而这个方法要求它的 msg.sender 必须是一个现有的 Module。这也意味着一个钱包的 Module 列表不能为空，否则就无法添加更多的 Module 了。

### Module

钱包的功能按照 Module 做切割，每个 module 相对都比较小巧，保障维护成本较低。每个钱包在生成后，会自动绑定一些默认的 Module，后续钱包可以发交易增加新的或者去掉已有的 Module，但每个 Module 必须是预注册的，也就意味着 Module 必须由我们来批准，不能是任意合约。

每个 Module 可以提供两类不同的方法，**读方法**和**写方法**。读方法可以通过 Wallet 的`bindStaticMethod`绑定到钱包。每个 Module 都会提供一个`staticMethods`方法，来告诉钱包它提供哪些读方法。当 Module 被加到一个钱包时候，所有的读方法就会自动被绑定到该钱包；当 module 被从一个钱包移除时，绑定的读方法就会被解绑。

假设`getABC`这个只读方法在 Module A 当中并且被绑定到了某个钱包，那么当这个钱包被调用`getABC`的时候，这个调用就会自动被转给 Module A。通过这种静态绑定，我们可以为钱包添加更多的读方法。值得注意的是，不同的 Module 的读方法如果要绑定到 Wallet，必须保证方法名称的全局唯一性，否则绑定就会失败，钱包就无法创建成功。

![AddModule](./images/add_module.png|width=100)

写方法就不能绑定了。如果需要钱包`X`调用一个第三方合约`C`的某个写方法`doSomething`，需要钱包`X`的 owner 作为 msg.sender，发交易给某个支持`C`的 Module（比如`QuotaTransfers` 和`ApprovedTransfers`模块），由这个 Module 验证权限（msg.sender == owner 或者 data 的签名是 owner），然后 Module 再调用钱包`X`的`transact`方法，然后把具体怎样调用`C`作为数据传给`transact`。 下面举个例子：

## 元交易和验签

### 安全

### 守护人

### 钱包锁定

### 限额与交易批准

### 基于时间锁的继承

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
- Uinswap

### 博彩

- PoolTogether

## 几个和钱包相关的重要 EIPs

- [EIP:681: URL Format for Transaction Requests](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-681.md)
- [EIP725 : Ethereum Identity Standard](https://docs.ethhub.io/built-on-ethereum/identity/ERC725/)
- [EIP1077: Executable Signed Messages refunded by the contract](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1077.md)
- [EIP1078: Universal login / signup using ENS subdomains](https://github.com/alexvandesande/EIPs/blob/ee2347027e94b93708939f2e448447d030ca2d76/EIPS/eip-1078.md)
- [EIP1271: Standard Signature Validation Method for Contracts](https://eips.ethereum.org/EIPS/eip-1271)
