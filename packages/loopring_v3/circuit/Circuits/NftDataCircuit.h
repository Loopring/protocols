// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
#ifndef _NFTDATACIRCUIT_H_
#define _NFTDATACIRCUIT_H_

#include "Circuit.h"
#include "../Utils/Constants.h"
#include "../Utils/Data.h"

#include "ethsnarks.hpp"
#include "utils.hpp"

using namespace ethsnarks;

namespace Loopring
{

// Makes the NFT data of an NFT available in the data-availability data.
// If no NFT is present in the token slot than the operator can provide dummy NFT data
// as long as the minter address is set to 0 to mark it as empty.
class NftDataCircuit : public BaseTransactionCircuit
{
  public:
    // Inputs
    DualVariableGadget type;
    DualVariableGadget accountID;
    DualVariableGadget tokenID;
    DualVariableGadget minter;
    DualVariableGadget nftType;
    DualVariableGadget tokenAddress;
    DualVariableGadget nftIDHi;
    DualVariableGadget nftIDLo;
    DualVariableGadget creatorFeeBips;

    // NftData
    NftDataGadget nftData;

    // Validate
    EqualGadget isNftDataTx;
    IsNftGadget isNftToken;
    IfThenRequireEqualGadget requireNftToken;
    NotEqualGadget isNftPresent;
    AndGadget validNftDataNeeded;
    NotGadget validNftDataNotNeeded;
    IfThenRequireEqualGadget validateNftData;
    IfThenRequireEqualGadget minterZeroAddress;

    // Type
    ArrayTernaryGadget onchainData;

    NftDataCircuit( //
      ProtoboardT &pb,
      const TransactionState &state,
      const std::string &prefix)
        : BaseTransactionCircuit(pb, state, prefix),

          // Inputs
          type(pb, NUM_BITS_TYPE, FMT(prefix, ".type")),
          accountID(pb, NUM_BITS_ACCOUNT, FMT(prefix, ".accountID")),
          tokenID(pb, NUM_BITS_TOKEN, FMT(prefix, ".tokenID")),
          minter(pb, NUM_BITS_ADDRESS, FMT(prefix, ".minter")),
          nftType(pb, NUM_BITS_TYPE, FMT(prefix, ".nftType")),
          tokenAddress(pb, NUM_BITS_ADDRESS, FMT(prefix, ".tokenAddress")),
          nftIDHi(pb, NUM_BITS_NFT_ID / 2, FMT(prefix, ".nftIDHi")),
          nftIDLo(pb, NUM_BITS_NFT_ID / 2, FMT(prefix, ".nftIDLo")),
          creatorFeeBips(pb, NUM_BITS_TYPE, FMT(prefix, ".creatorFeeBips")),

          // Validate
          isNftDataTx( //
            pb,
            state.type,
            state.constants.txTypeNftData,
            FMT(prefix, ".isNftDataTx")),
          isNftToken(pb, state.constants, tokenID.packed, FMT(prefix, ".isNftToken")),
          requireNftToken(
            pb,
            isNftDataTx.result(),
            isNftToken.isNFT(),
            state.constants._1,
            FMT(prefix, ".requireNftToken")),
          isNftPresent(pb, state.accountA.balanceS.weightAMM, state.constants._0, FMT(prefix, ".isNftPresent")),
          validNftDataNeeded(pb, {isNftDataTx.result(), isNftPresent.result()}, FMT(prefix, ".validNftDataNeeded")),
          validNftDataNotNeeded(pb, validNftDataNeeded.result(), FMT(prefix, ".validNftDataNotNeeded")),
          nftData(
            pb,
            minter.packed,
            nftType.packed,
            tokenAddress.packed,
            nftIDLo.packed,
            nftIDHi.packed,
            creatorFeeBips.packed,
            FMT(this->annotation_prefix, ".NftData")),
          validateNftData(
            pb,
            validNftDataNeeded.result(),
            nftData.result(),
            state.accountA.balanceS.weightAMM,
            FMT(prefix, ".validateNftData")),
          minterZeroAddress(
            pb,
            validNftDataNotNeeded.result(),
            minter.packed,
            state.constants._0,
            FMT(prefix, ".minterZeroAddress")),

          // Type
          onchainData(pb, type.packed, tokenAddress.bits, minter.bits, FMT(prefix, ".onchainData"))
    {
        setArrayOutput(TXV_ACCOUNT_A_ADDRESS, accountID.bits);
        setArrayOutput(TXV_BALANCE_A_S_ADDRESS, tokenID.bits);

        // No signatures needed
        setOutput(TXV_SIGNATURE_REQUIRED_A, state.constants._0);
        setOutput(TXV_SIGNATURE_REQUIRED_B, state.constants._0);
    }

    void generate_r1cs_witness(const NftData &nftDataTx)
    {
        // Inputs
        type.generate_r1cs_witness(pb, nftDataTx.type);
        accountID.generate_r1cs_witness(pb, nftDataTx.accountID);
        tokenID.generate_r1cs_witness(pb, nftDataTx.tokenID);
        minter.generate_r1cs_witness(pb, nftDataTx.minter);
        nftType.generate_r1cs_witness(pb, nftDataTx.nftType);
        tokenAddress.generate_r1cs_witness(pb, nftDataTx.tokenAddress);
        nftIDHi.generate_r1cs_witness(pb, nftDataTx.nftIDHi);
        nftIDLo.generate_r1cs_witness(pb, nftDataTx.nftIDLo);
        creatorFeeBips.generate_r1cs_witness(pb, nftDataTx.creatorFeeBips);

        // NftData
        nftData.generate_r1cs_witness();

        // Validate
        isNftDataTx.generate_r1cs_witness();
        isNftToken.generate_r1cs_witness();
        requireNftToken.generate_r1cs_witness();
        isNftPresent.generate_r1cs_witness();
        validNftDataNeeded.generate_r1cs_witness();
        validNftDataNotNeeded.generate_r1cs_witness();
        validateNftData.generate_r1cs_witness();
        minterZeroAddress.generate_r1cs_witness();

        // Type
        onchainData.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        // Inputs
        type.generate_r1cs_constraints(true);
        accountID.generate_r1cs_constraints(true);
        tokenID.generate_r1cs_constraints(true);
        minter.generate_r1cs_constraints();
        nftType.generate_r1cs_constraints(true);
        tokenAddress.generate_r1cs_constraints(true);
        nftIDHi.generate_r1cs_constraints(true);
        nftIDLo.generate_r1cs_constraints(true);
        creatorFeeBips.generate_r1cs_constraints(true);

        // NftData
        nftData.generate_r1cs_constraints();

        // Validate
        isNftDataTx.generate_r1cs_constraints();
        isNftToken.generate_r1cs_constraints();
        requireNftToken.generate_r1cs_constraints();
        isNftPresent.generate_r1cs_constraints();
        validNftDataNeeded.generate_r1cs_constraints();
        validNftDataNotNeeded.generate_r1cs_constraints();
        validateNftData.generate_r1cs_constraints();
        minterZeroAddress.generate_r1cs_constraints();

        // Type
        onchainData.generate_r1cs_constraints();
    }

    const VariableArrayT getPublicData() const
    {
        return flattenReverse(
          {type.bits,
           accountID.bits,
           tokenID.bits,
           nftIDHi.bits,
           nftIDLo.bits,
           creatorFeeBips.bits,
           nftType.bits,
           onchainData.result()});
    }
};

} // namespace Loopring

#endif
