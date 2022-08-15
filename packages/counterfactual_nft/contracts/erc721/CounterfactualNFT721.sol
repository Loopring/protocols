// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.

pragma solidity ^0.8.2;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./ICounterfactualNFT721.sol";
import "../AddressSet.sol";
import "../external/IL2MintableNFT.sol";
import "../external/IPFS.sol";
import "../external/OwnableUpgradeable.sol";


/**
 * @title CounterfactualNFT
 */
contract CounterfactualNFT721 is ICounterfactualNFT721, Initializable, ERC721Upgradeable, OwnableUpgradeable, IL2MintableNFT, AddressSet
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
    string public baseURI;

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

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address _layer2Address)
        initializer
    {
        layer2Address = _layer2Address;
        // Disable implementation contract
        _owner = 0x000000000000000000000000000000000000dEaD;
    }

    function initialize(
        address owner,
        string memory uri,
        string memory name,
        string memory symbol
    )
        public
        override
    {
        require(_owner == address(0), "ALREADY_INITIALIZED");
        _owner = owner;

        __ERC721_init(name, symbol);

        baseURI = uri;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
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

    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
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
        virtual
        onlyFromLayer2
    {
        require(amount == 1, "invalid amount");
        require(isMinter(minter) || isAddressInSet(DEPRECATED_MINTERS, minter), "invalid minter");

        _safeMint(to, id, data);
        emit MintFromL2(to, id, amount, minter);
    }

    function minters()
        public
        view
        virtual
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
        virtual
        returns (bool)
    {
        // Also allow the owner to mint NFTs to save on gas (no additional minter needs to be set)
        return addr == owner() || isAddressInSet(MINTERS, addr);
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
