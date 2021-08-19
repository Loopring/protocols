// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
#ifndef _MATHGADGETS_H_
#define _MATHGADGETS_H_

#include "../Utils/Constants.h"
#include "../Utils/Data.h"

#include "ethsnarks.hpp"
#include "utils.hpp"
#include "jubjub/point.hpp"
#include "jubjub/eddsa.hpp"
#include "gadgets/subadd.hpp"
#include "gadgets/poseidon.hpp"

using namespace ethsnarks;
using namespace jubjub;

namespace Loopring
{

// All Poseidon permutations used
using Poseidon_2 = Poseidon_gadget_T<3, 1, 6, 51, 2, 1>;
using Poseidon_3 = Poseidon_gadget_T<4, 1, 6, 52, 3, 1>;
template <unsigned n_outputs> using Poseidon_4_ = Poseidon_gadget_T<5, 1, 6, 52, n_outputs, 1>;
using Poseidon_4 = Poseidon_4_<4>;
using Poseidon_5 = Poseidon_gadget_T<6, 1, 6, 52, 5, 1>;
using Poseidon_6 = Poseidon_gadget_T<7, 1, 6, 52, 6, 1>;
using Poseidon_8 = Poseidon_gadget_T<9, 1, 6, 53, 8, 1>;
using Poseidon_9 = Poseidon_gadget_T<10, 1, 6, 53, 9, 1>;
using Poseidon_10 = Poseidon_gadget_T<11, 1, 6, 53, 10, 1>;
using Poseidon_11 = Poseidon_gadget_T<12, 1, 6, 53, 11, 1>;
using Poseidon_12 = Poseidon_gadget_T<13, 1, 6, 53, 12, 1>;

// require(A == B)
static void requireEqual( //
  ProtoboardT &pb,
  const VariableT &A,
  const VariableT &B,
  const std::string &annotation_prefix)
{
    pb.add_r1cs_constraint( //
      ConstraintT(A, FieldT::one(), B),
      FMT(annotation_prefix, ".requireEqual"));
}

// Constants stored in a VariableT for ease of use
class Constants : public GadgetT
{
  public:
    const VariableT _0;
    const VariableT _1;
    const VariableT _2;
    const VariableT _3;
    const VariableT _4;
    const VariableT _5;
    const VariableT _6;
    const VariableT _7;
    const VariableT _8;
    const VariableT _9;
    const VariableT _10;

    const VariableT _1000;
    const VariableT _1001;
    const VariableT _10000;
    const VariableT _100000;
    const VariableT fixedBase;
    const VariableT emptyStorage;
    const VariableT maxAmount;
    const VariableT numStorageSlots;
    const VariableT nftTokenIdStart;
    const VariableT txTypeSpotTrade;
    const VariableT txTypeTransfer;
    const VariableT txTypeWithdrawal;
    const VariableT txTypeNftMint;
    const VariableT txTypeNftData;

    const VariableArrayT zeroAccount;

    std::vector<VariableT> values;

    Constants( //
      ProtoboardT &pb,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          _0(make_variable(pb, FieldT::zero(), FMT(prefix, ".zero"))),
          _1(make_variable(pb, FieldT::one(), FMT(prefix, ".one"))),
          _2(make_variable(pb, ethsnarks::FieldT(2), FMT(prefix, ".two"))),
          _3(make_variable(pb, ethsnarks::FieldT(3), FMT(prefix, ".three"))),
          _4(make_variable(pb, ethsnarks::FieldT(4), FMT(prefix, ".four"))),
          _5(make_variable(pb, ethsnarks::FieldT(5), FMT(prefix, ".five"))),
          _6(make_variable(pb, ethsnarks::FieldT(6), FMT(prefix, ".six"))),
          _7(make_variable(pb, ethsnarks::FieldT(7), FMT(prefix, ".seven"))),
          _8(make_variable(pb, ethsnarks::FieldT(8), FMT(prefix, ".eight"))),
          _9(make_variable(pb, ethsnarks::FieldT(9), FMT(prefix, ".nine"))),
          _10(make_variable(pb, ethsnarks::FieldT(10), FMT(prefix, ".ten"))),
          _1000(make_variable(pb, ethsnarks::FieldT(1000), FMT(prefix, "._1000"))),
          _1001(make_variable(pb, ethsnarks::FieldT(1001), FMT(prefix, "._1001"))),
          _10000(make_variable(pb, ethsnarks::FieldT(10000), FMT(prefix, "._10000"))),
          _100000(make_variable(pb, ethsnarks::FieldT(100000), FMT(prefix, "._100000"))),
          fixedBase(make_variable(pb, ethsnarks::FieldT(FIXED_BASE), FMT(prefix, ".fixedBase"))),
          emptyStorage(make_variable(pb, ethsnarks::FieldT(EMPTY_TRADE_HISTORY), FMT(prefix, ".emptyStorage"))),
          maxAmount(make_variable(pb, ethsnarks::FieldT(MAX_AMOUNT), FMT(prefix, ".maxAmount"))),
          numStorageSlots(make_variable(pb, ethsnarks::FieldT(NUM_STORAGE_SLOTS), FMT(prefix, ".numStorageSlots"))),
          nftTokenIdStart(make_variable(pb, ethsnarks::FieldT(NFT_TOKEN_ID_START), FMT(prefix, ".nftTokenIdStart"))),
          txTypeSpotTrade(
            make_variable(pb, ethsnarks::FieldT(int(TransactionType::SpotTrade)), FMT(prefix, ".txTypeSpotTrade"))),
          txTypeTransfer(
            make_variable(pb, ethsnarks::FieldT(int(TransactionType::Transfer)), FMT(prefix, ".txTypeTransfer"))),
          txTypeWithdrawal(
            make_variable(pb, ethsnarks::FieldT(int(TransactionType::Withdrawal)), FMT(prefix, ".txTypeWithdrawal"))),
          txTypeNftMint(
            make_variable(pb, ethsnarks::FieldT(int(TransactionType::NftMint)), FMT(prefix, ".txTypeNftMint"))),
          txTypeNftData(
            make_variable(pb, ethsnarks::FieldT(int(TransactionType::NftData)), FMT(prefix, ".txTypeNftData"))),

          zeroAccount(NUM_BITS_ACCOUNT, _0)
    {
        assert(NUM_BITS_MAX_VALUE == FieldT::size_in_bits());
        assert(NUM_BITS_FIELD_CAPACITY == FieldT::capacity());

        values.push_back(_0);
        values.push_back(_1);
        values.push_back(_2);
        values.push_back(_3);
        values.push_back(_4);
        values.push_back(_5);
        values.push_back(_6);
        values.push_back(_7);
        values.push_back(_8);
        values.push_back(_9);
        values.push_back(_10);
    }

    void generate_r1cs_witness()
    {
    }

    void generate_r1cs_constraints()
    {
        pb.add_r1cs_constraint(ConstraintT(_0, FieldT::one(), FieldT::zero()), ".zero");
        pb.add_r1cs_constraint(ConstraintT(_1, FieldT::one(), FieldT::one()), ".one");
        pb.add_r1cs_constraint(ConstraintT(_2, FieldT::one(), FieldT(2)), ".two");
        pb.add_r1cs_constraint(ConstraintT(_3, FieldT::one(), FieldT(3)), ".three");
        pb.add_r1cs_constraint(ConstraintT(_4, FieldT::one(), FieldT(4)), ".four");
        pb.add_r1cs_constraint(ConstraintT(_5, FieldT::one(), FieldT(5)), ".five");
        pb.add_r1cs_constraint(ConstraintT(_6, FieldT::one(), FieldT(6)), ".six");
        pb.add_r1cs_constraint(ConstraintT(_7, FieldT::one(), FieldT(7)), ".seven");
        pb.add_r1cs_constraint(ConstraintT(_8, FieldT::one(), FieldT(8)), ".eight");
        pb.add_r1cs_constraint(ConstraintT(_9, FieldT::one(), FieldT(9)), ".nine");
        pb.add_r1cs_constraint(ConstraintT(_10, FieldT::one(), FieldT(10)), ".ten");

        pb.add_r1cs_constraint(ConstraintT(_1000, FieldT::one(), ethsnarks::FieldT(1000)), "._1000");
        pb.add_r1cs_constraint(ConstraintT(_1001, FieldT::one(), ethsnarks::FieldT(1001)), "._1001");
        pb.add_r1cs_constraint(ConstraintT(_10000, FieldT::one(), ethsnarks::FieldT(10000)), "._10000");
        pb.add_r1cs_constraint(ConstraintT(_100000, FieldT::one(), ethsnarks::FieldT(100000)), "._100000");
        pb.add_r1cs_constraint(ConstraintT(fixedBase, FieldT::one(), ethsnarks::FieldT(FIXED_BASE)), ".fixedBase");
        pb.add_r1cs_constraint(
          ConstraintT(emptyStorage, FieldT::one(), ethsnarks::FieldT(EMPTY_TRADE_HISTORY)), ".emptyStorage");
        pb.add_r1cs_constraint(ConstraintT(maxAmount, FieldT::one(), ethsnarks::FieldT(MAX_AMOUNT)), ".maxAmount");
        pb.add_r1cs_constraint(
          ConstraintT(numStorageSlots, FieldT::one(), ethsnarks::FieldT(NUM_STORAGE_SLOTS)), ".numStorageSlots");
        pb.add_r1cs_constraint(
          ConstraintT(nftTokenIdStart, FieldT::one(), ethsnarks::FieldT(NFT_TOKEN_ID_START)), ".nftTokenIdStart");
        pb.add_r1cs_constraint(
          ConstraintT(txTypeSpotTrade, FieldT::one(), ethsnarks::FieldT(int(TransactionType::SpotTrade))),
          ".txTypeSpotTrade");
        pb.add_r1cs_constraint(
          ConstraintT(txTypeTransfer, FieldT::one(), ethsnarks::FieldT(int(TransactionType::Transfer))),
          ".txTypeTransfer");
        pb.add_r1cs_constraint(
          ConstraintT(txTypeWithdrawal, FieldT::one(), ethsnarks::FieldT(int(TransactionType::Withdrawal))),
          ".txTypeWithdrawal");
        pb.add_r1cs_constraint(
          ConstraintT(txTypeNftMint, FieldT::one(), ethsnarks::FieldT(int(TransactionType::NftMint))),
          ".txTypeNftMint");
        pb.add_r1cs_constraint(
          ConstraintT(txTypeNftData, FieldT::one(), ethsnarks::FieldT(int(TransactionType::NftData))),
          ".txTypeNftData");
    }
};

class DualVariableGadget : public libsnark::dual_variable_gadget<FieldT>
{
  public:
    DualVariableGadget( //
      ProtoboardT &pb,
      const size_t width,
      const std::string &prefix)
        : libsnark::dual_variable_gadget<FieldT>(pb, width, prefix)
    {
    }

