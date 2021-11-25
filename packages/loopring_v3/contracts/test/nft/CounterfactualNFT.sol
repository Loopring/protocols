// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.

pragma solidity ^0.7.0;

import "../../core/iface/IL2MintableNFT.sol";
import "../../lib/AddressSet.sol";
import "../../lib/Ownable.sol";
import "../../thirdparty/erc1155/ERC1155.sol";
import "./ICounterfactualNFT.sol";


/**
 * @title CounterfactualNFT
 */
contract CounterfactualNFT is ICounterfactualNFT, ERC1155, IL2MintableNFT, Ownable, AddressSet
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

    constructor(address _layer2Address)
        ERC1155("")
    {
        layer2Address = _layer2Address;
        // Disable implementation contract
        owner = 0x000000000000000000000000000000000000dEaD;
    }

    function initialize(address _owner, string memory _uri)
        public
        override
    {
        require(owner == address(0), "ALREADY_INITIALIZED");
        owner = _owner;

        if (bytes(_uri).length != 0) {
            _setURI(_uri);
        }
    }

    function setURI(string memory _uri)
        public
        onlyOwner
    {
        _setURI(_uri);
    }

    function mint(
        address       account,
        uint256       id,
        uint256       amount,
        bytes  memory data
        )
        external
        onlyFromMinter
    {
        _mint(account, id, amount, data);
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
        mintersAndOwner[idx++] = owner;
        return mintersAndOwner;
    }

    function isMinter(address addr)
        public
        view
        returns (bool)
    {
        // Also allow the owner to mint NFTs to save on gas (no additional minter needs to be set)
        return addr == owner || isAddressInSet(MINTERS, addr);
    }
}
