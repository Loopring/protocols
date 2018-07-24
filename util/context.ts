export class Context {
  public tokenRegistryAddress: string;
  public brokerRegistryAddress: string;
  public tradeDelegateAddress: string;

  constructor(tokenRegistryAddress: string,
              brokerRegistryAddress: string,
              tradeDelegateAddress: string) {
    this. tokenRegistryAddress = tokenRegistryAddress;
    this.brokerRegistryAddress = brokerRegistryAddress;
    this.tradeDelegateAddress = tradeDelegateAddress;
  }

}
