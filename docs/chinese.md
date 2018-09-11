## 关于Loopring.js

该开发者文档主要介绍如果使用loopring.js接入路印协议。loopring.js 库可以帮助用户完成以太坊钱包以及接入路印协议开发去中心化交易所功能。loopring.js封装了Loopring Relay的JSON-RPC 接口和SocketIO接口。具体的接口详情见[Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2)。

## 获取

```javascript
 npm install loopring.js --save
```

## 浏览器端使用方法

loopring.js包含UMD规范的版本和CommonJS规范的版本

- ##### UMD 规范包


通过下面的方式引入 loopring.min.js

```javascript
<script src="../node_modules/loopring/dist/loopring.min.js"></script>
```

通过下面的方式获得获得loopring

```javascript
window.loopring.WalletUtils
window.loopring.ContractUtils
window.loopring.RelayRpcUitls
window.loopring.EthRpcUtils
window.loopring.SocketUtils
```

- ##### CommonJS  规范包 

  引用commojs规范包，需要引入 babel-polyfill

```javascript
import loopring from 'loopring.js';
or
import {WalletUtils} from 'loopring.js';
or
const loopring = require('loopring.js');
```

## API

注：API 的使用文档中的代码事例采用CommonJS 使用方式

### WalletUtils

#### createMnemonic()

生成一组英文助记词,根据参数strength的数字决定助记词长度，256 对应24个单词，128 对应12个单词。

##### 参数

- strength number  默认是256

##### 返回值

- mnemonic  string

```javascript
import {WalletUtils} from 'loopring.js'

const mnemonic = WalletUtils.createMnemonic();
// mnemonic: "seven museum glove patrol gain dumb dawn bridge task alone lion check interest hair scare cash sentence diary better kingdom remember nerve sunset move"
```

#### isValidateMnemonic(mnemonic)

验证助记词的合法性

##### 参数

- menmonic  string

##### 返回值

- isValid  bool   

##### 样例代码

```javascript
import {WalletUtils} from 'loopring.js'

const menmonic = "seven museum glove patrol gain dumb dawn bridge task alone lion check interest hair scare cash sentence diary better kingdom remember nerve sunset move";
const isValid = WalletUtils.isValidateMnemonic(mnemonic);
//isValid true
```

#### privateKeytoAddress(privatekey)

通过私钥获取地址

##### 参数

- privatekey  hex string or  Buffer

##### 返回值

- address

##### 代码样例：

```js
import {WalletUtils} from 'loopring.js'
const pKey = "07ae9ee56203d29171ce3de536d7742e0af4df5b7f62d298a0445d11e466bf9e";
WalletUtils.privateKeytoAddress(pkey); //address:0x48ff2269e58a373120FFdBBdEE3FBceA854AC30A
```

#### publicKeytoAddress（publicKey，sanitize）

通过公钥获得地址

##### 参数

- publicKey	hex string  or Buffer
- sanitize           bool 默认是false

##### 返回值

- address

##### 代码样例 

```javascript
import {WalletUtils} from 'loopring.js'
const publicKey = "0895b915149d15148ac4171f453060d6b53a9ebb694689351df8e3a49c109c7a65374b5c196ce8cc35ff79cb3ce54ea1695704dd5b3cfc6864bd110b62cfd509";
WalletUtils.publicKeytoAddress(publicKey)
//address:0x48ff2269e58a373120FFdBBdEE3FBceA854AC30A
```

#### privateKeytoPublic(privatekey)

通过私钥获取公钥

##### 参数

- privateKey hex string Buffer

##### 返回值

- publickey hex string without prefix

##### 代码样例

```javascript
import {WalletUtils} from 'loopring.js'

const privateKey = '07ae9ee56203d29171ce3de536d7742e0af4df5b7f62d298a0445d11e466bf9e';
const publicKey = WalletUtils.privateKeytoPublic(privateKey);
//publicKey:"0895b915149d15148ac4171f453060d6b53a9ebb694689351df8e3a49c109c7a65374b5c196ce8cc35ff79cb3ce54ea1695704dd5b3cfc6864bd110b62cfd509"
```

