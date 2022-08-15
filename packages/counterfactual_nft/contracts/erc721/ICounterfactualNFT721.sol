// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.

pragma solidity ^0.8.2;


/**
 * @title ICounterfactualNFT
 */
abstract contract ICounterfactualNFT721
{
    function initialize(
        address owner,
        string memory _uri,
        string memory name,
        string memory symbol
    )
        public
        virtual;
}
