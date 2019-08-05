import axios from "axios";

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

  static async getMarkets() {
    try {
      const response = await axios.post(`${MOCK_API_BASE_URL}/v1/getMarkets`);
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
}
