// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../lib/OwnerManagable.sol";
import "../lib/Drainable.sol";
import "../thirdparty/chi/IChiToken.sol";


/// @title BatchTransactor
/// @author Daniel Wang - <daniel@loopring.org>
contract BatchTransactor is Drainable, OwnerManagable
{
    IChiToken public immutable chi;

    // See:
    // - https://github.com/1inch-exchange/1inchProtocol/blob/a7781cf9aa1cc2aaa5ccab0d54ecbae1327ca08f/contracts/OneSplitAudit.sol#L343
    // - https://github.com/curvefi/curve-ren-adapter/blob/8c1fbc3fec41ebd79b06984d72ff6ace3198e62d/truffle/contracts/CurveExchangeAdapter.sol#L104
    modifier discountCHI(uint maxToBurn)
    {
        uint gasStart = gasleft();
        _;
        if (maxToBurn == 0) return;
        uint gasSpent = 21000 + gasStart - gasleft() + 16 * msg.data.length;
        uint fullAmountToBurn = (gasSpent + 14154) / 41947;
        uint amountToBurn = fullAmountToBurn > maxToBurn ? maxToBurn : fullAmountToBurn;
        if (amountToBurn > 0) {
            // Only managers are allowed to burn tokens using this contract.
            require(isManager(msg.sender), "UNAUTHORIZED");
            chi.freeUpTo(amountToBurn);
        }
    }

    constructor(
        address _chi             // Mainnet: 0x0000000000004946c0e9F43F4Dee607b0eF1fA1c
        )
    {
        chi = IChiToken(_chi);
    }

    function batchTransact(
        address target,
        bytes[] calldata txs,
        uint[]  calldata gasLimits,
        uint    numGasTokensToBurn
        )
        external
        discountCHI(numGasTokensToBurn)
    {
        require(target != address(0), "EMPTY_TARGET");
        require(txs.length == gasLimits.length, "SIZE_DIFF");

        for (uint i = 0; i < txs.length; i++) {
            (bool success, bytes memory returnData) = target.call{gas: gasLimits[i]}(txs[i]);
            if (!success) {
                assembly {
                    revert(add(returnData, 32), mload(returnData))
                }
            }
        }
    }

    function canDrain(address drainer, address /*token*/)
        public
        override
        view
        returns (bool)
    {
        return drainer == owner;
    }
}
