
enum TokenType {
  LRC = 0,
  ETH = 1,
  Other = 2,
}

export class Tax {

  public matchingIncomeLRC: number;
  public matchingIncomeETH: number;
  public matchingIncomeOther: number;
  public p2pIncomeLRC: number;
  public p2pIncomeETH: number;
  public p2pIncomeOther: number;
  public percentageBase: number;
  public lrcTokenAddress: string;
  public wethTokenAddress: string;

  constructor(matchingIncomeLRC: number,
              matchingIncomeETH: number,
              matchingIncomeOther: number,
              p2pIncomeLRC: number,
              p2pIncomeETH: number,
              p2pIncomeOther: number,
              percentageBase: number,
              lrcTokenAddress: string,
              wethTokenAddress: string) {
    this.matchingIncomeLRC = matchingIncomeLRC;
    this.matchingIncomeETH = matchingIncomeETH;
    this.matchingIncomeOther = matchingIncomeOther;
    this.p2pIncomeLRC = p2pIncomeLRC;
    this.p2pIncomeETH = p2pIncomeETH;
    this.p2pIncomeOther = p2pIncomeOther;
    this.percentageBase = percentageBase;
    this.lrcTokenAddress = lrcTokenAddress;
    this.wethTokenAddress = wethTokenAddress;
  }

  public calculateTax(token: string, P2P: boolean, amount: number) {
    if (amount === 0) {
      return 0;
    }
    const taxRate = this.getTaxRate(token, P2P);
    return Math.floor(amount * taxRate / this.percentageBase);
  }

  public getTaxRate(token: string, P2P: boolean) {
    const tokenType = this.getTokenType(token);
    if (P2P) {
      const taxes = [this.p2pIncomeLRC, this.p2pIncomeETH, this.p2pIncomeOther];
      return taxes[tokenType];
    } else {
      const taxes = [this.matchingIncomeLRC, this.matchingIncomeETH, this.matchingIncomeOther];
      return taxes[tokenType];
    }
  }

  private getTokenType(token: string) {
    if (token === this.lrcTokenAddress) {
      return TokenType.LRC;
    } else if (token === this.wethTokenAddress) {
      return TokenType.ETH;
    } else {
      return TokenType.Other;
    }
  }

}
