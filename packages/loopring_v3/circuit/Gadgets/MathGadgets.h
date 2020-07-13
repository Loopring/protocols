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

// require(A == B)
static void requireEqual(ProtoboardT& pb, const VariableT& A, const VariableT& B, const std::string& annotation_prefix)
{
    pb.add_r1cs_constraint(ConstraintT(A, FieldT::one(), B), FMT(annotation_prefix, ".requireEqual"));
}

// Constants stored in a VariableT for ease of use
class Constants : public GadgetT
{
public:
    const VariableT zero;
    const VariableT one;
    const VariableT two;
    const VariableT three;
    const VariableT four;
    const VariableT five;
    const VariableT six;
    const VariableT seven;

    const VariableT _1000;
    const VariableT _1001;
    const VariableT _10000;
    const VariableT _100000;
    const VariableT indexBase;
    const VariableT emptyTradeHistory;
    const VariableT maxAmount;
    const VariableT maxConcurrentOrderIDs;
    const VariableT dummyPublicKeyX;
    const VariableT dummyPublicKeyY;
    const VariableT txTypeTransfer;
    const VariableT txTypeNewAccount;
    const VariableArrayT zeroAccount;

    std::vector<VariableT> values;

    Constants(
        ProtoboardT& pb,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        zero(make_variable(pb, FieldT::zero(), FMT(prefix, ".zero"))),
        one(make_variable(pb, FieldT::one(), FMT(prefix, ".one"))),
        two(make_variable(pb, ethsnarks::FieldT(2), FMT(prefix, ".two"))),
        three(make_variable(pb, ethsnarks::FieldT(3), FMT(prefix, ".three"))),
        four(make_variable(pb, ethsnarks::FieldT(4), FMT(prefix, ".four"))),
        five(make_variable(pb, ethsnarks::FieldT(5), FMT(prefix, ".five"))),
        six(make_variable(pb, ethsnarks::FieldT(6), FMT(prefix, ".six"))),
        seven(make_variable(pb, ethsnarks::FieldT(7), FMT(prefix, ".seven"))),
        _1000(make_variable(pb, ethsnarks::FieldT(1000), FMT(prefix, "._1000"))),
        _1001(make_variable(pb, ethsnarks::FieldT(1001), FMT(prefix, "._1001"))),
        _10000(make_variable(pb, ethsnarks::FieldT(10000), FMT(prefix, "._10000"))),
        _100000(make_variable(pb, ethsnarks::FieldT(100000), FMT(prefix, "._100000"))),
        indexBase(make_variable(pb, ethsnarks::FieldT(INDEX_BASE), FMT(prefix, ".indexBase"))),
        emptyTradeHistory(make_variable(pb, ethsnarks::FieldT(EMPTY_TRADE_HISTORY), FMT(prefix, ".emptyTradeHistory"))),
        maxAmount(make_variable(pb, ethsnarks::FieldT(MAX_AMOUNT), FMT(prefix, ".maxAmount"))),
        maxConcurrentOrderIDs(make_variable(pb, ethsnarks::FieldT(MAX_CONCURRENT_ORDERIDS), FMT(prefix, ".maxConcurrentOrderIDs"))),
        dummyPublicKeyX(make_variable(pb, ethsnarks::FieldT("132404916167441185773716937639098950030214269269071041759116060313694190797"), FMT(prefix, ".dummyPublicKeyX"))),
        dummyPublicKeyY(make_variable(pb, ethsnarks::FieldT("6933274320914065805670637410453081675154127044926882796951068647148079547843"), FMT(prefix, ".dummyPublicKeyY"))),
        txTypeTransfer(make_variable(pb, ethsnarks::FieldT(int(TransactionType::Transfer)), FMT(prefix, ".txTypeTransfer"))),
        txTypeNewAccount(make_variable(pb, ethsnarks::FieldT(int(TransactionType::NewAccount)), FMT(prefix, ".txTypeNewAccount"))),
        zeroAccount(NUM_BITS_ACCOUNT, zero)
    {
        assert(NUM_BITS_MAX_VALUE == FieldT::size_in_bits());
        assert(NUM_BITS_FIELD_CAPACITY == FieldT::capacity());

        values.push_back(zero);
        values.push_back(one);
        values.push_back(two);
        values.push_back(three);
        values.push_back(four);
        values.push_back(five);
        values.push_back(six);
        values.push_back(seven);
    }

    void generate_r1cs_witness()
    {

    }

    void generate_r1cs_constraints()
    {
        pb.add_r1cs_constraint(ConstraintT(zero, FieldT::one(), FieldT::zero()), ".zero");
        pb.add_r1cs_constraint(ConstraintT(one, FieldT::one(), FieldT::one()), ".one");
        pb.add_r1cs_constraint(ConstraintT(two, FieldT::one(), FieldT(2)), ".two");
        pb.add_r1cs_constraint(ConstraintT(three, FieldT::one(), FieldT(3)), ".three");
        pb.add_r1cs_constraint(ConstraintT(four, FieldT::one(), FieldT(4)), ".four");
        pb.add_r1cs_constraint(ConstraintT(five, FieldT::one(), FieldT(5)), ".five");
        pb.add_r1cs_constraint(ConstraintT(six, FieldT::one(), FieldT(6)), ".six");
        pb.add_r1cs_constraint(ConstraintT(seven, FieldT::one(), FieldT(7)), ".seven");

        pb.add_r1cs_constraint(ConstraintT(_1000, FieldT::one(), ethsnarks::FieldT(1000)), "._1000");
        pb.add_r1cs_constraint(ConstraintT(_1001, FieldT::one(), ethsnarks::FieldT(1001)), "._1001");
        pb.add_r1cs_constraint(ConstraintT(_10000, FieldT::one(), ethsnarks::FieldT(10000)), "._10000");
        pb.add_r1cs_constraint(ConstraintT(_100000, FieldT::one(), ethsnarks::FieldT(100000)), "._100000");
        pb.add_r1cs_constraint(ConstraintT(indexBase, FieldT::one(), ethsnarks::FieldT(INDEX_BASE)), ".indexBase");
        pb.add_r1cs_constraint(ConstraintT(emptyTradeHistory, FieldT::one(), ethsnarks::FieldT(EMPTY_TRADE_HISTORY)), ".emptyTradeHistory");
        pb.add_r1cs_constraint(ConstraintT(maxAmount, FieldT::one(), ethsnarks::FieldT(MAX_AMOUNT)), ".maxAmount");
        pb.add_r1cs_constraint(ConstraintT(maxConcurrentOrderIDs, FieldT::one(), ethsnarks::FieldT(MAX_CONCURRENT_ORDERIDS)), ".maxConcurrentOrderIDs");
        pb.add_r1cs_constraint(ConstraintT(dummyPublicKeyX, FieldT::one(), ethsnarks::FieldT("132404916167441185773716937639098950030214269269071041759116060313694190797")), ".dummyPublicKeyX");
        pb.add_r1cs_constraint(ConstraintT(dummyPublicKeyY, FieldT::one(), ethsnarks::FieldT("6933274320914065805670637410453081675154127044926882796951068647148079547843")), ".dummyPublicKeyY");
        pb.add_r1cs_constraint(ConstraintT(txTypeTransfer, FieldT::one(), ethsnarks::FieldT(int(TransactionType::Transfer))), ".txTypeTransfer");
        pb.add_r1cs_constraint(ConstraintT(txTypeNewAccount, FieldT::one(), ethsnarks::FieldT(int(TransactionType::NewAccount))), ".txTypeNewAccount");
    }
};

class DualVariableGadget : public libsnark::dual_variable_gadget<FieldT>
{
public:
    bool fromPacked = false;
    bool fromBits = false;

