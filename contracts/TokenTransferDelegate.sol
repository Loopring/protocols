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

import "zeppelin-solidity/contracts/math/Math.sol";
import "zeppelin-solidity/contracts/token/ERC20.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";


/// @title TokenTransferDelegate - Acts as a middle man to transfer ERC20 tokens
/// on behalf of different versioned of Loopring protocol to avoid ERC20
/// re-authorization.
/// @author Daniel Wang - <daniel@loopring.org>.
contract TokenTransferDelegate is Ownable {
    using Math for uint;

    ////////////////////////////////////////////////////////////////////////////
    /// Variables                                                            ///
    ////////////////////////////////////////////////////////////////////////////

    uint public lastVersion = 0;
    address[] public versions;
    mapping (address => uint) public versioned;


    ////////////////////////////////////////////////////////////////////////////
    /// Modifiers                                                            ///
    ////////////////////////////////////////////////////////////////////////////

    modifier isVersioned(address addr) {
        if (versioned[addr] == 0) {
            revert();
        }
        _;
    }

    modifier notVersioned(address addr) {
        if (versioned[addr] > 0) {
            revert();
        }
        _;
    }


    ////////////////////////////////////////////////////////////////////////////
    /// Events                                                               ///
    ////////////////////////////////////////////////////////////////////////////

    event VersionAdded(address indexed addr, uint version);

    event VersionRemoved(address indexed addr, uint version);


    ////////////////////////////////////////////////////////////////////////////
    /// Public Functions                                                     ///
    ////////////////////////////////////////////////////////////////////////////

    /// @dev Add a Loopring protocol address.
    /// @param addr A loopring protocol address.
    function addVersion(address addr)
        onlyOwner
        notVersioned(addr)
        public
    {
        versioned[addr] = ++lastVersion;
        versions.push(addr);
        VersionAdded(addr, lastVersion);
    }

    /// @dev Remove a Loopring protocol address.
    /// @param addr A loopring protocol address.
    function removeVersion(address addr)
        onlyOwner
        isVersioned(addr)
        public
    {
        uint version = versioned[addr];
        delete versioned[addr];

        uint length = versions.length;
        for (uint i = 0; i < length; i++) {
            if (versions[i] == addr) {
                versions[i] = versions[length - 1];
                versions.length -= 1;
                break;
            }
        }
        VersionRemoved(addr, version);
    }

    /// @return Amount of ERC20 token that can be spent by this contract.
    /// @param tokenAddress Address of token to transfer.
    /// @param _owner Address of the token owner.
    function getSpendable(
        address tokenAddress,
        address _owner
        )
        isVersioned(msg.sender)
        public
        constant
        returns (uint)
    {

        var token = ERC20(tokenAddress);
        return token.allowance(
            _owner,
            address(this)
        ).min256(
            token.balanceOf(_owner)
        );
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
        uint value)
        isVersioned(msg.sender)
        public
    {
        if (from != to) {
            require(
                ERC20(token).transferFrom(from, to, value)
            );
        }
    }

    /// @dev Gets all versioned addresses.
    /// @return Array of versioned addresses.
    function getVersions()
        public
        constant
        returns (address[])
    {
        return versions;
    }
}
