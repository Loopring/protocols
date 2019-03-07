import BN = require("bn.js");
import ABI = require("ethereumjs-abi");
import ethUtil = require("ethereumjs-util");

const TYPED_MESSAGE_SCHEMA = {
  type: "object",
  properties: {
    types: {
      type: "object",
      additionalProperties: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: {type: "string"},
            type: {type: "string"},
          },
          required: ["name", "type"],
        },
      },
    },
    primaryType: {type: "string"},
    domain: {type: "object"},
    message: {type: "object"},
  },
  required: ["types", "primaryType", "domain", "message"],
};

export function getEIP712Message(typedData: any) {
  const sanitizedData = sanitizeData(typedData);

  const parts = [Buffer.from("1901", "hex")];
  parts.push(hashStruct("EIP712Domain", sanitizedData.domain, sanitizedData.types));
  parts.push(hashStruct(sanitizedData.primaryType, sanitizedData.message, sanitizedData.types));
  return ethUtil.sha3(Buffer.concat(parts));
}

function sanitizeData(data: any) {
  const sanitizedData: any = {};
  for (const key in TYPED_MESSAGE_SCHEMA.properties) {
    if (key && data[key]) {
      sanitizedData[key] = data[key];
    }
  }
  return sanitizedData;
}

function hashStruct(primaryType: any, data: any, types: any) {
  const encodedData = encodeData(primaryType, data, types);
  return ethUtil.sha3(encodedData);
}

function encodeData(primaryType: any, data: any, types: any) {
  const encodedTypes = ["bytes32"];
  const encodedValues = [hashType(primaryType, types)];
  for (const field of types[primaryType]) {
    let value = data[field.name];
    if (value !== undefined) {
      if (field.type === "string" || field.type === "bytes") {
        encodedTypes.push("bytes32");
        value = ethUtil.sha3(value);
        encodedValues.push(value);
      } else if (types[field.type] !== undefined) {
        encodedTypes.push("bytes32");
        value = ethUtil.sha3(encodeData(field.type, value, types));
        encodedValues.push(value);
      } else if (field.type.lastIndexOf("]") === field.type.length - 1) {
        throw new Error("Arrays currently unimplemented in encodeData");
      } else {
        encodedTypes.push(field.type);
        encodedValues.push(value);
      }
    }
  }
  return ABI.rawEncode(encodedTypes, encodedValues);
}

function hashType(primaryType: any, types: any) {
  return ethUtil.sha3(encodeType(primaryType, types));
}

function encodeType(primaryType: any, types: any) {
  let result = "";
  let deps = findTypeDependencies(primaryType, types).filter((dep: any) => dep !== primaryType);
  deps = [primaryType].concat(deps.sort());
  for (const type of deps) {
    const children = types[type];
    if (!children) {
      throw new Error("No type definition specified: ${type}");
    }
    result += `${type}(${types[type].map((o: any) => `${o.type} ${o.name}`).join(",")})`;
  }
  return result;
}

function findTypeDependencies(primaryType: any, types: any, results: any = []) {
  if (results.includes(primaryType) || types[primaryType] === undefined) { return results; }
  results.push(primaryType);
  for (const field of types[primaryType]) {
    for (const dep of findTypeDependencies(field.type, types, results)) {
      if (!results.includes(dep)) {
        results.push(dep);
      }
    }
  }
  return results;
}
