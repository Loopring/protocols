// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable reason-string */

import "../interfaces/IAggregator.sol";
import "../interfaces/IEntryPoint.sol";
import "../samples/SimpleAccount.sol";

/**
 * test signature aggregator.
 * the aggregated signature is the SUM of the nonce fields..
 */
contract TestSignatureAggregator is IAggregator {

    /// @inheritdoc IAggregator
    function validateSignatures(UserOperation[] calldata userOps, bytes calldata signature) external pure override {
        uint sum = 0;
        for (uint i = 0; i < userOps.length; i++) {
            uint nonce = userOps[i].nonce;
            sum += nonce;
        }
        require(signature.length == 32, "TestSignatureValidator: sig must be uint");
        (uint sig) = abi.decode(signature, (uint));
        require(sig == sum, "TestSignatureValidator: aggregated signature mismatch (nonce sum)");
    }

    /// @inheritdoc IAggregator
    function validateUserOpSignature(UserOperation calldata)
    external pure returns (bytes memory) {
        return "";
    }

    /**
     * dummy test aggregator: sum all nonce values of UserOps.
     */
    function aggregateSignatures(UserOperation[] calldata userOps) external pure returns (bytes memory aggregatedSignature) {
        uint sum = 0;
        for (uint i = 0; i < userOps.length; i++) {
            sum += userOps[i].nonce;
        }
        return abi.encode(sum);
    }

    /**
     * Calls the 'addStake' method of the EntryPoint. Forwards the entire msg.value to this call.
     * @param entryPoint - the EntryPoint to send the stake to.
     * @param delay - the new lock duration before the deposit can be withdrawn.
     */
    function addStake(IEntryPoint entryPoint, uint32 delay) external payable {
        entryPoint.addStake{value: msg.value}(delay);
    }
}
