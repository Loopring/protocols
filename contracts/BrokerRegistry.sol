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
pragma solidity 0.4.23;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";

import "./IBrokerRegistry.sol";


/// @title An Implementation of IBrokerRegistry.
/// @author Daniel Wang - <daniel@loopring.org>.
contract BrokerRegistry is IBrokerRegistry {
    struct Broker {
        uint    pos;        // 0 mens unregistered; if > 0, pos - 1 is the
                            // token's position in `addresses`.
        address owner;
        address addr;
        address interceptor;
    }

    mapping(address => Broker[]) public brokerageMap;
    mapping(address => mapping(address => Broker)) public brokerMap;

    function getBroker(
        address owner,
        address broker
        )
        external
        view
        returns(
            bool registered,
            address interceptor
        )
    {
        Broker storage b = brokerMap[owner][broker];
        registered = (b.addr == broker);
        interceptor = b.interceptor;
    }

    function getBrokers(
        uint start,
        uint count
        )
        public
        view
        returns (
            address[] brokers,
            address[] interceptors
        )
    {
        Broker[] storage _brokers = brokerageMap[msg.sender];
        uint num = _brokers.length;

        if (start >= num) {
            return;
        }

        uint end = start + count;
        if (end > num) {
            end = num;
        }

        if (start == num) {
            return;
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
        require(0x0 != broker,"bad broker");
        require(
            0 == brokerMap[msg.sender][broker].pos,
            "broker already exists"
        );

        Broker[] storage brokers = brokerageMap[msg.sender];
        Broker memory b = Broker(
            brokers.length + 1,
            msg.sender,
            broker,
            interceptor
        );

        brokers.push(b);
        brokerMap[msg.sender][broker] = b;

        emit BrokerRegistered(
            msg.sender,
            broker,
            interceptor
        );
    }
    
    function unregisterBroker(
        address broker
        )
        external
    {
        require(0x0 != broker, "bad broker");
        require(
            brokerMap[msg.sender][broker].addr == broker,
            "broker not found"
        );

        Broker storage b = brokerMap[msg.sender][broker];
        delete brokerMap[msg.sender][broker];

        Broker[] storage brokers = brokerageMap[msg.sender];
        Broker storage lastBroker = brokers[brokers.length - 1];

        if (lastBroker.addr != broker) {
            // Swap with the last token and update the pos
            lastBroker.pos = b.pos;
            brokers[b.pos - 1] = lastBroker;
            brokerMap[lastBroker.owner][lastBroker.addr] = lastBroker;
        }

        brokers.length--;

        emit BrokerUnregistered(msg.sender, broker);
    }
}