    void generate_r1cs_witness( //
      ProtoboardT &pb,
      const FieldT &value)
    {
        pb.val(packed) = value;
        generate_r1cs_witness_from_packed();
    }

    void generate_r1cs_witness( //
      ProtoboardT &pb,
      const LimbT &value)
    {
        assert(value.max_bits() == 256);
        for (unsigned int i = 0; i < 256; i++)
        {
            pb.val(bits[255 - i]) = value.test_bit(i);
        }
        generate_r1cs_witness_from_bits();
    }

    void generate_r1cs_constraints(bool enforce = true)
    {
        libsnark::dual_variable_gadget<FieldT>::generate_r1cs_constraints(enforce);
    }
};

class ToBitsGadget : public libsnark::dual_variable_gadget<FieldT>
{
  public:
    ToBitsGadget( //
      ProtoboardT &pb,
      const VariableT &value,
      const size_t width,
      const std::string &prefix)
        : libsnark::dual_variable_gadget<FieldT>(pb, value, width, prefix)
    {
    }

    void generate_r1cs_witness()
    {
        generate_r1cs_witness_from_packed();
    }

    void generate_r1cs_constraints()
    {
        libsnark::dual_variable_gadget<FieldT>::generate_r1cs_constraints(true);
    }
};

typedef ToBitsGadget RangeCheckGadget;

class FromBitsGadget : public libsnark::dual_variable_gadget<FieldT>
{
  public:
    FromBitsGadget( //
      ProtoboardT &pb,
      const VariableArrayT &bits,
      const std::string &prefix)
        : libsnark::dual_variable_gadget<FieldT>(pb, bits, prefix)
    {
    }

    void generate_r1cs_witness()
    {
        generate_r1cs_witness_from_bits();
    }

    void generate_r1cs_constraints(bool enforce = true)
    {
        libsnark::dual_variable_gadget<FieldT>::generate_r1cs_constraints(enforce);
    }
};

// Helper function that contains the history of all the values of a variable
class DynamicVariableGadget : public GadgetT
{
  public:
    std::vector<VariableT> variables;

    DynamicVariableGadget( //
      ProtoboardT &pb,
      const VariableT &initialValue,
      const std::string &prefix)
        : GadgetT(pb, prefix)
    {
        add(initialValue);
    }

    const VariableT &front() const
    {
        return variables.front();
    }

    const VariableT &back() const
    {
        return variables.back();
    }

    void add(const VariableT &variable)
    {
        variables.push_back(variable);
    }
};

// A - B
class UnsafeSubGadget : public GadgetT
{
  public:
    VariableT value;
    VariableT sub;
    VariableT sum;

    UnsafeSubGadget( //
      ProtoboardT &pb,
      const VariableT &_value,
      const VariableT &_sub,
      const std::string &prefix)
        : GadgetT( //
            pb,
            prefix),
          value(_value),
          sub(_sub),
          sum(make_variable(pb, FMT(prefix, ".sum")))
    {
    }

    const VariableT &result() const
    {
        return sum;
    }

    void generate_r1cs_witness()
    {
        pb.val(sum) = pb.val(value) - pb.val(sub);
    }

    void generate_r1cs_constraints()
    {
        pb.add_r1cs_constraint(
          ConstraintT( //
            value - sub,
            FieldT::one(),
            sum),
          FMT(annotation_prefix, ".value - sub = sum"));
    }
};

// A + B
class UnsafeAddGadget : public GadgetT
{
  public:
    VariableT value;
    VariableT add;
    VariableT sum;

    UnsafeAddGadget( //
      ProtoboardT &pb,
      const VariableT &_value,
      const VariableT &_add,
      const std::string &prefix)
        : GadgetT( //
            pb,
            prefix),
          value(_value),
          add(_add),
          sum(make_variable(pb, FMT(prefix, ".sum")))
    {
    }

    const VariableT &result() const
    {
        return sum;
    }

    void generate_r1cs_witness()
    {
        pb.val(sum) = pb.val(value) + pb.val(add);
    }

    void generate_r1cs_constraints()
    {
        pb.add_r1cs_constraint(
          ConstraintT( //
            value + add,
            FieldT::one(),
            sum),
          FMT(annotation_prefix, ".value + add = sum"));
    }
};

// A * B
class UnsafeMulGadget : public GadgetT
{
  public:
    VariableT valueA;
    VariableT valueB;
    VariableT product;

    UnsafeMulGadget( //
      ProtoboardT &pb,
      const VariableT &_valueA,
      const VariableT &_valueB,
      const std::string &prefix)
        : GadgetT( //
            pb,
            prefix),
          valueA(_valueA),
          valueB(_valueB),
          product(make_variable(pb, FMT(prefix, ".product")))
    {
    }

    const VariableT &result() const
    {
        return product;
    }

    void generate_r1cs_witness()
    {
        pb.val(product) = pb.val(valueA) * pb.val(valueB);
    }

    void generate_r1cs_constraints()
    {
        pb.add_r1cs_constraint( //
          ConstraintT(valueA, valueB, product),
          ".valueA * valueB = product");
    }
};

// A + B = sum with A, B and sum < 2^n
//
// This gadget is not designed to handle inputs of more than a couple of
// variables. Threfore, we are have not optimized the constraints as suggested
// in https://github.com/daira/r1cs/blob/master/zkproofs.pdf.
class AddGadget : public GadgetT
{
  public:
    UnsafeAddGadget unsafeAdd;
    RangeCheckGadget rangeCheck;

    AddGadget( //
      ProtoboardT &pb,
      const VariableT &A,
      const VariableT &B,
      unsigned int n,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          unsafeAdd(pb, A, B, FMT(prefix, ".unsafeAdd")),
          rangeCheck(pb, unsafeAdd.result(), n, FMT(prefix, ".rangeCheck"))
    {
        assert(n + 1 <= NUM_BITS_FIELD_CAPACITY);
    }

    void generate_r1cs_witness()
    {
        unsafeAdd.generate_r1cs_witness();
        rangeCheck.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        unsafeAdd.generate_r1cs_constraints();
        rangeCheck.generate_r1cs_constraints();
    }

    const VariableT &result() const
    {
        return unsafeAdd.result();
    }
};

// A - B = sub with A, B and sub >= 0
class SubGadget : public GadgetT
{
  public:
    UnsafeSubGadget unsafeSub;
    RangeCheckGadget rangeCheck;

    SubGadget( //
      ProtoboardT &pb,
      const VariableT &A,
      const VariableT &B,
      unsigned int n,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          unsafeSub(pb, A, B, FMT(prefix, ".unsafeAdd")),
          rangeCheck(pb, unsafeSub.result(), n, FMT(prefix, ".rangeCheck"))
    {
        assert(n + 1 <= NUM_BITS_FIELD_CAPACITY);
    }

    void generate_r1cs_witness()
    {
        unsafeSub.generate_r1cs_witness();
        rangeCheck.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        unsafeSub.generate_r1cs_constraints();
        rangeCheck.generate_r1cs_constraints();
    }

    const VariableT &result() const
    {
        return unsafeSub.result();
    }
};

// Helper function to do transfers
class TransferGadget : public GadgetT
{
  public:
    SubGadget sub;
    AddGadget add;

    TransferGadget(
      ProtoboardT &pb,
      DynamicVariableGadget &from,
      DynamicVariableGadget &to,
      const VariableT &value,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          sub(pb, from.back(), value, NUM_BITS_AMOUNT, FMT(prefix, ".sub")),
          add(pb, to.back(), value, NUM_BITS_AMOUNT, FMT(prefix, ".add"))
    {
        from.add(sub.result());
        to.add(add.result());
    }

    void generate_r1cs_witness()
    {
        sub.generate_r1cs_witness();
        add.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        sub.generate_r1cs_constraints();
        add.generate_r1cs_constraints();
    }
};

// b ? A : B
class TernaryGadget : public GadgetT
{
  public:
    VariableT b;
    VariableT x;
    VariableT y;

    VariableT selected;

    TernaryGadget(
      ProtoboardT &pb,
      const VariableT &_b,
      const VariableT &_x,
      const VariableT &_y,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          b(_b),
          x(_x),
          y(_y),

          selected(make_variable(pb, FMT(prefix, ".selected")))
    {
    }

    const VariableT &result() const
    {
        return selected;
    }

    void generate_r1cs_witness()
    {
        pb.val(selected) = (pb.val(b) == FieldT::one()) ? pb.val(x) : pb.val(y);
    }

    void generate_r1cs_constraints(bool enforceBitness = true)
    {
        if (enforceBitness)
        {
            libsnark::generate_boolean_r1cs_constraint<ethsnarks::FieldT>(pb, b, FMT(annotation_prefix, ".bitness"));
        }
        pb.add_r1cs_constraint(
          ConstraintT(b, y - x, y - selected), FMT(annotation_prefix, ".b * (y - x) == (y - selected)"));
    }
};

// b ? A[] : B[]
class ArrayTernaryGadget : public GadgetT
{
  public:
    VariableT b;
    std::vector<TernaryGadget> results;
    VariableArrayT res;

    ArrayTernaryGadget(
      ProtoboardT &pb,
      const VariableT &_b,
      const VariableArrayT &x,
      const VariableArrayT &y,
      const std::string &prefix)
        : GadgetT(pb, prefix), b(_b)
    {
        assert(x.size() == y.size());
        results.reserve(x.size());
        for (unsigned int i = 0; i < x.size(); i++)
        {
            results.emplace_back(pb, b, x[i], y[i], FMT(prefix, ".results"));
            res.emplace_back(results.back().result());
        }
    }