#### decryptKeystoreToPkey(keystore, password)

通过keystore和password 解锁得到私钥

##### 参数

- keystore    string
- password  string

##### 返回值

- privatekey  Buffer

##### 样例代码

```javascript
import {WalletUtils} from 'loopring.js'

const keystore = "{"version":3,"id":"e603b01d-9aa9-4ddf-a165-1b21630237a5","address":"2131b0816b3ef8fe2d120e32b20d15c866e6b4c1","Crypto":{"ciphertext":"7e0c30a985cf29493486acaf86259a2cb0eb45befb367ab59a0baa7738adf49e","cipherparams":{"iv":"54bbb6e77719a13c3fc2072bb88a708c"},"cipher":"aes-128-ctr","kdf":"scrypt","kdfparams":{"dklen":32,"salt":"50c31e2a99f231b09201494cac1cf0943246edcc6864a91cc931563cd11eb0ce","n":1024,"r":8,"p":1},"mac":"13d3566174d20d93d2fb447167c21a127190d4b9b4843fe7cbebeb6054639a4f"}}";
const password = "1111111";
const privatekey =  WalletUtils.decryptKeystoreToPkey(keystore,password);
```

#### pkeyToKeystore(privateKey, password)

通过privateKey 和 password 获得Keystore

##### 参数

- privateKey     Buffer
- password       string

##### 返回值

- keystore    Object   

##### 样例代码

```javascript
import {WalletUtils} from 'loopring.js'

const privateKey = toBuffer('0x07ae9ee56203d29171ce3de536d7742e0af4df5b7f62d298a0445d11e466bf9e')；
const password = "1111111";
const keystore = WalletUtils.pkeyToKeystore(privateKey,password);
//keystore:{ version: 3,
  id: '2f76ed18-76dd-4186-90c6-c95c71fcff09',
  address: '48ff2269e58a373120ffdbbdee3fbcea854ac30a',
  crypto: 
   { ciphertext: 'ad086c4b4bed193ae4ed2103160829c5c64027b2258110bae86d78be18905463',
     cipherparams: { iv: '32dd303feab25da5e612ffa3676c946f' },
     cipher: 'aes-128-ctr',
     kdf: 'scrypt',
     kdfparams: 
      { dklen: 32,
        salt: '765aa6c750c0a511da0184e9914484a7293a63f5e5817b57ce9bef8ef559b8df',
        n: 262144,
        r: 8,
        p: 1 },
     mac: '33fb274ba8eb91674f0e5957e86784358cf65d9593c4b1e55333299a94249565' } }
```

#### mnemonictoPrivatekey(mnemonic, dpath, password)

解锁助记词得到私钥

##### 参数

- mnemonic    string
- dpath            string
- password     string (optional)

##### 返回值

- privateKey Buffer

##### 样例代码

```javascript
import {WalletUtils} from 'loopring.js'

const mnemonic = "seven museum glove patrol gain dumb dawn bridge task alone lion check interest hair scare cash sentence diary better kingdom remember nerve sunset move"；
const dpath = "m/44'/60'/0'/0/0";
const privateKey = WalletUtils.mnemonictoPrivatekey(mnemonic,dpath);
```

#### fromMnemonic(mnemonic, dpath, password)

##### 参数

- mnemonic   string 
- dpath       string
- password  string  可以为空

##### 返回值

- account   KeyAccount

```javascript
import {WalletUtils} from 'loopring.js'

const mnemonic = "seven museum glove patrol gain dumb dawn bridge task alone lion check interest hair scare cash sentence diary better kingdom remember nerve sunset move";
const dpath = "m/44'/60'/0'/0/0";
const password = "1111111";
const account =  WalletUtils.fromMnemonic(mnemonic,dpath,password);
```

