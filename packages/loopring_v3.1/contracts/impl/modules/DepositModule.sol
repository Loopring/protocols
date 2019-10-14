/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "../../iface/modules/IDepositModule.sol";
import "./AbstractOnchainRequestModule.sol";
import "../Authorizable.sol";

import "../../iface/IAddressWhitelist.sol";
import "../../iface/IExchangeV3.sol";
import "../../impl/libexchange/ExchangeData.sol";
import "../../lib/AddressUtil.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";

// DepositModuleManager
import "../../iface/IExchangeModuleFactory.sol";
import "./../CircuitManager.sol";


/// @title  DepositModule
/// @author Brecht Devos - <brecht@loopring.org>
contract DepositModule is AbstractOnchainRequestModule, Authorizable, IDepositModule
{
    using AddressUtil       for address payable;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;

    // Represents an onchain deposit request. `tokenID` being `0x0` means depositing Ether.
    struct Deposit
    {
        uint24 accountID;
        uint16 tokenID;
        uint96 amount;
    }

    // The onchain deposit info (used in withdrawal mode to allow withdrawing unprocessed deposits)
    Deposit[] deposits;

    constructor(address exchangeAddress, address vkProviderAddress)
        AbstractOnchainRequestModule(exchangeAddress, vkProviderAddress, REQUEST_PRIORITY, MAX_OPEN_REQUESTS)
        public
    {
        // Nothing to do
    }

    function onRemove()
        external
        onlyExchange
        returns (bool)
    {
        RequestBlock storage lastBlock = requestBlocks[requestBlocks.length - 1];
        // Only allow this module to be removed when all deposits are handled
        bool allRequestsProcessed = (lastBlock.totalNumRequestsCommitted == requestChain.length);
        // We also have to make sure all blocks with these deposit requests are finalized,
        // otherwise users can't withdraw from the deposit request if the exchange goes into withdrawal mode.
        bool allBlocksFinalized = (lastBlock.blockIdx >= exchange.getNumBlocksFinalized());
        return allRequestsProcessed && allBlocksFinalized;
    }

    function createOrUpdateAccount(
        address owner,
        uint    pubKeyX,
        uint    pubKeyY,
        bytes   calldata permission
        )
        external
        nonReentrant
        onlyAuthorizedFor(owner)
        returns (
            uint24,
            bool,
            bool
        )
    {
        return createOrUpdateAccountInternal(
            owner,
            pubKeyX,
            pubKeyY,
            permission
        );
    }

    function updateAccountAndDeposit(
        address owner,
        uint    pubKeyX,
        uint    pubKeyY,
        address token,
        uint96  amount,
        bytes   calldata permission
        )
        external
        payable
        nonReentrant
        onlyAuthorizedFor(owner)
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        )
    {
        return updateAccountAndDepositInternal(
            owner,
            pubKeyX,
            pubKeyY,
            token,
            amount,
            permission
        );
    }

    function deposit(
        address from,
        address to,
        address tokenAddress,
        uint96  amount
        )
        external
        payable
        nonReentrant
        onlyAuthorizedFor(from)
    {
        depositInternal(
            from,
            to,
            tokenAddress,
            amount,
            0
        );
    }

    function withdrawFromDepositRequest(
        uint depositIdx
        )
        external
        nonReentrant
    {
        require(exchange.isInWithdrawalMode(), "NOT_IN_WITHDRAW_MODE");
        require(depositIdx < requestChain.length, "INVALID_DEPOSIT_IDX");

        // Find out what the cutoff point is for finalized processed deposit requests
        uint lastFinalizedBlockIdx = exchange.getNumBlocksFinalized() - 1;
        uint requestBlockIdx = findRightmostCorrespondingRequestBlockIdx(lastFinalizedBlockIdx);

        RequestBlock storage depositBlock = requestBlocks[requestBlockIdx];
        // We found the rightmost requestBlockIdx, so if the match isn't perfect we have to go back
        // a single request block to get the last finalized request block.
        if (depositBlock.blockIdx != lastFinalizedBlockIdx) {
            depositBlock = requestBlocks[requestBlockIdx - 1];
        }
        require(depositIdx >= depositBlock.totalNumRequestsCommitted, "REQUEST_INCLUDED_IN_FINALIZED_BLOCK");

        // The deposit info is stored at depositIdx - 1
        Deposit storage _deposit = deposits[depositIdx.sub(1)];

        uint amount = _deposit.amount;
        require(amount > 0, "WITHDRAWN_ALREADY");

        // Set the amount to 0 so it cannot be withdrawn again
        _deposit.amount = 0;

        // Transfer the tokens back to the user
        exchange.withdraw(
            _deposit.accountID,
            _deposit.tokenID,
            amount,
            false,
            gasleft()
        );
    }

    function setFees(
        uint _accountCreationFeeETH,
        uint _accountUpdateFeeETH,
        uint _depositFeeETH
        )
        external
        nonReentrant
        onlyExchangeOwner
    {
        accountCreationFeeETH = _accountCreationFeeETH;
        accountUpdateFeeETH = _accountUpdateFeeETH;
        depositFeeETH = _depositFeeETH;

        emit FeesUpdated(
            exchangeId,
            _accountCreationFeeETH,
            _accountUpdateFeeETH,
            _depositFeeETH
        );
    }

    function setAddressWhitelist(
        address _addressWhitelist
        )
        external
        nonReentrant
        onlyExchangeOwner
        returns (address oldAddressWhitelist)
    {
        require(addressWhitelist != _addressWhitelist, "SAME_ADDRESS");

        oldAddressWhitelist = addressWhitelist;
        addressWhitelist = _addressWhitelist;

        emit AddressWhitelistChanged(
            exchangeId,
            oldAddressWhitelist,
            _addressWhitelist
        );
    }

    // Internal functions

    function processBlock(
        uint32 blockSize,
        uint16 /*blockVersion*/,
        bytes  memory data,
        bytes  memory /*auxiliaryData*/,
        uint32 blockIdx
        )
        internal
    {
        uint totalNumRequestsCommitted = requestBlocks[requestBlocks.length - 1].totalNumRequestsCommitted;

        uint startIdx = 0;
        uint count = 0;
        assembly {
            startIdx := and(mload(add(data, 136)), 0xFFFFFFFF)
            count := and(mload(add(data, 140)), 0xFFFFFFFF)
        }
        require(startIdx == totalNumRequestsCommitted, "INVALID_REQUEST_RANGE");
        require(count > 0 && count <= blockSize, "INVALID_REQUEST_RANGE");
        require(startIdx + count <= requestChain.length, "INVALID_REQUEST_RANGE");
        require(totalNumRequestsCommitted + count <= 0xFFFFFFFF, "INVALID_REQUEST_RANGE");

        bytes32 startingHash = requestChain[startIdx - 1].accumulatedHash;
        bytes32 endingHash = requestChain[startIdx + count - 1].accumulatedHash;
        // Pad the block so it's full
        for (uint i = count; i < blockSize; i++) {
            endingHash = sha256(
                abi.encodePacked(
                    endingHash,
                    uint24(0),
                    uint(0),
                    uint(0),
                    uint8(0),
                    uint96(0)
                )
            );
        }
        bytes32 inputStartingHash = 0x0;
        bytes32 inputEndingHash = 0x0;
        assembly {
            inputStartingHash := mload(add(data, 100))
            inputEndingHash := mload(add(data, 132))
        }
        require(inputStartingHash == startingHash, "INVALID_STARTING_HASH");
        require(inputEndingHash == endingHash, "INVALID_ENDING_HASH");

        RequestBlock memory newDepositBlock = RequestBlock(
            blockIdx,
            uint16(count),
            uint32(totalNumRequestsCommitted + count),
            false,
            0,
            new bytes(0)
        );
        requestBlocks.push(newDepositBlock);
    }

    function createOrUpdateAccountInternal(
        address owner,
        uint    pubKeyX,
        uint    pubKeyY,
        bytes   memory permission
        )
        internal
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        )
    {
        isAccountNew = !exchange.hasAccount(owner);
        if (isAccountNew) {
            if (addressWhitelist != address(0)) {
                require(
                    IAddressWhitelist(addressWhitelist)
                        .isAddressWhitelisted(owner, permission),
                    "ADDRESS_NOT_WHITELISTED"
                );
            }
            accountID = uint24(exchange.getNumAccounts());
            ExchangeData.Account memory newAccount = ExchangeData.Account(
                owner,
                accountID,
                pubKeyX,
                pubKeyY
            );
            exchange.createAccount(newAccount);
            isAccountUpdated = false;
        } else {
            ExchangeData.Account memory account = exchange.getAccount(owner);
            account.pubKeyX = pubKeyX;
            account.pubKeyY = pubKeyY;
            accountID = account.id;
            isAccountUpdated = exchange.updateAccount(account);
        }
    }

    function updateAccountAndDepositInternal(
        address owner,
        uint    pubKeyX,
        uint    pubKeyY,
        address token,
        uint96  amount,
        bytes   memory permission
        )
        internal
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        )
    {
        (accountID, isAccountNew, isAccountUpdated) = createOrUpdateAccountInternal(
            owner,
            pubKeyX,
            pubKeyY,
            permission
        );
        uint additionalFeeETH = 0;
        if (isAccountNew) {
            additionalFeeETH = accountCreationFeeETH;
        } else if (isAccountUpdated) {
            additionalFeeETH = accountUpdateFeeETH;
        }
        depositInternal(
            owner,
            owner,
            token,
            amount,
            additionalFeeETH
        );
    }

    function depositInternal(
        address from,
        address to,
        address tokenAddress,
        uint96  amount,  // can be zero
        uint    additionalFeeETH
        )
        internal
    {
        require(from != address(0), "ZERO_ADDRESS");
        require(to != address(0), "ZERO_ADDRESS");
        require(exchange.areUserRequestsEnabled(), "USER_REQUEST_SUSPENDED");
        require(getNumAvailableSlots() > 0, "TOO_MANY_REQUESTS_OPEN");

        ExchangeData.Token memory token = exchange.getToken(tokenAddress);
        require(!token.depositDisabled, "TOKEN_DEPOSIT_DISABLED");

        uint24 accountID = exchange.getAccountID(to);
        ExchangeData.Account memory account = exchange.getAccount(to);

        // We allow invalid public keys to be set for accounts to
        // disable offchain request signing.
        // Make sure we can detect accounts that were not yet created in the circuits
        // by forcing the pubKeyX to be non-zero.
        require(account.pubKeyX > 0, "INVALID_PUBKEY");
        // Make sure the public key can be stored in the SNARK field
        require(account.pubKeyX < ExchangeData.SNARK_SCALAR_FIELD(), "INVALID_PUBKEY");
        require(account.pubKeyY < ExchangeData.SNARK_SCALAR_FIELD(), "INVALID_PUBKEY");

        // Total fee to be paid by the user
        uint feeETH = additionalFeeETH.add(depositFeeETH);

        // Transfer the tokens to this contract
        transferDeposit(
            from,
            token.id,
            amount,
            feeETH
        );

        // Add the request to the deposit chain
        Request storage prevRequest = requestChain[requestChain.length - 1];
        Request memory request = Request(
            sha256(
                abi.encodePacked(
                    prevRequest.accumulatedHash,
                    accountID,
                    account.pubKeyX,  // Include the pubKey to allow using the same circuit for
                                      // account creation, account updating and depositing.
                                      // In the circuit we always overwrite the public keys in
                                      // the Account leaf with the data given onchain.
                    account.pubKeyY,
                    uint8(token.id),
                    amount
                )
            ),
            prevRequest.accumulatedFee.add(feeETH),
            uint32(now)
        );
        requestChain.push(request);

        // Store deposit info onchain so we can withdraw from uncommitted deposit blocks
        Deposit memory _deposit = Deposit(
            accountID,
            token.id,
            amount
        );
        deposits.push(_deposit);

        emit DepositRequested(
            uint32(requestChain.length - 1),
            accountID,
            token.id,
            amount,
            account.pubKeyX,
            account.pubKeyY
        );
    }

    function transferDeposit(
        address from,
        uint16  tokenID,
        uint    amount,
        uint    feeETH
        )
        private
    {
        uint totalRequiredETH = feeETH;
        uint amountETH = 0;
        if (tokenID == 0) {
            totalRequiredETH = totalRequiredETH.add(amount);
            amountETH = amount;
        }

        require(msg.value >= totalRequiredETH, "INSUFFICIENT_FEE");
        uint feeSurplus = msg.value.sub(totalRequiredETH);
        if (feeSurplus > 0) {
            msg.sender.sendETHAndVerify(feeSurplus, gasleft());
        }

        // Transfer the tokens from the source into the exchange
        // Keep the fee, paid in ETH, in this contract
        exchange.deposit.value(amountETH)(
            from,
            tokenID,
            amount
        );
    }
}


/// @title DepositModuleManager
/// @author Brecht Devos - <brecht@loopring.org>
contract DepositModuleManager is IExchangeModuleFactory, CircuitManager
{
    function createModule(
        address exchangeAddress
        )
        external
        returns (address)
    {
        // Can deploy the module using a proxy (if supported), cloning,...
        DepositModule instance = new DepositModule(exchangeAddress, address(this));
        return address(instance);
    }
}
