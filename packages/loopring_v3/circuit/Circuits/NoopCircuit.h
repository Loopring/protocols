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

    NoopCircuit(
        ProtoboardT& pb,
        const TransactionState& state,
        const std::string& prefix
    ) :
        BaseTransactionCircuit(pb, state, prefix)
    {
        setOutput(signatureRequired_A, state.constants.zero);
        setOutput(signatureRequired_B, state.constants.zero);
    }

    void generate_r1cs_witness()
    {

    }

    void generate_r1cs_constraints()
    {

    }

    const VariableArrayT getPublicData() const
    {
        return VariableArrayT(0, state.constants.zero);
    }
};

}

#endif