#### fromKeystore(keystone,password)

##### 参数

- keystore  string
- password string 可以为空，根据keystore 是否需要密码解锁而定。

##### 返回值

- account  KeyAccount

##### 代码样例

```javascript
import {WalletUtils} from 'loopring.js'

const keystore = "{"version":3,"id":"e603b01d-9aa9-4ddf-a165-1b21630237a5","address":"2131b0816b3ef8fe2d120e32b20d15c866e6b4c1","Crypto":{"ciphertext":"7e0c30a985cf29493486acaf86259a2cb0eb45befb367ab59a0baa7738adf49e","cipherparams":{"iv":"54bbb6e77719a13c3fc2072bb88a708c"},"cipher":"aes-128-ctr","kdf":"scrypt","kdfparams":{"dklen":32,"salt":"50c31e2a99f231b09201494cac1cf0943246edcc6864a91cc931563cd11eb0ce","n":1024,"r":8,"p":1},"mac":"13d3566174d20d93d2fb447167c21a127190d4b9b4843fe7cbebeb6054639a4f"}}";
const password = "1111111";
const account =  WalletUtils.fromKeystore(keystore,password);
```

#### fromPrivateKey(privateKey)

##### 参数

- privateKey   hex string  Buffer

##### 返回值

- account KeyAccount

##### 代码样例

```javascript
import {WalletUtils} from 'loopring.js'

const privateKey = "07ae9ee56203d29171ce3de536d7742e0af4df5b7f62d298a0445d11e466bf9e";
const account = WalletUtils.fromPrivateKey(privateKey);
```

#### fromLedger(dpath)

##### 参数

- dpath  string

##### 返回值

LedgerAccount 

##### 样例代码

```javascript
import {WalletUtils} from 'loopring.js'

const dpath = "m/44'/60'/0'/0"
try{
const account = await WalletUtils.fromLedger(dpath)    
}catch(e){
    console.log(e.message)
}
```

##### fromTrezor

##### 参数

- dpath  string

##### 返回值

TrezorAccount

##### 样例代码

```javascript
import {WalletUtils} from 'loopring.js'

const dpath = "m/44'/60'/0'/0/0"
const account = await WalletUtils.fromTrezor(dpath)    
```

##### fromMetaMask

##### 参数

- web3  MetaMask 注册在浏览器window下的web3对象

##### 返回值

MetaMaskAccount

##### 样例代码

```javascript
import {WalletUtils} from 'loopring.js'

const dpath = "m/44'/60'/0'/0/0"
const account = await WalletUtils.fromMetaMask(web3)    
```

### ContractUtils

包含ERC20Token，WETH，AirdropContract，LoopringProtocol 4个合约，支持对应合约的ABI的encode和decode操作。

#### encodeInputs(method, inputs)

encode 指定方法的inputs。

##### 参数

- method  string , method如果abi中没有相同methodName的Method，可以是methodName。否则应该传入methodName+传入参数的类型或者methodId。

##### 返回值

- data  hex string

##### 代码样例

```javascript
import {ContractUtils} from 'loopring.js'

const method='transfer' //(transfer(address,uint256) or '0xa9059cbb')
 const _to = "0x88699e7fee2da0462981a08a15a3b940304cc516";
 const _value = "0xde0b6b3a7640000";
 const data = ContractUtils.ERC20Token.encodeInputs(method,{_to,_value})
 //data:"0xa9059cbb000000000000000000000000d91a7cb8efc59f485e999f02019bf2947b15ee1d0000000000000000000000000000000000000000000008ac7230489e80000"
```

#### decodeEncodeInputs(data)

decode 已经encoded 指定method的inputs参数。

##### 参数

- data  hex string   （methodId+ parameters）

##### 返回值

- inputs  Array  

##### 代码样例

