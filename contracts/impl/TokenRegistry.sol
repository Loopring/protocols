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

import "../iface/ITokenRegistry.sol";
import "../lib/AddressUtil.sol";
import "../lib/Claimable.sol";
import "../lib/NoDefaultFunc.sol";


/// @title An Implementation of TokenRegistry.
/// @author Kongliang Zhong - <kongliang@loopring.org>,
/// @author Daniel Wang - <daniel@loopring.org>.
contract TokenRegistry is ITokenRegistry, Claimable, NoDefaultFunc {

    // using AddressUtil for address;

    mapping (address => uint)   private agencyPosMap;
    mapping (address => uint)   private tokenPosMap;

    function registerAgency(
        address agency
        )
        onlyOwner
        external
    {
        require(isContract(agency), "agency is not a contract");
        require(
            0 == agencyPosMap[agency],
            "agency already exists"
        );

        agencies.push(agency);
        agencyPosMap[agency] = agencies.length;

        emit AgencyRegistered(agency);
    }

    function unregisterAgency(
        address agency
        )
        onlyOwner
        external
    {
        require(0x0 != agency, "bad agency");

        uint pos = agencyPosMap[agency];
        require(pos != 0, "agency not exists");

        uint size = agencies.length;
        if (pos != size) {
            address lastOne = agencies[size - 1];
            agencies[pos - 1] = lastOne;
            agencyPosMap[lastOne] = pos;
        }

        agencies.length -= 1;
        delete agencyPosMap[agency];

        emit AgencyUnregistered(agency);
    }

    function unregisterAllAgencies(
        )
        onlyOwner
        external
    {
        for (uint i = 0; i < agencies.length; i++) {
            delete agencyPosMap[agencies[i]];
        }
        agencies.length = 0;

        emit AllAgenciesUnregistered();
    }

    function registerToken(
        address addr
        )
        external
    {
        require(
            msg.sender == owner || agencyPosMap[msg.sender] != 0,
            "unauthenticated"
        );

        require(0x0 != addr, "bad address");

        uint pos = tokenPosMap[addr];
        require(pos == 0, "token already registered");

        tokens.push(addr);
        tokenPosMap[addr] = tokens.length;

        emit TokenRegistered(addr);
    }

    function unregisterToken(
        address addr
        )
        onlyOwner
        external
    {
        require(addr != 0x0, "bad token address ");

        uint pos = tokenPosMap[addr];
        require(pos != 0, "token not found");

        uint size = tokens.length;
        if (pos != size) {
            address lastOne = tokens[size - 1];
            tokens[pos - 1] = lastOne;
            tokenPosMap[lastOne] = pos;
        }
        tokens.length -= 1;

        delete tokenPosMap[addr];

        emit TokenUnregistered(addr);
    }

    function areAllTokensRegistered(
        address[] addressList
        )
        external
        view
        returns (bool)
    {
        for (uint i = 0; i < addressList.length; i++) {
            if (tokenPosMap[addressList[i]] == 0) {
                return false;
            }
        }
        return true;
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
        if (addr == 0x0) {
            return false;
        } else {
            uint size;
            assembly { size := extcodesize(addr) }
            return size > 0;
        }
    }

}