    DualVariableGadget(
        ProtoboardT& pb,
        const size_t width,
        const std::string& prefix
    ) :
        libsnark::dual_variable_gadget<FieldT>(pb, width, prefix)
    {

    }

    DualVariableGadget(
        ProtoboardT& pb,
        const VariableT& value,
        const size_t width,
        const std::string& prefix
    ) :
        libsnark::dual_variable_gadget<FieldT>(pb, value, width, prefix)
    {
        fromPacked = true;
    }

    DualVariableGadget(
        ProtoboardT& pb,
        const VariableArrayT& bits,
        const std::string& prefix
    ) :
        libsnark::dual_variable_gadget<FieldT>(pb, bits, prefix)
    {
        fromBits = true;
    }

    void generate_r1cs_witness()
    {
        if (fromPacked)
        {
            generate_r1cs_witness_from_packed();
        }
        if (fromBits)
        {
            generate_r1cs_witness_from_bits();
        }
    }

    void generate_r1cs_witness(ProtoboardT& pb, const FieldT& value)
    {
        pb.val(packed) = value;
        generate_r1cs_witness_from_packed();
    }

    void generate_r1cs_witness(ProtoboardT& pb, const LimbT& value)
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

// Helper function that contains the history of all the values of a variable
class DynamicVariableGadget : public GadgetT
{
public:
    std::vector<VariableT> variables;
    bool allowGeneratingWitness;

    DynamicVariableGadget(
        ProtoboardT& pb,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix)
    {
        add(make_variable(pb, FMT(prefix, ".initialValue")));
        allowGeneratingWitness = true;
    }

    DynamicVariableGadget(
        ProtoboardT& pb,
        const VariableT& initialValue,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix)
    {
        add(initialValue);
        allowGeneratingWitness = false;
    }

    const VariableT& front() const
    {
        return variables.front();
    }

    const VariableT& back() const
    {
        return variables.back();
    }

    void add(const VariableT& variable)
    {
        variables.push_back(variable);
    }

