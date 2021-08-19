// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


import "../../iface/ExchangeData.sol";
import "../../iface/IL2MintableNFT.sol";
import "../../../thirdparty/erc1155/IERC1155.sol";
import "../../../thirdparty/erc721/IERC721.sol";


/// @title ExchangeNFT
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeNFT
{
    using ExchangeNFT for ExchangeData.State;

    function deposit(
        ExchangeData.State storage S,
        address                    from,
        ExchangeData.NftType       nftType,
        address                    token,
        uint256                    nftID,
        uint                       amount,
        bytes              memory  extraData
        )
        internal
    {
        if (amount == 0) {
            return;
        }

        // Disable calls to certain contracts
        require(S.isTokenAddressAllowed(token), "TOKEN_ADDRESS_NOT_ALLOWED");

        if (nftType == ExchangeData.NftType.ERC1155) {
            IERC1155(token).safeTransferFrom(
                from,
                address(this),
                nftID,
                amount,
                extraData
            );
        } else if (nftType == ExchangeData.NftType.ERC721) {
            require(amount == 1, "INVALID_AMOUNT");
            IERC721(token).safeTransferFrom(
                from,
                address(this),
                nftID,
                extraData
            );
        } else {
            revert("UNKNOWN_NFTTYPE");
        }
    }

    function withdraw(
        ExchangeData.State storage S,
        address              /*from*/,
        address              to,
        ExchangeData.NftType nftType,
        address              token,
        uint256              nftID,
        uint                 amount,
        bytes   memory       extraData,
        uint                 gasLimit
        )
        internal
        returns (bool success)
    {
        if (amount == 0) {
            return true;
        }

        // Disable calls to certain contracts
        if(!S.isTokenAddressAllowed(token)) {
            return false;
        }

        if (nftType == ExchangeData.NftType.ERC1155) {
            try IERC1155(token).safeTransferFrom{gas: gasLimit}(
                address(this),
                to,
                nftID,
                amount,
                extraData
            ) {
                success = true;
            } catch {
                success = false;
            }
        } else if (nftType == ExchangeData.NftType.ERC721) {
            try IERC721(token).safeTransferFrom{gas: gasLimit}(
                address(this),
                to,
                nftID,
                extraData
            ) {
                success = true;
            } catch {
                success = false;
            }
        } else {
            revert("UNKNOWN_NFTTYPE");
        }
    }

    function mintFromL2(
        ExchangeData.State storage S,
        address                    to,
        address                    token,
        uint256                    nftID,
        uint                       amount,
        address                    minter,
        bytes              memory  extraData,
        uint                       gasLimit
        )
        internal
        returns (bool success)
    {
        if (amount == 0) {
            return true;
        }

        // Disable calls to certain contracts
        if(!S.isTokenAddressAllowed(token)) {
            return false;
        }

        try IL2MintableNFT(token).mintFromL2{gas: gasLimit}(
            to,
            nftID,
            amount,
            minter,
            extraData
        ) {
            success = true;
        } catch {
            success = false;
        }
    }

    function isTokenAddressAllowed(
        ExchangeData.State storage S,
        address                    token
        )
        internal
        view
        returns (bool valid)
    {
        return (token != address(this) && token != address(S.depositContract));
    }
}