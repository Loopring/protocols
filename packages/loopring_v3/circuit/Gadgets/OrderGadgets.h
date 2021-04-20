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

namespace Loopring
{

class OrderGadget : public GadgetT
{
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
    DualVariableGadget fillAmountBorS;
    VariableT taker;

    DualVariableGadget feeBips;
    DualVariableGadget amm;

    DualVariableGadget feeBipsMultiplierFlag;
    DualVariableGadget feeBipsData;

    NotGadget notAmm;

    // Checks
    RequireLeqGadget feeBips_leq_maxFeeBips;
    RequireNotEqualGadget tokenS_neq_tokenB;
    RequireNotZeroGadget amountS_notZero;
    RequireNotZeroGadget amountB_notZero;
    // Fee checks
    TernaryGadget feeMultiplier;
    UnsafeMulGadget decodedFeeBips;
    RequireEqualGadget feeBipsEqualsDecodedFeeBips;

    // Signature
    Poseidon_11 hash;

    OrderGadget( //
      ProtoboardT &pb,
      const Constants &constants,
      const VariableT &blockExchange,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          // Inputs
          storageID(pb, NUM_BITS_STORAGEID, FMT(prefix, ".storageID")),
          accountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".accountID")),
          tokenS(pb, NUM_BITS_TOKEN, FMT(prefix, ".tokenS")),
          tokenB(pb, NUM_BITS_TOKEN, FMT(prefix, ".tokenB")),
          amountS(pb, NUM_BITS_AMOUNT, FMT(prefix, ".amountS")),
          amountB(pb, NUM_BITS_AMOUNT, FMT(prefix, ".amountB")),
          validUntil(pb, NUM_BITS_TIMESTAMP, FMT(prefix, ".validUntil")),
          maxFeeBips(pb, NUM_BITS_BIPS, FMT(prefix, ".maxFeeBips")),
          fillAmountBorS(pb, 1, FMT(prefix, ".fillAmountBorS")),
          taker(make_variable(pb, FMT(prefix, ".taker"))),

          feeBips(pb, NUM_BITS_BIPS, FMT(prefix, ".feeBips")),
          amm(pb, 1, FMT(prefix, ".amm")),

          feeBipsMultiplierFlag(pb, 1, FMT(prefix, ".feeBipsMultiplierFlag")),
          feeBipsData(pb, NUM_BITS_BIPS_DA, FMT(prefix, ".feeBipsData")),

          notAmm(pb, amm.packed, FMT(prefix, ".notAmm")),

          // Checks
          feeBips_leq_maxFeeBips(
            pb,
            feeBips.packed,
            maxFeeBips.packed,
            NUM_BITS_BIPS,
            FMT(prefix, ".feeBips <= maxFeeBips")),
          tokenS_neq_tokenB(pb, tokenS.packed, tokenB.packed, FMT(prefix, ".tokenS != tokenB")),
          amountS_notZero(pb, amountS.packed, FMT(prefix, ".amountS != 0")),
          amountB_notZero(pb, amountB.packed, FMT(prefix, ".amountB != 0")),
          // Fee checks
          feeMultiplier(
            pb,
            feeBipsMultiplierFlag.packed,
            constants.feeMultiplier,
            constants._1,
            FMT(prefix, ".feeMultiplier")),
          decodedFeeBips(pb, feeBipsData.packed, feeMultiplier.result(), FMT(prefix, ".decodedFeeBips")),
          feeBipsEqualsDecodedFeeBips(
            pb,
            feeBips.packed,
            decodedFeeBips.result(),
            FMT(prefix, ".feeBipsEqualsDecodedFeeBips")),

          // Signature
          hash(
            pb,
            var_array(
              {blockExchange,
               storageID.packed,
               accountID.packed,
               tokenS.packed,
               tokenB.packed,
               amountS.packed,
               amountB.packed,
               validUntil.packed,
               maxFeeBips.packed,
               fillAmountBorS.packed,
               taker}),
            FMT(this->annotation_prefix, ".hash"))
    {
    }

    void generate_r1cs_witness(const Order &order)
    {
        // Inputs
        storageID.generate_r1cs_witness(pb, order.storageID);
        accountID.generate_r1cs_witness(pb, order.accountID);
        tokenS.generate_r1cs_witness(pb, order.tokenS);
        tokenB.generate_r1cs_witness(pb, order.tokenB);
        amountS.generate_r1cs_witness(pb, order.amountS);
        amountB.generate_r1cs_witness(pb, order.amountB);
        validUntil.generate_r1cs_witness(pb, order.validUntil);
        maxFeeBips.generate_r1cs_witness(pb, order.maxFeeBips);
        fillAmountBorS.generate_r1cs_witness(pb, order.fillAmountBorS);
        pb.val(taker) = order.taker;

        feeBips.generate_r1cs_witness(pb, order.feeBips);
        amm.generate_r1cs_witness(pb, order.amm);

        // Use the fee multiplier if necessary
        if (toBigInt(order.feeBips) >= 64 /*2**NUM_BITS_BIPS_DA*/)
        {
            feeBipsMultiplierFlag.generate_r1cs_witness(pb, ethsnarks::FieldT(1));
            feeBipsData.generate_r1cs_witness(
              pb, ethsnarks::FieldT((toBigInt(order.feeBips) / FEE_MULTIPLIER).to_int()));
        }
        else
        {
            feeBipsMultiplierFlag.generate_r1cs_witness(pb, ethsnarks::FieldT(0));
            feeBipsData.generate_r1cs_witness(pb, order.feeBips);
        }

        notAmm.generate_r1cs_witness();

        // Checks
        feeBips_leq_maxFeeBips.generate_r1cs_witness();
        tokenS_neq_tokenB.generate_r1cs_witness();
        amountS_notZero.generate_r1cs_witness();
        amountB_notZero.generate_r1cs_witness();
        // Fee checks
        feeMultiplier.generate_r1cs_witness();
        decodedFeeBips.generate_r1cs_witness();
        feeBipsEqualsDecodedFeeBips.generate_r1cs_witness();

        // Signature
        hash.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        // Inputs
        storageID.generate_r1cs_constraints(true);
        accountID.generate_r1cs_constraints(true);
        tokenS.generate_r1cs_constraints(true);
        tokenB.generate_r1cs_constraints(true);
        amountS.generate_r1cs_constraints(true);
        amountB.generate_r1cs_constraints(true);
        validUntil.generate_r1cs_constraints(true);
        maxFeeBips.generate_r1cs_constraints(true);
        fillAmountBorS.generate_r1cs_constraints(true);

        feeBips.generate_r1cs_constraints(true);
        amm.generate_r1cs_constraints(true);

        feeBipsMultiplierFlag.generate_r1cs_constraints(true);
        feeBipsData.generate_r1cs_constraints(true);

        notAmm.generate_r1cs_constraints();

        // Checks
        feeBips_leq_maxFeeBips.generate_r1cs_constraints();
        tokenS_neq_tokenB.generate_r1cs_constraints();
        amountS_notZero.generate_r1cs_constraints();
        amountB_notZero.generate_r1cs_constraints();
        // Fee checks
        feeMultiplier.generate_r1cs_constraints();
        decodedFeeBips.generate_r1cs_constraints();
        feeBipsEqualsDecodedFeeBips.generate_r1cs_constraints();

        // Signature
        hash.generate_r1cs_constraints();
    }
};

} // namespace Loopring

#endif
