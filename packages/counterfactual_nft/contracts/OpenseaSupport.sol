// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.2;

import "./IOpenseaSupport.sol";

/// @title AddressSet
/// @author Freeman Zhong (kongliang@loopring.io)
abstract contract OpenseaSupport is IOpenseaSupport {

    mapping (uint256 => address) public creators;
    string internal _contractURI;

    /**
     * @dev Change the creator address for given tokens
     * @param _to   Address of the new creator
     * @param _ids  Array of Token IDs to change creator
     */
    function setCreator(
        address _to,
        uint256[] memory _ids)
        public
    {
        require(_to != address(0), "ERC1155Tradable#setCreator: INVALID_ADDRESS.");
        for (uint256 i = 0; i < _ids.length; i++) {
            uint256 id = _ids[i];
            require(creators[id] == msg.sender, "ERC1155Tradable#creatorOnly: ONLY_CREATOR_ALLOWED");
            creators[id] = _to;
        }
    }

       /**
     * @dev Get the creator for a token
     * @param _id   The token id to look up
     */
    function creator(uint256 _id) public view returns (address) {
        return creators[_id];
    }

    /**
     * @dev Change the creator address for given token
     * @param _to   Address of the new creator
     * @param _id  Token IDs to change creator of
     */
    function _setCreator(address _to, uint256 _id) internal
    {
        creators[_id] = _to;
    }

    function contractURI() public view returns (string memory) {
        return _contractURI;
    }

    function _setContractURI(string memory contractURI_) internal {
        _contractURI = contractURI_;
    }

}
