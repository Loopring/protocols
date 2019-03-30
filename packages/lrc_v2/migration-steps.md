## 迁移步骤：

* 部署合约：NewLRCToken, NewLRCFoundationIceboxContract, NewLRCLongTermHoldingContract
* 确实切换的目标块高度: destBlock
* 设置destBlock，运行utils/getAllLrcHoldersWithBalance.js, 得到所有普通账号和合约账号在destBlock的余额。
* setup NewLRCFoundationIceboxContract
* setup NewLRCLongTermHoldingContract
* setup NewLRCToken(plain accounts only, exclude contract addresses)
