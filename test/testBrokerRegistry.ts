import { Artifacts } from "../util/artifacts";

const {
  BrokerRegistry,
} = new Artifacts(artifacts);

contract("BrokerRegistry", (accounts: string[]) => {
  const user = accounts[1];
  const broker = accounts[1];
  const interceptor = accounts[2];
  const emptyAddr = "0x0000000000000000000000000000000000000000";

  let brokerRegistry: any;

  before(async () => {
    brokerRegistry = await BrokerRegistry.deployed();
  });

  describe("any user", () => {
    it("should be able to register a broker", async () => {
      await brokerRegistry.registerBroker(broker, interceptor, {from: user});
      const [isRegistered, interceptorFromContract] = await brokerRegistry.getBroker(user, broker);
      assert(isRegistered, "interceptor should be registered.");
      assert.equal(interceptor, interceptorFromContract, "get wrong interceptor");
    });

  });

});
