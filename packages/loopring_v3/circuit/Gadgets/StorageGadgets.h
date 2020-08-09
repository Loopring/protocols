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

  StorageGadget(ProtoboardT &pb, const std::string &prefix)
      : GadgetT(pb, prefix),

        data(make_variable(pb, FMT(prefix, ".data"))),
        storageID(make_variable(pb, FMT(prefix, ".storageID")))
  {
  }

  StorageGadget(ProtoboardT &pb, VariableT _data, VariableT _storageID)
      : GadgetT(pb, "storageGadget"),

        data(_data), storageID(_storageID)
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

  StorageState stateBefore;
  StorageState stateAfter;

  const VariableArrayT proof;
  VerifyMerklePath rootBeforeVerifier;
  ComputeMerklePath rootAfter;

  UpdateStorageGadget(
    ProtoboardT &pb,
    const VariableT &merkleRoot,
    const VariableArrayT &slotID,
    const StorageState &_stateBefore,
    const StorageState &_stateAfter,
    const std::string &prefix)
      : GadgetT(pb, prefix),

        stateBefore(_stateBefore), stateAfter(_stateAfter),

        leafBefore(
          pb,
          var_array({_stateBefore.data, _stateBefore.storageID}),
          FMT(prefix, ".leafBefore")),
        leafAfter(
          pb,
          var_array({_stateAfter.data, _stateAfter.storageID}),
          FMT(prefix, ".leafAfter")),

        proof(make_var_array(pb, TREE_DEPTH_STORAGE * 3, FMT(prefix, ".proof"))),
        rootBeforeVerifier(
          pb,
          TREE_DEPTH_STORAGE,
          slotID,
          leafBefore.result(),
          merkleRoot,
          proof,
          FMT(prefix, ".pathBefore")),
        rootAfter(
          pb,
          TREE_DEPTH_STORAGE,
          slotID,
          leafAfter.result(),
          proof,
          FMT(prefix, ".pathAfter"))
  {
  }

  void generate_r1cs_witness(const StorageUpdate &update)
  {
    leafBefore.generate_r1cs_witness();
    leafAfter.generate_r1cs_witness();

    proof.fill_with_field_elements(pb, update.proof.data);
    rootBeforeVerifier.generate_r1cs_witness();
    rootAfter.generate_r1cs_witness();

    ASSERT(pb.val(rootBeforeVerifier.m_expected_root) == update.rootBefore, annotation_prefix);
    if (pb.val(rootAfter.result()) != update.rootAfter)
      {
        std::cout << "stateBefore:" << std::endl;
        printStorage(pb, stateBefore);
        std::cout << "stateAfter:" << std::endl;
        printStorage(pb, stateAfter);
        ASSERT(pb.val(rootAfter.result()) == update.rootAfter, annotation_prefix);
      }
  }

  void generate_r1cs_constraints()
  {
    leafBefore.generate_r1cs_constraints();
    leafAfter.generate_r1cs_constraints();

    rootBeforeVerifier.generate_r1cs_constraints();
    rootAfter.generate_r1cs_constraints();
  }

  const VariableT &result() const { return rootAfter.result(); }
};

class ReadStorageGadget : public GadgetT
{
  VariableT address;
  libsnark::packing_gadget<FieldT> packAddress;
  IsNonZero isNonZeroStorageLeafStorageID;
  TernaryGadget leafStorageID;

  UnsafeAddGadget nextStorageID;

  EqualGadget storageID_eq_leafStorageID;
  EqualGadget storageID_eq_nextStorageID;

  OrGadget isValidStorageID;
  IfThenRequireEqualGadget requireValidStorageID;

  TernaryGadget data;

public:
  ReadStorageGadget(
    ProtoboardT &pb,
    const Constants &constants,
    const StorageGadget &storage,
    const DualVariableGadget &storageID,
    const VariableT &verify,
    const std::string &prefix)
      : GadgetT(pb, prefix),