    void generate_r1cs_witness()
    {
        for (unsigned int i = 0; i < results.size(); i++)
        {
            results[i].generate_r1cs_witness();
        }
    }

    void generate_r1cs_constraints(bool enforceBitness = true)
    {
        if (enforceBitness)
        {
            libsnark::generate_boolean_r1cs_constraint<ethsnarks::FieldT>(pb, b, FMT(annotation_prefix, ".bitness"));
        }
        for (unsigned int i = 0; i < results.size(); i++)
        {
            results[i].generate_r1cs_constraints(false);
        }
    }

    const VariableArrayT &result() const
    {
        return res;
    }
};

// (input[0] && input[1] && ...) (all inputs need to be boolean)
class AndGadget : public GadgetT
{
  public:
    std::vector<VariableT> inputs;
    std::vector<VariableT> results;

    AndGadget( //
      ProtoboardT &pb,
      const std::vector<VariableT> &_inputs,
      const std::string &prefix)
        : GadgetT(pb, prefix), inputs(_inputs)
    {
        assert(inputs.size() > 1);
        for (unsigned int i = 1; i < inputs.size(); i++)
        {
            results.emplace_back(make_variable(pb, FMT(prefix, ".results")));
        }
    }

    const VariableT &result() const
    {
        return results.back();
    }

    void generate_r1cs_witness()
    {
        pb.val(results[0]) = pb.val(inputs[0]) * pb.val(inputs[1]);
        for (unsigned int i = 2; i < inputs.size(); i++)
        {
            pb.val(results[i - 1]) = pb.val(results[i - 2]) * pb.val(inputs[i]);
        }
    }

    void generate_r1cs_constraints()
    {
        // This can be done more efficiently but we never have any long inputs so no
        // need
        if (inputs.size() > 3)
        {
            std::cout << "[AndGadget] unexpected input length " << inputs.size() << std::endl;
        }
        pb.add_r1cs_constraint(ConstraintT(inputs[0], inputs[1], results[0]), FMT(annotation_prefix, ".A && B"));
        for (unsigned int i = 2; i < inputs.size(); i++)
        {
            pb.add_r1cs_constraint(
              ConstraintT(inputs[i], results[i - 2], results[i - 1]), FMT(annotation_prefix, ".A && B"));
        }
    }
};

// (input[0] || input[1] || ...) (all inputs need to be boolean)
//
// This gadget is not designed to handle inputs of more than a couple of
// variables. Threfore, we are have not optimized the constraints as suggested
// in https://github.com/daira/r1cs/blob/master/zkproofs.pdf
class OrGadget : public GadgetT
{
  public:
    std::vector<VariableT> inputs;
    std::vector<VariableT> results;

    OrGadget( //
      ProtoboardT &pb,
      const std::vector<VariableT> &_inputs,
      const std::string &prefix)
        : GadgetT(pb, prefix), inputs(_inputs)
    {
        assert(inputs.size() > 1);
        for (unsigned int i = 1; i < inputs.size(); i++)
        {
            results.emplace_back(make_variable(pb, FMT(prefix, ".results")));
        }
    }

    const VariableT &result() const
    {
        return results.back();
    }

    void generate_r1cs_witness()
    {
        pb.val(results[0]) = FieldT::one() - (FieldT::one() - pb.val(inputs[0])) * (FieldT::one() - pb.val(inputs[1]));
        for (unsigned int i = 2; i < inputs.size(); i++)
        {
            pb.val(results[i - 1]) =
              FieldT::one() - (FieldT::one() - pb.val(results[i - 2])) * (FieldT::one() - pb.val(inputs[i]));
        }
    }

    void generate_r1cs_constraints()
    {
        if (inputs.size() > 3)
        {
            std::cout << "[OrGadget] unexpected input length " << inputs.size() << std::endl;
        }

        pb.add_r1cs_constraint(
          ConstraintT(FieldT::one() - inputs[0], FieldT::one() - inputs[1], FieldT::one() - results[0]),
          FMT(annotation_prefix, ".A || B == _or"));
        for (unsigned int i = 2; i < inputs.size(); i++)
        {
            pb.add_r1cs_constraint(
              ConstraintT(FieldT::one() - inputs[i], FieldT::one() - results[i - 2], FieldT::one() - results[i - 1]),
              FMT(annotation_prefix, ".A || B == _or"));
        }
    }
};

// !A (A needs to be boolean)
class NotGadget : public GadgetT
{
  public:
    VariableT A;
    VariableT _not;

    NotGadget( //
      ProtoboardT &pb,
      const VariableT &_A,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          A(_A),
          _not(make_variable(pb, FMT(prefix, "._not")))
    {
    }

    const VariableT &result() const
    {
        return _not;
    }

    void generate_r1cs_witness()
    {
        pb.val(_not) = FieldT::one() - pb.val(A);
    }

    void generate_r1cs_constraints(bool enforceBitness = true)
    {
        if (enforceBitness)
        {
            libsnark::generate_boolean_r1cs_constraint<ethsnarks::FieldT>(pb, A, FMT(annotation_prefix, ".bitness"));
        }
        pb.add_r1cs_constraint(
          ConstraintT(FieldT::one() - A, FieldT::one(), _not), FMT(annotation_prefix, ".!A == _not"));
    }
};

// A[i] ^ B[i]
class XorArrayGadget : public GadgetT
{
  public:
    VariableArrayT A;
    VariableArrayT B;
    VariableArrayT C;

    XorArrayGadget( //
      ProtoboardT &pb,
      VariableArrayT _A,
      VariableArrayT _B,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          A(_A),
          B(_B),

          C(make_var_array(pb, A.size(), FMT(prefix, ".C")))
    {
        assert(A.size() == B.size());
    }

    const VariableArrayT &result() const
    {
        return C;
    }

    void generate_r1cs_witness()
    {
        for (unsigned int i = 0; i < C.size(); i++)
        {
            pb.val(C[i]) =
              pb.val(A[i]) + pb.val(B[i]) - ((pb.val(A[i]) == FieldT::one() && pb.val(B[i]) == FieldT::one()) ? 2 : 0);
        }
    }

    void generate_r1cs_constraints()
    {
        for (unsigned int i = 0; i < C.size(); i++)
        {
            pb.add_r1cs_constraint(
              ConstraintT(2 * A[i], B[i], A[i] + B[i] - C[i]), FMT(annotation_prefix, ".A ^ B == C"));
        }
    }
};

// (A == B)
class EqualGadget : public GadgetT
{
  public:
    UnsafeSubGadget difference;
    IsNonZero isNonZeroDifference;
    NotGadget isZeroDifference;

    EqualGadget( //
      ProtoboardT &pb,
      const VariableT &A,
      const VariableT &B,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          difference(pb, A, B, FMT(prefix, ".difference")),
          isNonZeroDifference(pb, difference.result(), FMT(prefix, ".isNonZeroDifference")),
          isZeroDifference(pb, isNonZeroDifference.result(), FMT(prefix, ".isZeroDifference"))
    {
    }

    const VariableT &result() const
    {
        return isZeroDifference.result();
    }

    void generate_r1cs_witness()
    {
        difference.generate_r1cs_witness();
        isNonZeroDifference.generate_r1cs_witness();
        isZeroDifference.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        difference.generate_r1cs_constraints();
        isNonZeroDifference.generate_r1cs_constraints();
        isZeroDifference.generate_r1cs_constraints();
    }
};

// (A != B)
class NotEqualGadget : public GadgetT
{
  public:
    EqualGadget equal;
    NotGadget notEqual;

    NotEqualGadget( //
      ProtoboardT &pb,
      const VariableT &A,
      const VariableT &B,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          equal(pb, A, B, FMT(prefix, ".equal")),
          notEqual(pb, equal.result(), FMT(prefix, ".notEqual"))
    {
    }

    const VariableT &result() const
    {
        return notEqual.result();
    }

    void generate_r1cs_witness()
    {
        equal.generate_r1cs_witness();
        notEqual.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        equal.generate_r1cs_constraints();
        notEqual.generate_r1cs_constraints();
    }
};

// require(A == B)
class RequireEqualGadget : public GadgetT
{
  public:
    VariableT A;
    VariableT B;

    RequireEqualGadget( //
      ProtoboardT &pb,
      const VariableT &_A,
      const VariableT &_B,
      const std::string &prefix)
        : GadgetT(pb, prefix), A(_A), B(_B)
    {
    }

    void generate_r1cs_witness()
    {
    }

    void generate_r1cs_constraints()
    {
        requireEqual(pb, A, B, FMT(annotation_prefix, ".requireEqual"));
    }
};

// require(A == 0 || B == 0)
class RequireZeroAorBGadget : public GadgetT
{
  public:
    VariableT A;
    VariableT B;

    RequireZeroAorBGadget( //
      ProtoboardT &pb,
      const VariableT &_A,
      const VariableT &_B,
      const std::string &prefix)
        : GadgetT(pb, prefix), A(_A), B(_B)
    {
    }

    void generate_r1cs_witness()
    {
    }

    void generate_r1cs_constraints()
    {
        pb.add_r1cs_constraint(ConstraintT(A, B, FieldT::zero()), FMT(annotation_prefix, ".A == 0 || B == 0"));
    }
};

// require(A != 0)
class RequireNotZeroGadget : public GadgetT
{
  public:
    VariableT A;
    VariableT A_inv;

    RequireNotZeroGadget( //
      ProtoboardT &pb,
      const VariableT &_A,
      const std::string &prefix)
        : GadgetT(pb, prefix), A(_A), A_inv(make_variable(pb, FMT(prefix, ".A_inv")))
    {
    }

    void generate_r1cs_witness()
    {
        pb.val(A_inv) = pb.val(A).inverse();
    }

    void generate_r1cs_constraints()
    {
        pb.add_r1cs_constraint(ConstraintT(A, A_inv, FieldT::one()), FMT(annotation_prefix, ".A * A_inv == 1"));
    }
};

// require(A != B)
class RequireNotEqualGadget : public GadgetT
{
  public:
    VariableT A;
    VariableT B;

    VariableT difference;
    RequireNotZeroGadget notZero;

