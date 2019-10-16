import basicSchemas from "../common/schemas";

let standSchemas = {
  BASIC_TX: {
    to: {
      ...basicSchemas.ADDRESS
    },
    value: {
      ...basicSchemas.ETH_DATA
    },
    gasLimit: {
      type: "string",
      pattern: /^0x[0-9a-fA-F]{1,64}$/g
    },
    gasPrice: {
      type: "string",
      pattern: /^0x[0-9a-fA-F]{1,64}$/g
    },
    chainId: {
      type: "number"
    },
    nonce: {
      type: "string",
      required: true,
      pattern: /^0x[0-9a-fA-F]{1,64}$/g
    },
    data: {
      type: "string",
      required: true,
      pattern: /^0x[0-9a-fA-F]*$/g
    }
  },
  TX: {
    to: {
      ...basicSchemas.ADDRESS
    },
    value: {
      ...basicSchemas.ETH_DATA
    },
    gasLimit: {
      ...basicSchemas.ETH_DATA
    },
    gasPrice: {
      ...basicSchemas.ETH_DATA
    },
    chainId: {
      type: "number",
      required: true
    },
    nonce: {
      ...basicSchemas.ETH_DATA
    },
    data: {
      type: "string",
      required: true,
      pattern: /^0x[0-9a-fA-F]*$/g
    },
    signed: {
      type: "string"
    }
  },
  BASIC_TOKEN: {
    address: {
      ...basicSchemas.ADDRESS
    },
    symbol: {
      type: "string"
    },
    name: {
      type: "string"
    },
    digits: {
      type: "number"
    },
    unit: {
      type: "string"
    },
    website: {
      type: "url"
    },
    allowance: {
      type: "number"
    },
    precision: {
      type: "number"
    },
    minTradeValue: {
      type: "number"
    }
  },
  TOKEN: {
    address: {
      ...basicSchemas.ADDRESS
    },
    symbol: {
      type: "string",
      required: true
    },
    name: {
      type: "string",
      required: true
    },
    digits: {
      type: "number",
      required: true
    },
    unit: {
      type: "string",
      required: true
    },
    website: {
      type: "url"
    },
    allowance: {
      type: "number",
      required: true
    },
    precision: {
      type: "number",
      required: true
    },
    minTradeValue: {
      type: "number",
      required: true
    }
  }
};

// Hack: What is standSchemas?
export default standSchemas;
