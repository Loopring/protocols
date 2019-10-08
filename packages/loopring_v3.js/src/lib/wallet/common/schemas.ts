// Schema Help： https://github.com/yiminghe/async-validator
// required: value should be not empty eg: null, undefined, ''

let basicSchemas = {
  STRING: {
    type: "string",
    required: true
  },
  OPTION_NUMBER: {
    validator: (rule, value, cb) => {
      if (value) {
        if (typeof value === "number") {
          cb();
        } else {
          cb("page number valid");
        }
      } else {
        cb();
      }
    }
  },
  URL: {
    type: "url",
    required: true
  },
  ADDRESS: {
    type: "string",
    required: true,
    pattern: /^0x[0-9a-fA-F]{40}$/g
  },
  HEX: {
    type: "string",
    required: true,
    pattern: /^0x[0-9a-fA-F]*$/g
  },
  ETH_DATA: {
    type: "string",
    required: true,
    pattern: /^0x[0-9a-fA-F]{1,64}$/g
  },
  QUANTITY: {
    type: "string",
    required: true
  },
  PRIVATE_KEY: {
    type: "string",
    required: true,
    len: 64
  },
  TX_HASH: {
    type: "string",
    required: true,
    pattern: /^0x[0-9a-fA-F]{64}$/g
  },
  ABI_METHOD: {
    type: "enum",
    required: true,
    enum: [
      "cancelOrder",
      "cancelAllOrders",
      "cancelOrdersByTokenPairs",
      "approve",
      "deposit",
      "withdraw",
      "transfer",
      "balanceOf",
      "allowance",
      "symbol",
      "name",
      "decimals",
      "bind",
      "unbind",
      "getBindingAddress"
    ]
  },
  RPC_TAG: {
    type: "enum",
    required: true,
    enum: ["latest", "earliest", "pending"]
  },
  TIMESTAMP: {
    type: "string"
  },
  PROJECT_ID: {
    type: "number",
    required: true,
    min: 1
  },
  LOOPRING_TOKEN: {
    type: "enum",
    required: true,
    enum: ["LRC", "LRN", "LRQ"]
  },
  PRIVATE_KEY_BUFFER: {
    validator: (rule, value, cb) => {
      if (value instanceof Buffer && value.length === 32) {
        cb();
      } else {
        cb("private_key must be buffer");
      }
    }
  },
  CURRENCY: {
    type: "string",
    required: true,
    enum: ["USD", "CNY"]
  },
  DEFAULT_BLOCK: {
    type: "string",
    required: true,
    enum: ["earliest", "latest", "pending"]
  },
  CANCEL_ORDER_TYPE: {
    type: "enum",
    required: true,
    enum: [1, 2, 3, 4]
  }
};

export default basicSchemas;
