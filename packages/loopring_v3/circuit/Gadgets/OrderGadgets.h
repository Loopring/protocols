// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
#ifndef _ORDERGADGETS_H_
#define _ORDERGADGETS_H_

#include "../Utils/Constants.h"
#include "../Utils/Data.h"
#include "StorageGadgets.h"
#include "AccountGadgets.h"

#include "ethsnarks.hpp"
#include "gadgets/poseidon.hpp"
#include "utils.hpp"

using namespace ethsnarks;

namespace Loopring {

class OrderGadget : public GadgetT {
public:
  // Inputs
  DualVariableGadget storageID;
  DualVariableGadget accountID;
  DualVariableGadget tokenS;
  DualVariableGadget tokenB;
  DualVariableGadget amountS;
  DualVariableGadget amountB;
  DualVariableGadget validUntil;
  DualVariableGadget maxFeeBips;
  DualVariableGadget buy;
  VariableT taker;

  DualVariableGadget feeBips;

  // Checks
  RequireLeqGadget feeBips_leq_maxFeeBips;
  RequireNotEqualGadget tokenS_neq_tokenB;
  RequireNotZeroGadget amountS_notZero;
  RequireNotZeroGadget amountB_notZero;

  // Signature
  Poseidon_gadget_T<12, 1, 6, 53, 11, 1> hash;

  OrderGadget(ProtoboardT &_pb, const Constants &constants,
              const VariableT &blockExchange, const std::string &prefix)
      : GadgetT(_pb, prefix),

        // Inputs
        storageID(_pb, NUM_BITS_STORAGEID, FMT(prefix, ".storageID")),
        accountID(_pb, NUM_BITS_ACCOUNT, FMT(prefix, ".accountID")),
        tokenS(_pb, NUM_BITS_TOKEN, FMT(prefix, ".tokenS")),
        tokenB(_pb, NUM_BITS_TOKEN, FMT(prefix, ".tokenB")),
        amountS(_pb, NUM_BITS_AMOUNT, FMT(prefix, ".amountS")),
        amountB(_pb, NUM_BITS_AMOUNT, FMT(prefix, ".amountB")),
        validUntil(_pb, NUM_BITS_TIMESTAMP, FMT(prefix, ".validUntil")),
        maxFeeBips(_pb, NUM_BITS_BIPS, FMT(prefix, ".maxFeeBips")),
        buy(_pb, 1, FMT(prefix, ".buy")),
        taker(make_variable(_pb, FMT(prefix, ".taker"))),

        feeBips(_pb, NUM_BITS_BIPS, FMT(prefix, ".feeBips")),

        // Checks
        feeBips_leq_maxFeeBips(_pb, feeBips.packed, maxFeeBips.packed,
                               NUM_BITS_BIPS,
                               FMT(prefix, ".feeBips <= maxFeeBips")),
        tokenS_neq_tokenB(_pb, tokenS.packed, tokenB.packed,
                          FMT(prefix, ".tokenS != tokenB")),
        amountS_notZero(_pb, amountS.packed, FMT(prefix, ".amountS != 0")),
        amountB_notZero(_pb, amountB.packed, FMT(prefix, ".amountB != 0")),

        // Signature
        hash(_pb,
             var_array({blockExchange, storageID.packed, accountID.packed,
                        tokenS.packed, tokenB.packed, amountS.packed,
                        amountB.packed, validUntil.packed, maxFeeBips.packed,
                        buy.packed, taker}),
             FMT(this->annotation_prefix, ".hash")) {}

  void generate_r1cs_witness(const Order &order) {
    // Inputs
    storageID.generate_r1cs_witness(_pb, order.storageID);
    accountID.generate_r1cs_witness(_pb, order.accountID);
    tokenS.generate_r1cs_witness(_pb, order.tokenS);
    tokenB.generate_r1cs_witness(_pb, order.tokenB);
    amountS.generate_r1cs_witness(_pb, order.amountS);
    amountB.generate_r1cs_witness(_pb, order.amountB);
    validUntil.generate_r1cs_witness(_pb, order.validUntil);
    maxFeeBips.generate_r1cs_witness(_pb, order.maxFeeBips);
    buy.generate_r1cs_witness(_pb, order.buy);
    pb.val(taker) = order.taker;

    feeBips.generate_r1cs_witness(_pb, order.feeBips);

    // Checks
    feeBips_leq_maxFeeBips.generate_r1cs_witness();
    tokenS_neq_tokenB.generate_r1cs_witness();
    amountS_notZero.generate_r1cs_witness();
    amountB_notZero.generate_r1cs_witness();

    // Signature
    hash.generate_r1cs_witness();
  }

  void generate_r1cs_constraints(bool doSignatureCheck = true) {
    // Inputs
    storageID.generate_r1cs_constraints(true);
    accountID.generate_r1cs_constraints(true);
    tokenS.generate_r1cs_constraints(true);
    tokenB.generate_r1cs_constraints(true);
    amountS.generate_r1cs_constraints(true);
    amountB.generate_r1cs_constraints(true);
    validUntil.generate_r1cs_constraints(true);
    maxFeeBips.generate_r1cs_constraints(true);
    buy.generate_r1cs_constraints(true);

    feeBips.generate_r1cs_constraints(true);

    // Checks
    feeBips_leq_maxFeeBips.generate_r1cs_constraints();
    tokenS_neq_tokenB.generate_r1cs_constraints();
    amountS_notZero.generate_r1cs_constraints();
    amountB_notZero.generate_r1cs_constraints();

    // Signature
    hash.generate_r1cs_constraints();
  }
};

} // namespace Loopring

#endif
