// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.

pragma solidity ^0.8.2;

import "./WithCreator.sol";
import "./CounterfactualNFT.sol";

/**
 * @title CounterfactualNFT
 */
contract CounterfactualNftExt is WithCreator, CounterfactualNFT
{
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address _layer2Address)
        CounterfactualNFT(_layer2Address)
        {}

    function mint(
        address       /*account*/,
        uint256       /*id*/,
        uint256       /*amount*/,
        bytes  memory /*data*/
        )
        external
        override
    {
        revert("UNSUPPORTED");
    }

    function mintBatch(
        address          /*to*/,
        uint256[] memory /*ids*/,
        uint256[] memory /*amounts*/,
        bytes     memory /*data*/
        )
        external
        override
    {
        revert("UNSUPPORTED");
    }

}
