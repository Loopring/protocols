// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.

pragma solidity ^0.8.2;

import "../OpenseaSupport.sol";
import "./CounterfactualNFT721.sol";

/**
 * @title CounterfactualNFT
 */
contract CounterfactualNftExt721 is CounterfactualNFT721, OpenseaSupport
{
    bool public immutable openMinting;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(bool _openMinting, address _layer2Address)
        CounterfactualNFT721(_layer2Address)
    {
        openMinting = _openMinting;
    }

    function mintFromL2(
        address          to,
        uint256          id,
        uint             amount,
        address          minter,
        bytes   calldata data
        )
        external
        override
        onlyFromLayer2
    {
        require(amount == 1, "invalid amount");
        if (!openMinting) {
            require(isMinter(minter) || isAddressInSet(DEPRECATED_MINTERS, minter), "invalid minter");
        }

        _setCreator(minter, id);
        _safeMint(to, id, data);
        emit MintFromL2(to, id, amount, minter);
    }

    function setContractURI(string memory contractURI_)
        external
        override
        onlyOwner
    {
        _setContractURI(contractURI_);
    }

    function minters()
        public
        view
        override
        returns (address[] memory)
    {
        if (openMinting) {
            return new address[](0);
        } else {
            return super.minters();
        }
    }

    function isMinter(address addr)
        public
        view
        override
        returns (bool)
    {
        if (openMinting) {
            return true;
        } else {
            return super.isMinter(addr);
        }
    }

}
