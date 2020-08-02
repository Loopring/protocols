// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../lib/Poseidon.sol";
import "../iface/ExchangeData.sol";


contract PoseidonContract {
    function hash_t5f6p52(
        uint t0,
        uint t1,
        uint t2,
        uint t3,
        uint t4
        )
        external
        pure
        returns (uint)
    {
        Poseidon.HashInputs5 memory inputs = Poseidon.HashInputs5(t0, t1, t2, t3, t4);
        return Poseidon.hash_t5f6p52(inputs, ExchangeData.SNARK_SCALAR_FIELD());
    }

    function hash_t6f6p52(
        uint t0,
        uint t1,
        uint t2,
        uint t3,
        uint t4,
        uint t5
        )
        external
        pure
        returns (uint)
    {
        Poseidon.HashInputs6 memory inputs = Poseidon.HashInputs6(t0, t1, t2, t3, t4, t5);
        return Poseidon.hash_t6f6p52(inputs, ExchangeData.SNARK_SCALAR_FIELD());
    }
}