    RequireNotEqualGadget( //
      ProtoboardT &pb,
      const VariableT &_A,
      const VariableT &_B,
      const std::string &prefix)
        : GadgetT(pb, prefix),
          A(_A),
          B(_B),
          difference(make_variable(pb, FMT(prefix, ".difference"))),
          notZero(pb, difference, FMT(prefix, ".difference != 0"))
    {
    }

    void generate_r1cs_witness()
    {
        pb.val(difference) = pb.val(A) - pb.val(B);
        notZero.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        pb.add_r1cs_constraint(
          ConstraintT(A - B, FieldT::one(), difference), FMT(annotation_prefix, ".A - B == difference"));
        notZero.generate_r1cs_constraints();
    }
};

// (A <(=) B)
class LeqGadget : public GadgetT
{
  public:
    VariableT _lt;
    VariableT _leq;
    libsnark::comparison_gadget<ethsnarks::FieldT> comparison;
    NotGadget _gt;
    NotGadget _gte;
    AndGadget _eq;

    LeqGadget( //
      ProtoboardT &pb,
      const VariableT &A,
      const VariableT &B,
      const size_t n,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          _lt(make_variable(pb, 1, FMT(prefix, ".lt"))),
          _leq(make_variable(pb, 1, FMT(prefix, ".leq"))),
          comparison(pb, n, A, B, _lt, _leq, FMT(prefix, ".A <(=) B")),
          _gt(pb, _leq, FMT(prefix, ".gt")),
          _gte(pb, _lt, FMT(prefix, ".gte")),
          _eq(pb, {_leq, _gte.result()}, FMT(prefix, ".eq"))
    {
        // The comparison gadget is only guaranteed to work correctly on values in
        // the field capacity - 1
        assert(n <= NUM_BITS_FIELD_CAPACITY - 1);
    }

    const VariableT &lt() const
    {
        return _lt;
    }

    const VariableT &leq() const
    {
        return _leq;
    }

    const VariableT &eq() const
    {
        return _eq.result();
    }

    const VariableT &gte() const
    {
        return _gte.result();
    }

    const VariableT &gt() const
    {
        return _gt.result();
    }

    void generate_r1cs_witness()
    {
        comparison.generate_r1cs_witness();
        _gt.generate_r1cs_witness();
        _gte.generate_r1cs_witness();
        _eq.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        comparison.generate_r1cs_constraints();
        _gt.generate_r1cs_constraints();
        _gte.generate_r1cs_constraints();
        _eq.generate_r1cs_constraints();
    }
};

// (A < B)
class LtFieldGadget : public GadgetT
{
  public:
    field2bits_strict Abits;
    field2bits_strict Bbits;
    FromBitsGadget Alo;
    FromBitsGadget Ahi;
    FromBitsGadget Blo;
    FromBitsGadget Bhi;
    LeqGadget partLo;
    LeqGadget partHi;
    TernaryGadget res;

    LtFieldGadget( //
      ProtoboardT &pb,
      const VariableT &A,
      const VariableT &B,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          Abits(pb, A, FMT(prefix, ".Abits")),
          Bbits(pb, B, FMT(prefix, ".Bbits")),

          Alo(pb, subArray(Abits.result(), 0, 254 / 2), FMT(prefix, ".Alo")),
          Ahi(pb, subArray(Abits.result(), 254 / 2, 254 / 2), FMT(prefix, ".Ahi")),
          Blo(pb, subArray(Bbits.result(), 0, 254 / 2), FMT(prefix, ".Blo")),
          Bhi(pb, subArray(Bbits.result(), 254 / 2, 254 / 2), FMT(prefix, ".Bhi")),
          partLo(pb, Alo.packed, Blo.packed, 254 / 2, FMT(prefix, ".partLo")),
          partHi(pb, Ahi.packed, Bhi.packed, 254 / 2, FMT(prefix, ".partHi")),
          res(pb, partHi.eq(), partLo.lt(), partHi.lt(), FMT(prefix, ".res"))
    {
    }

    const VariableT &lt() const
    {
        return res.result();
    }

    void generate_r1cs_witness()
    {
        Abits.generate_r1cs_witness();
        Bbits.generate_r1cs_witness();
        Alo.generate_r1cs_witness();
        Ahi.generate_r1cs_witness();
        Blo.generate_r1cs_witness();
        Bhi.generate_r1cs_witness();
        partLo.generate_r1cs_witness();
        partHi.generate_r1cs_witness();
        res.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        Abits.generate_r1cs_constraints();
        Bbits.generate_r1cs_constraints();
        Alo.generate_r1cs_constraints(false);
        Ahi.generate_r1cs_constraints(false);
        Blo.generate_r1cs_constraints(false);
        Bhi.generate_r1cs_constraints(false);
        partLo.generate_r1cs_constraints();
        partHi.generate_r1cs_constraints();
        res.generate_r1cs_constraints();
    }
};

// min(A, B)
class MinGadget : public GadgetT
{
  public:
    LeqGadget A_lt_B;
    TernaryGadget minimum;

    MinGadget( //
      ProtoboardT &pb,
      const VariableT &A,
      const VariableT &B,
      const size_t n,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          A_lt_B(pb, A, B, n, FMT(prefix, ".(A < B)")),
          minimum(pb, A_lt_B.lt(), A, B, FMT(prefix, ".minimum = (A < B) ? A : B"))
    {
    }

    const VariableT &result() const
    {
        return minimum.result();
    }

    void generate_r1cs_witness()
    {
        A_lt_B.generate_r1cs_witness();
        minimum.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        A_lt_B.generate_r1cs_constraints();
        minimum.generate_r1cs_constraints();
    }
};

// max(A, B)
class MaxGadget : public GadgetT
{
  public:
    LeqGadget A_lt_B;
    TernaryGadget maximum;

    MaxGadget( //
      ProtoboardT &pb,
      const VariableT &A,
      const VariableT &B,
      const size_t n,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          A_lt_B(pb, A, B, n, FMT(prefix, ".(A < B)")),
          maximum(pb, A_lt_B.lt(), B, A, FMT(prefix, ".maximum = (A < B) ? B : A"))
    {
    }

    const VariableT &result() const
    {
        return maximum.result();
    }

    void generate_r1cs_witness()
    {
        A_lt_B.generate_r1cs_witness();
        maximum.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        A_lt_B.generate_r1cs_constraints();
        maximum.generate_r1cs_constraints();
    }
};

// require(A <= B)
class RequireLeqGadget : public GadgetT
{
  public:
    LeqGadget leqGadget;

    RequireLeqGadget( //
      ProtoboardT &pb,
      const VariableT &A,
      const VariableT &B,
      const size_t n,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          leqGadget(pb, A, B, n, FMT(prefix, ".leq"))
    {
    }

    void generate_r1cs_witness()
    {
        leqGadget.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        leqGadget.generate_r1cs_constraints();
        pb.add_r1cs_constraint(
          ConstraintT(leqGadget.leq(), FieldT::one(), FieldT::one()), FMT(annotation_prefix, ".leq == 1"));
    }
};

// require(A < B)
class RequireLtGadget : public GadgetT
{
  public:
    LeqGadget leqGadget;

    RequireLtGadget( //
      ProtoboardT &pb,
      const VariableT &A,
      const VariableT &B,
      const size_t n,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          leqGadget(pb, A, B, n, FMT(prefix, ".leq"))
    {
    }

    void generate_r1cs_witness()
    {
        leqGadget.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        leqGadget.generate_r1cs_constraints();
        pb.add_r1cs_constraint(
          ConstraintT(leqGadget.lt(), FieldT::one(), FieldT::one()), FMT(annotation_prefix, ".lt == 1"));
    }
};

// if (C) then require(A), i.e.,
// require(!C || A)
class IfThenRequireGadget : public GadgetT
{
  public:
    NotGadget notC;
    OrGadget res;

    IfThenRequireGadget( //
      ProtoboardT &pb,
      const VariableT &C,
      const VariableT &A,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          notC(pb, C, FMT(prefix, ".notC")),
          res(pb, {notC.result(), A}, FMT(prefix, ".res"))
    {
    }

    void generate_r1cs_witness()
    {
        notC.generate_r1cs_witness();
        res.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        notC.generate_r1cs_constraints();
        res.generate_r1cs_constraints();
        pb.add_r1cs_constraint(
          ConstraintT(res.result(), FieldT::one(), FieldT::one()), FMT(annotation_prefix, ".valid"));
    }
};

// if (C) then require(A == B), i.e.,
// require(!C || A == B)
class IfThenRequireEqualGadget : public GadgetT
{
  public:
    EqualGadget eq;
    IfThenRequireGadget res;

    IfThenRequireEqualGadget(
      ProtoboardT &pb,
      const VariableT &C,
      const VariableT &A,
      const VariableT &B,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          eq(pb, A, B, FMT(prefix, ".eq")),
          res(pb, C, eq.result(), FMT(prefix, ".res"))
    {
    }

    void generate_r1cs_witness()
    {
        eq.generate_r1cs_witness();
        res.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        eq.generate_r1cs_constraints();
        res.generate_r1cs_constraints();
    }
};

// if (C) then require(A != B), i.e.,
// require(!C || A != B)
class IfThenRequireNotEqualGadget : public GadgetT
{
  public:
    EqualGadget eq;
    NotGadget notEq;
    IfThenRequireGadget res;

    IfThenRequireNotEqualGadget(
      ProtoboardT &pb,
      const VariableT &C,
      const VariableT &A,
      const VariableT &B,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          eq(pb, A, B, FMT(prefix, ".eq")),
          notEq(pb, eq.result(), FMT(prefix, ".notEq")),
          res(pb, C, notEq.result(), FMT(prefix, ".res"))
    {
    }

    void generate_r1cs_witness()
    {
        eq.generate_r1cs_witness();
        notEq.generate_r1cs_witness();
        res.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        eq.generate_r1cs_constraints();
        notEq.generate_r1cs_constraints();
        res.generate_r1cs_constraints();
    }
};

// (value * numerator) = product = denominator * quotient + remainder
// product / denominator = quotient
// product % denominator = remainder
class MulDivGadget : public GadgetT
{
  public:
    const VariableT value;
    const VariableT numerator;
    const VariableT denominator;

    const VariableT quotient;

    RequireNotZeroGadget denominator_notZero;
    UnsafeMulGadget product;
    DualVariableGadget remainder;
    RequireLtGadget remainder_lt_denominator;

