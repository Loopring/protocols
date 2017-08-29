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
pragma solidity ^0.4.11;

/// @title Loopring Token Exchange Contract
/// @author Kongliang Zhong - <kongliang@loopring.org>, Daniel Wang - <daniel@loopring.org>.
contract LoopringExchange {

    address public   owner;
    uint    public   loopringId = 0;

    struct OrderRing {
        address owner;
        Order[] orders;
    }

    struct Order {
        address outToken;
        address inToken;
        uint outTokenAmount;
        uint inTokenAmount;
        uint expirationInSecs;
        uint fee;
        uint8 savingShare;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    event RingFilled(address _ringOwner, uint _loopringId);

    function LoopringExchange(address _owner) public {
        owner = _owner;
    }

    function fillRing(
        address orderRingOwner,
        address[3][] orderAddresses,
        uint[5][] orderValues,
        uint8[] savingShares,
        uint8[] v,
        bytes32[] r,
        bytes32[] s)
    {
        for (uint i = 0; i < orderAddresses.length; i++) {
            require(fillOrder(orderAddresses[i],
                              orderValues[i],
                              savingShares[i],
                              v[i],
                              r[i],
                              s[i]
            ));
        }

        RingFilled(orderRingOwner, loopringId++);
    }

    function fillOrder(
        address[3] orderAddress,
        uint[5] orderValue,
        uint8 savingShare,
        uint8 v,
        bytes32 r,
        bytes32 s)
        internal
        returns (bool)
    {

        // TODO
        return true;
    }

    /// @dev Verifies that an order signature is valid.
    /// @param signer address of signer.
    /// @param hash Signed Keccak-256 hash.
    /// @param v ECDSA signature parameter v.
    /// @param r ECDSA signature parameters r.
    /// @param s ECDSA signature parameters s.
    /// @return Validity of order signature.
    function isValidSignature(
        address signer,
        bytes32 hash,
        uint8 v,
        bytes32 r,
        bytes32 s)
        public
        constant
        returns (bool)
    {
        return signer == ecrecover(
            keccak256("\x19Ethereum Signed Message:\n32", hash),
            v,
            r,
            s
        );
    }

}
