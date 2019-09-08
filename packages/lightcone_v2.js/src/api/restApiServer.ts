export class RestApiServer {
  static async getDexConfigurations() {
    try {
      var dexConfiguration = {};
      dexConfiguration["account_update_fee_eth"] = 0xde0b6b3a7640000;
      dexConfiguration["deposit_fee_eth"] = 0xde0b6b3a7640000;
      dexConfiguration["onchain_withdrawal_fee_eth"] = 0xde0b6b3a7640000;
      return dexConfiguration;
    } catch (error) {
      throw error;
    }
  }
}
