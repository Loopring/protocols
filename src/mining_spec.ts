
export class MiningSpec {

  private data: number;

  constructor(private specData: number) {
    this.data = specData;
  }

  public hasFeeRecipient() {
    return (this.data & (1 << 0)) !== 0;
  }

  public hasMiner() {
    return (this.data & (1 << 1)) !== 0;
  }

  public hasSignature() {
    return (this.data & (1 << 2)) !== 0;
  }
}
