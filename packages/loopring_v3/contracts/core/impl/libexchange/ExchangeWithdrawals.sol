// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../../lib/AddressUtil.sol";
import "../../../lib/TransferUtil.sol";
import "../../../thirdparty/BytesUtil.sol";
import "../../iface/ExchangeData.sol";
import "../../iface/IExchangeV3.sol";
import "./ExchangeBalances.sol";
import "./ExchangeMode.sol";
import "./ExchangeNFT.sol";
import "./ExchangeTokens.sol";


/// @title ExchangeWithdrawals.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
library ExchangeWithdrawals
{
    enum WithdrawalCategory
    {
        DISTRIBUTION,
        FROM_MERKLE_TREE,
        FROM_DEPOSIT_REQUEST,
        FROM_APPROVED_WITHDRAWAL
    }

    using AddressUtil       for address;
    using AddressUtil       for address payable;
    using BytesUtil         for bytes;
    using MathUint          for uint;
    using TransferUtil      for address;
    using ExchangeBalances  for ExchangeData.State;
    using ExchangeMode      for ExchangeData.State;
    using ExchangeTokens    for ExchangeData.State;
    using ExchangeTokens    for uint16;

    event ForcedWithdrawalRequested(
        address owner,
        uint16  tokenID,    // ERC20 token ID ( if < NFT_TOKEN_ID_START) or
                            // NFT balance slot (if >= NFT_TOKEN_ID_START)
        uint32  accountID
    );

    event WithdrawalCompleted(
        uint8   category,
        address from,
        address to,
        address token,
        uint    amount
    );

    event WithdrawalFailed(
        uint8   category,
        address from,
        address to,
        address token,
        uint    amount
    );

    event NftWithdrawalCompleted(
        uint8   category,
        address from,
        address to,
        uint16  tokenID,
        address token,
        uint256 nftID,
        uint    amount
    );

    event NftWithdrawalFailed(
        uint8   category,
        address from,
        address to,
        uint16  tokenID,
        address token,
        uint256 nftID,
        uint    amount
    );

    function setWithdrawalRecipient(
        ExchangeData.State storage S,
        address from,
        address to,
        address token,
        uint96  amount,
        uint32  storageID,
        address newRecipient
        )
        external
    {
        require(newRecipient != address(0), "INVALID_DATA");
        uint16 tokenID = S.getTokenID(token);
        require(S.withdrawalRecipient[from][to][tokenID][amount][storageID] == address(0), "CANNOT_OVERRIDE_RECIPIENT_ADDRESS");
        S.withdrawalRecipient[from][to][tokenID][amount][storageID] = newRecipient;
    }

    function forceWithdraw(
        ExchangeData.State storage S,
        address                    owner,
        uint16                     tokenID, // ERC20 token ID ( if < NFT_TOKEN_ID_START) or
                                            // NFT balance slot (if >= NFT_TOKEN_ID_START)
        uint32                     accountID
        )
        public
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        // Limit the amount of pending forced withdrawals so that the owner cannot be overwhelmed.
        require(S.getNumAvailableForcedSlots() > 0, "TOO_MANY_REQUESTS_OPEN");
        require(accountID < ExchangeData.MAX_NUM_ACCOUNTS, "INVALID_ACCOUNTID");
        // Only allow withdrawing from registered ERC20 tokens or NFT tokenIDs
        require(
            tokenID < S.tokens.length ||                 // ERC20
            tokenID.isNFT(),  // NFT
            "INVALID_TOKENID"
        );

        // A user needs to pay a fixed ETH withdrawal fee, set by the protocol.
        uint withdrawalFeeETH = S.loopring.forcedWithdrawalFee();

        // Check ETH value sent, can be larger than the expected withdraw fee
        require(msg.value >= withdrawalFeeETH, "INSUFFICIENT_FEE");

        // Send surplus of ETH back to the sender
        uint feeSurplus = msg.value.sub(withdrawalFeeETH);
        if (feeSurplus > 0) {
            msg.sender.sendETHAndVerify(feeSurplus, gasleft());
        }

        // There can only be a single forced withdrawal per (account, token) pair.
        require(
            S.pendingForcedWithdrawals[accountID][tokenID].timestamp == 0,
            "WITHDRAWAL_ALREADY_PENDING"
        );

        // Store the forced withdrawal request data
        S.pendingForcedWithdrawals[accountID][tokenID] = ExchangeData.ForcedWithdrawal({
            owner: owner,
            timestamp: uint64(block.timestamp)
        });

        // Increment the number of pending forced transactions so we can keep count.
        S.numPendingForcedTransactions++;

        emit ForcedWithdrawalRequested(
            owner,
            tokenID,
            accountID
        );
    }

    // We alow anyone to withdraw these funds for the account owner
    function withdrawFromMerkleTree(
        ExchangeData.State       storage  S,
        ExchangeData.MerkleProof calldata merkleProof
        )
        public
    {
        require(S.isInWithdrawalMode(), "NOT_IN_WITHDRAW_MODE");

        address owner = merkleProof.accountLeaf.owner;
        uint32 accountID = merkleProof.accountLeaf.accountID;
        uint16 tokenID = merkleProof.balanceLeaf.tokenID;
        uint96 balance = merkleProof.balanceLeaf.balance;

        // Make sure the funds aren't withdrawn already.
        require(S.withdrawnInWithdrawMode[accountID][tokenID] == false, "WITHDRAWN_ALREADY");

        // Verify that the provided Merkle tree data is valid by using the Merkle proof.
        ExchangeBalances.verifyAccountBalance(
            uint(S.merkleRoot),
            merkleProof
        );

        // Make sure the balance can only be withdrawn once
        S.withdrawnInWithdrawMode[accountID][tokenID] = true;

        if (!tokenID.isNFT()) {
            require(
                merkleProof.nft.nftID == 0 && merkleProof.nft.minter == address(0),
                "NOT_AN_NFT"
            );
            // Transfer the tokens to the account owner
            transferTokens(
                S,
                uint8(WithdrawalCategory.FROM_MERKLE_TREE),
                owner,
                owner,
                tokenID,
                balance,
                new bytes(0),
                gasleft(),
                false
            );
        } else {
            transferNFTs(
                S,
                uint8(WithdrawalCategory.DISTRIBUTION),
                owner,
                owner,
                tokenID,
                balance,
                merkleProof.nft,
                new bytes(0),
                gasleft(),
                false
            );
        }
    }

    function withdrawFromDepositRequest(
        ExchangeData.State storage S,
        address                    owner,
        address                    token
        )
        public
    {
        uint16 tokenID = S.getTokenID(token);
        ExchangeData.Deposit storage deposit = S.pendingDeposits[owner][tokenID];
        require(deposit.timestamp != 0, "DEPOSIT_NOT_WITHDRAWABLE_YET");

        // Check if the deposit has indeed exceeded the time limit or if the exchange is in withdrawal mode
        require(
            block.timestamp >= deposit.timestamp + S.maxAgeDepositUntilWithdrawable ||
            S.isInWithdrawalMode(),
            "DEPOSIT_NOT_WITHDRAWABLE_YET"
        );

        uint amount = deposit.amount;

        // Reset the deposit request
        delete S.pendingDeposits[owner][tokenID];

        // Transfer the tokens
        transferTokens(
            S,
            uint8(WithdrawalCategory.FROM_DEPOSIT_REQUEST),
            owner,
            owner,
            tokenID,
            amount,
            new bytes(0),
            gasleft(),
            false
        );
    }

    function withdrawFromNFTDepositRequest(
        ExchangeData.State storage S,
        address                    owner,
        address                    token,
        ExchangeData.NftType       nftType,
        uint256                    nftID
        )
        public
    {
        ExchangeData.Deposit storage deposit = S.pendingNFTDeposits[owner][nftType][token][nftID];
        require(deposit.timestamp != 0, "DEPOSIT_NOT_WITHDRAWABLE_YET");

        // Check if the deposit has indeed exceeded the time limit or if the exchange is in withdrawal mode
        require(
            block.timestamp >= deposit.timestamp + S.maxAgeDepositUntilWithdrawable ||
            S.isInWithdrawalMode(),
            "DEPOSIT_NOT_WITHDRAWABLE_YET"
        );

        uint amount = deposit.amount;

        // Reset the deposit request
        delete S.pendingNFTDeposits[owner][nftType][token][nftID];

        ExchangeData.Nft memory nft = ExchangeData.Nft({
            minter: token,
            nftType: nftType,
            token: token,
            nftID: nftID,
            creatorFeeBips: 0
        });

        // Transfer the NFTs
        transferNFTs(
            S,
            uint8(WithdrawalCategory.FROM_DEPOSIT_REQUEST),
            owner,
            owner,
            0,
            amount,
            nft,
            new bytes(0),
            gasleft(),
            false
        );
    }

    function withdrawFromApprovedWithdrawals(
        ExchangeData.State storage S,
        address[]          memory  owners,
        address[]          memory  tokens
        )
        public
    {
        require(owners.length == tokens.length, "INVALID_INPUT_DATA");
        for (uint i = 0; i < owners.length; i++) {
            address owner = owners[i];
            uint16 tokenID = S.getTokenID(tokens[i]);
            uint amount = S.amountWithdrawable[owner][tokenID];

            // Make sure this amount can't be withdrawn again
            delete S.amountWithdrawable[owner][tokenID];

            // Transfer the tokens to the owner
            transferTokens(
                S,
                uint8(WithdrawalCategory.FROM_APPROVED_WITHDRAWAL),
                owner,
                owner,
                tokenID,
                amount,
                new bytes(0),
                gasleft(),
                false
            );
        }
    }

    function withdrawFromApprovedWithdrawalsNFT(
        ExchangeData.State     storage S,
        address[]              memory  owners,
        address[]              memory  minters,
        ExchangeData.NftType[] memory  nftTypes,
        address[]              memory  tokens,
        uint256[]              memory  nftIDs
        )
        public
    {
        require(owners.length == minters.length, "INVALID_INPUT_DATA_MINTERS");
        require(owners.length == nftTypes.length, "INVALID_INPUT_DATA_NFTTYPES");
        require(owners.length == tokens.length, "INVALID_INPUT_DATA_TOKENS");
        require(owners.length == nftIDs.length, "INVALID_INPUT_DATA_CONTENT_URIS");
        for (uint i = 0; i < owners.length; i++) {
            address owner = owners[i];
            address minter = minters[i];
            ExchangeData.NftType nftType = nftTypes[i];
            address token = tokens[i];
            uint256 nftID = nftIDs[i];
            uint amount = S.amountWithdrawableNFT[owner][minter][nftType][token][nftID];

            // Make sure this amount can't be withdrawn again
            delete S.amountWithdrawableNFT[owner][minter][nftType][token][nftID];

            ExchangeData.Nft memory nft = ExchangeData.Nft({
                minter: minter,
                nftType: nftType,
                token: token,
                nftID: nftID,
                creatorFeeBips: 0
            });

            // Transfer the NFTs to the owner
            transferNFTs(
                S,
                uint8(WithdrawalCategory.DISTRIBUTION),
                owner,
                owner,
                0,
                amount,
                nft,
                new bytes(0),
                gasleft(),
                false
            );
        }
    }

    function distributeWithdrawal(
        ExchangeData.State storage S,
        address                    from,
        address                    to,
        uint16                     tokenID,
        uint                       amount,
        bytes              memory  extraData,
        uint                       gasLimit,
        ExchangeData.Nft   memory  nft
        )
        public
    {
        if (!tokenID.isNFT()) {
            // Try to transfer the tokens
            if (!transferTokens(
                S,
                uint8(WithdrawalCategory.DISTRIBUTION),
                from,
                to,
                tokenID,
                amount,
                extraData,
                gasLimit,
                true
            )) {
                // If the transfer was successful there's nothing left to do.
                // However, if the transfer failed the tokens are still in the contract and can be
                // withdrawn later to `to` by anyone by using `withdrawFromApprovedWithdrawal.
                S.amountWithdrawable[to][tokenID] = S.amountWithdrawable[to][tokenID].add(amount);
            }
        } else {
            // Try to transfer the tokens
            if (!transferNFTs(
                S,
                uint8(WithdrawalCategory.DISTRIBUTION),
                from,
                to,
                tokenID,
                amount,
                nft,
                extraData,
                gasLimit,
                true
            )) {
                // If the transfer was successful there's nothing left to do.
                // However, if the transfer failed the tokens are still in the contract and can be
                // withdrawn later to `to` by anyone by using `withdrawFromApprovedNftWithdrawal.
                S.amountWithdrawableNFT[to][nft.minter][nft.nftType][nft.token][nft.nftID] =
                    S.amountWithdrawableNFT[to][nft.minter][nft.nftType][nft.token][nft.nftID].add(amount);
            }
        }
    }

    // == Internal and Private Functions ==

    // If allowFailure is true the transfer can fail because of a transfer error or
    // because the transfer uses more than `gasLimit` gas. The function
    // will return true when successful, false otherwise.
    // If allowFailure is false the transfer is guaranteed to succeed using
    // as much gas as needed, otherwise it throws. The function always returns true.
    function transferTokens(
        ExchangeData.State storage S,
        uint8                      category,
        address                    from,
        address                    to,
        uint16                     tokenID,
        uint                       amount,
        bytes              memory  extraData,
        uint                       gasLimit,
        bool                       allowFailure
        )
        private
        returns (bool success)
    {
        // Redirect withdrawals to address(0) to the protocol fee vault
        if (to == address(0)) {
            to = S.loopring.protocolFeeVault();
        }
        address token = S.getTokenAddress(tokenID);

        // Transfer the tokens from the deposit contract to the owner
        if (gasLimit > 0) {
            try S.depositContract.withdraw{gas: gasLimit}(from, to, token, amount, extraData) {
                success = true;
            } catch {
                success = false;
            }
        } else {
            success = false;
        }

        require(allowFailure || success, "TRANSFER_FAILURE");

        if (success) {
            emit WithdrawalCompleted(category, from, to, token, amount);

            // Keep track of when the protocol fees were last withdrawn
            // (only done to make this data easier available).
            if (from == address(0)) {
                S.protocolFeeLastWithdrawnTime[token] = block.timestamp;
            }
        } else {
            emit WithdrawalFailed(category, from, to, token, amount);
        }
    }

    // If allowFailure is true the transfer can fail because of a transfer error or
    // because the transfer uses more than `gasLimit` gas. The function
    // will return true when successful, false otherwise.
    // If allowFailure is false the transfer is guaranteed to succeed using
    // as much gas as needed, otherwise it throws. The function always returns true.
    function transferNFTs(
        ExchangeData.State storage S,
        uint8                      category,
        address                    from,
        address                    to,
        uint16                     tokenID,
        uint                       amount,
        ExchangeData.Nft   memory  nft,
        bytes              memory  extraData,
        uint                       gasLimit,
        bool                       allowFailure
        )
        private
        returns (bool success)
    {
        if (nft.token == nft.minter) {
            // This is a deposited NFT
            success = ExchangeNFT.withdraw(
                S,
                from,
                to,
                nft.nftType,
                nft.token,
                nft.nftID,
                amount,
                extraData,
                gasLimit
            );
        } else {
            // This is an NFT minted on L2 for an NFT contract with L2 minting support
            success = ExchangeNFT.mintFromL2(
                S,
                to,
                nft.token,
                nft.nftID,
                amount,
                nft.minter,
                extraData,
                gasLimit
            );
        }

        require(allowFailure || success, "NFT_TRANSFER_FAILURE");

        if (success) {
            emit NftWithdrawalCompleted(category, from, to, tokenID, nft.token, nft.nftID, amount);
        } else {
            emit NftWithdrawalFailed(category, from, to, tokenID, nft.token, nft.nftID, amount);
        }
    }

    function withdrawExchangeFees(
        ExchangeData.State storage S,
        address token,
        address recipient
        )
        external
    {
        require(recipient != address(0), "INVALID_ADDRESS");

        // Does not call a standard NFT transfer function so we can allow any contract address.
        // Disallow calls to the deposit contract as a precaution.
        require(token != address(S.depositContract), "INVALID_TOKEN");

        uint amount = token.selfBalance();
        token.transferOut(recipient, amount);
    }

    function withdrawUnregisteredToken(
        ExchangeData.State storage S,
        address token,
        address to,
        uint    amount
        )
        external
    {
        try IExchangeV3(address(this)).getTokenID(token) {
            revert("TOKEN_REGISTERED");
        } catch {
            require(to != address(0), "INVALID_ADDRESS");
            require(amount > 0, "INVALID_AMOUNT");
            S.depositContract.withdraw(
                address(S.depositContract),
                to,
                token,
                amount,
                new bytes(0)
            );
        }
    }
}
