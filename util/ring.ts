import { OrderUtil } from "./order";
import { OrderInfo } from "./types";

export class Ring {

  public orders: Order[];
  public owner: string;
  public feeRecipient: string;

  constructor(orders: OrderInfo[],
              owner: string,
              feeRecipient: string) {
    this.orders = orders;
    this.owner = owner;
    this.feeRecipient = feeRecipient;
  }

  public async calculateFillAmountAndFee() {
    for (const order of orders) {

    }
  }

}
