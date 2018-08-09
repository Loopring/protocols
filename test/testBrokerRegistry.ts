import { Artifacts } from "../util/artifacts";
import { expectThrow } from "../util/expectThrow";

const {
  BrokerRegistry,
  DummyBrokerInterceptor,
} = new Artifacts(artifacts);

contract("BrokerRegistry", (accounts: string[]) => {
  const user1 = accounts[1];
  const user2 = accounts[2];
  const broker1 = accounts[5];
  const broker2 = accounts[6];
  const broker3 = accounts[7];
  const invalidInterceptor = accounts[9];
  const emptyAddr = "0x0000000000000000000000000000000000000000";

  let brokerRegistry: any;
  let dummyBrokerInterceptor: any;

  const registerBrokerChecked = async (user: string, broker: string, interceptor: string) => {
    await brokerRegistry.registerBroker(broker, interceptor, {from: user});
    await assertRegistered(user, broker, interceptor);
  };

  const unregisterBrokerChecked = async (user: string, broker: string) => {
    await brokerRegistry.unregisterBroker(broker, {from: user});
    assertNotRegistered(user, broker);
  };

  const assertRegistered = async (user: string, broker: string, interceptor: string) => {
    const [isRegistered, interceptorFromContract] = await brokerRegistry.getBroker(user, broker);
    assert(isRegistered, "interceptor should be registered.");
    assert.equal(interceptor, interceptorFromContract, "get wrong interceptor");
  };

  const assertNotRegistered = async (user: string, broker: string) => {
    const [isRegistered, interceptorFromContract] = await brokerRegistry.getBroker(user, broker);
    assert(!isRegistered, "interceptor should not be registered.");
  };

  const assertGetBrokers = async (user: string, brokersAndInterceptors: string[][]) => {
    const [brokersFromContract, interceptorsFromContract] = await brokerRegistry.getBrokers(user, 0, 100);
    brokersAndInterceptors.map((element, index) => {
      assert.equal(brokersFromContract[index], element[0], "Addresses should match");
      assert.equal(interceptorsFromContract[index], element[1], "Interceptors should match");
    });
  };

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
      await registerBrokerChecked(user1, broker1, emptyAddr);
    });

    it("should be able to register a broker with interceptor", async () => {
      await registerBrokerChecked(user1, broker1, dummyBrokerInterceptor.address);
    });

    it("should be able to unregister a broker", async () => {
      await expectThrow(brokerRegistry.unregisterBroker(broker1, {from: user1}));
      await registerBrokerChecked(user1, broker1, dummyBrokerInterceptor.address);
      await unregisterBrokerChecked(user1, broker1);
    });

    it("should not be able to register a broker with interceptor that is not a contract", async () => {
      await expectThrow(brokerRegistry.registerBroker(broker1, invalidInterceptor, {from: user1}));
    });

    it("should not be able to register the same broker twice", async () => {
      await registerBrokerChecked(user1, broker1, emptyAddr);
      await expectThrow(brokerRegistry.registerBroker(broker1, emptyAddr, {from: user1}));
    });

    it("should be able to unregister all brokers", async () => {
      await registerBrokerChecked(user1, broker1, emptyAddr);
      await registerBrokerChecked(user2, broker2, emptyAddr);
      await registerBrokerChecked(user1, broker3, emptyAddr);

      await brokerRegistry.unregisterAllBrokers({from: user1});

      await assertNotRegistered(user1, broker1);
      await assertRegistered(user2, broker2, emptyAddr);
      await assertNotRegistered(user1, broker3);

      await brokerRegistry.unregisterAllBrokers({from: user2});

      await assertNotRegistered(user1, broker1);
      await assertNotRegistered(user2, broker2);
      await assertNotRegistered(user1, broker3);
    });

    it("should be able to get all resgistered brokers for a user", async () => {
      const brokersAndInterceptorsUser1 = [[broker1, emptyAddr], [broker3, emptyAddr]];
      brokersAndInterceptorsUser1.map(async (element) => await registerBrokerChecked(user1, element[0], element[1]));

      const brokersAndInterceptorsUser2 = [[broker3, dummyBrokerInterceptor.address]];
      brokersAndInterceptorsUser2.map(async (element) => await registerBrokerChecked(user2, element[0], element[1]));

      assertGetBrokers(user1, brokersAndInterceptorsUser1);
      assertGetBrokers(user2, brokersAndInterceptorsUser2);
    });

  });

});