    MulDivGadget(
      ProtoboardT &pb,
      const Constants &constants,
      const VariableT &_value,
      const VariableT &_numerator,
      const VariableT &_denominator,
      unsigned int numBitsValue,
      unsigned int numBitsNumerator,
      unsigned int numBitsDenominator,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          value(_value),
          numerator(_numerator),
          denominator(_denominator),

          quotient(make_variable(pb, FMT(prefix, ".quotient"))),

          denominator_notZero(pb, denominator, FMT(prefix, ".denominator_notZero")),
          product(pb, value, numerator, FMT(prefix, ".product")),
          // Range limit the remainder. The comparison below is not guaranteed to
          // work for very large values.
          remainder(pb, numBitsDenominator, FMT(prefix, ".remainder")),
          remainder_lt_denominator(
            pb,
            remainder.packed,
            denominator,
            numBitsDenominator,
            FMT(prefix, ".remainder < denominator"))
    {
        assert(numBitsValue + numBitsNumerator <= NUM_BITS_FIELD_CAPACITY);
    }

    void generate_r1cs_witness()
    {
        denominator_notZero.generate_r1cs_witness();
        product.generate_r1cs_witness();
        if (pb.val(denominator) != FieldT::zero())
        {
            pb.val(quotient) = ethsnarks::FieldT(
              (toBigInt(pb.val(product.result())) / toBigInt(pb.val(denominator))).to_string().c_str());
        }
        else
        {
            pb.val(quotient) = FieldT::zero();
        }
        remainder.generate_r1cs_witness(pb, pb.val(product.result()) - (pb.val(denominator) * pb.val(quotient)));
        remainder_lt_denominator.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        denominator_notZero.generate_r1cs_constraints();
        product.generate_r1cs_constraints();
        pb.add_r1cs_constraint(
          ConstraintT(denominator, quotient, product.result() - remainder.packed),
          FMT(annotation_prefix, ".quotient * denominator == product - remainder"));
        remainder.generate_r1cs_constraints(true);
        remainder_lt_denominator.generate_r1cs_constraints();
    }

    const VariableT &result() const
    {
        return quotient;
    }

    const VariableT &getRemainder() const
    {
        return remainder.packed;
    }

    const VariableT &getProduct() const
    {
        return product.result();
    }
};

// _accuracy.numerator / _accuracy.denominator <=  value / original
// original * _accuracy.numerator <= value * _accuracy.denominator
// We have to make sure there are no overflows and the value is <= the original
// value (so a user never spends more) so we also check:
// - value <= original
// - value < 2^maxNumBits
class RequireAccuracyGadget : public GadgetT
{
  public:
    libsnark::dual_variable_gadget<FieldT> value;
    VariableT original;
    Accuracy accuracy;

    RequireLeqGadget value_leq_original;

    VariableT original_mul_accuracyN;
    VariableT value_mul_accuracyD;

    RequireLeqGadget original_mul_accuracyN_LEQ_value_mul_accuracyD;

    RequireAccuracyGadget(
      ProtoboardT &pb,
      const VariableT &_value,
      const VariableT &_original,
      const Accuracy &_accuracy,
      unsigned int maxNumBits,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          // Range limit the value. The comparison below is not guaranteed to work
          // for very large values.
          value(pb, _value, maxNumBits, FMT(prefix, ".value")),
          original(_original),
          accuracy(_accuracy),

          value_leq_original(pb, value.packed, original, maxNumBits, FMT(prefix, ".value_lt_original")),

          original_mul_accuracyN(make_variable(pb, FMT(prefix, ".original_mul_accuracyN"))),
          value_mul_accuracyD(make_variable(pb, FMT(prefix, ".value_mul_accuracyD"))),

          original_mul_accuracyN_LEQ_value_mul_accuracyD(
            pb,
            original_mul_accuracyN,
            value_mul_accuracyD,
            maxNumBits + 32,
            FMT(prefix, ".original_mul_accuracyN_LEQ_value_mul_accuracyD"))
    {
    }

    void generate_r1cs_witness()
    {
        value.generate_r1cs_witness_from_packed();

        value_leq_original.generate_r1cs_witness();

        pb.val(original_mul_accuracyN) = pb.val(original) * accuracy.numerator;
        pb.val(value_mul_accuracyD) = pb.val(value.packed) * accuracy.denominator;
        original_mul_accuracyN_LEQ_value_mul_accuracyD.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        value.generate_r1cs_constraints(true);

        value_leq_original.generate_r1cs_constraints();

        pb.add_r1cs_constraint(
          ConstraintT(original, accuracy.numerator, original_mul_accuracyN),
          FMT(annotation_prefix, ".original * accuracy.numerator == original_mul_accuracyN"));
        pb.add_r1cs_constraint(
          ConstraintT(value.packed, accuracy.denominator, value_mul_accuracyD),
          FMT(annotation_prefix, ".value * accuracy.denominator == value_mul_accuracyD"));
        original_mul_accuracyN_LEQ_value_mul_accuracyD.generate_r1cs_constraints();
    }
};

// Public data helper class.
// Will hash all public data with sha256 to a single public input of
// NUM_BITS_FIELD_CAPACITY bits
class PublicDataGadget : public GadgetT
{
  public:
    const VariableT publicInput;
    VariableArrayT publicDataBits;

    std::unique_ptr<sha256_many> hasher;
    std::unique_ptr<FromBitsGadget> calculatedHash;

    PublicDataGadget( //
      ProtoboardT &pb,
      const std::string &prefix)
        : GadgetT(pb, prefix), publicInput(make_variable(pb, FMT(prefix, ".publicInput")))
    {
        pb.set_input_sizes(1);
    }

    void add(const VariableArrayT &bits)
    {
        publicDataBits.insert(publicDataBits.end(), bits.rbegin(), bits.rend());
    }

    void transform(unsigned int start, unsigned int count, unsigned int size)
    {
        VariableArrayT transformedBits;
        transformedBits.reserve(publicDataBits.size());
        for (unsigned int i = 0; i < start; i++)
        {
            transformedBits.emplace_back(publicDataBits[i]);
        }

        unsigned int sizePart1 = 29 * 8;
        unsigned int sizePart2 = 39 * 8;

        unsigned int startPart1 = start;
        unsigned int startPart2 = startPart1 + sizePart1 * count;

        // Part 1
        for (unsigned int i = 0; i < count; i++)
        {
            for (unsigned int j = 0; j < sizePart1; j++)
            {
                transformedBits.emplace_back(publicDataBits[start + i * size + j]);
            }
        }
        // Part 2
        for (unsigned int i = 0; i < count; i++)
        {
            for (unsigned int j = 0; j < sizePart2; j++)
            {
                transformedBits.emplace_back(publicDataBits[start + i * size + sizePart1 + j]);
            }
        }

        publicDataBits = transformedBits;
    }

    void generate_r1cs_witness()
    {
        // Calculate the hash
        hasher->generate_r1cs_witness();

        // Calculate the expected public input
        calculatedHash->generate_r1cs_witness_from_bits();
        pb.val(publicInput) = pb.val(calculatedHash->packed);

        printBits("[ZKS]publicData: 0x", publicDataBits.get_bits(pb), false);
        printBits("[ZKS]publicDataHash: 0x", hasher->result().bits.get_bits(pb));
        print(pb, "[ZKS]publicInput", calculatedHash->packed);
    }

    void generate_r1cs_constraints()
    {
        // Calculate the hash
        hasher.reset(new sha256_many(pb, publicDataBits, ".hasher"));
        hasher->generate_r1cs_constraints();

        // Check that the hash matches the public input
        calculatedHash.reset(new FromBitsGadget(
          pb, reverse(subArray(hasher->result().bits, 0, NUM_BITS_FIELD_CAPACITY)), ".packCalculatedHash"));
        calculatedHash->generate_r1cs_constraints(false);
        requireEqual(pb, calculatedHash->packed, publicInput, ".publicDataCheck");
    }
};

// Decodes a float with the specified encoding
class FloatGadget : public GadgetT
{
  public:
    const Constants &constants;

    const FloatEncoding &floatEncoding;

    VariableArrayT f;

    std::vector<VariableT> values;
    std::vector<VariableT> baseMultipliers;
    std::vector<TernaryGadget> multipliers;

