/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity 0.4.24;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";

import "../iface/IBrokerRegistry.sol";
import "../iface/Errors.sol";
import "../lib/NoDefaultFunc.sol";


/// @title An Implementation of IBrokerRegistry.
/// @author Daniel Wang - <daniel@loopring.org>.
contract BrokerRegistry is IBrokerRegistry, NoDefaultFunc, Errors {
    struct Broker {
        address owner;
        address addr;
        address interceptor;
    }

    mapping (address => Broker[]) public brokersMap;
    mapping (address => mapping (address => uint)) public positionMap;

    function getBroker(
        address owner,
        address addr
        )
        external
        view
        returns(
            bool registered,
            address interceptor
        )
    {
        uint pos = positionMap[owner][addr];
        if (pos == 0) {
            registered = false;
        } else {
            registered = true;
            Broker storage broker = brokersMap[owner][pos - 1];
            interceptor = broker.interceptor;
        }
    }

    function getBrokers(
        address owner,
        uint    start,
        uint    count
        )
        external
        view
        returns (
            address[] brokers,
            address[] interceptors
        )
    {
        Broker[] storage _brokers = brokersMap[owner];
        uint size = _brokers.length;

        if (start >= size) {
            return;
        }

        uint end = start + count;
        if (end > size) {
            end = size;
        }

        brokers = new address[](end - start);
        interceptors = new address[](end - start);

        for (uint i = start; i < end; i++) {
            brokers[i - start] = _brokers[i].addr;
            interceptors[i - start] = _brokers[i].interceptor;
        }
    }

    function registerBroker(
        address broker,
        address interceptor  // 0x0 allowed
        )
        external
    {
        require(0x0 != broker, EMPTY_ADDRESS);
        require(
            0 == positionMap[msg.sender][broker],
            "broker already exists"
        );

        if (interceptor != 0x0) {
            require(isContract(interceptor), INVALID_INTERCEPTOR);
        }

        Broker[] storage brokers = brokersMap[msg.sender];
        Broker memory b = Broker(
            msg.sender,
            broker,
            interceptor
        );

        brokers.push(b);
        positionMap[msg.sender][broker] = brokers.length;

        emit BrokerRegistered(
            msg.sender,
            broker,
            interceptor
        );
    }

    function unregisterBroker(
        address addr
        )
        external
    {
        require(0x0 != addr, INVALID_BROKER);

        uint pos = positionMap[msg.sender][addr];
        require(pos != 0, NOT_FOUND);

        Broker[] storage brokers = brokersMap[msg.sender];
        uint size = brokers.length;

        address interceptor = brokers[pos - 1].interceptor;
        if (pos != size) {
            Broker storage lastOne = brokers[size - 1];
            brokers[pos - 1] = lastOne;
            positionMap[lastOne.owner][lastOne.addr] = pos;
        }

        brokers.length -= 1;
        delete positionMap[msg.sender][addr];

        emit BrokerUnregistered(
            msg.sender,
            addr,
            interceptor
        );
    }

    function unregisterAllBrokers(
        )
        external
    {
        Broker[] storage brokers = brokersMap[msg.sender];

        for (uint i = 0; i < brokers.length; i++) {
            delete positionMap[msg.sender][brokers[i].addr];
        }
        delete brokersMap[msg.sender];

        emit AllBrokersUnregistered(msg.sender);
    }

    // Currently here to work around InternalCompilerErrors when implemented
    // in a library. Because extcodesize is used the function cannot be pure,
    // so view is used which sometimes gives InternalCompilerErrors when
    // combined with internal.
    function isContract(
        address addr
        )
        public
        view
        returns (bool)
    {
        uint size;
        assembly { size := extcodesize(addr) }
        return size > 0;
    }
}