    void generate_r1cs_witness(ethsnarks::FieldT value)
    {
        assert(allowGeneratingWitness);
        pb.val(variables.front()) = value;
    }
};

// Helper function for subadd to do transfers
class TransferGadget : public GadgetT
{
public:
    subadd_gadget subadd;

    TransferGadget(
        ProtoboardT& pb,
        DynamicVariableGadget& from,
        DynamicVariableGadget& to,
        const VariableT& value,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),
        subadd(pb, NUM_BITS_AMOUNT, from.back(), to.back(), value, FMT(prefix, ".subadd"))
    {
        from.add(subadd.X);
        to.add(subadd.Y);
    }

    void generate_r1cs_witness()
    {
        subadd.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        subadd.generate_r1cs_constraints();
    }
};

// A - B
class UnsafeSubGadget : public GadgetT
{
public:
    VariableT value;
    VariableT sub;
    VariableT sum;

    UnsafeSubGadget(
        ProtoboardT& pb,
        const VariableT& _value,
        const VariableT& _sub,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),
        value(_value),
        sub(_sub),
        sum(make_variable(pb, FMT(prefix, ".sum")))
    {

    }

    const VariableT& result() const
    {
        return sum;
    }

    void generate_r1cs_witness()
    {
        pb.val(sum) = pb.val(value) - pb.val(sub);
    }

    void generate_r1cs_constraints()
    {
        pb.add_r1cs_constraint(ConstraintT(value - sub, FieldT::one(), sum), ".value - sub = sum");
    }
};

// A + B
class UnsafeAddGadget : public GadgetT
{
public:
    VariableT value;
    VariableT add;
    VariableT sum;

    UnsafeAddGadget(
        ProtoboardT& pb,
        const VariableT& _value,
        const VariableT& _add,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),
        value(_value),
        add(_add),
        sum(make_variable(pb, FMT(prefix, ".sum")))
    {

    }

    const VariableT& result() const
    {
        return sum;
    }

    void generate_r1cs_witness()
    {
        pb.val(sum) = pb.val(value) + pb.val(add);
    }

    void generate_r1cs_constraints()
    {
        pb.add_r1cs_constraint(ConstraintT(value + add, FieldT::one(), sum), FMT(annotation_prefix, ".value + add = sum"));
    }
};

// A * B
class UnsafeMulGadget : public GadgetT
{
public:
    VariableT valueA;
    VariableT valueB;
    VariableT product;

    UnsafeMulGadget(
        ProtoboardT& pb,
        const VariableT& _valueA,
        const VariableT& _valueB,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),
        valueA(_valueA),
        valueB(_valueB),
        product(make_variable(pb, FMT(prefix, ".product")))
    {

    }

    const VariableT& result() const
    {
        return product;
    }

    void generate_r1cs_witness()
    {
        pb.val(product) = pb.val(valueA) * pb.val(valueB);
    }

    void generate_r1cs_constraints()
    {
        pb.add_r1cs_constraint(ConstraintT(valueA, valueB, product), ".valueA * valueB = product");
    }
};

// A + B = sum with A, B and sum < 2^n
class AddGadget : public GadgetT
{
public:
    UnsafeAddGadget unsafeAdd;
    libsnark::dual_variable_gadget<FieldT> rangeCheck;

    AddGadget(
        ProtoboardT& pb,
        const VariableT& A,
        const VariableT& B,
        unsigned int n,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        unsafeAdd(pb, A, B, FMT(prefix, ".unsafeAdd")),
        rangeCheck(pb, unsafeAdd.result(), n, FMT(prefix, ".rangeCheck"))
    {
        assert(n + 1 <= NUM_BITS_FIELD_CAPACITY);
    }

    void generate_r1cs_witness()
    {
        unsafeAdd.generate_r1cs_witness();
        rangeCheck.generate_r1cs_witness_from_packed();
    }

    void generate_r1cs_constraints()
    {
        unsafeAdd.generate_r1cs_constraints();
        rangeCheck.generate_r1cs_constraints(true);
    }

    const VariableT& result() const
    {
        return unsafeAdd.result();
    }
};

// A - B = sub with A, B and sub >= 0
class SubGadget : public GadgetT
{
public:
    UnsafeSubGadget unsafeSub;
    libsnark::dual_variable_gadget<FieldT> rangeCheck;

