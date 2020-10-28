// Deploy the ExchangeV3 library which is very large in terms of
// gas usage. We need to deploy most libraries linked from it as stand-alone
// libraries, otherwise we'll run into the 'exceeded block gas limit' issue.

const fs = require("fs");
const ExchangeAdmins = artifacts.require("ExchangeAdmins");
const ExchangeBalances = artifacts.require("ExchangeBalances");
const ExchangeBlocks = artifacts.require("ExchangeBlocks");
const ExchangeDeposits = artifacts.require("ExchangeDeposits");
const ExchangeGenesis = artifacts.require("ExchangeGenesis");
const ExchangeTokens = artifacts.require("ExchangeTokens");
const ExchangeWithdrawals = artifacts.require("ExchangeWithdrawals");
const Cloneable = artifacts.require("./thirdparty/Cloneable.sol");
const ExchangeV3 = artifacts.require("./impl/ExchangeV3.sol");
const LoopringV3 = artifacts.require("LoopringV3");
const DefaultDepositContract = artifacts.require("DefaultDepositContract");
const LoopringIOExchangeOwner = artifacts.require("LoopringIOExchangeOwner");
const AgentRegistry = artifacts.require("AgentRegistry");
const LoopringAmmSharedConfig = artifacts.require("LoopringAmmSharedConfig");
const LRCToken = artifacts.require("./test/tokens/LRC.sol");
const GTOToken = artifacts.require("./test/tokens/GTO.sol");

const LoopringAmmPool = artifacts.require("LoopringAmmPool");
const LoopringAmmPoolCopy = artifacts.require("LoopringAmmPoolCopy");
const BlockVerifier = artifacts.require("BlockVerifier");

module.exports = function(deployer, network, accounts) {
  function flattenList(l) {
    return [].concat.apply([], l);
  }

  function flattenVK(vk) {
    return [
      flattenList([
        vk.alpha[0],
        vk.alpha[1],
        flattenList(vk.beta),
        flattenList(vk.gamma),
        flattenList(vk.delta)
      ]),
      flattenList(vk.gammaABC)
    ];
  }

  deployer.then(async () => {
    await deployer.link(ExchangeBalances, ExchangeV3);
    await deployer.link(ExchangeAdmins, ExchangeV3);
    await deployer.link(ExchangeBlocks, ExchangeV3);
    await deployer.link(ExchangeTokens, ExchangeV3);
    await deployer.link(ExchangeGenesis, ExchangeV3);
    await deployer.link(ExchangeDeposits, ExchangeV3);
    await deployer.link(ExchangeWithdrawals, ExchangeV3);

    await deployer.deploy(ExchangeV3, { gas: 6700000 });
    await deployer.deploy(DefaultDepositContract, { gas: 6700000 });
    await deployer.deploy(LoopringIOExchangeOwner, ExchangeV3.address, {
      gas: 6700000
    });

    if (process.env.TEST_ENV == "docker") {
      console.log("setup exchange:");
      const emptyMerkleRoot =
        "0x1efe4f31c90f89eb9b139426a95e5e87f6e0c9e8dab9ddf295e3f9d651f54698";
      const exchangeV3 = await ExchangeV3.deployed();
      await exchangeV3.initialize(
        LoopringV3.address,
        process.env.FROM,
        emptyMerkleRoot
      );
      await exchangeV3.setAgentRegistry(AgentRegistry.address);

      const depositContract = await DefaultDepositContract.deployed();
      await depositContract.initialize(ExchangeV3.address);
      await exchangeV3.setDepositContract(depositContract.address);

      console.log("setup amms:");
      // setup amm:
      // register tokens:
      await exchangeV3.registerToken(GTOToken.address);
      await exchangeV3.registerToken(LoopringAmmPool.address);
      await exchangeV3.registerToken(LoopringAmmPoolCopy.address);
      // register universal agent:
      const agentRegistry = await AgentRegistry.deployed();
      await agentRegistry.registerUniversalAgent(LoopringAmmPool.address, true);
      await agentRegistry.registerUniversalAgent(
        LoopringAmmPoolCopy.address,
        true
      );

      // set ownerContract:
      const ownerContract = await LoopringIOExchangeOwner.deployed();
      await exchangeV3.transferOwnership(ownerContract.address);
      const claimData = exchangeV3.contract.methods
        .claimOwnership()
        .encodeABI();
      // console.log("claimData:", claimData);
      await ownerContract.transact(claimData);
      await ownerContract.openAccessToSubmitBlocks(true);

      // do setup:
      const poolConfig1 = {
        sharedConfig: LoopringAmmSharedConfig.address,
        exchange: exchangeV3.address,
        poolName: "LRC-ETH-Pool-3",
        accountID: 1,
        tokens: [LRCToken.address, "0x" + "00".repeat(20)],
        weights: [10000, 10000],
        feeBips: 30,
        tokenSymbol: "LP-LRCETH"
      };
      const ammPool1 = await LoopringAmmPool.deployed();
      await ammPool1.setupPool(poolConfig1);
      console.log("poolConfig1:", poolConfig1);
      console.log("ammPool1.address:", ammPool1.address);

      const poolConfig2 = {
        sharedConfig: LoopringAmmSharedConfig.address,
        exchange: exchangeV3.address,
        poolName: "GTO-ETH-Pool-3",
        accountID: 2,
        tokens: [GTOToken.address, "0x" + "00".repeat(20)],
        weights: [10000, 10000],
        feeBips: 30,
        tokenSymbol: "LP-GTOETH"
      };
      const ammPool2 = await LoopringAmmPoolCopy.deployed();
      await ammPool2.setupPool(poolConfig2);
      console.log("poolConfig2:", poolConfig2);
      console.log("ammPool2.address:", ammPool2.address);

      const lrcToken = await LRCToken.deployed();
      const gtoToken = await GTOToken.deployed();
      // do the deposit for all accounts:
      for (const account of accounts) {
        console.log("do deposit for:", account);
        await lrcToken.approve(depositContract.address, "1" + "0".repeat(28), {
          from: account
        });
        await gtoToken.approve(depositContract.address, "1" + "0".repeat(28), {
          from: account
        });

        await exchangeV3.deposit(
          account,
          account,
          LRCToken.address,
          "1" + "0".repeat(26),
          [],
          { from: account, gas: 200000 }
        );

        await exchangeV3.deposit(
          account,
          account,
          GTOToken.address,
          "1" + "0".repeat(26),
          [],
          { from: account, gas: 200000 }
        );

        await exchangeV3.deposit(
          account,
          account,
          "0x" + "00".repeat(20),
          "1" + "0".repeat(20),
          [],
          { from: account, gas: 200000, value: "1" + "0".repeat(20) }
        );
      }

      // set VK in blockVerifier:
      const vk = JSON.parse(fs.readFileSync("test/all_16_vk.json", "ascii"));
      const vkFlattened = flattenList(flattenVK(vk));
      const blockVerifier = await BlockVerifier.deployed();
      await blockVerifier.registerCircuit(0, 16, 0, vkFlattened);
    }
  });
};
