// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
#ifndef _SIGNATUREVERIFICATIONCIRCUIT_H_
#define _SIGNATUREVERIFICATIONCIRCUIT_H_

#include "Circuit.h"
#include "../Utils/Constants.h"
#include "../Utils/Data.h"

#include "ethsnarks.hpp"
#include "utils.hpp"

#include "../Gadgets/SignatureGadgets.h"

using namespace ethsnarks;

namespace Loopring
{

class SignatureVerificationCircuit : public BaseTransactionCircuit
{
  public:
    // Inputs
    DualVariableGadget owner;
    DualVariableGadget accountID;
    DualVariableGadget data;

    EqualGadget isSignatureVerificationTx;

    SignatureVerificationCircuit( //
      ProtoboardT &pb,
      const TransactionState &state,
      const std::string &prefix)
        : BaseTransactionCircuit(pb, state, prefix),

          // Inputs
          owner(pb, state.accountA.account.owner, NUM_BITS_ADDRESS, FMT(prefix, ".owner")),
          accountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".accountID")),
          data(pb, NUM_BITS_FIELD_CAPACITY, FMT(prefix, ".data")),

          isSignatureVerificationTx( //
            pb,
            state.type,
            state.constants.txTypeSignatureVerification,
            FMT(prefix, ".isSignatureVerificationTx"))
    {
        setArrayOutput(TXV_ACCOUNT_A_ADDRESS, accountID.bits);

        // We need a single signature of the account
        setOutput(TXV_HASH_A, data.packed);
        setOutput(TXV_SIGNATURE_REQUIRED_A, isSignatureVerificationTx.result());
        setOutput(TXV_SIGNATURE_REQUIRED_B, state.constants._0);
    }

    void generate_r1cs_witness(const SignatureVerification &verification)
    {
        // Inputs
        owner.generate_r1cs_witness();
        accountID.generate_r1cs_witness(pb, verification.accountID);
        data.generate_r1cs_witness(pb, verification.data);

        isSignatureVerificationTx.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        // Inputs
        owner.generate_r1cs_constraints();
        accountID.generate_r1cs_constraints(true);
        data.generate_r1cs_constraints(true);

        isSignatureVerificationTx.generate_r1cs_constraints();
    }

    const VariableArrayT getPublicData() const
    {
        return flattenReverse({owner.bits, accountID.bits, VariableArrayT(3, state.constants._0), data.bits});
    }
};

} // namespace Loopring

#endif
