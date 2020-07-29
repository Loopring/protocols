// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "./ERC20.sol";


/// @title Burnable ERC20 Token Interface
/// @author Brecht Devos - <brecht@loopring.org>
abstract contract BurnableERC20 is ERC20
{
    function burn(
        uint value
        )
        public
        virtual
        returns (bool);

    function burnFrom(
        address from,
        uint value
        )
        public
        virtual
        returns (bool);
}
