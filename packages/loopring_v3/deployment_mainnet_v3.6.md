# Deployment info for Loopring V3.6

- release url: https://github.com/Loopring/protocols/releases/tag/Loopring_3.6.0_beta
- deployer: 0x4374D3d032B3c96785094ec9f384f07077792768
- operator(has access to submitBlocks): 0x81a48f7BB0b8FCE3db9FAf013D63963aE4948c1D
- operator 2: 0x2b263f55Bf2125159Ce8Ec2Bb575C649f822ab46

## contract addresses

- BlockVerifier: 0x6150343E0F43A17519c0327c41eDd9eBE88D01ef
  - ~~blockVersion: 13~~
  - ~~blockVersion: 14 (udated at 2021-01-11)~~
  - blockVersion: 16 (udated at 2021-03-25)
  - blockSizes: 16, 64, 128, 256, 384
- AgentRegistry: 0x39B9bf169a7e225ba037C443A40460c77438ea14
- FastWithdrawalAgent: 0xec3Cc6Cf0252565b56FC7AC396017Df5b9B78a31
- LoopringV3: 0xe56D6ccab6551932C0356E4e8d5dAF0630920C71
  params:
  - lrcAddr: 0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD
  - protocolFeeVault: 0x4b89f8996892d137c3dE1312d1dD4E4F4fFcA171
  - BlockVerifier: 0x6150343E0F43A17519c0327c41eDd9eBE88D01ef
- ProtocolFeeVaultAddress: 0x4b89f8996892d137c3dE1312d1dD4E4F4fFcA171
- Exchange Libs:

  - ~~ExchangeBalances:0x6CE48C5E1C6391F6877da7502a0d8621727eA441~~
  - ~~ExchangeAdmins:0x919551E7c778539f6238E3483358a2aFbDaa83c9~~
  - ~~ExchangeTokens:0x432bcD4fAdE6e54F8b0773546AF44BF7C90fa7F6~~
  - ~~ExchangeWithdrawals:0x4d6924ac10b840a17ac841b2e3d446C9e0d88d68~~
  - ~~ExchangeBlocks:0x17d3efeEF8e9d254a9E68b27386Bd9Beb9addf3b~~
  - ~~ExchangeBlocks: 0xb01E1B1eE285C16429e750aca67546d5Bcc797F3~~
  - ~~ExchangeGenesis:0xA2f3346c484aC1F55ef468fd2fE427B9730aFb9f~~

