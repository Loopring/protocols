import { Artifacts } from "../util/artifacts";
import { expectThrow } from "../util/expectThrow";

const {
  BrokerRegistry,
  DummyBrokerInterceptor,
} = new Artifacts(artifacts);

contract("BrokerRegistry", (accounts: string[]) => {
  const user = accounts[1];
  const broker = accounts[1];
  const invalidInterceptor = accounts[2];
  const emptyAddr = "0x0000000000000000000000000000000000000000";

  let brokerRegistry: any;
  let dummyBrokerInterceptor: any;

  before(async () => {
    brokerRegistry = await BrokerRegistry.deployed();
    dummyBrokerInterceptor = await DummyBrokerInterceptor.deployed();
  });

  beforeEach(async () => {
    // Fresh BrokerRegistry for each test
    brokerRegistry = await BrokerRegistry.new();
  });

  describe("any user", () => {
    it("should be able to register a broker without interceptor", async () => {
      await brokerRegistry.registerBroker(broker, emptyAddr, {from: user});
      const [isRegistered, interceptorFromContract] = await brokerRegistry.getBroker(user, broker);
      assert(isRegistered, "interceptor should be registered.");
      assert.equal(emptyAddr, interceptorFromContract, "get wrong interceptor");
    });

    it("should be able to register a broker with interceptor", async () => {
      await brokerRegistry.registerBroker(broker, dummyBrokerInterceptor.address, {from: user});
      const [isRegistered, interceptorFromContract] = await brokerRegistry.getBroker(user, broker);
      assert(isRegistered, "interceptor should be registered.");
      assert.equal(dummyBrokerInterceptor.address, interceptorFromContract, "get wrong interceptor");
    });

    it("should be able to unregister a broker", async () => {
      await expectThrow(brokerRegistry.unregisterBroker(broker, {from: user}));
      await brokerRegistry.registerBroker(broker, dummyBrokerInterceptor.address, {from: user});
      await brokerRegistry.unregisterBroker(broker, {from: user});
    });

    it("should not be able to register a broker with interceptor that is not a contract", async () => {
      await expectThrow(brokerRegistry.registerBroker(broker, invalidInterceptor, {from: user}));
    });

    it("should not be able to register the same broker twice", async () => {
      await brokerRegistry.registerBroker(broker, emptyAddr, {from: user});
      await expectThrow(brokerRegistry.registerBroker(broker, emptyAddr, {from: user}));
    });

  });

});