    FloatGadget(
      ProtoboardT &pb,
      const Constants &_constants,
      const FloatEncoding &_floatEncoding,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          constants(_constants),
          floatEncoding(_floatEncoding),

          f(make_var_array(pb, floatEncoding.numBitsExponent + floatEncoding.numBitsMantissa, FMT(prefix, ".f")))
    {
        for (unsigned int i = 0; i < f.size(); i++)
        {
            values.emplace_back(make_variable(pb, FMT(prefix, ".FloatToUintGadgetVariable")));
        }

        for (unsigned int i = 0; i < floatEncoding.numBitsExponent; i++)
        {
            baseMultipliers.emplace_back(make_variable(pb, FMT(prefix, ".baseMultipliers")));
            multipliers.emplace_back(
              pb, f[floatEncoding.numBitsMantissa + i], baseMultipliers[i], constants._1, FMT(prefix, ".multipliers"));
        }
    }

    void generate_r1cs_witness(const ethsnarks::FieldT &floatValue)
    {
        f.fill_with_bits_of_field_element(pb, floatValue);

        // Decodes the mantissa
        for (unsigned int i = 0; i < floatEncoding.numBitsMantissa; i++)
        {
            unsigned j = floatEncoding.numBitsMantissa - 1 - i;
            pb.val(values[i]) = (i == 0) ? pb.val(f[j]) : (pb.val(values[i - 1]) * 2 + pb.val(f[j]));
        }

        // Decodes the exponent and shifts the mantissa
        for (unsigned int i = floatEncoding.numBitsMantissa; i < f.size(); i++)
        {
            // Decode the exponent
            unsigned int j = i - floatEncoding.numBitsMantissa;
            pb.val(baseMultipliers[j]) =
              (j == 0) ? floatEncoding.exponentBase : pb.val(baseMultipliers[j - 1]) * pb.val(baseMultipliers[j - 1]);
            multipliers[j].generate_r1cs_witness();

            // Shift the value with the partial exponent
            pb.val(values[i]) = pb.val(values[i - 1]) * pb.val(multipliers[j].result());
        }
    }

    void generate_r1cs_constraints()
    {
        // Make sure all the bits of the float or 0s and 1s
        for (unsigned int i = 0; i < f.size(); i++)
        {
            libsnark::generate_boolean_r1cs_constraint<ethsnarks::FieldT>(pb, f[i], FMT(annotation_prefix, ".bitness"));
        }

        // Decodes the mantissa
        for (unsigned int i = 0; i < floatEncoding.numBitsMantissa; i++)
        {
            unsigned j = floatEncoding.numBitsMantissa - 1 - i;
            if (i == 0)
            {
                pb.add_r1cs_constraint(
                  ConstraintT(f[j], FieldT::one(), values[i]),
                  FMT(annotation_prefix, (std::string(".value_") + std::to_string(i)).c_str()));
            }
            else
            {
                pb.add_r1cs_constraint(
                  ConstraintT(values[i - 1] * 2 + f[j], FieldT::one(), values[i]),
                  FMT(annotation_prefix, (std::string(".value_") + std::to_string(i)).c_str()));
            }
        }

        // Decodes the exponent and shifts the mantissa
        for (unsigned int i = floatEncoding.numBitsMantissa; i < f.size(); i++)
        {
            // Decode the exponent
            unsigned int j = i - floatEncoding.numBitsMantissa;
            if (j == 0)
            {
                pb.add_r1cs_constraint(
                  ConstraintT(floatEncoding.exponentBase, FieldT::one(), baseMultipliers[j]), ".baseMultipliers");
            }
            else
            {
                pb.add_r1cs_constraint(
                  ConstraintT(baseMultipliers[j - 1], baseMultipliers[j - 1], baseMultipliers[j]), ".baseMultipliers");
            }
            multipliers[j].generate_r1cs_constraints();

            // Shift the value with the partial exponent
            pb.add_r1cs_constraint(ConstraintT(values[i - 1], multipliers[j].result(), values[i]), ".valuesExp");
        }
    }

    const VariableT &value() const
    {
        return values.back();
    }

    const VariableArrayT &bits() const
    {
        return f;
    }
};

// Checks 'type' is one of Constants.values - [0 - 10]
struct SelectorGadget : public GadgetT
{
    const Constants &constants;

    std::vector<EqualGadget> bits;
    std::vector<UnsafeAddGadget> sum;

    VariableArrayT res;

    SelectorGadget(
      ProtoboardT &pb,
      const Constants &_constants,
      const VariableT &type,
      unsigned int maxBits,
      const std::string &prefix)
        : GadgetT(pb, prefix), constants(_constants)
    {
        assert(maxBits <= constants.values.size());
        for (unsigned int i = 0; i < maxBits; i++)
        {
            bits.emplace_back(pb, type, constants.values[i], FMT(annotation_prefix, ".bits"));
            sum.emplace_back(
              pb, (i == 0) ? constants._0 : sum.back().result(), bits.back().result(), FMT(annotation_prefix, ".sum"));
            res.emplace_back(bits.back().result());
        }
    }

    void generate_r1cs_witness()
    {
        for (unsigned int i = 0; i < bits.size(); i++)
        {
            bits[i].generate_r1cs_witness();
            sum[i].generate_r1cs_witness();
        }
    }

    void generate_r1cs_constraints()
    {
        for (unsigned int i = 0; i < bits.size(); i++)
        {
            bits[i].generate_r1cs_constraints();
            sum[i].generate_r1cs_constraints();
        }
        // Sum needs to equal 1
        requireEqual(pb, sum.back().result(), constants._1, FMT(annotation_prefix, ".selector_sum_one"));
    }

    const VariableArrayT &result() const
    {
        return res;
    }
};

// if selector=[1,0,0] and values = [a,b,c], return a
// if selector=[0,1,0] and values = [a,b,c], return b
// if selector=[0,0,1] and values = [a,b,c], return c
// special case,
// if selector=[0,0,0] and values = [a,b,c], return c
class SelectGadget : public GadgetT
{
  public:
    std::vector<TernaryGadget> results;

    SelectGadget(
      ProtoboardT &pb,
      const Constants &_constants,
      const VariableArrayT &selector,
      const std::vector<VariableT> &values,
      const std::string &prefix)
        : GadgetT(pb, prefix)
    {
        assert(values.size() == selector.size());
        for (unsigned int i = 0; i < values.size(); i++)
        {
            results.emplace_back(
              pb, selector[i], values[i], (i == 0) ? _constants._0 : results.back().result(), FMT(prefix, ".results"));
        }
    }

    void generate_r1cs_witness()
    {
        for (unsigned int i = 0; i < results.size(); i++)
        {
            results[i].generate_r1cs_witness();
        }
    }

    void generate_r1cs_constraints()
    {
        for (unsigned int i = 0; i < results.size(); i++)
        {
            results[i].generate_r1cs_constraints(false);
        }
    }

    const VariableT &result() const
    {
        return results.back().result();
    }
};

// Select one out of many arrays based on mutiple boolean selector values.
// If all the selector values are false, then the last array is selected.
class ArraySelectGadget : public GadgetT
{
  public:
    std::vector<ArrayTernaryGadget> results;

    ArraySelectGadget(
      ProtoboardT &pb,
      const Constants &_constants,
      const VariableArrayT &selector,
      const std::vector<VariableArrayT> &values,
      const std::string &prefix)
        : GadgetT(pb, prefix)
    {
        assert(values.size() == selector.size());
        for (unsigned int i = 0; i < values.size(); i++)
        {
            results.emplace_back(
              pb,
              selector[i],
              values[i],
              (i == 0) ? VariableArrayT(values[0].size(), _constants._0) : results.back().result(),
              FMT(prefix, ".results"));
        }
    }

    void generate_r1cs_witness()
    {
        for (unsigned int i = 0; i < results.size(); i++)
        {
            results[i].generate_r1cs_witness();
        }
    }

    void generate_r1cs_constraints()
    {
        for (unsigned int i = 0; i < results.size(); i++)
        {
            results[i].generate_r1cs_constraints(false);
        }
    }

    const VariableArrayT &result() const
    {
        return results.back().result();
    }
};

// Checks that the new ower equals the current onwer or the current ower is 0.
class OwnerValidGadget : public GadgetT
{
  public:
    EqualGadget newOwner_equal_oldOwner;
    EqualGadget no_oldOwner;
    OrGadget equal_owner_or_no_owner;
    IfThenRequireEqualGadget equal_owner_or_no_owner_eq_true;

    OwnerValidGadget(
      ProtoboardT &pb,
      const Constants &constants,
      const VariableT &oldOwner,
      const VariableT &newOwner,
      const VariableT &verify,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          newOwner_equal_oldOwner(pb, newOwner, oldOwner, FMT(prefix, ".newOwner_equal_oldOwner")),
          no_oldOwner(pb, oldOwner, constants._0, FMT(prefix, ".no_oldOwner")),
          equal_owner_or_no_owner(
            pb,
            {newOwner_equal_oldOwner.result(), no_oldOwner.result()},
            FMT(prefix, ".equal_owner_or_no_owner")),
          equal_owner_or_no_owner_eq_true(
            pb,
            verify,
            equal_owner_or_no_owner.result(),
            constants._1,
            FMT(prefix, ".equal_owner_or_no_owner_eq_true"))
    {
    }

    void generate_r1cs_witness()
    {
        newOwner_equal_oldOwner.generate_r1cs_witness();
        no_oldOwner.generate_r1cs_witness();
        equal_owner_or_no_owner.generate_r1cs_witness();
        equal_owner_or_no_owner_eq_true.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        newOwner_equal_oldOwner.generate_r1cs_constraints();
        no_oldOwner.generate_r1cs_constraints();
        equal_owner_or_no_owner.generate_r1cs_constraints();
        equal_owner_or_no_owner_eq_true.generate_r1cs_constraints();
    }

    const VariableT &isNewAccount() const
    {
        return no_oldOwner.result();
    }
};

// Checks that the new ower equals the current onwer or the current ower is 0.
class IsNftGadget : public GadgetT
{
  public:
    LeqGadget tokenId_leq_nftStart;

    IsNftGadget(ProtoboardT &pb, const Constants &constants, const VariableT &tokenID, const std::string &prefix)
        : GadgetT(pb, prefix),

          tokenId_leq_nftStart(pb, tokenID, constants.nftTokenIdStart, NUM_BITS_TOKEN, FMT(prefix, ".isNFT"))
    {
    }

    void generate_r1cs_witness()
    {
        tokenId_leq_nftStart.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        tokenId_leq_nftStart.generate_r1cs_constraints();
    }

    const VariableT &isNFT()
    {
        return tokenId_leq_nftStart.gte();
    }

    const VariableT &isNotNFT()
    {
        return tokenId_leq_nftStart.lt();
    }
};

// Checks that the new ower equals the current onwer or the current ower is 0.
class RequireNotNftGadget : public GadgetT
{
  public:
    IsNftGadget isNFT;
    RequireEqualGadget requireValid;

    RequireNotNftGadget(
      ProtoboardT &pb,
      const Constants &constants,
      const VariableT &tokenID,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          isNFT(pb, constants, tokenID, FMT(prefix, ".isNFT")),
          requireValid(pb, isNFT.isNotNFT(), constants._1, FMT(prefix, ".isNFT"))
    {
    }

    void generate_r1cs_witness()
    {
        isNFT.generate_r1cs_witness();
        requireValid.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        isNFT.generate_r1cs_constraints();
        requireValid.generate_r1cs_constraints();
    }
};

// - assert (tokenID < NFT_TOKEN_ID_START && tokenID == destTokenID) ||
// (tokenID >= NFT_TOKEN_ID_START && destTokenID >= NFT_TOKEN_ID_START && (fromNftData == toNftData || toNftData == 0)))
// - fromNewNftData := (fromTokenID >= NFT_TOKEN_ID_START && fromBalanceAfter == 0) ? 0 : fromNftData
// - toNewNftData := (toTokenID >= NFT_TOKEN_ID_START) ? 0 : toNftData
// - toTokenValueDA := (fromTokenID == toTokenID) ? 0 : toTokenID
class TokenTransferDataGadget : public GadgetT
{
  public:
    IsNftGadget isNftFromTokenID;
    IsNftGadget isNftToTokenID;
    EqualGadget tokensEqual;

