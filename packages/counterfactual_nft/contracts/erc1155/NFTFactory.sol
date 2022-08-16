// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.2;
pragma experimental ABIEncoderV2;

import "./ICounterfactualNFT.sol";
import "@openzeppelin/contracts-upgradeable/utils/Create2Upgradeable.sol";
import "../external/CloneFactory.sol";


/// @title NFTFactory
/// @author Brecht Devos - <brecht@loopring.org>
contract NFTFactory
{
    event NFTContractCreated (address nftContract, address owner, string baseURI);

    string public constant NFT_CONTRACT_CREATION = "NFT_CONTRACT_CREATION";
    address public immutable implementation;

    constructor(
        address _implementation
        )
    {
        implementation = _implementation;
    }

    /// @dev Create a new NFT contract.
    /// @param owner The NFT contract owner.
    /// @param baseURI The base token URI (empty string allowed/encouraged to use IPFS mode)
    /// @return nftContract The new NFT contract address
    function createNftContract(
        address            owner,
        string    calldata baseURI
        )
        external
        payable
        returns (address nftContract)
    {
        // Deploy the proxy contract
        nftContract = Create2Upgradeable.deploy(
            0,
            keccak256(abi.encodePacked(NFT_CONTRACT_CREATION, owner, baseURI)),
            CloneFactory.getByteCode(implementation)
        );

        // Initialize
        ICounterfactualNFT(nftContract).initialize(owner, baseURI);

        emit NFTContractCreated(nftContract, owner, baseURI);
    }

    function computeNftContractAddress(
        address          owner,
        string  calldata baseURI
        )
        public
        view
        returns (address)
    {
        return _computeAddress(owner, baseURI);
    }

    function getNftContractCreationCode()
        public
        view
        returns (bytes memory)
    {
        return CloneFactory.getByteCode(implementation);
    }

    function _computeAddress(
        address          owner,
        string  calldata baseURI
        )
        private
        view
        returns (address)
    {
        return Create2Upgradeable.computeAddress(
            keccak256(abi.encodePacked(NFT_CONTRACT_CREATION, owner, baseURI)),
            keccak256(CloneFactory.getByteCode(implementation))
        );
    }
}