    SubGadget(
        ProtoboardT& pb,
        const VariableT& A,
        const VariableT& B,
        unsigned int n,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        unsafeSub(pb, A, B, FMT(prefix, ".unsafeAdd")),
        rangeCheck(pb, unsafeSub.result(), n, FMT(prefix, ".rangeCheck"))
    {
        assert(n + 1 <= NUM_BITS_FIELD_CAPACITY);
    }

    void generate_r1cs_witness()
    {
        unsafeSub.generate_r1cs_witness();
        rangeCheck.generate_r1cs_witness_from_packed();
    }

    void generate_r1cs_constraints()
    {
        unsafeSub.generate_r1cs_constraints();
        rangeCheck.generate_r1cs_constraints(true);
    }

    const VariableT& result() const
    {
        return unsafeSub.result();
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
        ProtoboardT& pb,
        const VariableT& _b,
        const VariableT& _x,
        const VariableT& _y,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        b(_b),
        x(_x),
        y(_y),

        selected(make_variable(pb, FMT(prefix, ".selected")))
    {

    }

    const VariableT& result() const
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
        pb.add_r1cs_constraint(ConstraintT(b, y - x, y - selected), FMT(annotation_prefix, ".b * (y - x) == (y - selected)"));
    }
};

// b ? A : B
class ArrayTernaryGadget : public GadgetT
{
public:

    std::vector<TernaryGadget> results;
    VariableArrayT res;

    ArrayTernaryGadget(
        ProtoboardT& pb,
        const VariableT& b,
        const VariableArrayT& x,
        const VariableArrayT& y,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix)
    {
        assert(x.size() == y.size());
        results.reserve(x.size());
        for (unsigned int i = 0; i < x.size(); i++)
        {
            results.emplace_back(TernaryGadget(pb, b, x[i], y[i], FMT(prefix, ".results")));
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

    void generate_r1cs_constraints()
    {
        for (unsigned int i = 0; i < results.size(); i++)
        {
            results[i].generate_r1cs_constraints(false);
        }
    }

    const VariableArrayT& result() const
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

    AndGadget(
        ProtoboardT& pb,
        const std::vector<VariableT>& _inputs,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),
        inputs(_inputs)
    {
        assert(inputs.size() > 1);
        for (unsigned int i = 1; i < inputs.size(); i++)
        {
            results.emplace_back(make_variable(pb, FMT(prefix, ".results")));
        }
    }

    const VariableT& result() const
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
        // This can be done more efficiently but we never have any long inputs so no need
        pb.add_r1cs_constraint(ConstraintT(inputs[0], inputs[1], results[0]), FMT(annotation_prefix, ".A && B"));
        for (unsigned int i = 2; i < inputs.size(); i++)
        {
            pb.add_r1cs_constraint(ConstraintT(inputs[i], results[i - 2], results[i - 1]), FMT(annotation_prefix, ".A && B"));
        }
    }
};

// (input[0] || input[1] || ...) (all inputs need to be boolean)
class OrGadget : public GadgetT
{
public:
    std::vector<VariableT> inputs;
    std::vector<VariableT> results;

    OrGadget(
        ProtoboardT& pb,
        const std::vector<VariableT>& _inputs,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),
        inputs(_inputs)
    {
        assert(inputs.size() > 1);
        for (unsigned int i = 1; i < inputs.size(); i++)
        {
            results.emplace_back(make_variable(pb, FMT(prefix, ".results")));
        }
    }

    const VariableT& result() const
    {
        return results.back();
    }

    void generate_r1cs_witness()
    {
        pb.val(results[0]) = FieldT::one() - (FieldT::one() - pb.val(inputs[0])) * (FieldT::one() - pb.val(inputs[1]));
        for (unsigned int i = 2; i < inputs.size(); i++)
        {
            pb.val(results[i - 1]) = FieldT::one() - (FieldT::one() - pb.val(results[i - 2])) * (FieldT::one() - pb.val(inputs[i]));
        }
    }

    void generate_r1cs_constraints()
    {
        pb.add_r1cs_constraint(ConstraintT(FieldT::one() - inputs[0], FieldT::one() - inputs[1], FieldT::one() - results[0]), FMT(annotation_prefix, ".A || B == _or"));
        for (unsigned int i = 2; i < inputs.size(); i++)
        {
            pb.add_r1cs_constraint(ConstraintT(FieldT::one() - inputs[i], FieldT::one() - results[i - 2], FieldT::one() - results[i - 1]), FMT(annotation_prefix, ".A || B == _or"));
        }
    }
};

// !A (A needs to be boolean)
class NotGadget : public GadgetT
{
public:
    VariableT A;
    VariableT _not;

    NotGadget(
        ProtoboardT& pb,
        const VariableT& _A,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        A(_A),
        _not(make_variable(pb, FMT(prefix, "._not")))
    {

    }

    const VariableT& result() const
    {
        return _not;
    }

    void generate_r1cs_witness()
    {
        pb.val(_not) = FieldT::one() - pb.val(A);
    }

    void generate_r1cs_constraints()
    {
        pb.add_r1cs_constraint(ConstraintT(FieldT::one() - A, FieldT::one(), _not), FMT(annotation_prefix, ".!A == _not"));
    }
};

// A[i] ^ B[i]
class XorArrayGadget : public GadgetT
{
public:
    VariableArrayT A;
    VariableArrayT B;
    VariableArrayT C;

