## Deployment infos for Loopring 3.0-beta4:

- release url: https://github.com/Loopring/protocols/releases/tag/3.0-beta4
- depoyer: 0x4374D3d032B3c96785094ec9f384f07077792768
- Migrations: 0x277c2c086F7435496e7D892aC370e5BeDe2bA8E4

### contracts

- LRCAddress: 0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD [lrctoken.eth](https://etherscan.io/address/lrctoken.eth)
- WETHAddress: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
- ProtocolFeeVaultAddress: 0x5BB8EF8efD18C6034EC9277DaCA9a5E29B1f1Cb1 ([feevault.lrctoken.eth]-incorrect, need update)(https://etherscan.io/address/feevault.lrctoken.eth)
- UniversalRegistry: 0x4c2103152a1A402af283fa52903569f05477611f [registry.lrctoken.eth](https://etherscan.io/address/registry.lrctoken.eth)
- BlockVerifier: 0x40598B41cc17a7E56dd72F415E8223aaCCA94cF7 [blockverifier.lrctoken.eth](https://etherscan.io/address/blockverifier.lrctoken.eth)
- DowntimeCostCalculator: 0x873685f032c6Aa1572766401f3198a1f09A5C221
- UniswapTokenSellerAddress: 0xaf92B83231a78978A236CA9D682CEBbAe97E62cB
- UserStakingPoolAddress: 0xF4662bB1C4831fD411a95b8050B3A5998d8A4A5b [stakingpool.lrctoken.eth](https://etherscan.io/address/stakingpool.lrctoken.eth)
- LoopringV3: 0x8745074248634f37327Ee748137C8b31238002C7 [loopring30.lrctoken.eth](https://etherscan.io/address/loopring30.lrctoken.eth)
- ExchangeV3: 0xc2D1E8FB0C10810BB888231E7B85118042846105 [exchange30b4.lrctoken.eth](https://etherscan.io/address/exchange30b4.lrctoken.eth)

### vks with following blockSize are registered in blockverifier contract:

- trade: 1, 2, 4, 8, 14, 31, 63, 128, 256, 512, 1024
- deposit: 1, 2, 4, 8, 15, 31, 64, 128, 256
- onchainWithdrawal: 1, 2, 4, 8, 16, 32, 64, 128, 256

### These tokens are supported by all exchanges:

- ETH: 0x0, tokenId: 0
- WETH: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2, tokenId: 1
- LRC: 0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD, tokenId: 2

### WEDAX Exchange contract address:

- exchangeID: 1
- exchangeAddress: 0x7D3D221A8D8AbDd868E8e88811fFaF033e68E108
- exchange stake: 500000 LRC
- takerFeeBips: 50; makerFeeBips: 25
- operator: 0x056C0263E87c2edBF7083620832D25216b1cB05D
- dummy account: 0x732E2501D6Bd54EEbf4Fb2800F664399413AF26A

#### WEDAX supported tokens:

- USDT: 0xdac17f958d2ee523a2206206994597c13d831ec7, tokenId: 3

### contract libs:

- Cloneable: 0x59d0e7aC20094D2c1813C23372b1A8Ca4F4CC22a
- BatchVerifier: 0x3edbC702AeE93b470ca9E586b4eeC0fF6a211b5f
- ExchangeConstants: 0x3353aB2b32Db682e98a2aB4bA90A58E63F5F4Ac8
- ExchangeBalances: 0x3a9C3E54231689dFFAf9E05c265C10d7716fe38d
- ExchangeAccounts: 0xc9A437be55ffBcd64aa6f0596d2906faC2591C94
- ExchangeAdmins: 0xd06824818Cc35445cf1593729b892f80f2F04eFf
- ExchangeBlocks: 0x571d92144d96bcf1a76Ec47Ee1464a552673b67D
- ExchangeTokens: 0xA3AC9BE46EB0F39b772908B5A5b16eaE188FC765
- ExchangeGenesis: 0x013AA50dc4a1B11c6a1B37C2961895c9Dc826069
- ExchangeDeposits: 0x7e185c0233D4F5473E540Fb2c72FF0E994d4359C
- ExchangeWithdrawals: 0x0E77d9716E3f6a6Ee4763FCC59ED164CF74A691c
