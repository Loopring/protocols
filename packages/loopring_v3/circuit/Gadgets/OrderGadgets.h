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
    VariableT nftDataB;

    DualVariableGadget feeBips;
    DualVariableGadget amm;

    NotGadget notAmm;

    // Checks
    RequireLeqGadget feeBips_leq_maxFeeBips;
    RequireNotEqualGadget tokenS_neq_tokenB;
    RequireNotZeroGadget amountS_notZero;
    RequireNotZeroGadget amountB_notZero;

    // NFT
    IsNftGadget isNftTokenS;
    IsNftGadget isNftTokenB;
    AndGadget isNftTokenSandB;
    TernaryGadget hashDataTokenB;
    IfThenRequireEqualGadget requireNoFeeOnNft;
    AndGadget noNfts;
    IfThenRequireGadget noNftsInAmm;

    // Fees
    RequireLeqGadget maxFeeBipsLeq10000;
    TernaryGadget feeBipsS;
    TernaryGadget feeBipsB;

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
          nftDataB(make_variable(pb, FMT(prefix, ".nftDataB"))),

          feeBips(pb, NUM_BITS_BIPS, FMT(prefix, ".feeBips")),
          amm(pb, 1, FMT(prefix, ".amm")),

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

          // NFT
          isNftTokenS(pb, constants, tokenS.packed, FMT(prefix, ".isNftTokenS")),
          isNftTokenB(pb, constants, tokenB.packed, FMT(prefix, ".isNftTokenB")),
          isNftTokenSandB(pb, {isNftTokenS.isNFT(), isNftTokenB.isNFT()}, FMT(prefix, ".isNftTokenSandB")),
          hashDataTokenB(pb, isNftTokenB.isNotNFT(), tokenB.packed, nftDataB, FMT(prefix, ".hashDataTokenB")),
          // Disallow paying fees in NFTs (if tokenB is an NFT then feeBips needs to be 0)
          requireNoFeeOnNft(
            pb,
            isNftTokenSandB.result(),
            feeBips.packed,
            constants._0,
            FMT(prefix, ".requireNoFeeOnNft")),
          // Don't allow an AMM to contain NFTs (impossible because the weights/NFT data uses the same storage slot)
          noNfts(pb, {isNftTokenS.isNotNFT(), isNftTokenB.isNotNFT()}, FMT(prefix, ".noNfts")),
          noNftsInAmm(pb, amm.packed, noNfts.result(), FMT(prefix, ".noNftsInAmm")),

          // Fees
          maxFeeBipsLeq10000(
            pb,
            maxFeeBips.packed,
            constants._10000,
            NUM_BITS_BIPS,
            FMT(prefix, ".maxFeeBipsLeq10000")),
          feeBipsS(pb, isNftTokenB.isNFT(), feeBips.packed, constants._0, FMT(prefix, ".feeBipsS")),
          feeBipsB(pb, isNftTokenB.isNFT(), constants._0, feeBips.packed, FMT(prefix, ".feeBipsB")),

          // Signature
          hash(
            pb,
            var_array(
              {blockExchange,
               storageID.packed,
               accountID.packed,
               tokenS.packed,
               hashDataTokenB.result(),
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
        pb.val(nftDataB) = order.nftDataB;

        feeBips.generate_r1cs_witness(pb, order.feeBips);
        amm.generate_r1cs_witness(pb, order.amm);

        notAmm.generate_r1cs_witness();

        // Checks
        feeBips_leq_maxFeeBips.generate_r1cs_witness();
        tokenS_neq_tokenB.generate_r1cs_witness();
        amountS_notZero.generate_r1cs_witness();
        amountB_notZero.generate_r1cs_witness();

        // NFT
        isNftTokenS.generate_r1cs_witness();
        isNftTokenB.generate_r1cs_witness();
        isNftTokenSandB.generate_r1cs_witness();
        hashDataTokenB.generate_r1cs_witness();
        requireNoFeeOnNft.generate_r1cs_witness();
        noNfts.generate_r1cs_witness();
        noNftsInAmm.generate_r1cs_witness();

        // Fees
        maxFeeBipsLeq10000.generate_r1cs_witness();
        feeBipsS.generate_r1cs_witness();
        feeBipsB.generate_r1cs_witness();

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

        notAmm.generate_r1cs_constraints();

        // Checks
        feeBips_leq_maxFeeBips.generate_r1cs_constraints();
        tokenS_neq_tokenB.generate_r1cs_constraints();
        amountS_notZero.generate_r1cs_constraints();
        amountB_notZero.generate_r1cs_constraints();

        // NFT
        isNftTokenS.generate_r1cs_constraints();
        isNftTokenB.generate_r1cs_constraints();
        isNftTokenSandB.generate_r1cs_constraints();
        hashDataTokenB.generate_r1cs_constraints();
        requireNoFeeOnNft.generate_r1cs_constraints();
        noNfts.generate_r1cs_constraints();
        noNftsInAmm.generate_r1cs_constraints();

        // Fees
        maxFeeBipsLeq10000.generate_r1cs_constraints();
        feeBipsS.generate_r1cs_constraints();
        feeBipsB.generate_r1cs_constraints();

        // Signature
        hash.generate_r1cs_constraints();
    }
};

} // namespace Loopring

#endif
