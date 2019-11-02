"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const async_validator_1 = __importDefault(require("async-validator"));
const schemas_1 = __importDefault(require("../common/schemas"));
const schemas_2 = __importDefault(require("./schemas"));
const schemas = {
  basic: Object.assign({}, schemas_1.default),
  transaction: Object.assign({}, schemas_2.default)
};
let handleErrors = (errors, fields) => {
  let msgs = errors.map(err => err.message).join();
  throw new Error(`data type invalid: ${msgs} \n`);
};
let validate = payload => {
  let { type, value, onError, onSuccess } = payload;
  let source = {};
  let schema = {};
  // fix bug: if value undefined or null
  if (typeof value === "undefined") {
    throw new Error(`data type invalid: ${type} should not be undefined`);
  }
  if (value === null) {
    throw new Error(`data type invalid: ${type} should not be null`);
  }
  if (schemas["basic"][type]) {
    // validate one field , schema & source must just has one field
    schema[type] = schemas["basic"][type];
    source[type] = value;
  }
  if (schemas["transaction"][type]) {
    // validate multiple fileds , schema & source must has multiple fields
    schema[type] = {
      type: "object",
      required: true,
      fields: schemas["transaction"][type]
    };
    source[type] = value;
  }
  // TODO: if schema empty
  let validator = new async_validator_1.default(schema);
  validator.validate(source, (errors, fields) => {
    if (errors) {
      console.log("validate start source", source);
      console.log("validate start schema", schema);
      if (onError) {
        onError(errors, fields);
      } else {
        handleErrors(errors, fields);
      }
    } else {
      if (onSuccess) {
        onSuccess();
      }
    }
  });
};
exports.default = {
  validate
};
//# sourceMappingURL=validator.js.map
