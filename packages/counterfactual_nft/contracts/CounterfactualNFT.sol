// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.

pragma solidity ^0.8.2;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./ICounterfactualNFT.sol";
import "./AddressSet.sol";
import "./external/IL2MintableNFT.sol";
import "./external/IPFS.sol";
import "./external/OwnableUpgradeable.sol";


/**
 * @title CounterfactualNFT
 */
contract CounterfactualNFT is ICounterfactualNFT, Initializable, ERC1155Upgradeable, OwnableUpgradeable, IL2MintableNFT, AddressSet
{
    event MintFromL2(
        address owner,
        uint256 id,
        uint    amount,
        address minter
    );

    bytes32 internal constant MINTERS = keccak256("__MINTERS__");
    bytes32 internal constant DEPRECATED_MINTERS = keccak256("__DEPRECATED_MINTERS__");

    address public immutable layer2Address;
    mapping (uint256 => address) public creators;

    modifier onlyFromLayer2
    {
        require(msg.sender == layer2Address, "not authorized");
        _;
    }

    modifier onlyFromMinter
    {
        require(isMinter(msg.sender), "not authorized");
        _;
    }

    modifier creatorOnly(uint256 _id) {
        require(creators[_id] == msg.sender, "ERC1155Tradable#creatorOnly: ONLY_CREATOR_ALLOWED");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address _layer2Address)
        initializer
    {
        layer2Address = _layer2Address;
        // Disable implementation contract
        _owner = 0x000000000000000000000000000000000000dEaD;
    }

    function initialize(address owner, string memory _uri)
        public
        override
    {
        require(_owner == address(0), "ALREADY_INITIALIZED");
        _owner = owner;

        if (bytes(_uri).length != 0) {
            _setURI(_uri);
        }

        // The owner is not explicitly added to the minters here
        // to minimize the contract deployment cost.
        // The owner is however always an authorized minter by
        // adding the owner's address to the authorized minters
        // in `minters` and `isMinter`.
    }

    /// update at 2022-05-31: Do not allow minting on Layer 1
    /* function mint( */
    /*     address       account, */
    /*     uint256       id, */
    /*     uint256       amount, */
    /*     bytes  memory data */
    /*     ) */
    /*     external */
    /*     onlyFromMinter */
    /* { */
    /*     _mint(account, id, amount, data); */
    /* } */

    function mintBatch(
        address          to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes     memory data
        )
        external
        onlyFromMinter
    {
        _mintBatch(to, ids, amounts, data);
    }

    function setMinter(
        address minter,
        bool enabled
        )
        external
        onlyOwner
    {
        if (enabled) {
            addAddressToSet(MINTERS, minter, true);
            if (isAddressInSet(DEPRECATED_MINTERS, minter)) {
                removeAddressFromSet(DEPRECATED_MINTERS, minter);
            }
        } else {
            removeAddressFromSet(MINTERS, minter);
            if (!isAddressInSet(DEPRECATED_MINTERS, minter)) {
                addAddressToSet(DEPRECATED_MINTERS, minter, true);
            }
        }
    }

    function transferOwnership(address newOwner)
        public
        virtual
        override
        onlyOwner
    {
        require(newOwner != owner(), "INVALID_OWNER");
        // Make sure NFTs minted by the previous owner remain valid
        if (!isAddressInSet(DEPRECATED_MINTERS, owner())) {
            addAddressToSet(DEPRECATED_MINTERS, owner(), true);
        }
        // Now transfer the ownership like usual
        super.transferOwnership(newOwner);
    }

    function uri(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        string memory baseURI = super.uri(tokenId);

	if (bytes(baseURI).length == 0 || bytes4("ipfs") == bytes4(bytes(baseURI))) {
	    return string(abi.encodePacked("ipfs://", IPFS.encode(tokenId)));
	} else {
	    return string(abi.encodePacked(baseURI, uint2str(tokenId)));
	}
    }

    // Layer 2 logic

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
        require(isMinter(minter) || isAddressInSet(DEPRECATED_MINTERS, minter), "invalid minter");

        creators[id] = minter; // set minter as creator
        _mint(to, id, amount, data);
        emit MintFromL2(to, id, amount, minter);
    }

    function minters()
        public
        view
        override
        returns (address[] memory)
    {
        address[] memory minterAddresses = addressesInSet(MINTERS);
        address[] memory deprecatedAddresses = addressesInSet(DEPRECATED_MINTERS);
        address[] memory mintersAndOwner = new address[](minterAddresses.length + deprecatedAddresses.length + 1);
        uint idx = 0;
        for (uint i = 0; i < minterAddresses.length; i++) {
            mintersAndOwner[idx++] = minterAddresses[i];
        }

        for (uint i = 0; i < deprecatedAddresses.length; i++) {
            mintersAndOwner[idx++] = deprecatedAddresses[i];
        }
        // Owner could already be added to the minters, but that's fine
        mintersAndOwner[idx++] = owner();
        return mintersAndOwner;
    }

    function isMinter(address addr)
        public
        view
        returns (bool)
    {
        // Also allow the owner to mint NFTs to save on gas (no additional minter needs to be set)
        return addr == owner() || isAddressInSet(MINTERS, addr);
    }

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
            _setCreator(_to, id);
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
    function _setCreator(address _to, uint256 _id) internal creatorOnly(_id)
    {
        creators[_id] = _to;
    }

    function uint2str(uint _i) internal pure returns (string memory _uintAsString) {
        if (_i == 0) {
            return "0";
        }
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len - 1;
        while (_i != 0) {
            bstr[k--] = bytes1(uint8(48 + _i % 10));
            _i /= 10;
        }
        return string(bstr);
    }
}
