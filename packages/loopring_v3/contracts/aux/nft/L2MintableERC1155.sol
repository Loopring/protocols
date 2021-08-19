// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../../core/iface/IL2MintableNFT.sol";
import "../../lib/OwnerManagable.sol";
import "../../thirdparty/erc1155/ERC1155.sol";


/// @title  L2MintableERC1155
/// @author Brecht Devos - <brecht@loopring.org>
contract L2MintableERC1155 is ERC1155, IL2MintableNFT, OwnerManagable
{
    event MintFromL2(
        address owner,
        uint256 id,
        uint    amount,
        address minter
    );

    string  public           name;
    address public immutable layer2;

    modifier onlyFromLayer2
    {
        require(msg.sender == layer2, "UNAUTHORIZED");
        _;
    }

    constructor(
        string memory _name,
        string memory _uri,
        address       _layer2
        )
        OwnerManagable()
        ERC1155(_uri)
    {
        name = _name;
        layer2 = _layer2;
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
        onlyManager(minter)
    {
        _mint(to, id, amount, data);
        emit MintFromL2(to, id, amount, minter);
    }

    function minters()
        public
        view
        override
        returns (address[] memory)
    {
        return managers();
    }

    function removeManager(address /*manager*/)
        override
        public
    {
        revert("DISABLED");
    }

    function mint(
        address          to,
        uint256          id,
        uint             amount,
        bytes   calldata data
        )
        external
        onlyOwner
    {
        _mint(to, id, amount, data);
    }
}
