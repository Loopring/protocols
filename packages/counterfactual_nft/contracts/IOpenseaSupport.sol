// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.

pragma solidity ^0.8.2;


/**
 * @title IOpenseaSupport
 */
abstract contract IOpenseaSupport
{
    function setContractURI(string memory contractURI_)
        external
        virtual;
}
