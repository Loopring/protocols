// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./SignedRequest.sol";
import "./WalletData.sol";


/// @title UpgradeLib
/// @author Brecht Devos - <brecht@loopring.org>
library UpgradeLib
{
    using SignedRequest   for Wallet;

    event ChangedMasterCopy (address masterCopy);

    bytes32 public constant CHANGE_MASTER_COPY_TYPEHASH = keccak256(
        "changeMasterCopy(address wallet,uint256 validUntil,address masterCopy)"
    );

    function changeMasterCopy(
        Wallet  storage  wallet,
        bytes32          domainSeperator,
        Request calldata request,
        address          newMasterCopy
        )
        external
        returns (address)
    {
        require(newMasterCopy != address(0), "INVALID_MASTER_COPY");

        wallet.verifyRequest(
            domainSeperator,
            SigRequirement.MAJORITY_OWNER_REQUIRED,
            request,
            abi.encode(
                CHANGE_MASTER_COPY_TYPEHASH,
                request.wallet,
                request.validUntil,
                newMasterCopy
            )
        );

        emit ChangedMasterCopy(newMasterCopy);

        return newMasterCopy;
    }
}