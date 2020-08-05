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

namespace Loopring {

struct StorageState {
  VariableT data;
  VariableT storageID;
};

static void printStorage(const ProtoboardT &pb, const StorageState &state) {
  std::cout << "- data: " << pb.val(state.data) << std::endl;
  std::cout << "- storageID: " << pb.val(state.storageID) << std::endl;
}

class StorageGadget : public GadgetT {
public:
  VariableT data;
  VariableT storageID;

  StorageGadget(ProtoboardT &pb, const std::string &_prefix)
      : GadgetT(pb, _prefix),

        data(make_variable(pb, FMT(_prefix, ".data"))),
        storageID(make_variable(pb, FMT(_prefix, ".storageID"))) {}

  StorageGadget(ProtoboardT &pb, VariableT _data, VariableT _storageID)
      : GadgetT(pb, "storageGadget"),

        data(_data), storageID(_storageID) {}

  void generate_r1cs_witness(const StorageLeaf &storageLeaf) {
    pb.val(data) = storageLeaf.data;
    pb.val(storageID) = storageLeaf.storageID;
  }
};

// Changes a storage leaf from its current value to a new value and
// calculates the new sub-tree root.
class UpdateStorageGadget : public GadgetT {
public:
  HashStorageLeaf leafHashBefore;
  HashStorageLeaf leafHashAfter;

  StorageState leafBefore;
  StorageState leafAfter;

  const VariableArrayT proof;
  VerifyTreeRoot rootBeforeVerifier;
  UpdateTreeRoot rootAfter;

  UpdateStorageGadget(ProtoboardT &pb, const VariableT &_rootBefore,
                      const VariableArrayT &_addressBits,
                      const StorageState &_leafBefore,
                      const StorageState &_leafAfter,
                      const std::string &_prefix)
      : GadgetT(pb, _prefix),

        leafBefore(_leafBefore), leafAfter(_leafAfter),

        leafHashBefore(pb, var_array({_leafBefore.data, _leafBefore.storageID}),
                       FMT(_prefix, ".leafHashBefore")),
        leafHashAfter(pb, var_array({_leafAfter.data, _leafAfter.storageID}),
                      FMT(_prefix, ".leafHashAfter")),

        proof(
            make_var_array(pb, TREE_DEPTH_STORAGE * 3, FMT(_prefix, ".proof"))),
        rootBeforeVerifier(pb, TREE_DEPTH_STORAGE, _addressBits,
                           leafHashBefore.result(), _rootBefore, proof,
                           FMT(_prefix, ".rootBeforeVerifier")),
        rootAfter(pb, TREE_DEPTH_STORAGE, _addressBits, leafHashAfter.result(),
                  proof, FMT(_prefix, ".rootAfter")) {}

  void generate_r1cs_witness(const StorageUpdate &update) {
    leafHashBefore.generate_r1cs_witness();
    leafHashAfter.generate_r1cs_witness();

    proof.fill_with_field_elements(pb, update.proof.data);
    rootBeforeVerifier.generate_r1cs_witness();
    rootAfter.generate_r1cs_witness();

    ASSERT(pb.val(rootBeforeVerifier.m_expected_root) == update.rootBefore,
           annotation_prefix);
    if (pb.val(rootAfter.result()) != update.rootAfter) {
      std::cout << "leafBefore:" << std::endl;
      printStorage(pb, leafBefore);
      std::cout << "leafAfter:" << std::endl;
      printStorage(pb, leafAfter);
      ASSERT(pb.val(rootAfter.result()) == update.rootAfter, annotation_prefix);
    }
  }

  void generate_r1cs_constraints() {
    leafHashBefore.generate_r1cs_constraints();
    leafHashAfter.generate_r1cs_constraints();

    rootBeforeVerifier.generate_r1cs_constraints();
    rootAfter.generate_r1cs_constraints();
  }

  const VariableT &result() const { return rootAfter.result(); }
};

// Given the current storage leaf content and a storageID:
// - Verifies storageId == storage.storageID OR
//            storageId == storage.storageID + numStorageSlots
// - Returns the storage.data
// - Returns if the previous storage is overwritten.
class ReadStorageGadget : public GadgetT {
  VariableT address;
  libsnark::packing_gadget<FieldT> packAddress;
  IsNonZero isCurrentStorageIDNonZero;
  TernaryGadget currentStorageID;

  UnsafeAddGadget nextStorageID;

  EqualGadget storageID_eq_storageID;
  EqualGadget storageID_eq_nextStorageID;

  OrGadget isValidStorageID;
  IfThenRequireEqualGadget requireValidStorageID;

