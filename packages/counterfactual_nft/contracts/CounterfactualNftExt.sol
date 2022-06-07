// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.

pragma solidity ^0.8.2;

import "./OpenseaSupport.sol";
import "./CounterfactualNFT.sol";

/**
 * @title CounterfactualNFT
 */
contract CounterfactualNftExt is CounterfactualNFT, OpenseaSupport
{
    bool public immutable openMinting;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address _layer2Address, bool _openMinting) CounterfactualNFT(_layer2Address)
    {
        openMinting = _openMinting;
    }

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
        if (!openMinting) {
            require(isMinter(minter) || isAddressInSet(DEPRECATED_MINTERS, minter), "invalid minter");
        }

        _setCreator(minter, id);
        _mint(to, id, amount, data);
        emit MintFromL2(to, id, amount, minter);
    }

    function setContractURI(string memory contractURI_)
        external
        override
    {
        if (bytes(contractURI_).length > 0) {
            if (_owner == address(0)) {             // every on can set when owner not init
                _setContractURI(contractURI_);
            } else {                                // otherwise only owner can set it
                require(_owner == msg.sender, "OWNER_REQUIRED");
                _setContractURI(contractURI_);
            }
        }
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
