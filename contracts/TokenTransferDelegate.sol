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
pragma solidity 0.4.18;

import "./lib/ERC20.sol";
import "./lib/MathUint.sol";
import "./lib/Ownable.sol";


/// @title TokenTransferDelegate - Acts as a middle man to transfer ERC20 tokens
/// on behalf of different versions of Loopring protocol to avoid ERC20
/// re-authorization.
/// @author Daniel Wang - <daniel@loopring.org>.
contract TokenTransferDelegate is Ownable {
    using MathUint for uint;

    ////////////////////////////////////////////////////////////////////////////
    /// Variables                                                            ///
    ////////////////////////////////////////////////////////////////////////////

    mapping(address => AddressInfo) private addressInfos;

    address public latestAddress;


    ////////////////////////////////////////////////////////////////////////////
    /// Structs                                                              ///
    ////////////////////////////////////////////////////////////////////////////

    struct AddressInfo {
        address previous;
        uint32  index;
        bool    authorized;
    }


    ////////////////////////////////////////////////////////////////////////////
    /// Modifiers                                                            ///
    ////////////////////////////////////////////////////////////////////////////

    modifier onlyAuthorized() {
        if (isAddressAuthorized(msg.sender) == false) {
            revert();
        }
        _;
    }


    ////////////////////////////////////////////////////////////////////////////
    /// Events                                                               ///
    ////////////////////////////////////////////////////////////////////////////

    event AddressAuthorized(address indexed addr, uint32 number);

    event AddressDeauthorized(address indexed addr, uint32 number);


    ////////////////////////////////////////////////////////////////////////////
    /// Public Functions                                                     ///
    ////////////////////////////////////////////////////////////////////////////

    /// @dev Add a Loopring protocol address.
    /// @param addr A loopring protocol address.
    function authorizeAddress(address addr)
        onlyOwner
        external
    {
        AddressInfo storage addrInfo = addressInfos[addr];

        if (addrInfo.index != 0) { // existing
            if (addrInfo.authorized == false) { // re-authorize
                addrInfo.authorized = true;
                AddressAuthorized(addr, addrInfo.index);
            }
        } else {
            address prev = latestAddress;
            if (prev == address(0)) {
                addrInfo.index = 1;
                addrInfo.authorized = true;
            } else {
                addrInfo.previous = prev;
                addrInfo.index = addressInfos[prev].index + 1;

            }
            addrInfo.authorized = true;
            latestAddress = addr;
            AddressAuthorized(addr, addrInfo.index);
        }
    }

    /// @dev Remove a Loopring protocol address.
    /// @param addr A loopring protocol address.
    function deauthorizeAddress(address addr)
        onlyOwner
        external
    {
        uint32 index = addressInfos[addr].index;
        if (index != 0) {
            addressInfos[addr].authorized = false;
            AddressDeauthorized(addr, index);
        }
    }

    function isAddressAuthorized(address addr)
        public
        view
        returns (bool)
    {
        return addressInfos[addr].authorized;
    }

    function getLatestAuthorizedAddresses(uint max)
        external
        view
        returns (address[] memory addresses)
    {
        addresses = new address[](max);
        address addr = latestAddress;
        AddressInfo memory addrInfo;
        uint count = 0;

        while (addr != address(0) && max < count) {
            addrInfo = addressInfos[addr];
            if (addrInfo.index == 0) {
                break;
            }
            addresses[count++] = addr;
            addr = addrInfo.previous;
        }
    }

    /// @dev Invoke ERC20 transferFrom method.
    /// @param token Address of token to transfer.
    /// @param from Address to transfer token from.
    /// @param to Address to transfer token to.
    /// @param value Amount of token to transfer.
    function transferToken(
        address token,
        address from,
        address to,
        uint    value)
        onlyAuthorized
        external
    {
        if (value > 0 && from != to) {
            require(
                ERC20(token).transferFrom(from, to, value)
            );
        }
    }

    function batchTransferToken(
        uint ringSize, 
        address lrcTokenAddress,
        address feeRecipient,
        bytes32[] batch)
        onlyAuthorized
        external
    {
        require(batch.length == ringSize * 6);

        uint p = ringSize * 2;
        for (uint i = 0; i < ringSize; i++) {
            uint prev = ((i + ringSize - 1) % ringSize);
            address tokenS = address(batch[i]);
            address owner = address(batch[ringSize + i]);
            address prevOwner = address(batch[ringSize + prev]);
            
            // Pay tokenS to previous order, or to miner as previous order's
            // margin split or/and this order's margin split.
            if (owner != prevOwner) {
                require(
                    ERC20(tokenS).transferFrom(
                        owner,
                        prevOwner,
                        uint(batch[p])
                    )
                );
            }

            if (owner != feeRecipient) {
                if (batch[p+1] != 0) {
                    require(
                        ERC20(tokenS).transferFrom(
                            owner,
                            feeRecipient,
                            uint(batch[p+1])
                        )
                    );
                } 

                if (batch[p+2] != 0) {
                    require(
                        ERC20(lrcTokenAddress).transferFrom(
                            feeRecipient,
                            owner,
                            uint(batch[p+2])
                        )
                    );
                }

                if (batch[p+3] != 0) {
                    require(
                        ERC20(lrcTokenAddress).transferFrom(
                            owner,
                            feeRecipient,
                            uint(batch[p+3])
                        )
                    );
                }
            }

            p += 4;
        }
    }
}