```javascript
import {ContractUtils} from 'loopring.js'

const data = "0xa9059cbb000000000000000000000000d91a7cb8efc59f485e999f02019bf2947b15ee1d0000000000000000000000000000000000000000000008ac7230489e80000"；
const inputs = ContractUtils.ERC20Token.decodeEncodeInputs(data);
//inputs:['88699e7fee2da0462981a08a15a3b940304cc516','0xde0b6b3a7640000']
```

#### decodeOutputs(method, data)

decode 指定method的outputs 。

##### 参数

- method  string , method如果abi中没有相同methodName的Method，可以是methodName。否则应该传入methodName+inputs的类型或者methodId。

##### 返回值

- outputs   Array  

##### 代码样例

```javascript
import {ContractUtils} from 'loopring.js'

const method = 'balanceOf'
const data = '0x000000000000000000000000000000000000000000e6cbc4f6ec6156401801fc';
const outputs = ContractUtils.ERC20Token.decodeOutputs(method, data);
//outputs:['0xe6cbc4f6ec6156401801fc']
```

LoopringProtocol 封装实现了encodECancelOrder, encodeSubmitRing

#### encodeCancelOrder(signedOrder, amount)

取消指定amount数量的订单可成交量。如果amount 超过订单可成家量，则订单记为完全取消。

##### 参数

- signedOrder
  - protocol    address      路印撮合协议地址，例如 1.5.1版本：0x8d8812b72d1e4ffCeC158D25f56748b7d67c1e78
  - delegate   address      路印协议授权地址，例如 1.5.1 版本 ：0x17233e07c67d086464fD408148c3ABB56245FA64
  - owner       address        订单拥有者，即下单用户的地址
  - tokenS      address         要卖出币种的合约地址
  - tokenB      address         要买入币种的合约地址
  - authAddr   address      随机生成账户对应地址
  - authPriavteKey    privatekey    随机生成账户对应私钥
  - validSince    hex string    订单生效时间，时间戳—秒数。 
  - validUntil     hex string    订单失效时间， 时间戳—秒数。
  - amountB     hex string    要购买的tokenB的数量（这里以最小单位作为单位）
  - amountS     hex string    要出售的tokenS的数量（这里以最小单位作为单位） 
  - walletAddress   address  钱包的订单撮合费收益接收地址
  - buyNoMoreThanAmountB   bool  是不是允许购买超过amountB数量的tokeB
  - lrcFee           hex string    订单完全撮合最多需要支付的撮合费。（这里以LRC的最小单位作单位）
  - marginSplitPercentage   number(0–100)  撮合分润中用来支付撮合费的比例
  - v               number
  - r               hex string
  - v              hex string
  - powNonce  number     满足难度系数的随机数
  - amount  number or hex string  要取消的数量 ，默认为订单全量

##### 返回值

- data    hex string

##### 代码样例

```javascript
const signedOrder = {
  "delegateAddress": "0x17233e07c67d086464fD408148c3ABB56245FA64",
  "protocol": "0x8d8812b72d1e4ffCeC158D25f56748b7d67c1e78",
  "owner": "0xb94065482ad64d4c2b9252358d746b39e820a582",
  "tokenB": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  "tokenS": "0xEF68e7C694F40c8202821eDF525dE3782458639f",
  "amountB": "0x429d069189e0000",
  "amountS": "0xad78ebc5ac6200000",
  "lrcFee": "0x928ca80cfc20000",
  "validSince": "0x5b038122",
  "validUntil": "0x5b04d2a2",
  "marginSplitPercentage": 50,
  "buyNoMoreThanAmountB": false,
  "walletAddress": "0xb94065482ad64d4c2b9252358d746b39e820a582",
  "authAddr": "0x5b98dac691be2f2882bfb79067ee50c221d20203",
  "authPrivateKey": "89fb80ba23d355686ff0b2093100af2d6a2ec071fe98c33252878caeab738e37",
  "v": 28,
  "r": "0xbdf3c5bdeeadbddc0995d7fb51471e2166774c8ad5ed9cc315635985c190e573",
  "s": "0x4ab135ff654c3f5e87183865175b6180e342565525eefc56bf2a0d5d5c564a73",
  "powNonce": 100
};
const data = LoopringProtocol.encodeCancelOrder(signedOrder);
//data : 
"0x8c59f7ca000000000000000000000000b94065482ad64d4c2b9252358d746b39e820a582000000000000000000000000ef68e7c694f40c8202821edf525de3782458639f000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000b94065482ad64d4c2b9252358d746b39e820a5820000000000000000000000005b98dac691be2f2882bfb79067ee50c221d2020300000000000000000000000000000000000000000000000ad78ebc5ac62000000000000000000000000000000000000000000000000000000429d069189e0000000000000000000000000000000000000000000000000000000000005b038122000000000000000000000000000000000000000000000000000000005b04d2a20000000000000000000000000000000000000000000000000928ca80cfc2000000000000000000000000000000000000000000000000000ad78ebc5ac620000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000032000000000000000000000000000000000000000000000000000000000000001cbdf3c5bdeeadbddc0995d7fb51471e2166774c8ad5ed9cc315635985c190e5734ab135ff654c3f5e87183865175b6180e342565525eefc56bf2a0d5d5c564a73"
```

