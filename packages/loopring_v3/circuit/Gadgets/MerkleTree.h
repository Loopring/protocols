// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
#ifndef _MERKLETREE_H_
#define _MERKLETREE_H_

#include "ethsnarks.hpp"
#include "gadgets/poseidon.hpp"
#include "MathGadgets.h"

namespace Loopring
{

class SelectMerklePath : public GadgetT
{
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
    SelectMerklePath(
      ProtoboardT &pb,
      const VariableT &x,
      std::vector<VariableT> y,
      const VariableT &bit0,
      const VariableT &bit1,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          bit0_or_bit1(pb, {bit0, bit1}, FMT(prefix, ".bit0_or_bit1")),
          bit0_and_bit1(pb, {bit0, bit1}, FMT(prefix, ".bit0_and_bit1")),

          child0(pb, bit0_or_bit1.result(), y[0], x, FMT(prefix, ".child0")),
          child1p(pb, bit0, x, y[0], FMT(prefix, ".child1p")),
          child1(pb, bit1, y[1], child1p.result(), FMT(prefix, ".child1")),
          child2p(pb, bit0, y[2], x, FMT(prefix, ".child2p")),
          child2(pb, bit1, child2p.result(), y[1], FMT(prefix, ".child2")),
          child3(pb, bit0_and_bit1.result(), x, y[2], FMT(prefix, ".child3"))
    {
        assert(y.size() == 3);
    }

    void generate_r1cs_constraints()
    {
        bit0_or_bit1.generate_r1cs_constraints();
        bit0_and_bit1.generate_r1cs_constraints();

        child0.generate_r1cs_constraints(false);
        child1p.generate_r1cs_constraints(false);
        child1.generate_r1cs_constraints(false);
        child2p.generate_r1cs_constraints(false);
        child2.generate_r1cs_constraints(false);
        child3.generate_r1cs_constraints(false);
    }

    void generate_r1cs_witness()
    {
        bit0_or_bit1.generate_r1cs_witness();
        bit0_and_bit1.generate_r1cs_witness();

        child0.generate_r1cs_witness();
        child1p.generate_r1cs_witness();
        child1.generate_r1cs_witness();
        child2p.generate_r1cs_witness();
        child2.generate_r1cs_witness();
        child3.generate_r1cs_witness();
    }

    std::vector<VariableT> getChildren() const
    {
        return {child0.result(), child1.result(), child2.result(), child3.result()};
    }
};

template <typename HashT> class ComputeMerklePathT : public GadgetT
{
  public:
    std::vector<SelectMerklePath> m_selectors;
    std::vector<HashT> m_hashers;

    ComputeMerklePathT(
      ProtoboardT &pb,
      const size_t depth,
      const VariableArrayT &slotID,
      const VariableT leaf,
      const VariableArrayT &path,
      const std::string &prefix)
        : GadgetT(pb, prefix)
    {
        assert(depth > 0);
        assert(slotID.size() == depth * 2);

        m_selectors.reserve(depth);
        m_hashers.reserve(depth);
        for (size_t i = 0; i < depth; i++)
        {
            m_selectors.push_back(SelectMerklePath(
              pb,
              (i == 0) ? leaf : m_hashers[i - 1].result(),
              {path[i * 3 + 0], path[i * 3 + 1], path[i * 3 + 2]},
              slotID[i * 2 + 0],
              slotID[i * 2 + 1],
              FMT(this->annotation_prefix, ".selector[%zu]", i)));

            m_hashers.emplace_back(
              pb, var_array(m_selectors[i].getChildren()), FMT(this->annotation_prefix, ".hasher[%zu]", i));
        }
    }

    const VariableT &result() const
    {
        assert(m_hashers.size() > 0);
        return m_hashers.back().result();
    }

    void generate_r1cs_constraints()
    {
        for (size_t i = 0; i < m_hashers.size(); i++)
        {
            m_selectors[i].generate_r1cs_constraints();
            m_hashers[i].generate_r1cs_constraints();
        }
    }

    void generate_r1cs_witness()
    {
        for (size_t i = 0; i < m_hashers.size(); i++)
        {
            m_selectors[i].generate_r1cs_witness();
            m_hashers[i].generate_r1cs_witness();
        }
    }
};

/**
 * Merkle path verifier, verifies computed root matches expected result
 */
template <typename HashT> class VerifyMerklePathT : public ComputeMerklePathT<HashT>
{
  public:
    const VariableT expectedRoot;

    VerifyMerklePathT(
      ProtoboardT &pb,
      const size_t depth,
      const VariableArrayT slotID,
      const VariableT leaf,
      const VariableT _expectedRoot,
      const VariableArrayT path,
      const std::string &prefix)
        : ComputeMerklePathT<HashT>::ComputeMerklePathT(pb, depth, slotID, leaf, path, prefix),
          expectedRoot(_expectedRoot)
    {
    }

    bool is_valid() const
    {
        return this->pb.val(this->result()) == this->pb.val(expectedRoot);
    }

    void generate_r1cs_constraints()
    {
        ComputeMerklePathT<HashT>::generate_r1cs_constraints();

        // Ensure root matches calculated path hash
        this->pb.add_r1cs_constraint(
          ConstraintT(this->result(), 1, expectedRoot), FMT(this->annotation_prefix, ".expectedRoot verifier"));
    }
};

// Same parameters for ease of implementation in EVM
using HashMerkleTree = Poseidon_gadget_T<5, 1, 6, 52, 4, 1>;
using HashAccountLeaf = Poseidon_gadget_T<6, 1, 6, 52, 5, 1>;
using HashBalanceLeaf = Poseidon_gadget_T<5, 1, 6, 52, 2, 1>;
using HashStorageLeaf = Poseidon_gadget_T<5, 1, 6, 52, 2, 1>;

using VerifyMerklePath = VerifyMerklePathT<HashMerkleTree>;
using ComputeMerklePath = ComputeMerklePathT<HashMerkleTree>;

} // namespace Loopring

#endif