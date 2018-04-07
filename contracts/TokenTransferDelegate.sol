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
pragma solidity 0.4.21;

import "./lib/Claimable.sol";
import "./lib/ERC20.sol";
import "./lib/MathUint.sol";


/// @title TokenTransferDelegate
/// @dev Acts as a middle man to transfer ERC20 tokens on behalf of different
/// versions of Loopring protocol to avoid ERC20 re-authorization.
/// @author Daniel Wang - <daniel@loopring.org>.
contract TokenTransferDelegate is Claimable {
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
        require(addressInfos[msg.sender].authorized);
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

    /// @dev Disable default function.
    function () payable public {
        revert();
    }

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
                emit AddressAuthorized(addr, addrInfo.index);
            }
        } else {
            address prev = latestAddress;
            if (prev == 0x0) {
                addrInfo.index = 1;
                addrInfo.authorized = true;
            } else {
                addrInfo.previous = prev;
                addrInfo.index = addressInfos[prev].index + 1;

            }
            addrInfo.authorized = true;
            latestAddress = addr;
            emit AddressAuthorized(addr, addrInfo.index);
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
            emit AddressDeauthorized(addr, index);
        }
    }

    function getLatestAuthorizedAddresses(uint max)
        external
        view
        returns (address[] addresses)
    {
        addresses = new address[](max);
        address addr = latestAddress;
        AddressInfo memory addrInfo;
        uint count = 0;

        while (addr != 0x0 && count < max) {
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
        if (value > 0 && from != to && to != 0x0) {
            require(
                ERC20(token).transferFrom(from, to, value)
            );
        }
    }

    function batchTransferToken(
        address lrcTokenAddress,
        address minerFeeRecipient,
        uint8 walletSplitPercentage,
        bytes32[] batch)
        onlyAuthorized
        external
    {
        uint len = batch.length;
        require(len % 7 == 0);
        require(walletSplitPercentage > 0 && walletSplitPercentage < 100);

        ERC20 lrc = ERC20(lrcTokenAddress);

        for (uint i = 0; i < len; i += 7) {
            address owner = address(batch[i]);
            address prevOwner = address(batch[(i + len - 7) % len]);

            // Pay token to previous order, or to miner as previous order's
            // margin split or/and this order's margin split.

            ERC20 token = ERC20(address(batch[i + 1]));

            // Here batch[i + 2] has been checked not to be 0.
            if (owner != prevOwner) {
                require(
                    token.transferFrom(
                        owner,
                        prevOwner,
                        uint(batch[i + 2])
                    )
                );
            }

            // Miner pays LRx fee to order owner
            uint lrcReward = uint(batch[i + 4]);
            if (lrcReward != 0 && minerFeeRecipient != owner) {
                require(
                    lrc.transferFrom(
                        minerFeeRecipient,
                        owner,
                        lrcReward
                    )
                );
            }

            // Split margin-split income between miner and wallet
            splitPayFee(
                token,
                uint(batch[i + 3]),
                owner,
                minerFeeRecipient,
                address(batch[i + 6]),
                walletSplitPercentage
            );

            // Split LRx fee income between miner and wallet
            splitPayFee(
                lrc,
                uint(batch[i + 5]),
                owner,
                minerFeeRecipient,
                address(batch[i + 6]),
                walletSplitPercentage
            );
        }
    }

    function isAddressAuthorized(address addr)
        public
        view
        returns (bool)
    {
        return addressInfos[addr].authorized;
    }

    function splitPayFee(
        ERC20   token,
        uint    fee,
        address owner,
        address minerFeeRecipient,
        address walletFeeRecipient,
        uint    walletSplitPercentage
        )
        internal
    {
        if (fee == 0) {
            return;
        }

        uint walletFee = (walletFeeRecipient == 0x0) ? 0 : fee.mul(walletSplitPercentage) / 100;
        uint minerFee = fee - walletFee;

        if (walletFee > 0 && walletFeeRecipient != owner) {
            require(
                token.transferFrom(
                    owner,
                    walletFeeRecipient,
                    walletFee
                )
            );
        }

        if (minerFee > 0 && minerFeeRecipient != 0x0 && minerFeeRecipient != owner) {
            require(
                token.transferFrom(
                    owner,
                    minerFeeRecipient,
                    minerFee
                )
            );
        }
    }
}
