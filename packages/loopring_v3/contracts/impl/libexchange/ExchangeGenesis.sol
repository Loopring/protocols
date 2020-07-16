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

    function initializeGenesisBlock(
        ExchangeData.State storage S,
        uint    _id,
        address _loopringAddress,
        address payable _operator,
        bool    _onchainDataAvailability,
        bytes32 _genesisMerkleRoot
        )
        external
    {
        require(0 != _id, "INVALID_ID");
        require(address(0) != _loopringAddress, "ZERO_ADDRESS");
        require(address(0) != _operator, "ZERO_ADDRESS");
        require(_genesisMerkleRoot != 0, "ZERO_GENESIS_MERKLE_ROOT");
        require(S.id == 0, "INITIALIZED_ALREADY");

        S.id = _id;
        S.exchangeCreationTimestamp = now;
        S.loopring = ILoopringV3(_loopringAddress);
        S.operator = _operator;
        S.onchainDataAvailability = _onchainDataAvailability;
        S.genesisMerkleRoot = _genesisMerkleRoot;

        ILoopringV3 loopring = ILoopringV3(_loopringAddress);
        S.blockVerifier = IBlockVerifier(loopring.blockVerifierAddress());

        S.merkleRoot = S.genesisMerkleRoot;
        S.blocks.push(ExchangeData.BlockInfo(bytes32(0)));

        // Get the protocol fees for this exchange
        S.protocolFeeData.timestamp = uint32(0);
        S.protocolFeeData.takerFeeBips = S.loopring.maxProtocolTakerFeeBips();
        S.protocolFeeData.makerFeeBips = S.loopring.maxProtocolMakerFeeBips();
        S.protocolFeeData.previousTakerFeeBips = S.protocolFeeData.takerFeeBips;
        S.protocolFeeData.previousMakerFeeBips = S.protocolFeeData.makerFeeBips;

        // Call these after the main state has been set up
        S.registerToken(address(0), 0);
        S.registerToken(loopring.lrcAddress(), 0);
    }
}