        address(make_variable(pb, FMT(prefix, ".address"))),
        packAddress(
          pb,
          subArray(storageID.bits, 0, NUM_BITS_STORAGE_ADDRESS),
          address,
          FMT(prefix, ".packAddress")),

        isNonZeroStorageLeafStorageID(
          pb,
          storage.storageID,
          FMT(prefix, ".isNonZeroStorageLeafStorageID")),
        leafStorageID(
          pb,
          isNonZeroStorageLeafStorageID.result(),
          storage.storageID,
          address,
          FMT(prefix, ".leafStorageID")),

        nextStorageID(
          pb,
          leafStorageID.result(),
          constants.numStorageSlots,
          FMT(prefix, ".nextStorageID")),

        storageID_eq_leafStorageID(
          pb,
          storageID.packed,
          leafStorageID.result(),
          FMT(prefix, ".storageID_eq_leafStorageID")),
        storageID_eq_nextStorageID(
          pb,
          storageID.packed,
          nextStorageID.result(),
          FMT(prefix, ".storageID_eq_nextStorageID")),
        isValidStorageID(
          pb,
          {storageID_eq_leafStorageID.result(), storageID_eq_nextStorageID.result()},
          FMT(prefix, ".isValidStorageID")),
        requireValidStorageID(
          pb,
          verify,
          isValidStorageID.result(),
          constants._1,
          FMT(prefix, ".requireValidStorageID")),

        data(
          pb,
          storageID_eq_leafStorageID.result(),
          storage.data,
          constants._0,
          FMT(prefix, ".data"))
  {
  }

  void generate_r1cs_witness()
  {
    packAddress.generate_r1cs_witness_from_bits();
    isNonZeroStorageLeafStorageID.generate_r1cs_witness();
    leafStorageID.generate_r1cs_witness();

    nextStorageID.generate_r1cs_witness();

    storageID_eq_leafStorageID.generate_r1cs_witness();
    storageID_eq_nextStorageID.generate_r1cs_witness();
    isValidStorageID.generate_r1cs_witness();
    requireValidStorageID.generate_r1cs_witness();

    data.generate_r1cs_witness();
  }

  void generate_r1cs_constraints()
  {
    packAddress.generate_r1cs_constraints(false);
    isNonZeroStorageLeafStorageID.generate_r1cs_constraints();
    leafStorageID.generate_r1cs_constraints();

    nextStorageID.generate_r1cs_constraints();

    storageID_eq_leafStorageID.generate_r1cs_constraints();
    storageID_eq_nextStorageID.generate_r1cs_constraints();
    isValidStorageID.generate_r1cs_constraints();
    requireValidStorageID.generate_r1cs_constraints();

    data.generate_r1cs_constraints();
  }

  const VariableT &getData() const { return data.result(); }

  const VariableT &getOverwrite() const { return storageID_eq_nextStorageID.result(); }
};

class ReadNonceGadget : public GadgetT
{
  const Constants &constants;
  const DualVariableGadget &storageID;

  ReadStorageGadget storageReader;
  IfThenRequireEqualGadget requireDataZero;

public:
  ReadNonceGadget(
    ProtoboardT &pb,
    const Constants &_constants,
    const StorageGadget &storage,
    const DualVariableGadget &_storageID,
    const VariableT &verify,
    const std::string &prefix)
      : GadgetT(pb, prefix),

        constants(_constants), storageID(_storageID),

        storageReader(pb, constants, storage, storageID, verify, FMT(prefix, ".storageReader")),
        requireDataZero(
          pb,
          verify,
          storageReader.getData(),
          constants._0,
          FMT(prefix, ".requireDataZero"))
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

  const VariableT &getData() const { return constants._1; }

  const VariableArrayT getShortStorageID() const
  {
    return reverse(flattenReverse(
      {VariableArrayT(1, constants._0),
       VariableArrayT(1, storageReader.getOverwrite()),
       subArray(storageID.bits, 0, NUM_BITS_STORAGE_ADDRESS)}));
  }

  const VariableT &getOverwrite() const { return storageReader.getOverwrite(); }
};

} // namespace Loopring

#endif
