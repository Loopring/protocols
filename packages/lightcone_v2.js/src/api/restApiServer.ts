import axios from "axios";
import { DexConfiguration } from "./ApiModel";

// It's a mock API server hosted on SwaggerHub
// Link: https://app.swaggerhub.com/apis/relay7/service-dex_proto/2
const MOCK_API_BASE_URL =
  "https://virtserver.swaggerhub.com/relay7/service-dex_proto/2";

// TODO: add request body to POST method.
export class RestApiServer {
  static async cancelOrder() {
    try {
      const response = await axios.post(`${MOCK_API_BASE_URL}/v1/cancelOrder`);
      return response;
    } catch (error) {
      throw error;
    }
  }

  static async getAccount() {
    try {
      const response = await axios.post(`${MOCK_API_BASE_URL}/v1/getAccount`);
      return response;
    } catch (error) {
      throw error;
    }
  }

  static async getCandles() {
    try {
      const response = await axios.post(`${MOCK_API_BASE_URL}/v1/getCandles`);
      return response;
    } catch (error) {
      throw error;
    }
  }

  static async getDexConfigurations() {
    try {
      const response = await axios.post(
        `${MOCK_API_BASE_URL}/v1/getDexConfigurations`
      );
      const dexConfiguration = <DexConfiguration>response.data;

      // Mock data
      dexConfiguration.account_update_fee_eth = "0x10000";
      dexConfiguration.deposit_fee_eth = "0x10000";
      dexConfiguration.onchain_withdrawal_fee_eth = "0x10000";

      return dexConfiguration;
    } catch (error) {
      throw error;
    }
  }

  static async getMarketFills() {
    try {
      const response = await axios.post(
        `${MOCK_API_BASE_URL}/v1/getMarketFills`
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  static async getMarkets() {
    try {
      const response = await axios.post(`${MOCK_API_BASE_URL}/v1/getMarkets`);
      return response;
    } catch (error) {
      throw error;
    }
  }

  static async getNextOrderId() {
    try {
      const response = await axios.post(
        `${MOCK_API_BASE_URL}/v1/getNextOrderId`
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  static async getNonce() {
    try {
      const response = await axios.post(`${MOCK_API_BASE_URL}/v1/getNonce`);
      return response;
    } catch (error) {
      throw error;
    }
  }

  static async getOrderBook() {
    try {
      const response = await axios.post(`${MOCK_API_BASE_URL}/v1/getOrderBook`);
      return response;
    } catch (error) {
      throw error;
    }
  }

  static async getTokens() {
    try {
      const response = await axios.post(`${MOCK_API_BASE_URL}/v1/getTokens`);
      return response;
    } catch (error) {
      throw error;
    }
  }

  static async getUserFills() {
    try {
      const response = await axios.post(`${MOCK_API_BASE_URL}/v1/getUserFills`);
      return response;
    } catch (error) {
      throw error;
    }
  }

  static async getUserOrders() {
    try {
      const response = await axios.post(
        `${MOCK_API_BASE_URL}/v1/getUserOrders`
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  static async getUserTransfers() {
    try {
      const response = await axios.post(
        `${MOCK_API_BASE_URL}/v1/getUserTransfers`
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  static async submitOffchainWithdrawal() {
    try {
      const response = await axios.post(
        `${MOCK_API_BASE_URL}/v1/submitOffchainWithdrawal`
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  static async submitOrder() {
    try {
      const response = await axios.post(`${MOCK_API_BASE_URL}/v1/submitOrder`);
      return response;
    } catch (error) {
      throw error;
    }
  }

  static async submitOrderCancellation() {
    try {
      const response = await axios.post(
        `${MOCK_API_BASE_URL}/v1/submitOrderCancellation`
      );
      return response;
    } catch (error) {
      throw error;
    }
  }
}
