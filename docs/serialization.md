# Serializationa nd Deserialization

## The Demand
In v2, there will be a lot more optional parameters that a order or a ring can have. We can either manually program solidity to handle these cases or define the data in a thrift/protobuf like language and write a program to generate serialization/deserialization code in solidity to reduce error.

```
serializable OrderState {
  required address owner;
  required address tokenS;
  required address wallet;
  optional address authAddr;
  required uint amountS;
  required uint amountB;
  required uint lrcFee;
  bytes32 optional sig;
  optional uint validSince;
  optional uint validUntil = "0 - 1";
}

```

Given the following input, such a program should generate the following data structure:

```
library OrderStateSerialization extends AutoBytesSerialization {
struct OrderState {
        address owner;
        address tokenS;
        address wallet;
        address authAddr;
        uint    amountS;
        uint    amountB;
        uint    lrcFee;
        uint    rateS;
        bytes32 sig;
        uint    validSince;
        uint    validUntil;
    }
}

function deseralize(memory bytes input) returns (OrderState) {
   // auto generated code
}

function seralize(memory OrderState input) returns (OrderState orderState) {
   // auto generated code
}
```

