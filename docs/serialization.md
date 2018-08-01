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

```javascript
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

    function deseralize(memory bytes input, uint offset) returns (bool ok, OrderState _orderState) {
       // auto generated code
    }
}
```

## Array-aware 
Sometimes we want to decode a bytes array into a array of objects, we can specify do it this way:


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
 arrayaware OrderState {
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

```javascript
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
    
    function deseralize(memory bytes input, uint offset) returns (bool ok, uint newOffset, OrderState _orderState) {
       // auto generated code
       // step 1: populate all requird fields
       
       // step 2: pupulated all optional fields that doesn't depend on the value of other fields;
       // we can use a byte32 to indicate whether a field is provided,
       // if the n-th optional field is provided, the n-th bit should be set to `1`.
       (uint32 mask, offset) = getUint32();
       if ((mask >> 0) & 1 == 0) {
          _orderState.optionalField1 = 0x0; // address default
       } else {
         (_orderState.optionalField1, offset) = getAddress();
       }
       
       if ((mask >> 1) & 1 == 0) {
          _orderState.optionalField2 = 0; // uint256 default
       } else {
         (_orderState.optionalField2, offset) = getUint256();
       }
       
       if ((mask >> 2) & 1 == 0) {
          _orderState.optionalField3 = 0x0; // bytes default
       } else {
         (uint size, offset) = getUint32();
         (_orderState.optionalField3, offset) = getBytes(size);
       }
       
       // step 3: populate all fields that depends on other fields. (compulted fields)
    }
    function deseralizeArray(memory bytes input, uint offset) returns (bool ok, uint newOffset, OrderState[] _orderState) {
       ok = false;
       uint size = getArraySize() // assuming this is 1 byte so we can have 2^7-1 = 255 element in the array
       _orderState = new OrderState[size];
       uint newOffset = offset + 1;
       if (newOffset > bytes.size) {
            return;
       }
       for (uint i = 0; i < size; i++) {
          bool _ok;
          (_ok, newOffset, _orderStates[i]) = deseralize(bytes, newOffset)
          if (!_ok) {
            return;
          }
       }
       ok = true;
       newOffset = _newOffset
    }
}
```

