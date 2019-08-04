import axios from "axios";

const MOCK_API_BASE_URL =
  "https://virtserver.swaggerhub.com/relay7/service-dex_proto/2";

export class RestApiServer {
  static async getMarkets() {
    try {
      const response = await axios.get(`${MOCK_API_BASE_URL}/v1/getMarkets`);
      console.log(response);
    } catch (error) {
      console.error(error);
    }
  }
}
