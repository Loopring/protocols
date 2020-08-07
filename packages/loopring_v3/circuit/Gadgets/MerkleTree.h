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
  merkle_path_selector(ProtoboardT &_pb, const VariableT &x,
                       std::vector<VariableT> y, const VariableT &bit0,
                       const VariableT &bit1, const std::string &prefix)
      : GadgetT(_pb, prefix),

        bit0_or_bit1(_pb, {bit0, bit1}, FMT(prefix, ".bit0_or_bit1")),
        bit0_and_bit1(_pb, {bit0, bit1}, FMT(prefix, ".bit0_and_bit1")),

        child0(_pb, bit0_or_bit1.result(), y[0], x, FMT(prefix, ".child0")),
        child1p(_pb, bit0, x, y[0], FMT(prefix, ".child1p")),
        child1(_pb, bit1, y[1], child1p.result(), FMT(prefix, ".child1")),
        child2p(_pb, bit0, y[2], x, FMT(prefix, ".child2p")),
        child2(_pb, bit1, child2p.result(), y[1], FMT(prefix, ".child2")),
        child3(_pb, bit0_and_bit1.result(), x, y[2], FMT(prefix, ".child3")) {
    assert(y.size() == 3);
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

  merkle_root_updater(ProtoboardT &_pb,
                      const size_t _tree_depth, // RENAME: _tree_depth
                      const VariableArrayT &_address_bits,
                      const VariableT _leaf_hash,   // RENAME:_leaf_hash_hash
                      const VariableArrayT &_proof, // RENAME: _proof
                      const std::string &_annotation_prefix)
      : GadgetT(_pb, _annotation_prefix) {
    assert(_tree_depth > 0);
    assert(_address_bits.size() == _tree_depth * 2);

    m_selectors.reserve(_tree_depth);
    m_hashers.reserve(_tree_depth);
    for (size_t i = 0; i < _tree_depth; i++) {
      m_selectors.push_back(merkle_path_selector(
          _pb, (i == 0) ? _leaf_hash : m_hashers[i - 1].result(),
          {_proof[i * 3 + 0], _proof[i * 3 + 1], _proof[i * 3 + 2]},
          _address_bits[i * 2 + 0], _address_bits[i * 2 + 1],
          FMT(this->annotation_prefix, ".selector[%zu]", i)));

      m_hashers.emplace_back(_pb, var_array(m_selectors[i].getChildren()),
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

  merkle_root_verifier(ProtoboardT &_pb, const size_t _tree_depth,
                       const VariableArrayT _address_bits,
                       const VariableT _leaf_hash,
                       const VariableT _expected_root,
                       const VariableArrayT _proof,
                       const std::string &_annotation_prefix)
      : merkle_root_updater<HashT>::merkle_root_updater(
            _pb, _tree_depth, _address_bits, _leaf_hash, _proof,
            _annotation_prefix),
        m_expected_root(_expected_root) {}

  bool is_valid() const {
    return this->pb.val(this->result()) == this->pb.val(m_expected_root);
  }

  void generate_r1cs_constraints() {
    merkle_root_updater<HashT>::generate_r1cs_constraints();

    // Ensure root matches calculated path hash
    this->pb.add_r1cs_constraint(
        ConstraintT(this->result(), 1, m_expected_root),
        FMT(this->annotation_prefix, ".expected_root verifier"));
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
