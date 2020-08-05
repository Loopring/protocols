// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
#ifndef _MERKLETREE_H_
#define _MERKLETREE_H_

#include "ethsnarks.hpp"
#include "gadgets/poseidon.hpp"
#include "MathGadgets.h"

namespace Loopring {

class merkle_path_selector : public GadgetT {
public:
  OrGadget bit0_or_bit1;
  AndGadget bit0_and_bit1;

  TernaryGadget child0;
  TernaryGadget child1p;
  TernaryGadget child1;
  TernaryGadget child2p;
  TernaryGadget child2;
  TernaryGadget child3;

  //[bit1][bit0] [child0] [child1] [child2] [child3]
  // 0 0         x         y0          y1      y2
  // 0 1         y0        x           y1      y2
  // 1 0         y0        y1          x       y2
  // 1 1         y0        y1          y2      x
  merkle_path_selector(ProtoboardT &pb, const VariableT &input /* x */,
                         std::vector<VariableT> sideNodes /* y */,
                         const VariableT &bit0, const VariableT &bit1,
                         const std::string &prefix)
      : GadgetT(pb, prefix),

        bit0_or_bit1(pb, {bit0, bit1}, FMT(prefix, ".bit0_or_bit1")),
        bit0_and_bit1(pb, {bit0, bit1}, FMT(prefix, ".bit0_and_bit1")),

        child0(pb, bit0_or_bit1.result(), sideNodes[0], input,
               FMT(prefix, ".child0")),
        child1p(pb, bit0, input, sideNodes[0], FMT(prefix, ".child1p")),
        child1(pb, bit1, sideNodes[1], child1p.result(),
               FMT(prefix, ".child1")),
        child2p(pb, bit0, sideNodes[2], input, FMT(prefix, ".child2p")),
        child2(pb, bit1, child2p.result(), sideNodes[1],
               FMT(prefix, ".child2")),
        child3(pb, bit0_and_bit1.result(), input, sideNodes[2],
               FMT(prefix, ".child3")) {
    assert(sideNodes.size() == 3);
  }

  void generate_r1cs_constraints() {
    bit0_or_bit1.generate_r1cs_constraints();
    bit0_and_bit1.generate_r1cs_constraints();

    child0.generate_r1cs_constraints(false);
    child1p.generate_r1cs_constraints(false);
    child1.generate_r1cs_constraints(false);
    child2p.generate_r1cs_constraints(false);
    child2.generate_r1cs_constraints(false);
    child3.generate_r1cs_constraints(false);
  }

  void generate_r1cs_witness() {
    bit0_or_bit1.generate_r1cs_witness();
    bit0_and_bit1.generate_r1cs_witness();

    child0.generate_r1cs_witness();
    child1p.generate_r1cs_witness();
    child1.generate_r1cs_witness();
    child2p.generate_r1cs_witness();
    child2.generate_r1cs_witness();
    child3.generate_r1cs_witness();
  }

  std::vector<VariableT> getChildren() const {
    return {child0.result(), child1.result(), child2.result(), child3.result()};
  }
};

template <typename HashT> class merkle_root_updater : public GadgetT {
public:
  std::vector<merkle_path_selector> m_selectors;
  std::vector<HashT> m_hashers;

  merkle_root_updater(
      ProtoboardT &in_pb,
      const size_t in_tree_depth, // RENAME: in_tree_depth
      const VariableArrayT &in_address_bits,
      const VariableT in_leaf_hash,   // RENAME:in_leaf_hash_hash
      const VariableArrayT &in_proof, // RENAME: in_proof
      const std::string &in_annotation_prefix)
      : GadgetT(in_pb, in_annotation_prefix) {
    assert(in_tree_depth > 0);
    assert(in_address_bits.size() == in_tree_depth * 2);

    m_selectors.reserve(in_tree_depth);
    m_hashers.reserve(in_tree_depth);
    for (size_t i = 0; i < in_tree_depth; i++) {
      m_selectors.push_back(merkle_path_selector(
          in_pb, (i == 0) ? in_leaf_hash : m_hashers[i - 1].result(),
          {in_proof[i * 3 + 0], in_proof[i * 3 + 1], in_proof[i * 3 + 2]},
          in_address_bits[i * 2 + 0], in_address_bits[i * 2 + 1],
          FMT(this->annotation_prefix, ".selector[%zu]", i)));

      m_hashers.emplace_back(in_pb, var_array(m_selectors[i].getChildren()),
                             FMT(this->annotation_prefix, ".hasher[%zu]", i));
    }
  }

  const VariableT &result() const {
    assert(m_hashers.size() > 0);
    return m_hashers.back().result();
  }

  void generate_r1cs_constraints() {
    for (size_t i = 0; i < m_hashers.size(); i++) {
      m_selectors[i].generate_r1cs_constraints();
      m_hashers[i].generate_r1cs_constraints();
    }
  }

  void generate_r1cs_witness() {
    for (size_t i = 0; i < m_hashers.size(); i++) {
      m_selectors[i].generate_r1cs_witness();
      m_hashers[i].generate_r1cs_witness();
    }
  }
};

/**
 * Merkle path authenticator, verifies computed root matches expected result
 */
template <typename HashT>
class merkle_root_verifier : public merkle_root_updater<HashT> {
public:
  const VariableT m_expected_root;

  merkle_root_verifier(ProtoboardT &in_pb, const size_t in_tree_depth,
                              const VariableArrayT in_address_bits,
                              const VariableT in_leaf_hash,
                              const VariableT in_expected_root,
                              const VariableArrayT in_proof,
                              const std::string &in_annotation_prefix)
      : merkle_root_updater<HashT>::merkle_root_updater(
            in_pb, in_tree_depth, in_address_bits, in_leaf_hash, in_proof,
            in_annotation_prefix),
        m_expected_root(in_expected_root) {}

  bool is_valid() const {
    return this->pb.val(this->result()) == this->pb.val(m_expected_root);
  }

  void generate_r1cs_constraints() {
    merkle_root_updater<HashT>::generate_r1cs_constraints();

    // Ensure root matches calculated path hash
    this->pb.add_r1cs_constraint(
        ConstraintT(this->result(), 1, m_expected_root),
        FMT(this->annotation_prefix, ".expected_root authenticator"));
  }
};

// Same parameters for ease of implementation in EVM
using HashMerkleTree = Poseidon_gadget_T<5, 1, 6, 52, 4, 1>;
using HashAccountLeaf = Poseidon_gadget_T<6, 1, 6, 52, 5, 1>;
using HashBalanceLeaf = Poseidon_gadget_T<5, 1, 6, 52, 2, 1>;
using HashStorageLeaf = Poseidon_gadget_T<5, 1, 6, 52, 2, 1>;

using VerifyTreeRoot = merkle_root_verifier<HashMerkleTree>;
using UpdateTreeRoot = merkle_root_updater<HashMerkleTree>;

} // namespace Loopring

#endif
