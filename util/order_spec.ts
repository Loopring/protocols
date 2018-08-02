
export class OrderSpec {

  private data: number;

  constructor(private specData: number) {
    this.data = specData;
  }

  public hasDualAuth() {
    return (this.data & (1 << 0)) !== 0;
  }

  public hasBroker() {
    return (this.data & (1 << 1)) !== 0;
  }

  public hasOrderInterceptor() {
    return (this.data & (1 << 2)) !== 0;
  }

  public hasWallet() {
    return (this.data & (1 << 3)) !== 0;
  }

  public hasValidUntil() {
    return (this.data & (1 << 4)) !== 0;
  }

  public allOrNone() {
    return (this.data & (1 << 5)) !== 0;
  }

  public hasSignature() {
    return (this.data & (1 << 6)) !== 0;
  }

  public hasDualAuthSig() {
    return (this.data & (1 << 7)) !== 0;
  }
}
