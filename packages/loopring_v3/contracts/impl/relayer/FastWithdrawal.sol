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

import "./RelayerData.sol";

import "../../iface/IExchangeV3.sol";
import "../../iface/ICookieJarContract.sol";

import "../../lib/MathUint.sol";
import "../../thirdparty/ECDSA.sol";

/// @title An Implementation of IRelayer.
/// @dev FastWithdrawal needs to extend RelayerData to make sure the data layout matches
///      with that layout in the Relayer contract.
/// @author Brecht Devos - <brecht@loopring.org>
contract FastWithdrawal is RelayerData
{
    using ECDSA             for bytes32;
    using MathUint          for uint;

    function executeFastWithdrawal(
        address cookieJarContractAddress,
        address exchangeAddress,
        address destinationAddress,
        address from,
        address to,
        address token,
        uint24  fAmount,
        address feeToken,
        uint16  fFee,
        bool    onchainFeePayment,
        uint32  salt,
        bytes   calldata signature
        )
        external
    {
        // Check the signature
        bytes32 hash = keccak256(
            abi.encodePacked(
                cookieJarContractAddress,
                exchangeAddress,
                destinationAddress,
                from,
                to,
                token,
                uint(fAmount).decodeFloat(24),
                feeToken,
                uint(fFee).decodeFloat(16),
                onchainFeePayment,
                salt
            )
        );
        require(hash.toEthSignedMessageHash().recover(signature) == from, "UNAUTHORIZED");

        // Transfer the tokens directly to the destination address
        ICookieJarContract(cookieJarContractAddress).transfer(destinationAddress, token, uint(fAmount).decodeFloat(24));

        // Do fee payment directly from the user's wallet if requested
        if (onchainFeePayment) {
            IExchangeV3(exchangeAddress).onchainTransferFrom(
                from,
                to,
                feeToken,
                uint(fFee).decodeFloat(16)
            );
        }

        // Approve the conditional transfer
        IExchangeV3(exchangeAddress).approveConditionalTransfer(
            from,
            to,
            token,
            fAmount,
            feeToken,
            onchainFeePayment ? 0 : fFee,
            salt
        );
    }
}