- [ExchangeV3Proxy: 0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4](https://etherscan.io/address/0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4)
- ~~ExchangeV3: 0xa01d4d1FE18A34902Ac2e4045a5e8f553dDe9685~~
- ~~ExchangeV3: 0x2fefbeF4d1445F523941c56349C2414cd5e9675d~~
- [DefaultDepositContract: 0x674bdf20A0F284D710BC40872100128e2d66Bd3f](https://etherscan.io/address/0x674bdf20A0F284D710BC40872100128e2d66Bd3f)
- ~~LoopringIOExchangeOwner: 0x5c367c1b2603ed166C62cEc0e4d47e9D5DC1c073~~

- Amm:

  - ~~AmmJoinRequest: 0xD86eCD9dc3C18e1d202C63941CAcb85ec9fAdf83~~
  - ~~AmmExitRequest: 0x643Caf6bb68986CD17f71E225C8E264378bfccE5~~
  - ~~AmmStatus: 0xaae0a0515609723F66a38e6fE9e3455e7897143a~~
  - ~~AmmWithdrawal: 0xb971902d99e1f94f02Cc19e6BEC73Cf3d38c16B3~~
  - LoopringAmmSharedConfig: 0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D
  - ~~LoopringAmmPool: 0xEE017DF188362F8620058e6CeF56D0e65b872164~~
  - ~~LoopringAmmPool: 0xcc2e3d2DC1fd6Ce145e1124868fda5B2a0592cc5~~

### ~~UPDATE-20210115~~

- ~~[LoopringIOExchangeOwner: 0x42bC1aB51b7aF89CfAA88A7291CE55971d8cB83a](https://etherscan.io/address/0x42bC1aB51b7aF89CfAA88A7291CE55971d8cB83a)~~
- ~~ExchangeV3: 0x8c63D8E608fF702a92D5908730C91457b0447Ad7~~
- ~~LoopringAmmPool: 0xE6AbFcABE24F06197a7A20dc9c81c251f2862430~~

### UPGRADE-2021-03-25


- [LoopringIOExchangeOwner: 0x153CdDD727e407Cb951f728F24bEB9A5FaaA8512](https://etherscan.io/address/0x153CdDD727e407Cb951f728F24bEB9A5FaaA8512)
- ~~ExchangeV3(implementation): 0xCFba78aecfBcc0B4B748fA58c530D4675BB5D32F~~
- ExchangeV3(implementation): 0x4fb117dcd6d09abf1a99b502d488a99f5a17e7ec
- LoopringAmmPool(implementation): 0xCAC49516e6E1c79a62BD67E4D87F7E0d80858258

### UPDATE-20210310

- ForcedWithdrawalAgent: [0x52ea1971C05B0169c02a0bBeC05Fe8b5E3A24470](https://etherscan.io/address/0x52ea1971C05B0169c02a0bBeC05Fe8b5E3A24470)

---

- AmmPools:

  1. LRC-ETH pool: 0x18920d6E6Fb7EbE057a4DD9260D6D95845c95036

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-LRC-ETH',
    accountID: 1,
    tokens: [
      '0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-LRC-ETH'
  }
  ```

  4. ETH-USDT pool: 0x605872a5A459E778959B8a49dc3A56a8c9197983

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-ETH-USDT',
    accountID: 4,
    tokens: [
      '0x0000000000000000000000000000000000000000',
      '0xdac17f958d2ee523a2206206994597c13d831ec7'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-ETH-USDT'
  }
  ```

  5. WBTC-ETH pool: 0xf6cd964E6345E8f01e548063De13d0DE7d8c59De

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-WBTC-ETH',
    accountID: 5,
    tokens: [
      '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-WBTC-ETH'
  }
  ```

  6. UNI-ETH pool: 0x9b7a20ae12a3f2a3d4cF9eA2d4a8518c104cc5f2

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-UNI-ETH',
    accountID: 6,
    tokens: [
      '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-UNI-ETH'
  }
  ```

  7. DPI-ETH pool: 0x6FF8A397F7A04B41c58c00AB8e70ACa7cbc0adBa

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-DPI-ETH',
    accountID: 7,
    tokens: [
      '0x1494CA1F11D487c2bBe4543E90080AeBa4BA3C2b',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-DPI-ETH'
  }
  ```

  8. LINK-ETH pool: 0x1230F7e06c3fA96f4259F7BaD79e6afF321B8133

  ```
    {
      sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
      exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
      poolName: 'AMM-LINK-ETH',
      accountID: 8,
      tokens: [
        '0x514910771af9ca656af840dff83e8264ecf986ca',
        '0x0000000000000000000000000000000000000000'
      ],
      weights: [ 1000000, 1000000 ],
      feeBips: 20,
      tokenSymbol: 'LP-LINK-ETH'
    }
  ```

  9. KP3R-ETH pool: 0x2ed5d3Fff0EB1451c381DDECE244E9b796db7b8a

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-KP3R-ETH',
    accountID: 9,
    tokens: [
      '0x1ceb5cb57c4d4e2b2433641b95dd330a33185a44',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-KP3R-ETH'
  }
  ```

  10. YFI-ETH pool: 0xd85f594481D3DEE61FD38464dD54CF3ccE6906b6

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-YFI-ETH',
    accountID: 10,
    tokens: [
      '0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-YFI-ETH'
  }
  ```

  11. YFII-ETH pool: 0xF8e4aBF498235fA8fdE2f6A04c21db7877957C47

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-YFII-ETH',
    accountID: 11,
    tokens: [
      '0xa1d0e215a23d7030842fc67ce582a6afa3ccab83',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-YFII-ETH'
  }
  ```

  12. MCB-ETH: 0x70c8E0AedB5933Da09C9392A17389e4D6d79D638

  ```
    {
      sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
      exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
      poolName: 'AMM-MCB-ETH',
      accountID: 12,
      tokens: [
        '0x4e352cF164E64ADCBad318C3a1e222E9EBa4Ce42',
        '0x0000000000000000000000000000000000000000'
      ],
      weights: [ 1000000, 1000000 ],
      feeBips: 20,
      tokenSymbol: 'LP-MCB-ETH'
    }
  ```

  13. AC-ETH: 0x8EFAD07720D331a49f5db2cC83946F7DC8FC6B42

  ```
  {
  sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
  exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
  poolName: 'AMM-AC-ETH',
  accountID: 13,
  tokens: [
    '0x9A0aBA393aac4dFbFf4333B06c407458002C6183',
    '0x0000000000000000000000000000000000000000'
  ],
  weights: [ 1000000, 1000000 ],
  feeBips: 20,
  tokenSymbol: 'LP-AC-ETH'
  }
  ```

  14. ETH-DAI: 0xD9D681C1ddD462ca222E90Bbe14A35273C318A09

  ```
  {
  sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
  exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
  poolName: 'AMM-ETH-DAI',
  accountID: 14,
  tokens: [
    '0x0000000000000000000000000000000000000000',
    '0x6B175474E89094C44Da98b954EedeAC495271d0F'
  ],
  weights: [ 1000000, 1000000 ],
  feeBips: 20,
  tokenSymbol: 'LP-ETH-DAI'
  }
  ```

  15. LRC-USDT: 0xE6CC0d45C4E4F81be340F4D176e6Ce0D63Ad5743

  ```
  {
  sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
  exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
  poolName: 'AMM-LRC-USDT',
  accountID: 15,
  tokens: [
    '0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD',
    '0xdac17f958d2ee523a2206206994597c13d831ec7'
  ],
  weights: [ 1000000, 1000000 ],
  feeBips: 20,
  tokenSymbol: 'LP-LRC-USDT'
  }
  ```

  16. HBTC-USDT: 0x746EEB6bdd9139A4d605C2c410911F37BEa9093b

  ```
   {
  sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
  exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
  poolName: 'AMM-HBTC-USDT',
  accountID: 16,
  tokens: [
    '0x0316EB71485b0Ab14103307bf65a021042c6d380',
    '0xdac17f958d2ee523a2206206994597c13d831ec7'
  ],
  weights: [ 1000000, 1000000 ],
  feeBips: 20,
  tokenSymbol: 'LP-HBTC-USDT'
  }
  ```

  17. 1INCH-ETH: 0xa9D46DEdEff7dFe8fF3628F4D276a0e1C5007b81

  ```
  {
  sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
  exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
  poolName: 'AMM-1INCH-ETH',
  accountID: 17,
  tokens: [
    '0x111111111117dC0aa78b770fA6A738034120C302',
    '0x0000000000000000000000000000000000000000'
  ],
  weights: [ 1000000, 1000000 ],
  feeBips: 20,
  tokenSymbol: 'LP-1INCH-ETH'
  }
  ```

  18. AC-USDT: 0x502B5525e1508C51Af46719D13E5238b83A404e5

  ```
  {
  sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
  exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
  poolName: 'AMM-AC-USDT',
  accountID: 18,
  tokens: [
    '0x9A0aBA393aac4dFbFf4333B06c407458002C6183',
    '0xdac17f958d2ee523a2206206994597c13d831ec7'
  ],
  weights: [ 1000000, 1000000 ],
  feeBips: 20,
  tokenSymbol: 'LP-AC-USDT'
  }
  ```

  19. VETH-ETH： 0x9795f527d0Fad45F41dE27bef71F0eeD47f5256C

  ```
  {
  sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
  exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
  poolName: 'AMM-VETH-ETH',
  accountID: 19,
  tokens: [
    '0xc3d088842dcf02c13699f936bb83dfbbc6f721ab',
    '0x0000000000000000000000000000000000000000'
  ],
  weights: [ 1000000, 1000000 ],
  feeBips: 20,
  tokenSymbol: 'LP-VETH-ETH'
  }
  ```

  20. WOO-USDT: 0x1D28b287B5E19b12Ac2B3618405C57AD882A4D74

  ```
  {
  sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
  exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
  poolName: 'AMM-WOO-USDT',
  accountID: 20,
  tokens: [
    '0x4691937a7508860F876c9c0a2a617E7d9E945D4B',
    '0xdac17f958d2ee523a2206206994597c13d831ec7'
  ],
  weights: [ 1000000, 1000000 ],
  feeBips: 20,
  tokenSymbol: 'LP-WOO-USDT'
  }
  ```

  21. HBTC-ETH: 0x1F78CD24Ccf73fDd5095d0339DD6eF72E30669aC

  ```
  {
  sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
  exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
  poolName: 'AMM-HBTC-ETH',
  accountID: 21,
  tokens: [
    '0x0316EB71485b0Ab14103307bf65a021042c6d380',
    '0x0000000000000000000000000000000000000000'
  ],
  weights: [ 1000000, 1000000 ],
  feeBips: 20,
  tokenSymbol: 'LP-HBTC-ETH'
  }
  ```

  22. ETH-USDC: 0xF88de0CCD1E84898b4EA62c421009996bFb6156e

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-ETH-USDC',
    accountID: 22,
    tokens: [
      '0x0000000000000000000000000000000000000000',
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-ETH-USDC'
  }
  ```

  23. CEL-ETH: 0x93bB5B402F04D3053F2c3800F6A4AF54788c16d0

  ```
  {
  sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
  exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
  poolName: 'AMM-CEL-ETH',
  accountID: 23,
  tokens: [
    '0xaaaebe6fe48e54f431b0c390cfaf0b017d09d42d',
    '0x0000000000000000000000000000000000000000'
  ],
  weights: [ 1000000, 1000000 ],
  feeBips: 20,
  tokenSymbol: 'LP-CEL-ETH'
  }
  ```

  24. BEL-ETH: 0x567c1ad6d736755abcb3df8ef794b09bb7701e66

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-BEL-ETH',
    accountID: 24,
    tokens: [
      '0xa91ac63d040deb1b7a5e4d4134ad23eb0ba07e14',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-BEL-ETH'
  }
  ```

  25. OBTC-ETH: 0x85f2e9474d208a11ac18ed2a4e434c4bfc6ddbde

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-OBTC-ETH',
    accountID: 25,
    tokens: [
      '0x8064d9ae6cdf087b1bcd5bdf3531bd5d8c537a68',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-OBTC-ETH'
  }
  ```

  26. ENJ-ETH: 0x1b04a25a0a7f93cfb0c4278ca4f7ca2483a1e94e

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-ENJ-ETH',
    accountID: 26,
    tokens: [
      '0xf629cbd94d3791c9250152bd8dfbdf380e2a3b9c',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-ENJ-ETH'
  }
  ```

  27. NIOX-ETH: 0x8cf6c5e7ec123583e1529d8afaeaa3d25da2fd3d

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-NIOX-ETH',
    accountID: 27,
    tokens: [
      '0xc813EA5e3b48BEbeedb796ab42A30C5599b01740',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-NIOX-ETH'
  }
  ```

  28. AMP-ETH: 0x0aa4d2dd35418d63af13ea906ce3a088dec8d786

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-AMP-ETH',
    accountID: 28,
    tokens: [
      '0xff20817765cb7f73d4bde2e66e067e58d11095c2',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-AMP-ETH'
  }
  ```

  29. INDEX-ETH: 0x0089081950b4ebbf362689519c1d54827e99d727

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-INDEX-ETH',
    accountID: 29,
    tokens: [
      '0x0954906da0bf32d5479e25f46056d22f08464cab',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-INDEX-ETH'
  }
  ```

  30. GRT-ETH: 0x583208883277896435b9821a64806d708de17df2

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-GRT-ETH',
    accountID: 30,
    tokens: [
      '0xc944E90C64B2c07662A292be6244BDf05Cda44a7',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-GRT-ETH'
  }
  ```

  31. KEEP-ETH: 0x4e585bad734f0c6af04a3afb359fdb69435fe74b

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-KEEP-ETH',
    accountID: 31,
    tokens: [
      '0x85Eee30c52B0b379b046Fb0F85F4f3Dc3009aFEC',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-KEEP-ETH'
  }
  ```

  32. DXD-ETH: 0x9387e06961988726dd0732b6930be1c0a5343901

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-DXD-ETH',
    accountID: 32,
    tokens: [
      '0xa1d65E8fB6e87b60FECCBc582F7f97804B725521',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-DXD-ETH'
  }
  ```

  33. ~~TRB-ETH: 0xe8ea36f850db564408e4165a92bccb4e6e5f5e20~~

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-TRB-ETH',
    accountID: 33,
    tokens: [
      '0x0Ba45A8b5d5575935B8158a88C631E9F9C95a2e5',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-TRB-ETH'
  }
  ```

  34. RPL-ETH: 0x33df027650cd2729e0b132fc0bff4788725cc0fa

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-RPL-ETH',
    accountID: 34,
    tokens: [
      '0xB4EFd85c19999D84251304bDA99E90B92300Bd93',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-RPL-ETH'
  }
  ```

  35. PBTC-ETH: 0x22844c482b0626ac09b5689b4d8e81fe6710f5f4

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-PBTC-ETH',
    accountID: 35,
    tokens: [
      '0x5228a22e72ccC52d415EcFd199F99D0665E7733b',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-PBTC-ETH'
  }
  ```

  36. COMP-ETH: 0x9c601377fd95410be46cfc1a786686874c6e7702

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-COMP-ETH',
    accountID: 36,
    tokens: [
      '0xc00e94Cb662C3520282E6f5717214004A7f26888',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-COMP-ETH'
  }
  ```

  37. PNT-ETH: 0x43eca2f58d8c371c5073fc382784a3a483005d6b

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-PNT-ETH',
    accountID: 37,
    tokens: [
      '0x89ab32156e46f46d02ade3fecbe5fc4243b9aaed',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-PNT-ETH'
  }
  ```

  38. PNK-ETH: 0x78a58558ca76cf66b6c4d72231cf6529ed5bef29

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-PNK-ETH',
    accountID: 38,
    tokens: [
      '0x93ed3fbe21207ec2e8f2d3c3de6e058cb73bc04d',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-PNK-ETH'
  }
  ```

  39. NEST-ETH: 0xba64cdf65aea36ff4a58dcf288f1a62923555795

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-NEST-ETH',
    accountID: 39,
    tokens: [
      '0x04abeda201850ac0124161f037efd70c74ddc74c',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-NEST-ETH'
  }
  ```

  40. BTU-ETH: 0x73b7bc4463263194eb9b570948fda12244a5ffa8

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-BTU-ETH',
    accountID: 40,
    tokens: [
      '0xb683D83a532e2Cb7DFa5275eED3698436371cc9f',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-BTU-ETH'
  }
  ```

  41. BZRX-ETH: 0xaced28432cd60d7d34799de0d745871e5f10f961

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-BZRX-ETH',
    accountID: 41,
    tokens: [
      '0x56d811088235F11C8920698a204A5010a788f4b3',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-BZRX-ETH'
  }
  ```

  42. GRID-ETH: 0xa762d8422237bd26b4f882c5d0744726eb2a86b0

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-GRID-ETH',
    accountID: 42,
    tokens: [
      '0x12B19D3e2ccc14Da04FAe33e63652ce469b3F2FD',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-GRID-ETH'
  }
  ```

  43. RENBTC-ETH: 0x636a3141d48402d06a907aa14f023e8f5b5d634f

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-RENBTC-ETH',
    accountID: 43,
    tokens: [
      '0xEB4C2781e4ebA804CE9a9803C67d0893436bB27D',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-RENBTC-ETH'
  }
  ```

  44. GRG-ETH: 0x37b6aad464e8916dc8231ae5f8aee15dd244c1b1

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-GRG-ETH',
    accountID: 44,
    tokens: [
      '0x4fbb350052bca5417566f188eb2ebce5b19bc964',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-GRG-ETH'
  }
  ```

  45. CRV-ETH: 0x2eab3234ea1e4c9571c2e011f435c7316ececdb9

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-CRV-ETH',
    accountID: 45,
    tokens: [
      '0xD533a949740bb3306d119CC777fa900bA034cd52',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-CRV-ETH'
  }
  ```

  46. BUSD-ETH: 0x8303f865a2a221c920e9fcbf2e84703991f16251

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-BUSD-ETH',
    accountID: 46,
    tokens: [
      '0x4fabb145d64652a948d72533023f6e7a623c7c53',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-BUSD-ETH'
  }
  ```

  47. BAND-ETH: 0xf11702d591303d790c7b372e53fde348b82037de

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-BAND-ETH',
    accountID: 47,
    tokens: [
      '0xba11d00c5f74255f56a5e366f4f77f5a186d7f55',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-BAND-ETH'
  }
  ```

  48. OGN-ETH: 0x8e89790635dbffdcc0642055cb21abe63edc484c

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-OGN-ETH',
    accountID: 48,
    tokens: [
      '0x8207c1ffc5b6804f6024322ccf34f29c3541ae26',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-OGN-ETH'
  }
  ```

  49. ADX-ETH: 0x1f94eaaa413c11bea645ee65108b5673304753bd

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-ADX-ETH',
    accountID: 49,
    tokens: [
      '0xADE00C28244d5CE17D72E40330B1c318cD12B7c3',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-ADX-ETH'
  }
  ```

  50. PLTC-ETH: 0xfb64c2d72e1caa0286899be8e4f88266c4d8ab9f

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-PLTC-ETH',
    accountID: 50,
    tokens: [
      '0x5979f50f1d4c08f9a53863c2f39a7b0492c38d0f',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-PLTC-ETH'
  }
  ```

  51. QCAD-ETH: 0xa738de0f4b1f52cc8410d6e49ab6ed1ca3fe1420

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-QCAD-ETH',
    accountID: 51,
    tokens: [
      '0x4A16BAf414b8e637Ed12019faD5Dd705735DB2e0',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-QCAD-ETH'
  }
  ```

  52. FIN-ETH: 0xa0059ad8e06c57458116abc5e5c0bdb86c4fb4b2

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-FIN-ETH',
    accountID: 52,
    tokens: [
      '0x054f76beed60ab6dbeb23502178c52d6c5debe40',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-FIN-ETH'
  }
  ```

  53. DOUGH-ETH: 0x24e4cf9b1723e5a5401841d931a301aedecd96ef

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-DOUGH-ETH',
    accountID: 53,
    tokens: [
      '0xad32A8e6220741182940c5aBF610bDE99E737b2D',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-DOUGH-ETH'
  }
  ```

  54. DEFIL-ETH: 0xa2f4a88553ba746a468c21d3990fe9c503e0b19a

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-DEFIL-ETH',
    accountID: 54,
    tokens: [
      '0x78f225869c08d478c34e5f645d07a87d3fe8eb78',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-DEFIL-ETH'
  }
  ```

  55. DEFIS-ETH: 0xa2acf6b0304a808147ee3b10601e452c3f1bfde7

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-DEFIS-ETH',
    accountID: 55,
    tokens: [
      '0xad6a626ae2b43dcb1b39430ce496d2fa0365ba9c',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-DEFIS-ETH'
  }
  ```

  56. AAVE-ETH: 0x8f5a6e6d18f8e3fdffc27fe7fe5804c2378f8310

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-AAVE-ETH',
    accountID: 56,
    tokens: [
      '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-AAVE-ETH'
  }
  ```

  57. MKR-ETH: 0x69a8bdee1af2138c58b1261373b37071850689c0

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-MKR-ETH',
    accountID: 57,
    tokens: [
      '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-MKR-ETH'
  }
  ```

  58. BAL-ETH: 0x145f20a0c129d592da261e42947a70be3b22db07

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-BAL-ETH',
    accountID: 58,
    tokens: [
      '0xba100000625a3754423978a60c9317c58a424e3D',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-BAL-ETH'
  }
  ```

  59. REN-ETH: 0xee6a9d6cb11a9796f767540f435f90f11a9b1414

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-REN-ETH',
    accountID: 59,
    tokens: [
      '0x408e41876cccdc0f92210600ef50372656052a38',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-REN-ETH'
  }
  ```

  60. UMA-ETH: 0x8a6ba9d448ad54579bed1f42f587d134bf7f8582

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-UMA-ETH',
    accountID: 60,
    tokens: [
      '0x04Fa0d235C4abf4BcF4787aF4CF447DE572eF828',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-UMA-ETH'
  }
  ```

  61. OMG-ETH: 0x8a986607603d606b1ac5fdcca089764671c725e1

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-OMG-ETH',
    accountID: 61,
    tokens: [
      '0xd26114cd6EE289AccF82350c8d8487fedB8A0C07',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-OMG-ETH'
  }
  ```

  62. KNC-ETH: 0xf85f030865359d1843701f4f1b08c38913c3d57f

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-KNC-ETH',
    accountID: 62,
    tokens: [
      '0xdd974D5C2e2928deA5F71b9825b8b646686BD200',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-KNC-ETH'
  }
  ```

  63. BNT-ETH: 0x7ab580e6af77bd13f090619ee1f7e7c2a645afb1

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-BNT-ETH',
    accountID: 63,
    tokens: [
      '0x1F573D6Fb3F13d689FF844B4cE37794d79a7FF1C',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-BNT-ETH'
  }
  ```

  64. SNT-ETH: 0xfe88c469e27861907d05a0e97f81d84c789a1cda

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-SNT-ETH',
    accountID: 64,
    tokens: [
      '0x744d70fdbe2ba4cf95131626614a1763df805b9e',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-SNT-ETH'
  }
  ```

  65. GNO-ETH: 0x447356b190c7dafbe0452c8d041725abf1e1d41f

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-GNO-ETH',
    accountID: 65,
    tokens: [
      '0x6810e776880c02933d47db1b9fc05908e5386b96',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-GNO-ETH'
  }
  ```

  66. CVT-ETH: 0x8f871ac37fa7f575e9b8c285b38f0bf99d3c087f

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-CVT-ETH',
    accountID: 66,
    tokens: [
      '0xbe428c3867f05dea2a89fc76a102b544eac7f772',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-CVT-ETH'
  }
  ```

  67. ENTRP-ETH: 0x41e3b439a4798f2f466d28be7bedc0743847dbe4

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-ENTRP-ETH',
    accountID: 67,
    tokens: [
      '0x5bc7e5f0ab8b2e10d2d0a3f21739fce62459aef3',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-ENTRP-ETH'
  }
  ```

  68. FARM-ETH: 0x5f6a9960318903d4205dda6ba45796bc969461b8

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-FARM-ETH',
    accountID: 68,
    tokens: [
      '0xa0246c9032bC3A600820415aE600c6388619A14D',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-FARM-ETH'
  }
  ```

  69. ZRX-ETH: 0xbbca4790398c4ce916937db3c6b7e9a9da6502e8

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-ZRX-ETH',
    accountID: 69,
    tokens: [
      '0xE41d2489571d322189246DaFA5ebDe1F4699F498',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-ZRX-ETH'
  }
  ```

  70. NMR-ETH: 0x093137cfd844b64febeb5371d85cf83ff4f92bbf

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-NMR-ETH',
    accountID: 70,
    tokens: [
      '0x1776e1F26f98b1A5dF9cD347953a26dd3Cb46671',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-NMR-ETH'
  }
  ```

  71. LRC-WBTC: 0xfa6680779dc9168600bcdcaff28b41c8fa568d98

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-LRC-WBTC',
    accountID: 71,
    tokens: [
      '0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD',
      '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-LRC-WBTC'
  }
  ```

  72. RFOX-ETH: 0x1ad74cf7caf443f77bd89860ef39f4ca16fbe810

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-RFOX-ETH',
    accountID: 72,
    tokens: [
      '0xa1d6Df714F91DeBF4e0802A542E13067f31b8262',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-RFOX-ETH'
  }
  ```

  73. NEC-ETH: 0xc418a3af58d7a1bad0b709fe58d0afddf64e178d

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-NEC-ETH',
    accountID: 73,
    tokens: [
      '0xCc80C051057B774cD75067Dc48f8987C4Eb97A5e',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-NEC-ETH'
  }
  ```

  74. WBTC-USDT: 0xe6f1c20d06b2f541e4308d752d0d58c6df07191d

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-WBTC-USDT',
    accountID: 74,
    tokens: [
      '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      '0xdac17f958d2ee523a2206206994597c13d831ec7'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-WBTC-USDT'
  }
  ```

  75. WBTC-USDC: 0x7af6e5dd61c93277b406ffcadad6e6089b27075b

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-WBTC-USDC',
    accountID: 75,
    tokens: [
      '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-WBTC-USDC'
  }
  ```

  76. WBTC-DAI: 0x759c0d0ce4191db16ef5bce6ed0a05de9e99a9f5

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-WBTC-DAI',
    accountID: 76,
    tokens: [
      '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      '0x6B175474E89094C44Da98b954EedeAC495271d0F'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-WBTC-DAI'
  }
  ```

  77. RAI-ETH: 0x994f94c853d691f5c775e5131fc4a110abeed4a8

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-RAI-ETH',
    accountID: 77,
    tokens: [
      '0x03ab458634910AaD20eF5f1C8ee96F1D6ac54919',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-RAI-ETH'
  }
  ```

  78. SNX-ETH: 0xe7e807631f3e807ae20d0e23919db8789680104b

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-SNX-ETH',
    accountID: 78,
    tokens: [
      '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-SNX-ETH'
  }
  ```

  79. RGT-ETH: 0x7cd7871181d91af440dd4552bae70b8ebe9fba73

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-RGT-ETH',
    accountID: 79,
    tokens: [
      '0xd291e7a03283640fdc51b121ac401383a46cc623',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-RGT-ETH'
  }
  ```

  80. VSP-ETH: 0x9a94a815f56d00f52bbad46edc6d12d879df2635

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-VSP-ETH',
    accountID: 80,
    tokens: [
      '0x1b40183efb4dd766f11bda7a7c3ad8982e998421',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-VSP-ETH'
  }
  ```

  81. SMARTCREDIT-ETH: 0xfd997e572f03f3ff4f117aaccaab9b45bfb6e01c

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-SMARTCREDIT-ETH',
    accountID: 81,
    tokens: [
      '0x72e9D9038cE484EE986FEa183f8d8Df93f9aDA13',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-SMARTCREDIT-ETH'
  }
  ```

  82. TEL-ETH: 0x5f24c3a2c9841c023d6646402fd449665b64626b

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-TEL-ETH',
    accountID: 82,
    tokens: [
      '0x467Bccd9d29f223BcE8043b84E8C8B282827790F',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-TEL-ETH'
  }
  ```

  83. BCP-ETH: 0x9775449efdf24b7eb5391e7d3758e184595e4c69

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-BCP-ETH',
    accountID: 83,
    tokens: [
      '0xE4f726Adc8e89C6a6017F01eadA77865dB22dA14',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-BCP-ETH'
  }
  ```

  84. BADGER-ETH: 0x4f23ca1cc6253dc1ba69a07a892d68f3b777c407

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-BADGER-ETH',
    accountID: 84,
    tokens: [
      '0x3472A5A71965499acd81997a54BBA8D852C6E53d',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-BADGER-ETH'
  }
  ```

  85. SUSHI-ETH: 0x5c159d164b8fd7f0599c625988dc2db68df14842

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-SUSHI-ETH',
    accountID: 85,
    tokens: [
      '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-SUSHI-ETH'
  }
  ```

  86. MASK-ETH: 0x8572b8a876f47d70128c73bfca049ce00eb77563

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-MASK-ETH',
    accountID: 86,
    tokens: [
      '0x69af81e73A73B40adF4f3d4223Cd9b1ECE623074',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-MASK-ETH'
  }
  ```

  87. YPIE-ETH: 0xbbb360538b07b59ba2ca1c9f847c8bc760b8f0d7

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-YPIE-ETH',
    accountID: 87,
    tokens: [
      '0x17525E4f4Af59fbc29551bC4eCe6AB60Ed49CE31',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-YPIE-ETH'
  }
  ```

  88. FUSE-ETH: 0x34841262432975e36755ab797cb523dd7248861a

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-FUSE-ETH',
    accountID: 88,
    tokens: [
      '0x970B9bB2C0444F5E81e9d0eFb84C8ccdcdcAf84d',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-FUSE-ETH'
  }
  ```

  89. MASK-LRC: 0xc8f242b2ac6069ebdc876ba0ef42efbf03c5ba4b

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-MASK-LRC',
    accountID: 89,
    tokens: [
      '0x69af81e73A73B40adF4f3d4223Cd9b1ECE623074',
      '0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-MASK-LRC'
  }
  ```

  90. SX-ETH: 0xb27b1fd0d4a7d91d07c19f9a33d3a4711a453d7c

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-SX-ETH',
    accountID: 90,
    tokens: [
      '0x99fe3b1391503a1bc1788051347a1324bff41452',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-SX-ETH'
  }
  ```

  91. REPT-ETH: 0x76d8ea32c511a87ee4bff5f00e758dd362adf3d0

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-REPT-ETH',
    accountID: 91,
    tokens: [
      '0xcda4770d65b4211364cb870ad6be19e7ef1d65f4',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-REPT-ETH'
  }
  ```

  92. RSPT-USDC: 0x6bf0060fbcf271a2ed828e77076543076d5edba1

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-RSPT-USDC',
    accountID: 92,
    tokens: [
      '0x016bf078abcacb987f0589a6d3beadd4316922b0',
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-RSPT-USDC'
  }
  ```

  93. RSR-ETH: 0x554be7b23fde679049e52f195448db28b624534e

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-RSR-ETH',
    accountID: 93,
    tokens: [
      '0x8762db106b2c2a0bccb3a80d1ed41273552616e8',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-RSR-ETH'
  }
  ```

  94. UBT-ETH: 0xa41e49fdcd0555484f70899d95593d2e1a0fcbbb

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-UBT-ETH',
    accountID: 94,
    tokens: [
      '0x8400d94a5cb0fa0d041a3788e395285d61c9ee5e',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-UBT-ETH'
  }
  ```

  95. BAT-ETH: 0x83df13e357c731ec92d13cbf8f5bf4765a8e1205

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-BAT-ETH',
    accountID: 95,
    tokens: [
      '0x0D8775F648430679A709E98d2b0Cb6250d2887EF',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-BAT-ETH'
  }
  ```

  96. 0xBTC-ETH: 0x4facf65a157678e62f84389dd248d99f828403d6

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-0xBTC-ETH',
    accountID: 96,
    tokens: [
      '0xb6ed7644c69416d67b522e20bc294a9a9b405b31',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-0xBTC-ETH'
  }
  ```

  97. HEX-ETH: 0xc3630669cb660f9405df0d0037f52b78c49772ab

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-HEX-ETH',
    accountID: 97,
    tokens: [
      '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-HEX-ETH'
  }
  ```

  98. OVR-ETH: 0x7b854d37e502771b1647f5917efcf065ce1c0677

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-OVR-ETH',
    accountID: 98,
    tokens: [
      '0x21BfBDa47A0B4B5b1248c767Ee49F7caA9B23697',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-OVR-ETH'
  }
  ```

  99. BCDT-ETH: 0x66fAD4Ab701eE8C6F9eBef93b634a3E7401aa276

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-BCDT-ETH',
    accountID: 99,
    tokens: [
      '0xacfa209fb73bf3dd5bbfb1101b9bc999c49062a5',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-BCDT-ETH'
  }
  ```

  100. ALCX-ETH: 0x18a1A6F47Fd92185b91edc322d1954349aD0b652

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-ALCX-ETH',
    accountID: 100,
    tokens: [
      '0xdbdb4d16eda451d0503b854cf79d55697f90c8df',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-ALCX-ETH'
  }
  ```

  101. FLI-ETH: 0x4a7e38476b05F40B16E5ae1C761302B1A7d5afc5

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-FLI-ETH',
    accountID: 101,
    tokens: [
      '0xaa6e8127831c9de45ae56bb1b0d4d4da6e5665bd',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-FLI-ETH'
  }
  ```

  102. JRT-ETH: 0x83c11cbfbED2971032d3a1eD2f34d4Fb43FE181F

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-JRT-ETH',
    accountID: 102,
    tokens: [
      '0x8a9c67fee641579deba04928c4bc45f66e26343a',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-JRT-ETH'
  }
  ```

  103. ICHI-ETH: 0xc6bc133562b470a61394f9a2ff7fe8082da698a4

  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-ICHI-ETH',
    accountID: 103,
    tokens: [
      '0x903bEF1736CDdf2A537176cf3C64579C3867A881',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-ICHI-ETH'
  }
  ```

  104. DPR-ETH: 0x3ec139b45558d1db73b889f887624ef117d28e3b
  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-DPR-ETH',
    accountID: 104,
    tokens: [
      '0xf3AE5d769e153Ef72b4e3591aC004E89F48107a1',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-DPR-ETH'
  }
  ```

  105. FLX-ETH: 0x1cb97a1fdcbc60f112b5a58896906bdb870bc438
  ```
  {
    sharedConfig: '0x19b28198D993d3B0b1807C7bd46b4F0a4AFD473D',
    exchange: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
    poolName: 'AMM-FLX-ETH',
    accountID: 105,
    tokens: [
      '0x6243d8CEA23066d098a15582d81a598b4e8391F4',
      '0x0000000000000000000000000000000000000000'
    ],
    weights: [ 1000000, 1000000 ],
    feeBips: 20,
    tokenSymbol: 'LP-FLX-ETH'
  }
  ```
  ***

- Registered tokens:
  - ETH: 0x0000000000000000000000000000000000000000, tokenId: 0
  - LRC: 0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD, tokenId: 1
  - WETH: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2, tokenId: 2
  - USDT: 0xdac17f958d2ee523a2206206994597c13d831ec7, tokenId: 3
  - WBTC: 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599, tokenId: 4
  - DAI: 0x6B175474E89094C44Da98b954EedeAC495271d0F, tokenId: 5
  - USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48, tokenId: 6
  - MKR: 0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2, tokenId: 7
  - KNC: 0xdd974D5C2e2928deA5F71b9825b8b646686BD200, tokenId: 8
  - LINK: 0x514910771AF9Ca656af840dff83E8264EcF986CA, tokenId: 9
  - BAT: 0x0D8775F648430679A709E98d2b0Cb6250d2887EF, tokenId: 10
  - ZRX: 0xE41d2489571d322189246DaFA5ebDe1F4699F498, tokenId: 11
  - HT: 0x6f259637dcD74C767781E37Bc6133cd6A68aa161, tokenId: 12
  - OKB: 0x75231F58b43240C9718Dd58B4967c5114342a86c, tokenId: 13
  - BNB: 0xB8c77482e45F1F44dE1745F52C74426C631bDD52, tokenId: 14
  - KEEP: 0x85Eee30c52B0b379b046Fb0F85F4f3Dc3009aFEC, tokenId: 15
  - DXD: 0xa1d65E8fB6e87b60FECCBc582F7f97804B725521, tokenId: 16
  - ~~TRB: 0x0Ba45A8b5d5575935B8158a88C631E9F9C95a2e5, tokenId: 17~~
  - AUC: 0xc12d099be31567add4e4e4d0D45691C3F58f5663, tokenId: 18
  - RPL: 0xB4EFd85c19999D84251304bDA99E90B92300Bd93, tokenId: 19
  - renBTC: 0xEB4C2781e4ebA804CE9a9803C67d0893436bB27D, tokenId: 20
  - PAX: 0x8e870d67f660d95d5be530380d0ec0bd388289e1, tokenId: 21
  - TUSD: 0x0000000000085d4780B73119b644AE5ecd22b376, tokenId: 22
  - BUSD: 0x4fabb145d64652a948d72533023f6e7a623c7c53, tokenId: 23
  - ~~SNX: 0xc011a72400e58ecd99ee497cf89e3775d4bd732f, tokenId: 24~~
  - GNO: 0x6810e776880c02933d47db1b9fc05908e5386b96, tokenId: 25
  - ~~LEND: 0x80fB784B7eD66730e8b1DBd9820aFD29931aab03, tokenId: 26~~ // migrate to AAVE
  - REN: 0x408e41876cccdc0f92210600ef50372656052a38, tokenId: 27
  - ~~REP: 0x1985365e9f78359a9B6AD760e32412f4a445E862, tokenId: 28~~ // old contract
  - BNT: 0x1F573D6Fb3F13d689FF844B4cE37794d79a7FF1C, tokenId: 29
  - pBTC: 0x5228a22e72ccC52d415EcFd199F99D0665E7733b, tokenId: 30
  - COMP: 0xc00e94Cb662C3520282E6f5717214004A7f26888, tokenId: 31
  - PNT: 0x89ab32156e46f46d02ade3fecbe5fc4243b9aaed, tokenId: 32
  - GRID: 0x12B19D3e2ccc14Da04FAe33e63652ce469b3F2FD, tokenId: 33
  - PNK: 0x93ed3fbe21207ec2e8f2d3c3de6e058cb73bc04d, tokenId: 34
  - NEST: 0x04abeda201850ac0124161f037efd70c74ddc74c, tokenId: 35
  - BTU: 0xb683D83a532e2Cb7DFa5275eED3698436371cc9f, tokenId: 36
  - BZRX: 0x56d811088235F11C8920698a204A5010a788f4b3, tokenId: 37
  - vBZRX: 0xB72B31907C1C95F3650b64b2469e08EdACeE5e8F, tokenId: 38
  - cDAI: 0x5d3a536e4d6dbd6114cc1ead35777bab948e3643, tokenId: 39
  - cETH: 0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5, tokenId: 40
  - cUSDC: 0x39aa39c021dfbae8fac545936693ac917d5e7563, tokenId: 41
  - ~~aLEND: 0x7D2D3688Df45Ce7C552E19c27e007673da9204B8, tokenId: 42~~
  - aLINK: 0xA64BD6C70Cb9051F6A9ba1F163Fdc07E0DfB5F84, tokenId: 43
  - aUSDC: 0x9bA00D6856a4eDF4665BcA2C2309936572473B7E, tokenId: 44
  - OMG: 0xd26114cd6EE289AccF82350c8d8487fedB8A0C07, tokenId: 45
  - ENJ: 0xf629cbd94d3791c9250152bd8dfbdf380e2a3b9c, tokenId: 46
  - NMR: 0x1776e1F26f98b1A5dF9cD347953a26dd3Cb46671, tokenId: 47
  - SNT: 0x744d70fdbe2ba4cf95131626614a1763df805b9e, tokenId: 48
  - ~~tBTC: 0x1bBE271d15Bb64dF0bc6CD28Df9Ff322F2eBD847, tokenId: 49~~
  - ~~ANT: 0x960b236A07cf122663c4303350609A66A7B288C0, tokenId: 50~~
  - BAL: 0xba100000625a3754423978a60c9317c58a424e3D, tokenId: 51
  - MTA: 0xa3BeD4E1c75D00fa6f4E5E6922DB7261B5E9AcD2, tokenId: 52
  - sUSD: 0x57Ab1ec28D129707052df4dF418D58a2D46d5f51, tokenId: 53
  - ONG: 0xd341d1680eeee3255b8c4c75bcce7eb57f144dae, tokenId: 54
  - GRG: 0x4fbb350052bca5417566f188eb2ebce5b19bc964, tokenId: 55
  - BEEF: 0xBc2908DE55877e6Baf2FaAD7aE63AC8b26bd3de5, tokenId: 56
  - YFI: 0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e, tokenId: 57
  - CRV: 0xD533a949740bb3306d119CC777fa900bA034cd52, tokenId: 58
  - QCAD: 0x4A16BAf414b8e637Ed12019faD5Dd705735DB2e0, tokenId: 59
  - TON: 0x6a6c2ada3ce053561c2fbc3ee211f23d9b8c520a, tokenId: 60
  - BAND: 0xba11d00c5f74255f56a5e366f4f77f5a186d7f55, tokenId: 61
  - UMA: 0x04Fa0d235C4abf4BcF4787aF4CF447DE572eF828, tokenId: 62
  - wNXM: 0x0d438f3b5175bebc262bf23753c1e53d03432bde, tokenId: 63
  - ENTRP: 0x5bc7e5f0ab8b2e10d2d0a3f21739fce62459aef3, tokenId: 64
  - NIOX: 0xc813EA5e3b48BEbeedb796ab42A30C5599b01740, tokenId: 65
  - STAKE: 0x0Ae055097C6d159879521C384F1D2123D1f195e6, tokenId: 66
  - OGN: 0x8207c1ffc5b6804f6024322ccf34f29c3541ae26, tokenId: 67
  - ADX: 0xADE00C28244d5CE17D72E40330B1c318cD12B7c3, tokenId: 68
  - HEX: 0x2b591e99afe9f32eaa6214f7b7629768c40eeb39, tokenId: 69
  - DPI: 0x1494CA1F11D487c2bBe4543E90080AeBa4BA3C2b, tokenId: 70
  - HBTC: 0x0316eb71485b0ab14103307bf65a021042c6d380, tokenId: 71
  - UNI: 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984, tokenId: 72
  - pLTC: 0x5979f50f1d4c08f9a53863c2f39a7b0492c38d0f, tokenId: 73
  - ~~KAI: 0xbd6467a31899590474ce1e84f70594c53d628e46, tokenId: 74~~
  - FIN: 0x054f76beed60ab6dbeb23502178c52d6c5debe40, tokenId: 75
  - DOUGH: 0xad32A8e6220741182940c5aBF610bDE99E737b2D, tokenId: 76
  - DEFI+L: 0x78f225869c08d478c34e5f645d07a87d3fe8eb78, tokenId: 77
  - DEFI+S: 0xad6a626ae2b43dcb1b39430ce496d2fa0365ba9c, tokenId: 78
  - AAVE: 0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9, tokenId: 79
  - TRYB: 0x2c537e5624e4af88a7ae4060c022609376c8d0eb, tokenId: 80
  - CEL: 0xaaaebe6fe48e54f431b0c390cfaf0b017d09d42d, tokenId: 81
  - AMP: 0xff20817765cb7f73d4bde2e66e067e58d11095c2, tokenId: 82
  - LP-LRC-ETH: 0x18920d6E6Fb7EbE057a4DD9260D6D95845c95036, tokenId: 83
  - ~~LP-USDT-ETH: 0xA573C5d473702286f0AC84592EDA49aD799EBAA1, tokenId: 84~~
  - ~~LP-ETH-USDT: 0x6D537764355bc23d4eADba7829048Dac8215a73c, tokenId: 85~~
  - LP-ETH-USDT: 0x605872a5A459E778959B8a49dc3A56a8c9197983, tokenId: 86
  - LP-WBTC-ETH: 0xf6cd964E6345E8f01e548063De13d0DE7d8c59De, tokenId: 87
  - LP-UNI-ETH: 0x9b7a20ae12a3f2a3d4cF9eA2d4a8518c104cc5f2, tokenId: 88
  - KP3R: 0x1ceb5cb57c4d4e2b2433641b95dd330a33185a44, tokenId: 89
  - YFII: 0xa1d0e215a23d7030842fc67ce582a6afa3ccab83, tokenId: 90
  - MCB: 0x4e352cF164E64ADCBad318C3a1e222E9EBa4Ce42, tokenId: 91
  - LP-DPI-ETH: 0x6FF8A397F7A04B41c58c00AB8e70ACa7cbc0adBa, tokenId: 92
  - LP-LINK-ETH: 0x1230F7e06c3fA96f4259F7BaD79e6afF321B8133, tokenId: 93
  - LP-KP3R-ETH: 0x2ed5d3Fff0EB1451c381DDECE244E9b796db7b8a, tokenId: 94
  - LP-YFI-ETH: 0xd85f594481D3DEE61FD38464dD54CF3ccE6906b6, tokenId: 95
  - LP-YFII-ETH: 0xF8e4aBF498235fA8fdE2f6A04c21db7877957C47, tokenId: 96
  - LP-MCB-ETH: 0x70c8E0AedB5933Da09C9392A17389e4D6d79D638, tokenId: 97
  - AC: 0x9A0aBA393aac4dFbFf4333B06c407458002C6183, tokenId: 98
  - LP-AC-ETH: 0x8EFAD07720D331a49f5db2cC83946F7DC8FC6B42, tokenId: 99
  - LP-ETH-DAI: 0xD9D681C1ddD462ca222E90Bbe14A35273C318A09, tokenId: 100
  - CVT: 0xbe428c3867f05dea2a89fc76a102b544eac7f772, tokenId: 101
  - LP-LRC-USDT: 0xE6CC0d45C4E4F81be340F4D176e6Ce0D63Ad5743, tokenId: 102
  - LP-HBTC-USDT: 0x746EEB6bdd9139A4d605C2c410911F37BEa9093b, tokenId: 103
  - 1INCH: 0x111111111117dC0aa78b770fA6A738034120C302, tokenId: 104
  - LP-1INCH-ETH: 0xa9D46DEdEff7dFe8fF3628F4D276a0e1C5007b81, tokenId: 105
  - LP-AC-USDT: 0x502B5525e1508C51Af46719D13E5238b83A404e5, tokenId: 106
  - vETH: 0xc3d088842dcf02c13699f936bb83dfbbc6f721ab, tokenId: 107
  - WOO: 0x4691937a7508860F876c9c0a2a617E7d9E945D4B, tokenId: 108
  - LP-VETH-ETH: 0x9795f527d0Fad45F41dE27bef71F0eeD47f5256C, tokenId: 109
  - LP-WOO-USDT: 0x1D28b287B5E19b12Ac2B3618405C57AD882A4D74, tokenId: 110
  - LP-HBTC-ETH: 0x1F78CD24Ccf73fDd5095d0339DD6eF72E30669aC, tokenId: 111
  - LP-ETH-USDC: 0xF88de0CCD1E84898b4EA62c421009996bFb6156e, tokenId: 112
  - LP-CEL-ETH: 0x93bB5B402F04D3053F2c3800F6A4AF54788c16d0, tokenId: 113
  - BEL: 0xa91ac63d040deb1b7a5e4d4134ad23eb0ba07e14, tokenId: 114, decimals: 18
  - OBTC: 0x8064d9ae6cdf087b1bcd5bdf3531bd5d8c537a68, tokenId: 115, decimals: 18
  - INDEX: 0x0954906da0bf32d5479e25f46056d22f08464cab, tokenId: 116, decimals: 18
  - GRT: 0xc944E90C64B2c07662A292be6244BDf05Cda44a7, tokenId: 117, decimals: 18
  - TTV: 0xa838be6e4b760e6061d4732d6b9f11bf578f9a76, tokenId: 118, decimals: 18
  - FARM: 0xa0246c9032bC3A600820415aE600c6388619A14D, tokenId: 119, decimals: 18
  - LP-INDEX-ETH: 0x0089081950b4ebbf362689519c1d54827e99d727, tokenId: 120
  - LP-NIOX-ETH: 0x8cf6c5e7ec123583e1529d8afaeaa3d25da2fd3d, tokenId: 121
  - LP-GRT-ETH: 0x583208883277896435b9821a64806d708de17df2, tokenId: 122
  - LP-OBTC-ETH: 0x85f2e9474d208a11ac18ed2a4e434c4bfc6ddbde, tokenId: 123
  - LP-AMP-ETH: 0x0aa4d2dd35418d63af13ea906ce3a088dec8d786, tokenId: 124
  - LP-BEL-ETH: 0x567c1ad6d736755abcb3df8ef794b09bb7701e66, tokenId: 125
  - LP-ENJ-ETH: 0x1b04a25a0a7f93cfb0c4278ca4f7ca2483a1e94e, tokenId: 126
  - LP-KEEP-ETH 0x4e585bad734f0c6af04a3afb359fdb69435fe74b, tokenId: 127
  - LP-DXD-ETH 0x9387e06961988726dd0732b6930be1c0a5343901, tokenId: 128
  - ~~LP-TRB-ETH 0xe8ea36f850db564408e4165a92bccb4e6e5f5e20, tokenId: 129~~
  - LP-RPL-ETH 0x33df027650cd2729e0b132fc0bff4788725cc0fa, tokenId: 130
  - LP-PBTC-ETH 0x22844c482b0626ac09b5689b4d8e81fe6710f5f4, tokenId: 131
  - LP-COMP-ETH 0x9c601377fd95410be46cfc1a786686874c6e7702, tokenId: 132
  - LP-PNT-ETH 0x43eca2f58d8c371c5073fc382784a3a483005d6b, tokenId: 133
  - LP-PNK-ETH 0x78a58558ca76cf66b6c4d72231cf6529ed5bef29, tokenId: 134
  - LP-NEST-ETH 0xba64cdf65aea36ff4a58dcf288f1a62923555795, tokenId: 135
  - LP-BTU-ETH 0x73b7bc4463263194eb9b570948fda12244a5ffa8, tokenId: 136
  - LP-BZRX-ETH 0xaced28432cd60d7d34799de0d745871e5f10f961, tokenId: 137
  - LP-GRID-ETH 0xa762d8422237bd26b4f882c5d0744726eb2a86b0, tokenId: 138
  - LP-RENBTC-ETH 0x636a3141d48402d06a907aa14f023e8f5b5d634f, tokenId: 139
  - LP-GRG-ETH 0x37b6aad464e8916dc8231ae5f8aee15dd244c1b1, tokenId: 140
  - LP-CRV-ETH 0x2eab3234ea1e4c9571c2e011f435c7316ececdb9, tokenId: 141
  - LP-BUSD-ETH 0x8303f865a2a221c920e9fcbf2e84703991f16251, tokenId: 142
  - LP-BAND-ETH 0xf11702d591303d790c7b372e53fde348b82037de, tokenId: 143
  - LP-OGN-ETH 0x8e89790635dbffdcc0642055cb21abe63edc484c, tokenId: 144
  - LP-ADX-ETH 0x1f94eaaa413c11bea645ee65108b5673304753bd, tokenId: 145
  - LP-PLTC-ETH 0xfb64c2d72e1caa0286899be8e4f88266c4d8ab9f, tokenId: 146
  - BOR: 0x3c9d6c1c73b31c837832c72e04d3152f051fc1a9, tokenId: 147
  - LP-QCAD-ETH 0xa738de0f4b1f52cc8410d6e49ab6ed1ca3fe1420, tokenId: 148
  - LP-FIN-ETH 0xa0059ad8e06c57458116abc5e5c0bdb86c4fb4b2, tokenId: 149
  - LP-DOUGH-ETH 0x24e4cf9b1723e5a5401841d931a301aedecd96ef, tokenId: 150
  - LP-DEFIL-ETH 0xa2f4a88553ba746a468c21d3990fe9c503e0b19a, tokenId: 151
  - LP-DEFIS-ETH 0xa2acf6b0304a808147ee3b10601e452c3f1bfde7, tokenId: 152
  - LP-AAVE-ETH 0x8f5a6e6d18f8e3fdffc27fe7fe5804c2378f8310, tokenId: 153
  - LP-MKR-ETH 0x69a8bdee1af2138c58b1261373b37071850689c0, tokenId: 154
  - LP-BAL-ETH 0x145f20a0c129d592da261e42947a70be3b22db07, tokenId: 155
  - LP-REN-ETH 0xee6a9d6cb11a9796f767540f435f90f11a9b1414, tokenId: 156
  - LP-UMA-ETH 0x8a6ba9d448ad54579bed1f42f587d134bf7f8582, tokenId: 157
  - LP-OMG-ETH 0x8a986607603d606b1ac5fdcca089764671c725e1, tokenId: 158
  - LP-KNC-ETH 0xf85f030865359d1843701f4f1b08c38913c3d57f, tokenId: 159
  - LP-BNT-ETH 0x7ab580e6af77bd13f090619ee1f7e7c2a645afb1, tokenId: 160
  - LP-SNT-ETH 0xfe88c469e27861907d05a0e97f81d84c789a1cda, tokenId: 161
  - LP-GNO-ETH 0x447356b190c7dafbe0452c8d041725abf1e1d41f, tokenId: 162
  - LP-CVT-ETH 0x8f871ac37fa7f575e9b8c285b38f0bf99d3c087f, tokenId: 163
  - LP-ENTRP-ETH 0x41e3b439a4798f2f466d28be7bedc0743847dbe4, tokenId: 164
  - LP-FARM-ETH 0x5f6a9960318903d4205dda6ba45796bc969461b8, tokenId: 165
  - LP-ZRX-ETH 0xbbca4790398c4ce916937db3c6b7e9a9da6502e8, tokenId: 166
  - LP-NMR-ETH 0x093137cfd844b64febeb5371d85cf83ff4f92bbf, tokenId: 167
  - LP-LRC-WBTC 0xfa6680779dc9168600bcdcaff28b41c8fa568d98, tokenId: 168
  - RFOX: 0xa1d6Df714F91DeBF4e0802A542E13067f31b8262, tokenId: 169
  - NEC: 0xCc80C051057B774cD75067Dc48f8987C4Eb97A5e, tokenId: 170
  - LP-RFOX-ETH 0x1ad74cf7caf443f77bd89860ef39f4ca16fbe810, tokenId: 171
  - LP-NEC-ETH 0xc418a3af58d7a1bad0b709fe58d0afddf64e178d, tokenId: 172
  - SNX: 0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F, tokenId: 173
  - RGT: 0xd291e7a03283640fdc51b121ac401383a46cc623, tokenId: 174
  - VSP: 0x1b40183efb4dd766f11bda7a7c3ad8982e998421, tokenId: 175
  - SMARTCREDIT: 0x72e9D9038cE484EE986FEa183f8d8Df93f9aDA13, tokenId: 176
  - RAI: 0x03ab458634910AaD20eF5f1C8ee96F1D6ac54919, tokenId: 177
  - TEL: 0x467Bccd9d29f223BcE8043b84E8C8B282827790F, tokenId: 178
  - BCP: 0xE4f726Adc8e89C6a6017F01eadA77865dB22dA14, tokenId: 179
  - BADGER: 0x3472A5A71965499acd81997a54BBA8D852C6E53d, tokenId: 180
  - SUSHI: 0x6B3595068778DD592e39A122f4f5a5cF09C90fE2, tokenId: 181
  - MASK: 0x69af81e73A73B40adF4f3d4223Cd9b1ECE623074, tokenId: 182
  - LP-WBTC-USDT 0xe6f1c20d06b2f541e4308d752d0d58c6df07191d, tokenId: 183
  - LP-WBTC-USDC 0x7af6e5dd61c93277b406ffcadad6e6089b27075b, tokenId: 184
  - LP-WBTC-DAI 0x759c0d0ce4191db16ef5bce6ed0a05de9e99a9f5, tokenId: 185
  - LP-RAI-ETH 0x994f94c853d691f5c775e5131fc4a110abeed4a8, tokenId: 186
  - LP-SNX-ETH 0xe7e807631f3e807ae20d0e23919db8789680104b, tokenId: 187
  - LP-RGT-ETH 0x7cd7871181d91af440dd4552bae70b8ebe9fba73, tokenId: 188
  - LP-VSP-ETH 0x9a94a815f56d00f52bbad46edc6d12d879df2635, tokenId: 189
  - LP-SMARTCREDIT-ETH 0xfd997e572f03f3ff4f117aaccaab9b45bfb6e01c, tokenId: 190
  - LP-TEL-ETH 0x5f24c3a2c9841c023d6646402fd449665b64626b, tokenId: 191
  - LP-BCP-ETH 0x9775449efdf24b7eb5391e7d3758e184595e4c69, tokenId: 192
  - LP-BADGER-ETH 0x4f23ca1cc6253dc1ba69a07a892d68f3b777c407, tokenId: 193
  - LP-SUSHI-ETH 0x5c159d164b8fd7f0599c625988dc2db68df14842, tokenId: 194
  - LP-MASK-ETH 0x8572b8a876f47d70128c73bfca049ce00eb77563, tokenId: 195
  - YPIE: 0x17525E4f4Af59fbc29551bC4eCe6AB60Ed49CE31, tokenId: 196
  - FUSE: 0x970B9bB2C0444F5E81e9d0eFb84C8ccdcdcAf84d, tokenId: 197
  - LP-YPIE-ETH 0xbbb360538b07b59ba2ca1c9f847c8bc760b8f0d7, tokenId: 198
  - LP-FUSE-ETH 0x34841262432975e36755ab797cb523dd7248861a, tokenId: 199
  - LP-MASK-LRC 0xc8f242b2ac6069ebdc876ba0ef42efbf03c5ba4b, tokenId: 200
  - SX: 0x99fe3b1391503a1bc1788051347a1324bff41452, tokenId: 201
  - REPT: 0xcda4770d65b4211364cb870ad6be19e7ef1d65f4, tokenId: 202
  - RSPT: 0x016bf078abcacb987f0589a6d3beadd4316922b0, tokenId: 203
  - LP-SX-ETH 0xb27b1fd0d4a7d91d07c19f9a33d3a4711a453d7c, tokenId: 204
  - LP-REPT-ETH 0x76d8ea32c511a87ee4bff5f00e758dd362adf3d0, tokenId: 205
  - LP-RSPT-USDC 0x6bf0060fbcf271a2ed828e77076543076d5edba1, tokenId: 206
  - RSR: 0x8762db106b2c2a0bccb3a80d1ed41273552616e8, tokenId: 207
  - UBT: 0x8400d94a5cb0fa0d041a3788e395285d61c9ee5e, tokenId: 208
  - OXBTC: 0xb6ed7644c69416d67b522e20bc294a9a9b405b31, tokenId: 209
  - OVR: 0x21BfBDa47A0B4B5b1248c767Ee49F7caA9B23697, tokenId: 210
  - LP-RSR-ETH 0x554be7b23fde679049e52f195448db28b624534e, tokenId: 211
  - LP-UBT-ETH 0xa41e49fdcd0555484f70899d95593d2e1a0fcbbb, tokenId: 212
  - LP-BAT-ETH 0x83df13e357c731ec92d13cbf8f5bf4765a8e1205, tokenId: 213
  - LP-0xBTC-ETH 0x4facf65a157678e62f84389dd248d99f828403d6, tokenId: 214
  - LP-HEX-ETH 0xc3630669cb660f9405df0d0037f52b78c49772ab, tokenId: 215
  - LP-OVR-ETH 0x7b854d37e502771b1647f5917efcf065ce1c0677, tokenId: 216
  - BCDT: 0xacfa209fb73bf3dd5bbfb1101b9bc999c49062a5, tokenId: 217
  - ALCX: 0xdbdb4d16eda451d0503b854cf79d55697f90c8df, tokenId: 218
  - FLI: 0xaa6e8127831c9de45ae56bb1b0d4d4da6e5665bd, tokenId: 219
  - JRT: 0x8a9c67fee641579deba04928c4bc45f66e26343a, tokenId: 220
  - LP-BCDT-ETH: 0x66fAD4Ab701eE8C6F9eBef93b634a3E7401aa276, tokenId: 221
  - LP-ALCX-ETH: 0x18a1A6F47Fd92185b91edc322d1954349aD0b652, tokenId: 222
  - LP-FLI-ETH: 0x4a7e38476b05F40B16E5ae1C761302B1A7d5afc5, tokenId: 223
  - LP-JRT-ETH: 0x83c11cbfbED2971032d3a1eD2f34d4Fb43FE181F, tokenId: 224
  - ICHI: 0x903bEF1736CDdf2A537176cf3C64579C3867A881, tokenId: 225
  - LP-ICHI-ETH: 0xc6bc133562b470a61394f9a2ff7fe8082da698a4, tokenId: 226
  - DPR: 0xf3AE5d769e153Ef72b4e3591aC004E89F48107a1, tokenId: 227
  - LP-DPR-ETH: 0x3ec139b45558d1db73b889f887624ef117d28e3b, tokenId: 228
  - FLX: 0x6243d8CEA23066d098a15582d81a598b4e8391F4, tokenId: 229
  - LP-FLX-ETH: 0x1cb97a1fdcbc60f112b5a58896906bdb870bc438, tokenId: 230
