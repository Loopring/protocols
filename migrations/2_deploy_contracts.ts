import { Artifacts } from '../util/artifacts';

const {
  LoopringExchange,
  TokenRegistry,
  DummyToken,
} = new Artifacts(artifacts)

var TokenRegistry = artifacts.require("./TokenRegistry.sol");
var LoopringExchange = artifacts.require("./LoopringExchange.sol");

module.exports = (deployer: any) => {
  deployer.deploy(TokenRegistry);
  deployer.deploy(LoopringExchange);
};
