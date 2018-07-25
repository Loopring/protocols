export class Context {
  public tokenRegistryAddress: string;
  public tradeDelegateAddress: string;
  public orderBrokerRegistryAddress: string;
  public minerBrokerRegistryAddress: string;
  public orderRegistryAddress: string;
  public minerRegistryAddress: string;

  constructor(tokenRegistryAddress: string,
              tradeDelegateAddress: string,
              orderBrokerRegistryAddress: string,
              minerBrokerRegistryAddress: string,
              orderRegistryAddress: string,
              minerRegistryAddress: string,
              ) {
    this.tokenRegistryAddress = tokenRegistryAddress;
    this.tradeDelegateAddress = tradeDelegateAddress;
    this.orderBrokerRegistryAddress = orderBrokerRegistryAddress;
    this.minerBrokerRegistryAddress = minerBrokerRegistryAddress;
    this.orderRegistryAddress = orderRegistryAddress;
    this.minerRegistryAddress = minerRegistryAddress;
  }

}