    OwnerValidGadget nftDataValid;

    AndGadget nonNftRequirement;
    AndGadget nftRequirement;

    OrGadget valid;
    IfThenRequireGadget requireValid;

    EqualGadget isFromBalanceAfterZero;
    AndGadget isFromBalanceAfterZeroAndNFT;
    TernaryGadget fromNewNftData;

    TernaryGadget toNewNftData;

    TernaryGadget toTokenValueDA;
    ToBitsGadget toTokenBitsDA;

    TokenTransferDataGadget(
      ProtoboardT &pb,
      const Constants &constants,
      const VariableT &fromTokenID,
      const VariableT &fromNftData,
      const VariableT &toTokenID,
      const VariableT &toNftData,
      const VariableT &fromBalanceAfter,
      const VariableT &verify,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          isNftFromTokenID(pb, constants, fromTokenID, FMT(prefix, ".isNftFromTokenID")),
          isNftToTokenID(pb, constants, toTokenID, FMT(prefix, ".isNftToTokenID")),
          tokensEqual(pb, fromTokenID, toTokenID, FMT(prefix, ".isNftToTokenID")),

          nftDataValid(pb, constants, toNftData, fromNftData, isNftFromTokenID.isNFT(), FMT(prefix, ".nftDataValid")),

          nonNftRequirement(pb, {isNftFromTokenID.isNotNFT(), tokensEqual.result()}, FMT(prefix, ".nonNftRequirement")),
          nftRequirement(pb, {isNftFromTokenID.isNFT(), isNftToTokenID.isNFT()}, FMT(prefix, ".nftRequirement")),

          valid(pb, {nonNftRequirement.result(), nftRequirement.result()}, FMT(prefix, ".valid")),
          requireValid(pb, verify, valid.result(), FMT(prefix, ".requireValid")),

          isFromBalanceAfterZero(pb, fromBalanceAfter, constants._0, FMT(prefix, ".isFromBalanceAfterZero")),
          isFromBalanceAfterZeroAndNFT(
            pb,
            {isNftFromTokenID.isNFT(), isFromBalanceAfterZero.result()},
            FMT(prefix, ".isFromBalanceAfterZeroAndNFT")),
          fromNewNftData(
            pb,
            isFromBalanceAfterZeroAndNFT.result(),
            constants._0,
            fromNftData,
            FMT(prefix, ".fromNewNftData")),

          toNewNftData(pb, isNftToTokenID.isNFT(), fromNftData, toNftData, FMT(prefix, ".toNewNftData")),

          toTokenValueDA(pb, tokensEqual.result(), constants._0, toTokenID, FMT(prefix, ".toTokenValueDA")),
          toTokenBitsDA(pb, toTokenValueDA.result(), NUM_BITS_TOKEN, FMT(prefix, ".toTokenBitsDA"))
    {
    }

    virtual void generate_r1cs_witness()
    {
        isNftFromTokenID.generate_r1cs_witness();
        isNftToTokenID.generate_r1cs_witness();
        tokensEqual.generate_r1cs_witness();

        nftDataValid.generate_r1cs_witness();

        nonNftRequirement.generate_r1cs_witness();
        nftRequirement.generate_r1cs_witness();

        valid.generate_r1cs_witness();
        requireValid.generate_r1cs_witness();

        isFromBalanceAfterZero.generate_r1cs_witness();
        isFromBalanceAfterZeroAndNFT.generate_r1cs_witness();
        fromNewNftData.generate_r1cs_witness();

        toNewNftData.generate_r1cs_witness();

        toTokenValueDA.generate_r1cs_witness();
        toTokenBitsDA.generate_r1cs_witness();
    }

    virtual void generate_r1cs_constraints()
    {
        isNftFromTokenID.generate_r1cs_constraints();
        isNftToTokenID.generate_r1cs_constraints();
        tokensEqual.generate_r1cs_constraints();

        nftDataValid.generate_r1cs_constraints();

        nonNftRequirement.generate_r1cs_constraints();
        nftRequirement.generate_r1cs_constraints();

        valid.generate_r1cs_constraints();
        requireValid.generate_r1cs_constraints();

        isFromBalanceAfterZero.generate_r1cs_constraints();
        isFromBalanceAfterZeroAndNFT.generate_r1cs_constraints();
        fromNewNftData.generate_r1cs_constraints();

        toNewNftData.generate_r1cs_constraints();

        toTokenValueDA.generate_r1cs_constraints();
        toTokenBitsDA.generate_r1cs_constraints();
    }

    const VariableT &fromNftData()
    {
        return fromNewNftData.result();
    }

    const VariableT &toNftData()
    {
        return toNewNftData.result();
    }

    const VariableArrayT &toTokenDA() const
    {
        return toTokenBitsDA.bits;
    }
};

class TokenTradeDataGadget : public TokenTransferDataGadget
{
  public:
    AndGadget checkExpectedNftData;
    IfThenRequireEqualGadget requireValid;

    TokenTradeDataGadget(
      ProtoboardT &pb,
      const Constants &constants,
      const VariableT &fromTokenID,
      const VariableT &fromNftData,
      const VariableT &toTokenID,
      const VariableT &toNftData,
      const VariableT &fromBalanceAfter,
      const VariableT &verify,
      const VariableT &expectedNftData,
      const std::string &prefix)
        : TokenTransferDataGadget(
            pb,
            constants,
            fromTokenID,
            fromNftData,
            toTokenID,
            toNftData,
            fromBalanceAfter,
            verify,
            prefix),

          checkExpectedNftData(pb, {verify, isNftToTokenID.isNFT()}, FMT(prefix, ".checkExpectedNftData")),
          requireValid(pb, checkExpectedNftData.result(), expectedNftData, fromNftData, FMT(prefix, ".requireValid"))
    {
    }

    void generate_r1cs_witness()
    {
        TokenTransferDataGadget::generate_r1cs_witness();

        checkExpectedNftData.generate_r1cs_witness();
        requireValid.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        TokenTransferDataGadget::generate_r1cs_constraints();

        checkExpectedNftData.generate_r1cs_constraints();
        requireValid.generate_r1cs_constraints();
    }
};

class NftDataGadget : public GadgetT
{
  public:
    Poseidon_6 hash;

    NftDataGadget(
      ProtoboardT &pb,
      const VariableT &minter,
      const VariableT &nftType,
      const VariableT &tokenAddress,
      const VariableT &nftIDLo,
      const VariableT &nftIDHi,
      const VariableT &creatorFeeBips,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          hash(
            pb,
            var_array({minter, nftType, tokenAddress, nftIDLo, nftIDHi, creatorFeeBips}),
            FMT(this->annotation_prefix, ".hash"))
    {
    }

    void generate_r1cs_witness()
    {
        hash.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        hash.generate_r1cs_constraints();
    }

    const VariableT &result() const
    {
        return hash.result();
    }
};

// Signed variable:
// positive: sign == 1
// negative: sign == 0
// Zero can be either positive or negative
struct SignedVariableT
{
  public:
    VariableT sign;
    VariableT value;

    SignedVariableT()
    {
    }

    SignedVariableT( //
      ProtoboardT &pb,
      const std::string &prefix)
        : sign(make_variable(pb, FMT(prefix, ".sign"))), value(make_variable(pb, FMT(prefix, ".value")))
    {
    }

    SignedVariableT( //
      const VariableT &_sign,
      const VariableT &_value)
        : sign(_sign), value(_value)
    {
    }
};

// sA + sB = sSum with abs(A), abs(B) and abs(sum) < 2^n
class SignedAddGadget : public GadgetT
{
  public:
    SignedVariableT _A;
    SignedVariableT _B;

    UnsafeAddGadget a_add_b;
    UnsafeSubGadget b_sub_a;
    UnsafeSubGadget a_sub_b;

    LeqGadget a_leq_b;

    EqualGadget signsEqual;
    TernaryGadget temp;
    TernaryGadget value;

    AndGadget signB_and_a_leq_b;
    AndGadget signA_and_not_a_leq_b;
    OrGadget sign;
    EqualGadget isZero;
    TernaryGadget normalizedSign;

    RangeCheckGadget rangeCheck;

    SignedAddGadget(
      ProtoboardT &pb,
      const Constants &constants,
      const SignedVariableT &A,
      const SignedVariableT &B,
      unsigned int n,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          _A(A),
          _B(B),

          a_add_b(pb, A.value, B.value, FMT(prefix, ".a_add_b")),
          b_sub_a(pb, B.value, A.value, FMT(prefix, ".b_sub_a")),
          a_sub_b(pb, A.value, B.value, FMT(prefix, ".a_sub_b")),

          a_leq_b(pb, A.value, B.value, n, FMT(prefix, ".a_leq_b")),

          signsEqual(pb, A.sign, B.sign, FMT(prefix, ".signsEqual")),
          temp(pb, a_leq_b.lt(), b_sub_a.result(), a_sub_b.result(), FMT(prefix, ".temp")),
          value(pb, signsEqual.result(), a_add_b.result(), temp.result(), FMT(prefix, ".value")),

          signB_and_a_leq_b(pb, {B.sign, a_leq_b.leq()}, FMT(prefix, ".signB_and_a_leq_b")),
          signA_and_not_a_leq_b(pb, {A.sign, a_leq_b.gt()}, FMT(prefix, ".signA_and_not_a_leq_b")),
          sign(pb, {signB_and_a_leq_b.result(), signA_and_not_a_leq_b.result()}, FMT(prefix, ".sign")),
          isZero(pb, value.result(), constants._0, FMT(prefix, ".isZero")),
          normalizedSign(pb, isZero.result(), constants._0, sign.result(), FMT(prefix, ".sign")),

          rangeCheck(pb, value.result(), n, FMT(prefix, ".rangeCheck"))
    {
        assert(n + 1 <= NUM_BITS_FIELD_CAPACITY);
    }

    void generate_r1cs_witness()
    {
        a_add_b.generate_r1cs_witness();
        b_sub_a.generate_r1cs_witness();
        a_sub_b.generate_r1cs_witness();

        a_leq_b.generate_r1cs_witness();

        signsEqual.generate_r1cs_witness();
        temp.generate_r1cs_witness();
        value.generate_r1cs_witness();

        signB_and_a_leq_b.generate_r1cs_witness();
        signA_and_not_a_leq_b.generate_r1cs_witness();
        sign.generate_r1cs_witness();
        isZero.generate_r1cs_witness();
        normalizedSign.generate_r1cs_witness();

        rangeCheck.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        a_add_b.generate_r1cs_constraints();
        b_sub_a.generate_r1cs_constraints();
        a_sub_b.generate_r1cs_constraints();

        a_leq_b.generate_r1cs_constraints();

        signsEqual.generate_r1cs_constraints();
        temp.generate_r1cs_constraints();
        value.generate_r1cs_constraints();

        signB_and_a_leq_b.generate_r1cs_constraints();
        signA_and_not_a_leq_b.generate_r1cs_constraints();
        sign.generate_r1cs_constraints();
        isZero.generate_r1cs_constraints();
        normalizedSign.generate_r1cs_constraints();

        rangeCheck.generate_r1cs_constraints();
    }

    const SignedVariableT result() const
    {
        return SignedVariableT(normalizedSign.result(), value.result());
    }
};

// sA + (-sB) = sSum with abs(A), abs(B) and abs(sum) < 2^n
class SignedSubGadget : public GadgetT
{
  public:
    NotGadget notSignB;
    SignedAddGadget signedAddGadget;

