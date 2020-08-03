// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../lib/Claimable.sol";


/// @title Authorizable
/// @author Brecht Devos - <brecht@loopring.org>
/// @dev The Authorizable contract allows a contract to be used by other contracts
///      by authorizing it by the contract owner.
contract Authorizable is Claimable
{
    event AddressAuthorized(
        address indexed addr
    );

    event AddressDeauthorized(
        address indexed addr
    );

    // The list of all authorized addresses
    address[] public authorizedAddresses;

    mapping (address => uint) private positionMap;

    struct AuthorizedAddress {
        uint    pos;
        address addr;
    }

    modifier onlyAuthorized()
    {
        require(positionMap[msg.sender] > 0, "UNAUTHORIZED");
        _;
    }

    function authorizeAddress(
        address addr
        )
        external
        onlyOwner
    {
        require(address(0) != addr, "ZERO_ADDRESS");
        require(0 == positionMap[addr], "ALREADY_EXIST");
        require(isContract(addr), "INVALID_ADDRESS");

        authorizedAddresses.push(addr);
        positionMap[addr] = authorizedAddresses.length;
        emit AddressAuthorized(addr);
    }

    function deauthorizeAddress(
        address addr
        )
        external
        onlyOwner
    {
        require(address(0) != addr, "ZERO_ADDRESS");

        uint pos = positionMap[addr];
        require(pos != 0, "NOT_FOUND");

        uint size = authorizedAddresses.length;
        if (pos != size) {
            address lastOne = authorizedAddresses[size - 1];
            authorizedAddresses[pos - 1] = lastOne;
            positionMap[lastOne] = pos;
        }

        authorizedAddresses.pop();
        delete positionMap[addr];

        emit AddressDeauthorized(addr);
    }

    function isAddressAuthorized(
        address addr
        )
        public
        view
        returns (bool)
    {
        return positionMap[addr] > 0;
    }

    function isContract(
        address addr
        )
        internal
        view
        returns (bool)
    {
        uint size;
        assembly { size := extcodesize(addr) }
        return size > 0;
    }

}
