// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
#ifndef _STORAGEGADGETS_H_
#define _STORAGEGADGETS_H_

#include "../Utils/Constants.h"
#include "../Utils/Data.h"

#include "MerkleTree.h"

#include "ethsnarks.hpp"
#include "utils.hpp"

using namespace ethsnarks;

namespace Loopring
{

struct StorageState
{
    VariableT data;
    VariableT storageID;
};

static void printStorage(const ProtoboardT &pb, const StorageState &state)
{
    std::cout << "- data: " << pb.val(state.data) << std::endl;
    std::cout << "- storageID: " << pb.val(state.storageID) << std::endl;
}

class StorageGadget : public GadgetT
{
  public:
    VariableT data;
    VariableT storageID;

    StorageGadget( //
      ProtoboardT &pb,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          data(make_variable(pb, FMT(prefix, ".data"))),
          storageID(make_variable(pb, FMT(prefix, ".storageID")))
    {
    }

    void generate_r1cs_witness(const StorageLeaf &storageLeaf)
    {
        pb.val(data) = storageLeaf.data;
        pb.val(storageID) = storageLeaf.storageID;
    }
};

class UpdateStorageGadget : public GadgetT
{
  public:
    HashStorageLeaf leafBefore;
    HashStorageLeaf leafAfter;

    StorageState valuesBefore;
    StorageState valuesAfter;

    const VariableArrayT proof;
    MerklePathCheckT proofVerifierBefore;
    MerklePathT rootCalculatorAfter;

    UpdateStorageGadget(
      ProtoboardT &pb,
      const VariableT &merkleRoot,
      const VariableArrayT &slotID,
      const StorageState &before,
      const StorageState &after,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          valuesBefore(before),
          valuesAfter(after),

          leafBefore(pb, var_array({before.data, before.storageID}), FMT(prefix, ".leafBefore")),
          leafAfter(pb, var_array({after.data, after.storageID}), FMT(prefix, ".leafAfter")),

          proof(make_var_array(pb, TREE_DEPTH_STORAGE * 3, FMT(prefix, ".proof"))),
          proofVerifierBefore(
            pb,
            TREE_DEPTH_STORAGE,
            slotID,
            leafBefore.result(),
            merkleRoot,
            proof,
            FMT(prefix, ".pathBefore")),
          rootCalculatorAfter(pb, TREE_DEPTH_STORAGE, slotID, leafAfter.result(), proof, FMT(prefix, ".pathAfter"))
    {
    }

    void generate_r1cs_witness(const StorageUpdate &update)
    {
        leafBefore.generate_r1cs_witness();
        leafAfter.generate_r1cs_witness();

        proof.fill_with_field_elements(pb, update.proof.data);
        proofVerifierBefore.generate_r1cs_witness();
        rootCalculatorAfter.generate_r1cs_witness();

        ASSERT(pb.val(proofVerifierBefore.m_expected_root) == update.rootBefore, annotation_prefix);
        if (pb.val(rootCalculatorAfter.result()) != update.rootAfter)
        {
            std::cout << "Before:" << std::endl;
            printStorage(pb, valuesBefore);
            std::cout << "After:" << std::endl;
            printStorage(pb, valuesAfter);
            ASSERT(pb.val(rootCalculatorAfter.result()) == update.rootAfter, annotation_prefix);
        }
    }

    void generate_r1cs_constraints()
    {
        leafBefore.generate_r1cs_constraints();
        leafAfter.generate_r1cs_constraints();

        proofVerifierBefore.generate_r1cs_constraints();
        rootCalculatorAfter.generate_r1cs_constraints();
    }

    const VariableT &result() const
    {
        return rootCalculatorAfter.result();
    }
};

class StorageReaderGadget : public GadgetT
{
    LeqGadget storageID_leq_leafStorageID;
    IfThenRequireGadget requireValidStorageID;

    TernaryGadget data;

  public:
    StorageReaderGadget(
      ProtoboardT &pb,
      const Constants &constants,
      const StorageGadget &storage,
      const DualVariableGadget &storageID,
      const VariableT &verify,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          storageID_leq_leafStorageID(
            pb,
            storageID.packed,
            storage.storageID,
            NUM_BITS_STORAGEID,
            FMT(prefix, ".storageID_leq_leafStorageID")),
          requireValidStorageID(pb, verify, storageID_leq_leafStorageID.gte(), FMT(prefix, ".requireValidStorageID")),

          data(pb, storageID_leq_leafStorageID.eq(), storage.data, constants._0, FMT(prefix, ".data"))
    {
    }

    void generate_r1cs_witness()
    {
        storageID_leq_leafStorageID.generate_r1cs_witness();
        requireValidStorageID.generate_r1cs_witness();

        data.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        storageID_leq_leafStorageID.generate_r1cs_constraints();
        requireValidStorageID.generate_r1cs_constraints();

        data.generate_r1cs_constraints();
    }

    const VariableT &getData() const
    {
        return data.result();
    }
};

class NonceGadget : public GadgetT
{
    const Constants &constants;
    const DualVariableGadget &storageID;

    StorageReaderGadget storageReader;
    IfThenRequireEqualGadget requireDataZero;

  public:
    NonceGadget(
      ProtoboardT &pb,
      const Constants &_constants,
      const StorageGadget &storage,
      const DualVariableGadget &_storageID,
      const VariableT &verify,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          constants(_constants),
          storageID(_storageID),

          storageReader(pb, constants, storage, storageID, verify, FMT(prefix, ".storageReader")),
          requireDataZero(pb, verify, storageReader.getData(), constants._0, FMT(prefix, ".requireDataZero"))
    {
    }

    void generate_r1cs_witness()
    {
        storageReader.generate_r1cs_witness();
        requireDataZero.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        storageReader.generate_r1cs_constraints();
        requireDataZero.generate_r1cs_constraints();
    }

    const VariableT &getData() const
    {
        return constants._1;
    }
};

} // namespace Loopring

#endif
