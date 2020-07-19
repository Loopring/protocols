// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../../lib/MathUint.sol";

import "../../iface/ExchangeData.sol";
import "../../iface/IBlockVerifier.sol";
import "../../iface/ILoopringV3.sol";

import "./ExchangeTokens.sol";


/// @title ExchangeGenesis.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeGenesis
{
    using ExchangeTokens    for ExchangeData.State;

    modifier onlyWhenUninitialized(ExchangeData.State memory S)
    {
        require(S.id == 0, "INITIALIZED_ALREADY");
        _;
    }

    function initializeGenesisBlock(
        ExchangeData.State storage S,
        uint    _id,
        address _loopringAddress,
        address payable _operator,
        bool    _rollupEnabled,
        bytes32 _genesisMerkleRoot,
        bytes32 _domainSeperator
        )
        external
        onlyWhenUninitialized(S)
    {
        require(0 != _id, "INVALID_ID");
        require(address(0) != _loopringAddress, "ZERO_ADDRESS");
        require(address(0) != _operator, "ZERO_ADDRESS");
        require(_genesisMerkleRoot != 0, "ZERO_GENESIS_MERKLE_ROOT");

        S.id = _id;
        S.exchangeCreationTimestamp = now;
        S.operator = _operator;
        S.rollupEnabled = _rollupEnabled;
        S.maxAgeDepositUntilWithdrawable = ExchangeData.MAX_AGE_DEPOSIT_UNTIL_WITHDRAWABLE_UPPERBOUND();
        S.genesisMerkleRoot = _genesisMerkleRoot;
        S.DOMAIN_SEPARATOR = _domainSeperator;

        ILoopringV3 loopring = ILoopringV3(_loopringAddress);
        S.loopring = loopring;
        S.blockVerifier = IBlockVerifier(loopring.blockVerifierAddress());

        S.merkleRoot = S.genesisMerkleRoot;
        S.blocks.push(ExchangeData.BlockInfo(bytes32(0)));

        // Get the protocol fees for this exchange
        S.protocolFeeData.syncedAt = uint32(now);
        S.protocolFeeData.takerFeeBips = S.loopring.maxProtocolTakerFeeBips();
        S.protocolFeeData.makerFeeBips = S.loopring.maxProtocolMakerFeeBips();
        S.protocolFeeData.previousTakerFeeBips = S.protocolFeeData.takerFeeBips;
        S.protocolFeeData.previousMakerFeeBips = S.protocolFeeData.makerFeeBips;

        // Call these after the main state has been set up
        S.registerToken(address(0), 0);
        S.registerToken(loopring.lrcAddress(), 0);
    }
}