#### encodeSubmitRing(orders,feeRecipient, feeSelections)

##### 参数

- orders                  order[]
- feeRecipient       address
- feeSelections     number[]          (0 代表选择分润，1代表选择lrcFee，默认为1)

##### 返回值

- data                     hex string

### EthRpcUtils

实现部分Ethereum jsonrpc 接口

#### 构造方法

##### 参数

- host  string

##### 样例代码

```javascript
import {EthRpcUtils} from 'loopring.js'

const host = 'localhost:8545';
const ethRpcUtils = new EthRpcUtils(host);
```

#### getTransactionCount({address,tag})

获得指定地址的transactionCount

详情参考[Ethereum Jsonrpc eth_getTransactionCount接口](https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_gettransactioncount) 

##### 样例代码

```javascript
const address= "0xb94065482ad64d4c2b9252358d746b39e820a582";
const tag = "latest"
ethRpcUtils.getTransactionCount({address,tag})
```

#### sendRawTransaction(signTx)

向以太坊节点发送签名交易

详情参考 [Ethereum JSON-RPC eth_sendRawTransaction 接口](https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_sendrawtransaction)

#### getGasPrice()

获得Ethereum 网络的平均gas price

详情参考 [Ethereum JSON-RPC eth_gasPrice 接口](https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_gasprice)

#### getAccountBalance({address,tag})

查询指定address 的Ethereum 余额

详情参考 [Ethereum JSON-RPC eth_getBalance 接口](https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_getbalance)

#### getTransactionByhash(hash)

获得指定hash的transaction详情

详情参考 [Ethereum JSON-RPC eth_getTransactionByHash 接口](https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_gettransactionbyhash)

#### call({tx,tag})

模拟执行一条tx

详情参考 [Ethereum JSON-RPC eth_call 接口](https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_call)

### RelayRpcUtils

#### 构造方法

##### 参数

- host    Loopring Relay host

##### 样例代码

```javascript
import {RelayRpcUtils} from 'loopring.js'

const host = "localhost:8080"
const relayRpcUtils = new RelayRpcUtils(host)
```

RelayRpcUtils 包含account、market、ring、 order四个部分对象，分别实现了relay rpc对应部分的结构，以下是具体的接口。

account 相关接口

------

#### getBalance({delegateAddress, owner})

获取指定owner的账户余额，以及对路印delegateAddress的授权值。

详情参考[Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getbalance)

##### 代码样例

```javascript
const owner = "0x88699e7fee2da0462981a08a15a3b940304cc516";
const delegataAddress = "0x17233e07c67d086464fD408148c3ABB56245FA64";
const response = relayRpcUtils.account.getBalance({owner,delegataAddress});
```

#### register(owner)

