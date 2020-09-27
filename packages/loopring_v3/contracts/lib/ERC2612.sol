// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "./ERC20.sol";


/// @title ERC2612 Token with permit – 712-signed approvals but with
///        bytes as signature
/// @dev see https://eips.ethereum.org/EIPS/eip-2612
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract ERC2612 is ERC20
{
    function nonces(address owner)
        public
        view
        virtual
        returns (uint);

    function permit(
        address        owner,
        address        spender,
        uint256        value,
        uint256        deadline,
        bytes calldata signature
        )
        external
        virtual;
}
