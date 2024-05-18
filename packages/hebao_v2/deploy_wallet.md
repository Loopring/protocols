#  合约部署说明

## 部署命令

1. 克隆部署工具  
   `git clone https://github.com/Loopring/protocols.git`
2. 切换分支（分支可能发生变化，执行前请与开发人员确认）   
   `git checkout xl/estimateGas ; cd packages/hebao_v2`
3. 安装依赖  
   `yarn install`
4. 环境变量配置（在hebao_v3目录下，copy`.env.example`生成新文件`.env`，改里面的私钥）  
   `PRIVATE_KEY`: deployer 私钥，部署合约使用
   其它环境变量未使用，可不配置
6. 执行部署脚本  
   `yarn hardhat run script/deploy2.ts --network <network>`  
   填写的 network 必须在 `hardhat.config.ts` 文件中有相应的配置。运行成功后，可在 `deployments`目录中找到部署的合约信息
7. 部署的合约的信息不会自动写入文件中，记得保存命令行中的输出

## 部署步骤

1. 部署使用 `0x391fD52903D1531fd45F41c4A354533c91289F5F` 地址的 LoopringCreate2Deployer，无需转让 Owner 权限
2. 部署 `SmartWalletImpl`，Owner 为 deployer ，详细说明见下文

## 部署 WalletImpl 说明

依赖合约：
* `LoopringCreate2Deployer`  

前置合约：
* `ERC1271Lib`  
* `ERC20Lib`  
* `GuardianLib`  
* `InheritanceLib`  
* `QuotaLib`  
* `UpgradeLib`  
* `WhitelistLib`  
* `LockLib`  
* `RecoverLib`  
* `MetaTxLib`  

执行步骤：

1. 部署前置合约
2. 部署 `SmartWallet`，所需参数:
   1. `priceOracleAddr`：可以为 0x0000000000000000000000000000000000000000
   2. `blankOwner`
