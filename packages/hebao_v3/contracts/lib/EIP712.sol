// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

library EIP712 {
    struct Domain {
        string name;
        string version;
        address verifyingContract;
    }

    bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );

    string internal constant EIP191_HEADER = "\x19\x01";

    function hash(Domain memory domain) internal view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    EIP712_DOMAIN_TYPEHASH,
                    keccak256(bytes(domain.name)),
                    keccak256(bytes(domain.version)),
                    block.chainid,
                    domain.verifyingContract
                )
            );
    }

    function hashPacked(
        bytes32 domainSeparator,
        bytes32 dataHash
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(EIP191_HEADER, domainSeparator, dataHash)
            );
    }
}
