### 1.合约地址
```
ethereum
  paymaster:0x7A1a1475b8B0204606a57DbFCAc4f9A52191b825
  owner:0xd5b7ee6146E87DC85450c9a761f843855a10c696
  signer:0xE6FDa200797a5B8116e69812344cE7D2A9F17B0B
taiko
  paymaster:0x5254727Db658c217b7233A6AcAE8D2EC460D896B
  owner:0xd5b7ee6146E87DC85450c9a761f843855a10c696 
  signer:0xE6FDa200797a5B8116e69812344cE7D2A9F17B0B
```

### 2. 操作
#### 1. 配paymasterAndData的签名eoa
owner发起
`grantRole ($SIGNER, $eoa)  // SIGNER:0x2aeb38be3df14d720aeb10a2de6df09b0fb3cd5c5ec256283a22d4593110ca40`
#### 2. 添加paymaster支持的token
owner发起   
`addToken($token)`
#### 3. paymaster 往entrypoint预存ETH
任何地址都能发起   
`deposit()` 
#### 4. paymaster 从entrypoint提取ETH
owner发起   
`withdrawTo($withdrawAddress, $amount)` 
#### 5. paymaster 提取token
owner发起   
```
1. unlockTokenDeposit()  // 记录sender at blockNumber
2. withdrawTokensTo($token, $target, $amount)  // sender 在下一个block执行，把$token transfer到$target 地址
```