    SignedSubGadget(
      ProtoboardT &pb,
      const Constants &constants,
      const SignedVariableT &A,
      const SignedVariableT &B,
      unsigned int n,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          notSignB(pb, B.sign, FMT(prefix, ".notSignB")),
          signedAddGadget(
            pb,
            constants,
            A,
            SignedVariableT(notSignB.result(), B.value),
            n,
            FMT(prefix, ".signedAddGadget"))
    {
    }

    void generate_r1cs_witness()
    {
        notSignB.generate_r1cs_witness();
        signedAddGadget.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        notSignB.generate_r1cs_constraints();
        signedAddGadget.generate_r1cs_constraints();
    }

    const SignedVariableT result() const
    {
        return signedAddGadget.result();
    }
};

// sA * sB / C
// Always rounds towards zero, even for negative values.
class SignedMulDivGadget : public GadgetT
{
  public:
    MulDivGadget res;
    EqualGadget sign;

    EqualGadget isZero;
    TernaryGadget normalizedSign;

    SignedMulDivGadget(
      ProtoboardT &pb,
      const Constants &constants,
      const SignedVariableT &_value,
      const SignedVariableT &_numerator,
      const VariableT &_denominator,
      unsigned int numBitsValue,
      unsigned int numBitsNumerator,
      unsigned int numBitsDenominator,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          res(
            pb,
            constants,
            _value.value,
            _numerator.value,
            _denominator,
            numBitsValue,
            numBitsNumerator,
            numBitsDenominator,
            FMT(prefix, ".res")),
          sign(pb, _value.sign, _numerator.sign, FMT(prefix, ".sign")),

          isZero(pb, res.result(), constants._0, FMT(prefix, ".isZero")),
          normalizedSign(pb, isZero.result(), constants._0, sign.result(), FMT(prefix, ".sign"))
    {
    }

    void generate_r1cs_witness()
    {
        res.generate_r1cs_witness();
        sign.generate_r1cs_witness();

        isZero.generate_r1cs_witness();
        normalizedSign.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        res.generate_r1cs_constraints();
        sign.generate_r1cs_constraints();

        isZero.generate_r1cs_constraints();
        normalizedSign.generate_r1cs_constraints();
    }

    const SignedVariableT result() const
    {
        return SignedVariableT(normalizedSign.result(), res.result());
    }
};

// Calculates [0, 1]**[0, inf) using an approximation. The closer the base is to 1, the higher the accuracy.
// The result is enforced to be containable in NUM_BITS_AMOUNT bits.
// The higher the number of iterations, the higher the accuracy (and the greater the cost).
/*
    const x = (_x - BASE_FIXED);
    const bn = [BASE_FIXED, BASE_FIXED];
    const cn = [BASE_FIXED, y];
    const xn = [BASE_FIXED, x];
    let sum = xn[0]*cn[0] + xn[1]*cn[1];
    for (let i = 2; i < iterations; i++) {
        const v = y - bn[i-1];
        bn.push(bn[i-1] + BASE_FIXED);
        xn.push(Math.floor((xn[i-1] * x) / BASE_FIXED));
        cn.push(Math.floor((cn[i-1] * v) / bn[i]));
        sum += xn[i]*cn[i];
    }
    return Math.floor(sum / BASE_FIXED);
*/
class PowerGadget : public GadgetT
{
  public:
    UnsafeMulGadget sum0;

    SubGadget x1;
    UnsafeMulGadget t1;
    SignedAddGadget sum1;

    std::vector<UnsafeMulGadget> bn;
    std::vector<SignedSubGadget> vn;
    std::vector<MulDivGadget> xn;
    std::vector<SignedMulDivGadget> cn;
    std::vector<SignedMulDivGadget> tn;
    std::vector<SignedAddGadget> sum;
    std::vector<RangeCheckGadget> cnRangeCheck;

    std::unique_ptr<MulDivGadget> res;
    std::unique_ptr<RangeCheckGadget> resRangeCheck;
    std::unique_ptr<RequireEqualGadget> requirePositive;

    PowerGadget(
      ProtoboardT &pb,
      const Constants &constants,
      const VariableT &x,
      const VariableT &y,
      const unsigned int iterations,
      const std::string &prefix)
        : GadgetT(pb, prefix),

          sum0(pb, constants.fixedBase, constants.fixedBase, FMT(prefix, ".sum0")),

          x1(pb, constants.fixedBase, x, NUM_BITS_FIXED_BASE, FMT(prefix, ".x1")),
          t1(pb, x1.result(), y, FMT(prefix, ".t1")),
          sum1(
            pb,
            constants,
            SignedVariableT(constants._1, sum0.result()),
            SignedVariableT(constants._0, t1.result()),
            NUM_BITS_AMOUNT * 2,
            FMT(prefix, ".sum1"))
    {
        assert(iterations >= 3);

        for (unsigned int i = 2; i < iterations; i++)
        {
            bn.emplace_back(pb, constants.fixedBase, constants.values[i], FMT(prefix, ".bn"));
            vn.emplace_back(
              pb,
              constants,
              SignedVariableT(constants._1, y),
              i > 2 ? SignedVariableT(constants._1, bn[i - 2 - 1].result())
                    : SignedVariableT(constants._1, constants.fixedBase),
              NUM_BITS_AMOUNT,
              FMT(prefix, ".vn"));
            xn.emplace_back(
              pb,
              constants,
              xn.size() > 0 ? xn.back().result() : x1.result(),
              x1.result(),
              constants.fixedBase,
              NUM_BITS_FIXED_BASE,
              NUM_BITS_FIXED_BASE,
              NUM_BITS_FIXED_BASE,
              FMT(prefix, ".xn"));
            cn.emplace_back(
              pb,
              constants,
              (i > 2) ? cn.back().result() : SignedVariableT(constants._1, y),
              vn.back().result(),
              bn.back().result(),
              NUM_BITS_AMOUNT,
              NUM_BITS_AMOUNT,
              NUM_BITS_AMOUNT,
              FMT(prefix, ".cn"));
            tn.emplace_back(
              pb,
              constants,
              SignedVariableT(constants.values[(i + 1) % 2], xn.back().result()),
              cn.back().result(),
              constants._1,
              NUM_BITS_FIXED_BASE,
              NUM_BITS_AMOUNT,
              1,
              FMT(prefix, ".t2"));
            sum.emplace_back(
              pb,
              constants,
              sum.size() > 0 ? sum.back().result() : sum1.result(),
              tn.back().result(),
              NUM_BITS_AMOUNT * 2,
              FMT(prefix, ".sum"));
            cnRangeCheck.emplace_back(pb, cn.back().result().value, NUM_BITS_AMOUNT, FMT(prefix, ".cnRangeCheck"));
        }

        res.reset(new MulDivGadget(
          pb,
          constants,
          sum.back().result().value,
          constants._1,
          constants.fixedBase,
          NUM_BITS_AMOUNT * 2,
          1,
          NUM_BITS_FIXED_BASE,
          FMT(prefix, ".res")));
        resRangeCheck.reset(new RangeCheckGadget(pb, res->result(), NUM_BITS_AMOUNT, FMT(prefix, ".resRangeCheck")));
        requirePositive.reset(
          new RequireEqualGadget(pb, sum.back().result().sign, constants._1, FMT(prefix, ".requirePositive")));
    }

    void generate_r1cs_witness()
    {
        sum0.generate_r1cs_witness();

        x1.generate_r1cs_witness();
        t1.generate_r1cs_witness();
        sum1.generate_r1cs_witness();

        for (unsigned int i = 0; i < sum.size(); i++)
        {
            bn[i].generate_r1cs_witness();
            vn[i].generate_r1cs_witness();
            xn[i].generate_r1cs_witness();
            cn[i].generate_r1cs_witness();
            tn[i].generate_r1cs_witness();
            sum[i].generate_r1cs_witness();
            cnRangeCheck[i].generate_r1cs_witness();
        }
        res->generate_r1cs_witness();
        resRangeCheck->generate_r1cs_witness();
        requirePositive->generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        sum0.generate_r1cs_constraints();

        x1.generate_r1cs_constraints();
        t1.generate_r1cs_constraints();
        sum1.generate_r1cs_constraints();

        for (unsigned int i = 0; i < sum.size(); i++)
        {
            bn[i].generate_r1cs_constraints();
            vn[i].generate_r1cs_constraints();
            xn[i].generate_r1cs_constraints();
            cn[i].generate_r1cs_constraints();
            tn[i].generate_r1cs_constraints();
            sum[i].generate_r1cs_constraints();
            cnRangeCheck[i].generate_r1cs_constraints();
        }
        res->generate_r1cs_constraints();
        resRangeCheck->generate_r1cs_constraints();
        requirePositive->generate_r1cs_constraints();
    }

    const VariableT &result() const
    {
        return res->result();
    }
};

} // namespace Loopring

#endif
