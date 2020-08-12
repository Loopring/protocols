// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
#ifndef _NOOPCIRCUIT_H_
#define _NOOPCIRCUIT_H_

#include "Circuit.h"
#include "../Utils/Constants.h"
#include "../Utils/Data.h"

#include "ethsnarks.hpp"
#include "utils.hpp"

using namespace ethsnarks;

namespace Loopring
{

class NoopCircuit : public BaseTransactionCircuit
{
  public:
    NoopCircuit( //
      ProtoboardT &pb,
      const TransactionState &state,
      const std::string &prefix)
        : BaseTransactionCircuit(pb, state, prefix)
    {
        // No signatures needed
        setOutput(TXV_SIGNATURE_REQUIRED_A, state.constants._0);
        setOutput(TXV_SIGNATURE_REQUIRED_B, state.constants._0);
    }

    void generate_r1cs_witness()
    {
    }

    void generate_r1cs_constraints()
    {
    }

    const VariableArrayT getPublicData() const
    {
        return VariableArrayT(0, state.constants._0);
    }
};

} // namespace Loopring

#endif