  TernaryGadget data;

public:
  ReadStorageGadget(ProtoboardT &pb, const Constants &_constants,
                    const StorageGadget &_currentStorage,
                    const DualVariableGadget &_storageID,
                    const VariableT &_verify, const std::string &_prefix)
      : GadgetT(pb, _prefix),

        address(make_variable(pb, FMT(_prefix, ".address"))),

        packAddress(pb, subArray(_storageID.bits, 0, NUM_BITS_STORAGE_ADDRESS),
                    address, FMT(_prefix, ".packAddress")),

        isCurrentStorageIDNonZero(pb, _currentStorage.storageID,
                                  FMT(_prefix, ".isCurrentStorageIDNonZero")),

        currentStorageID(pb, isCurrentStorageIDNonZero.result(),
                         _currentStorage.storageID,
                         address, // Value = 0
                         FMT(_prefix, ".currentStorageID")),

        nextStorageID(pb, currentStorageID.result(), _constants.numStorageSlots,
                      FMT(_prefix, ".nextStorageID")),

        storageID_eq_storageID(pb, _storageID.packed, currentStorageID.result(),
                               FMT(_prefix, ".storageID_eq_storageID")),

        storageID_eq_nextStorageID(pb, _storageID.packed,
                                   nextStorageID.result(),
                                   FMT(_prefix, ".storageID_eq_nextStorageID")),

        isValidStorageID(pb,
                         {storageID_eq_storageID.result(),
                          storageID_eq_nextStorageID.result()},
                         FMT(_prefix, ".isValidStorageID")),

        requireValidStorageID(pb, _verify, isValidStorageID.result(),
                              _constants._1,
                              FMT(_prefix, ".requireValidStorageID")),

        data(pb, storageID_eq_storageID.result(), _currentStorage.data,
             _constants._0, FMT(_prefix, ".data")) {}

  void generate_r1cs_witness() {
    packAddress.generate_r1cs_witness_from_bits();
    isCurrentStorageIDNonZero.generate_r1cs_witness();
    currentStorageID.generate_r1cs_witness();

    nextStorageID.generate_r1cs_witness();

    storageID_eq_storageID.generate_r1cs_witness();
    storageID_eq_nextStorageID.generate_r1cs_witness();
    isValidStorageID.generate_r1cs_witness();
    requireValidStorageID.generate_r1cs_witness();

    data.generate_r1cs_witness();
  }

  void generate_r1cs_constraints() {
    packAddress.generate_r1cs_constraints(false);
    isCurrentStorageIDNonZero.generate_r1cs_constraints();
    currentStorageID.generate_r1cs_constraints();

    nextStorageID.generate_r1cs_constraints();

    storageID_eq_storageID.generate_r1cs_constraints();
    storageID_eq_nextStorageID.generate_r1cs_constraints();
    isValidStorageID.generate_r1cs_constraints();
    requireValidStorageID.generate_r1cs_constraints();

    data.generate_r1cs_constraints();
  }

  const VariableT &getData() const { return data.result(); }

  const VariableT &getOverwrite() const {
    return storageID_eq_nextStorageID.result();
  }
};

class NonceGadget : public GadgetT {
  const Constants &constants;
  const DualVariableGadget &storageID;

  ReadStorageGadget readStorage;
  IfThenRequireEqualGadget requireDataZero;

public:
  NonceGadget(ProtoboardT &pb, const Constants &_constants,
              const StorageGadget &_currentStorage,
              const DualVariableGadget &_storageID, const VariableT &_verify,
              const std::string &_prefix)
      : GadgetT(pb, _prefix),

        constants(_constants),
        storageID(_storageID),
        readStorage(pb, constants, _currentStorage, storageID, _verify,
                      FMT(_prefix, ".readStorage")),
        requireDataZero(pb, _verify, readStorage.getData(), _constants._0,
                        FMT(_prefix, ".requireDataZero")) {}

  void generate_r1cs_witness() {
    readStorage.generate_r1cs_witness();
    requireDataZero.generate_r1cs_witness();
  }

  void generate_r1cs_constraints() {
    readStorage.generate_r1cs_constraints();
    requireDataZero.generate_r1cs_constraints();
  }

  const VariableT &getData() const { return constants._1; }

  const VariableArrayT getShortStorageID() const {
    return reverse(flattenReverse(
        {VariableArrayT(1, constants._0),
         VariableArrayT(1, readStorage.getOverwrite()),
         subArray(storageID.bits, 0, NUM_BITS_STORAGE_ADDRESS)}));
  }

  const VariableT &getOverwrite() const { return readStorage.getOverwrite(); }
};

} // namespace Loopring

#endif
