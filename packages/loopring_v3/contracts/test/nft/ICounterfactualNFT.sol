// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.

pragma solidity ^0.7.0;


/**
 * @title ICounterfactualNFT
 */
abstract contract ICounterfactualNFT
{
    function initialize(address owner, string memory _uri)
        public
        virtual;
}