向relay注册指定的owner地址。注册以后，relay会解析存储该地址的相关Ethereum txs。

详情参考[Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_unlockwallet)

#### notifyTransactionSubmitted({txHash, rawTx, from})

通知Relay 已经发送的以太坊tx。relay会跟踪tx的状态。

详情参考[Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_notifytransactionsubmitted)

#### getTransactions({owner, status, txHash, pageIndex, pageSize})

获取指定owner的以太坊txs

详情参考[Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_gettransactions)

#### getFrozenLrcFee(owner)

获得指定Owner的有效订单需要的LRC Fee的总和。

详情参考[Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getgetfrozenlrcfee)

#### getPortfolio(owner)

获得指定owner 地址的portfolio

详情参考 [Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getportfolio)

market相关接口

------

#### getPriceQuote(currency)

获得Relay支持的所有token的指定Currency的价格

详情参考[Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getpricequote)

#### getSupportedMarket()

获得Relay支持的所有市场

详情参考 [Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getsupportedmarket)

#### getSupportedTokens()

获得Relay支持的所有token

详情参考 [Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getsupportedtokens)

#### getDepth(filter)

获得市场的深度

 详情参考 [Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getdepth)

#### getTicker()

获得Loopring 所有市场的24小时合并的成交统计

详情参考 [Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getticker)

#### getTickers(market)

获得注定市场多个交易所24小时合并的成交统计

详情参考 [Loopring Relay的接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_gettickers)

#### getTrend({market, interval})

获得多个交易所指定市场在指定interval的价格变化等趋势信息

详情参考[Loopring Relay 的接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_gettrend)

order相关接口

------

#### getOrders(filter)

获得路印的订单列表

详情参考[Loopring Relay 的接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getorders)

#### getCutoff({address, delegateAddress, blockNumber})

获得注定address，在对应loopring 的delegateAddress 的cut off 时间戳。 cut off 对应时间之前的订单会被取消。

详情参考[ Loopring Relay的接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getcutoff)

#### placeOrder(order)

提交订单到Loopring Relay

详情参考[Loopring Relay的接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_submitorder)

#### getOrderHash(order)

计算orderHash

ring相关接口

------

#### getRings(fiter)

获得已经撮合的环路

详情参考 [Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getringmined)

#### getRingMinedDetail({ringIndex, delegateAddress})

获得ring的详细信息

详情参考 [Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getRingMinedDetail)

#### getFills(filter)

获取订单撮合历史记录

详情参考 [Loopring Relay 接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2#loopring_getfills)

### SocketUtils

Loopring Relay 使用socket.io 实现Web Socket。Loopring Relay 的socket 事件列表详情见[Loopring Relay接入文档](https://loopring.github.io/relay-cluster/relay_api_spec_v2)

#### 构造方法

连接指定url的socket 服务器，详情参考 [socket.io_client api 文档](https://github.com/socketio/socket.io-client/blob/master/docs/API.md#iourl-options)

##### 参数

- url            string
- options    object  (可选)

##### 代码样例

```javascript
import {SocketUtils} from 'loopring.js'
const url = 'ws://relay.loopring'
const options= {transports: ['websocket']};
const socketUtils = new SocketUtils(url,options)
```

#### emit ( event, options)

向relay发送一条消息，开始监听指定的event或者更新指定事件的条件

##### 参数

- event string 
- options  string(json)  event 的参数

##### 代码样例

```javascript
cosnt event = 'portfolio_req';
const options = '{"owner" : "0x847983c3a34afa192cfee860698584c030f4c9db1"}';
socketUtils.emit(event,options)
```

#### on(event,handle)

监听指定event 的数据返回

##### 参数

- event     string
- handle  function  处理返回的数据

##### 代码样例

```javascript
const event = "portfolio_res"
const handle = (data)=> {console.log(data)}
socketUtils.on(event,handle);
```

#### close()

手动断开socket连接

##### 代码样例

```javascript
socketUtils.close()
```