    XorArrayGadget(
        ProtoboardT& pb,
        VariableArrayT _A,
        VariableArrayT _B,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        A(_A),
        B(_B),

        C(make_var_array(pb, A.size(), FMT(prefix, ".C")))
    {
        assert(A.size() == B.size());
    }

    const VariableArrayT& result() const
    {
        return C;
    }

    void generate_r1cs_witness()
    {
        for (unsigned int i = 0; i < C.size(); i++)
        {
            pb.val(C[i]) = pb.val(A[i]) + pb.val(B[i]) - ((pb.val(A[i]) == FieldT::one() && pb.val(B[i]) == FieldT::one()) ? 2 : 0);
        }
    }

    void generate_r1cs_constraints()
    {
        for (unsigned int i = 0; i < C.size(); i++)
        {
            pb.add_r1cs_constraint(ConstraintT(2 * A[i], B[i], A[i] + B[i] - C[i]), FMT(annotation_prefix, ".A ^ B == C"));
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

    EqualGadget(
        ProtoboardT& pb,
        const VariableT& A,
        const VariableT& B,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        difference(pb, A, B, FMT(prefix, ".difference")),
        isNonZeroDifference(pb, difference.result(), FMT(prefix, ".isNonZeroDifference")),
        isZeroDifference(pb, isNonZeroDifference.result(), FMT(prefix, ".isZeroDifference"))
    {

    }

    const VariableT& result() const
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

// require(A == B)
class RequireEqualGadget : public GadgetT
{
public:
    VariableT A;
    VariableT B;

    RequireEqualGadget(
        ProtoboardT& pb,
        const VariableT& _A,
        const VariableT& _B,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),
        A(_A),
        B(_B)
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

    RequireZeroAorBGadget(
        ProtoboardT& pb,
        const VariableT& _A,
        const VariableT& _B,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),
        A(_A),
        B(_B)
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

    RequireNotZeroGadget(
        ProtoboardT& pb,
        const VariableT& _A,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),
        A(_A),
        A_inv(make_variable(pb, FMT(prefix, ".A_inv")))
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

    RequireNotEqualGadget(
        ProtoboardT& pb,
        const VariableT& _A,
        const VariableT& _B,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),
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
        pb.add_r1cs_constraint(ConstraintT(A - B, FieldT::one(), difference), FMT(annotation_prefix, ".A - B == difference"));
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

    LeqGadget(
        ProtoboardT& pb,
        const VariableT& A,
        const VariableT& B,
        const size_t n,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        _lt(make_variable(pb, 1, FMT(prefix, ".lt"))),
        _leq(make_variable(pb, 1, FMT(prefix, ".leq"))),
        comparison(pb, n, A, B, _lt, _leq, FMT(prefix, ".A <(=) B")),
        _gt(pb, _leq, FMT(prefix, ".gt")),
        _gte(pb, _lt, FMT(prefix, ".gte")),
        _eq(pb, {_leq, _gte.result()}, FMT(prefix, ".eq"))
    {
        // The comparison gadget is only guaranteed to work correctly on values in the field capacity - 1
        assert(n <= NUM_BITS_FIELD_CAPACITY - 1);
    }

    const VariableT& lt() const
    {
        return _lt;
    }

    const VariableT& leq() const
    {
        return _leq;
    }

    const VariableT& eq() const
    {
        return _eq.result();
    }

    const VariableT& gte() const
    {
        return _gte.result();
    }

    const VariableT& gt() const
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
    DualVariableGadget Alo;
    DualVariableGadget Ahi;
    DualVariableGadget Blo;
    DualVariableGadget Bhi;
    LeqGadget partLo;
    LeqGadget partHi;
    TernaryGadget res;

    LtFieldGadget(
        ProtoboardT& pb,
        const VariableT& A,
        const VariableT& B,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        Abits(pb, A, FMT(prefix, ".Abits")),
        Bbits(pb, B, FMT(prefix, ".Bbits")),

        Alo(pb, subArray(Abits.result(), 0, 254/2), FMT(prefix, ".Alo")),
        Ahi(pb, subArray(Abits.result(), 254/2, 254/2), FMT(prefix, ".Ahi")),
        Blo(pb, subArray(Bbits.result(), 0, 254/2), FMT(prefix, ".Blo")),
        Bhi(pb, subArray(Bbits.result(), 254/2, 254/2), FMT(prefix, ".Bhi")),
        partLo(pb, Alo.packed, Blo.packed, 254/2, FMT(prefix, ".partLo")),
        partHi(pb, Ahi.packed, Bhi.packed, 254/2, FMT(prefix, ".partHi")),
        res(pb, partHi.eq(), partLo.lt(), partHi.lt(), FMT(prefix, ".res"))
    {

    }

    const VariableT& lt() const
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
        Alo.generate_r1cs_constraints();
        Ahi.generate_r1cs_constraints();
        Blo.generate_r1cs_constraints();
        Bhi.generate_r1cs_constraints();
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

    MinGadget(
        ProtoboardT& pb,
        const VariableT& A,
        const VariableT& B,
        const size_t n,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        A_lt_B(pb, A, B, n, FMT(prefix, ".(A < B)")),
        minimum(pb, A_lt_B.lt(), A, B, FMT(prefix, ".minimum = (A < B) ? A : B"))
    {

    }

    const VariableT& result() const
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

    MaxGadget(
        ProtoboardT& pb,
        const VariableT& A,
        const VariableT& B,
        const size_t n,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        A_lt_B(pb, A, B, n, FMT(prefix, ".(A < B)")),
        maximum(pb, A_lt_B.lt(), B, A, FMT(prefix, ".maximum = (A < B) ? B : A"))
    {

    }

    const VariableT& result() const
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

    RequireLeqGadget(
        ProtoboardT& pb,
        const VariableT& A,
        const VariableT& B,
        const size_t n,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

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
        pb.add_r1cs_constraint(ConstraintT(leqGadget.leq(), FieldT::one(), FieldT::one()), FMT(annotation_prefix, ".leq == 1"));
    }
};

// require(A < B)
class RequireLtGadget : public GadgetT
{
public:
    LeqGadget leqGadget;

    RequireLtGadget(
        ProtoboardT& pb,
        const VariableT& A,
        const VariableT& B,
        const size_t n,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

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
        pb.add_r1cs_constraint(ConstraintT(leqGadget.lt(), FieldT::one(), FieldT::one()), FMT(annotation_prefix, ".lt == 1"));
    }
};

// if (C) then require(A)
class IfThenRequireGadget : public GadgetT
{
public:
    NotGadget notC;
    OrGadget res;

    IfThenRequireGadget(
        ProtoboardT& pb,
        const VariableT& C,
        const VariableT& A,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

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
        pb.add_r1cs_constraint(ConstraintT(res.result(), FieldT::one(), FieldT::one()), FMT(annotation_prefix, ".valid"));
    }
};

// if (C) then require(A == B)
class IfThenRequireEqualGadget : public GadgetT
{
public:
    EqualGadget eq;
    IfThenRequireGadget res;

    IfThenRequireEqualGadget(
        ProtoboardT& pb,
        const VariableT& C,
        const VariableT& A,
        const VariableT& B,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

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

// if (C) then require(A != B)
class IfThenRequireNotEqualGadget : public GadgetT
{
public:
    EqualGadget eq;
    NotGadget notEq;
    IfThenRequireGadget res;

    IfThenRequireNotEqualGadget(
        ProtoboardT& pb,
        const VariableT& C,
        const VariableT& A,
        const VariableT& B,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

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

// (value * numerator) = product
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
    libsnark::dual_variable_gadget<FieldT> remainder;
    RequireLtGadget remainder_lt_denominator;

    MulDivGadget(
        ProtoboardT& pb,
        const Constants& constants,
        const VariableT& _value,
        const VariableT& _numerator,
        const VariableT& _denominator,
        unsigned int numBitsValue,
        unsigned int numBitsNumerator,
        unsigned int numBitsDenominator,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        value(_value),
        numerator(_numerator),
        denominator(_denominator),

        quotient(make_variable(pb, FMT(prefix, ".quotient"))),

        denominator_notZero(pb, denominator, FMT(prefix, ".denominator_notZero")),
        product(pb, value, numerator, FMT(prefix, ".product")),
        // Range limit the remainder. The comparison below is not guaranteed to work for very large values.
        remainder(pb, numBitsDenominator, FMT(prefix, ".remainder")),
        remainder_lt_denominator(pb, remainder.packed, denominator, numBitsDenominator, FMT(prefix, ".remainder < denominator"))
    {
        assert(numBitsValue + numBitsNumerator <= NUM_BITS_FIELD_CAPACITY);
    }

    void generate_r1cs_witness()
    {
        denominator_notZero.generate_r1cs_witness();
        product.generate_r1cs_witness();
        if (pb.val(denominator) != FieldT::zero())
        {
            pb.val(quotient) = ethsnarks::FieldT((toBigInt(pb.val(product.result())) / toBigInt(pb.val(denominator))).to_string().c_str());
        }
        else
        {
            pb.val(quotient) = FieldT::zero();
        }
        pb.val(remainder.packed) = pb.val(product.result()) - (pb.val(denominator) * pb.val(quotient));
        remainder.generate_r1cs_witness_from_packed();
        remainder_lt_denominator.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        denominator_notZero.generate_r1cs_constraints();
        product.generate_r1cs_constraints();
        pb.add_r1cs_constraint(ConstraintT(denominator, quotient, product.result() - remainder.packed), FMT(annotation_prefix, ".quotient * denominator == product - remainder"));
        remainder.generate_r1cs_constraints(true);
        remainder_lt_denominator.generate_r1cs_constraints();
    }

    const VariableT& result() const
    {
        return quotient;
    }

    const VariableT& getRemainder() const
    {
        return remainder.packed;
    }

    const VariableT& getProduct() const
    {
        return product.result();
    }
};

// _accuracy.numerator / _accuracy.denominator <=  value / original
// original * _accuracy.numerator <= value * _accuracy.denominator
// We have to make sure there are no overflows and the value is <= the original value (so a user never spends more) so we also check:
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
        ProtoboardT& pb,
        const VariableT& _value,
        const VariableT& _original,
        const Accuracy& _accuracy,
        unsigned int maxNumBits,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        // Range limit the value. The comparison below is not guaranteed to work for very large values.
        value(pb, _value, maxNumBits, FMT(prefix, ".value")),
        original(_original),
        accuracy(_accuracy),

        value_leq_original(pb, value.packed, original, maxNumBits, FMT(prefix, ".value_lt_original")),

        original_mul_accuracyN(make_variable(pb, FMT(prefix, ".original_mul_accuracyN"))),
        value_mul_accuracyD(make_variable(pb, FMT(prefix, ".value_mul_accuracyD"))),

        original_mul_accuracyN_LEQ_value_mul_accuracyD(pb, original_mul_accuracyN, value_mul_accuracyD, maxNumBits + 32, FMT(prefix, ".original_mul_accuracyN_LEQ_value_mul_accuracyD"))
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

        pb.add_r1cs_constraint(ConstraintT(original, accuracy.numerator, original_mul_accuracyN), FMT(annotation_prefix, ".original * accuracy.numerator == original_mul_accuracyN"));
        pb.add_r1cs_constraint(ConstraintT(value.packed, accuracy.denominator, value_mul_accuracyD), FMT(annotation_prefix, ".value * accuracy.denominator == value_mul_accuracyD"));
        original_mul_accuracyN_LEQ_value_mul_accuracyD.generate_r1cs_constraints();
    }
};

// Public data helper class.
// Will hash all public data with sha256 to a single public input of NUM_BITS_FIELD_CAPACITY bits
class PublicDataGadget : public GadgetT
{
public:
    const VariableT publicInput;
    VariableArrayT publicDataBits;

    std::unique_ptr<sha256_many> hasher;
    std::unique_ptr<libsnark::dual_variable_gadget<FieldT>> calculatedHash;

    PublicDataGadget(
        ProtoboardT& pb,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),
        publicInput(make_variable(pb, FMT(prefix, ".publicInput")))
    {
        pb.set_input_sizes(1);
    }

    void add(const VariableArrayT& bits)
    {
        publicDataBits.insert(publicDataBits.end(), bits.rbegin(), bits.rend());
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
        calculatedHash.reset(new libsnark::dual_variable_gadget<FieldT>(
            pb, reverse(subArray(hasher->result().bits, 0, NUM_BITS_FIELD_CAPACITY)), ".packCalculatedHash")
        );
        calculatedHash->generate_r1cs_constraints(false);
        requireEqual(pb, calculatedHash->packed, publicInput, ".publicDataCheck");
    }
};

// Decodes a float with the specified encoding
class FloatGadget : public GadgetT
{
public:
    const Constants& constants;

    const FloatEncoding& floatEncoding;

    VariableArrayT f;

    std::vector<VariableT> values;
    std::vector<VariableT> baseMultipliers;
    std::vector<TernaryGadget> multipliers;

    FloatGadget(
        ProtoboardT& pb,
        const Constants& _constants,
        const FloatEncoding& _floatEncoding,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

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
            multipliers.emplace_back(TernaryGadget(pb, f[floatEncoding.numBitsMantissa + i], baseMultipliers[i], constants.one, FMT(prefix, ".multipliers")));
        }
    }

    void generate_r1cs_witness(const ethsnarks::FieldT& floatValue)
    {
        f.fill_with_bits_of_field_element(pb, floatValue);

        // Decodes the mantissa
        for (unsigned int i = 0; i < floatEncoding.numBitsMantissa; i++)
        {
            unsigned j = floatEncoding.numBitsMantissa - 1 - i;
            pb.val(values[i]) = (i == 0) ? pb.val(f[j]) : (pb.val(values[i-1]) * 2 + pb.val(f[j]));
        }

        // Decodes the exponent and shifts the mantissa
        for (unsigned int i = floatEncoding.numBitsMantissa; i < f.size(); i++)
        {
            // Decode the exponent
            unsigned int j = i - floatEncoding.numBitsMantissa;
            pb.val(baseMultipliers[j]) = (j == 0) ? floatEncoding.exponentBase : pb.val(baseMultipliers[j - 1]) * pb.val(baseMultipliers[j - 1]);
            multipliers[j].generate_r1cs_witness();

            // Shift the value with the partial exponent
            pb.val(values[i]) = pb.val(values[i-1]) * pb.val(multipliers[j].result());
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
                pb.add_r1cs_constraint(ConstraintT(f[j], FieldT::one(), values[i]), FMT(annotation_prefix, (std::string(".value_") + std::to_string(i)).c_str()));
            }
            else
            {
                pb.add_r1cs_constraint(ConstraintT(values[i-1] * 2 + f[j], FieldT::one(), values[i]), FMT(annotation_prefix, (std::string(".value_") + std::to_string(i)).c_str()));
            }
        }

        // Decodes the exponent and shifts the mantissa
        for (unsigned int i = floatEncoding.numBitsMantissa; i < f.size(); i++)
        {
            // Decode the exponent
            unsigned int j = i - floatEncoding.numBitsMantissa;
            if (j == 0)
            {
                pb.add_r1cs_constraint(ConstraintT(floatEncoding.exponentBase, FieldT::one(), baseMultipliers[j]), ".baseMultipliers");
            }
            else
            {
                pb.add_r1cs_constraint(ConstraintT(baseMultipliers[j - 1], baseMultipliers[j - 1], baseMultipliers[j]), ".baseMultipliers");
            }
            multipliers[j].generate_r1cs_constraints();

            // Shift the value with the partial exponent
            pb.add_r1cs_constraint(ConstraintT(values[i - 1], multipliers[j].result(), values[i]), ".valuesExp");
        }
    }

    const VariableT& value() const
    {
        return values.back();
    }

    const VariableArrayT& bits() const
    {
        return f;
    }
};

struct SelectorGadget : public GadgetT
{
    const Constants& constants;

    std::vector<EqualGadget> bits;
    std::vector<UnsafeAddGadget> sum;

    VariableArrayT res;

    SelectorGadget(
        ProtoboardT& pb,
        const Constants& _constants,
        const VariableT& type,
        unsigned int maxBits,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),
        constants(_constants)
    {
        for (unsigned int i = 0; i < maxBits; i++)
        {
            bits.emplace_back(pb, type, constants.values[i], FMT(annotation_prefix, ".bits"));
            sum.emplace_back(pb, (i == 0) ? constants.zero : sum.back().result(), bits.back().result(), FMT(annotation_prefix, ".sum"));
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
        requireEqual(pb, sum.back().result(), constants.one, FMT(annotation_prefix, ".selector_sum_one"));
    }

    const VariableArrayT& result() const
    {
        return res;
    }
};

class SelectGadget : public GadgetT
{
public:

    std::vector<TernaryGadget> results;

    SelectGadget(
        ProtoboardT& pb,
        const VariableArrayT& selector,
        const std::vector<VariableT>& values,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix)
    {
        assert(values.size() == selector.size());
        for (unsigned int i = 0; i < values.size(); i++)
        {
            results.emplace_back(TernaryGadget(pb, selector[i], values[i], (i == 0) ? values[0] : results.back().result(), FMT(prefix, ".results")));
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

    const VariableT& result() const
    {
        return results.back().result();
    }
};

class ArraySelectGadget : public GadgetT
{
public:

    std::vector<ArrayTernaryGadget> results;

    ArraySelectGadget(
        ProtoboardT& pb,
        const VariableArrayT& selector,
        const std::vector<VariableArrayT>& values,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix)
    {
        assert(values.size() == selector.size());
        for (unsigned int i = 0; i < values.size(); i++)
        {
            results.emplace_back(ArrayTernaryGadget(pb, selector[i], values[i], (i == 0) ? values[0] : results.back().result(), FMT(prefix, ".results")));
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
            results[i].generate_r1cs_constraints();
        }
    }

    const VariableArrayT& result() const
    {
        return results.back().result();
    }
};

class OwnerValidGadget : public GadgetT
{
public:

    EqualGadget newOwner_equal_oldOwner;
    EqualGadget no_oldOwner;
    OrGadget equal_owner_or_no_owner;
    RequireEqualGadget equal_owner_or_no_owner_eq_true;

    OwnerValidGadget(
        ProtoboardT& pb,
        const Constants& constants,
        const VariableT& oldOwner,
        const VariableT& newOwner,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        newOwner_equal_oldOwner(pb, newOwner, oldOwner, FMT(prefix, ".newOwner_equal_oldOwner")),
        no_oldOwner(pb, oldOwner, constants.zero, FMT(prefix, ".no_oldOwner")),
        equal_owner_or_no_owner(pb, {newOwner_equal_oldOwner.result(), no_oldOwner.result()}, FMT(prefix, ".equal_owner_or_no_owner")),
        equal_owner_or_no_owner_eq_true(pb, equal_owner_or_no_owner.result(), constants.one, FMT(prefix, ".equal_owner_or_no_owner_eq_true"))
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

    const VariableT& isNewAccount() const
    {
        return no_oldOwner.result();
    }
};

}

#endif
