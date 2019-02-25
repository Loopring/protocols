#ifndef _MATHGADGETS_H_
#define _MATHGADGETS_H_

#include "../Utils/Constants.h"
#include "../Utils/Data.h"

#include "ethsnarks.hpp"
#include "utils.hpp"
#include "jubjub/point.hpp"
#include "jubjub/eddsa.hpp"

using namespace ethsnarks;

namespace Loopring
{

void forceEqual(ProtoboardT& pb, const VariableT& A, const VariableT& B, const std::string& annotation_prefix)
{
    pb.add_r1cs_constraint(ConstraintT(A, FieldT::one(), B), FMT(annotation_prefix, ".forceEqual"));
}

class TernaryGadget : public GadgetT
{
public:
    VariableT condition;
    VariableT T;
    VariableT F;

    VariableT invCondition;
    VariableT resultT;
    VariableT resultF;

    VariableT selected;

    TernaryGadget(
        ProtoboardT& pb,
        const VariableT& _condition,
        const VariableT& _T,
        const VariableT& _F,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        condition(_condition),
        T(_T),
        F(_F),

        invCondition(make_variable(pb, FMT(prefix, ".invCondition"))),
        resultT(make_variable(pb, FMT(prefix, ".resultT"))),
        resultF(make_variable(pb, FMT(prefix, ".resultF"))),

        selected(make_variable(pb, FMT(prefix, ".selected")))
    {

    }

    const VariableT& result() const
    {
        return selected;
    }

    void generate_r1cs_witness()
    {
        pb.val(invCondition) = FieldT::one() - pb.val(condition);
        pb.val(resultT) = pb.val(T) * pb.val(condition);
        pb.val(resultF) = pb.val(F) * pb.val(invCondition);
        pb.val(selected) = pb.val(resultT) + pb.val(resultF);
    }

    void generate_r1cs_constraints()
    {
        libsnark::generate_boolean_r1cs_constraint<ethsnarks::FieldT>(pb, condition, FMT(annotation_prefix, ".bitness"));
        pb.add_r1cs_constraint(ConstraintT(condition + invCondition, FieldT::one(), FieldT::one()), FMT(annotation_prefix, ".condition + invCondition == 1"));
        pb.add_r1cs_constraint(ConstraintT(T, condition, resultT), FMT(annotation_prefix, ".T * condition == resultT"));
        pb.add_r1cs_constraint(ConstraintT(F, invCondition, resultF), FMT(annotation_prefix, ".F * invCondition == resultF"));
        pb.add_r1cs_constraint(ConstraintT(resultT + resultF, FieldT::one(), selected), FMT(annotation_prefix, ".resultT + resultF == selected"));
    }
};

class LeqGadget : public GadgetT
{
public:
    VariableT _lt;
    VariableT _leq;
    libsnark::comparison_gadget<ethsnarks::FieldT> comparison;

    LeqGadget(
        ProtoboardT& pb,
        const VariableT& A,
        const VariableT& B,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        _lt(make_variable(pb, 1, FMT(prefix, ".lt"))),
        _leq(make_variable(pb, 1, FMT(prefix, ".leq"))),
        comparison(pb, 2*96, A, B, _lt, _leq, FMT(prefix, ".A <(=) B"))
    {

    }

    const VariableT& lt() const
    {
        return _lt;
    }

    const VariableT& leq() const
    {
        return _leq;
    }

    void generate_r1cs_witness()
    {
        comparison.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        comparison.generate_r1cs_constraints();
    }
};


class AndGadget : public GadgetT
{
public:
    VariableT A;
    VariableT B;
    VariableT _and;

    AndGadget(
        ProtoboardT& pb,
        const VariableT& _A,
        const VariableT& _B,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        A(_A),
        B(_B),

        _and(make_variable(pb, FMT(prefix, "._and")))
    {

    }

    const VariableT& And() const
    {
        return _and;
    }

    void generate_r1cs_witness()
    {
        pb.val(_and) = pb.val(A) * pb.val(B);
    }

    void generate_r1cs_constraints()
    {
        pb.add_r1cs_constraint(ConstraintT(A, B, _and), FMT(annotation_prefix, ".A && B == _and"));
    }
};

class OrGadget : public GadgetT
{
public:
    VariableT A;
    VariableT B;
    VariableT _or;

    OrGadget(
        ProtoboardT& pb,
        const VariableT& _A,
        const VariableT& _B,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        A(_A),
        B(_B),

        _or(make_variable(pb, FMT(prefix, "._or")))
    {

    }

    const VariableT& Or() const
    {
        return _or;
    }

    void generate_r1cs_witness()
    {
        pb.val(_or) = FieldT::one() - (FieldT::one() - pb.val(A)) * (FieldT::one() - pb.val(B));
    }

    void generate_r1cs_constraints()
    {
        pb.add_r1cs_constraint(ConstraintT(FieldT::one() - A, FieldT::one() - B, FieldT::one() - _or), FMT(annotation_prefix, ".A || B == _or"));
    }
};

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

    const VariableT& Not() const
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


class EqualGadget : public GadgetT
{
public:
    LeqGadget leq;
    NotGadget NOTLt;
    AndGadget NOTltANDleq;

    EqualGadget(
        ProtoboardT& pb,
        const VariableT& A,
        const VariableT& B,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        leq(pb, A, B, FMT(prefix, ".A <(=) B")),
        NOTLt(pb, leq.lt(), FMT(prefix, ".!(A<B)")),
        NOTltANDleq(pb, NOTLt.Not(), leq.leq(), FMT(prefix, ".!(A<B) && (A<=B)"))
    {

    }

    const VariableT& eq() const
    {
        return NOTltANDleq.And();
    }

    void generate_r1cs_witness()
    {
        leq.generate_r1cs_witness();
        NOTLt.generate_r1cs_witness();
        NOTltANDleq.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        leq.generate_r1cs_constraints();
        NOTLt.generate_r1cs_constraints();
        NOTltANDleq.generate_r1cs_constraints();
    }
};


class MinGadget : public GadgetT
{
public:
    LeqGadget A_lt_B;
    TernaryGadget minimum;

    MinGadget(
        ProtoboardT& pb,
        const VariableT& A,
        const VariableT& B,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        A_lt_B(pb, A, B, FMT(prefix, ".(A < B)")),
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

class ForceLeqGadget : public GadgetT
{
public:
    LeqGadget leqGadget;

    ForceLeqGadget(
        ProtoboardT& pb,
        const VariableT& A,
        const VariableT& B,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        leqGadget(pb, A, B, FMT(prefix, ".leq"))
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

class MulDivGadget : public GadgetT
{
public:
    const VariableT const0;

    const VariableT A;
    const VariableT B;
    const VariableT C;
    const VariableT D;

    const VariableT X;
    const VariableT Y;
    const VariableT rest;

    LeqGadget rest_lt_C;
    EqualGadget rest_eq_0;
    OrGadget rest_lt_C_OR_rest_eq_0;

    // (A * B) / C = D
    MulDivGadget(
        ProtoboardT& pb,
        const VariableT& _A,
        const VariableT& _B,
        const VariableT& _C,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        const0(make_variable(pb, 0, FMT(prefix, ".const0"))),

        A(_A),
        B(_B),
        C(_C),

        D(make_variable(pb, FMT(prefix, ".D"))),

        X(make_variable(pb, FMT(prefix, ".X"))),
        Y(make_variable(pb, FMT(prefix, ".Y"))),
        rest(make_variable(pb, FMT(prefix, ".rest"))),

        rest_lt_C(pb, rest, C, FMT(prefix, ".rest <(=) C")),
        rest_eq_0(pb, rest, const0, FMT(prefix, ".rest == 0")),
        rest_lt_C_OR_rest_eq_0(pb, rest_lt_C.lt(), rest_eq_0.eq(), FMT(prefix, ".(rest < C) || (rest == 0)"))
    {

    }

    const VariableT& result() const
    {
        return D;
    }

    void generate_r1cs_witness()
    {
        pb.val(D) = (pb.val(C) == FieldT::zero()) ? FieldT::zero() :
                    ethsnarks::FieldT(((toBigInt(pb.val(A)) * toBigInt(pb.val(B))) /  toBigInt(pb.val(C))).to_string().c_str());

        pb.val(X) = pb.val(A) * pb.val(B);
        pb.val(Y) = pb.val(C) * pb.val(D);
        pb.val(rest) = pb.val(X) - pb.val(Y);

        rest_lt_C.generate_r1cs_witness();
        rest_eq_0.generate_r1cs_witness();
        rest_lt_C_OR_rest_eq_0.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        pb.add_r1cs_constraint(ConstraintT(A, B, X), FMT(annotation_prefix, ".A * B == X"));
        pb.add_r1cs_constraint(ConstraintT(C, D, Y), FMT(annotation_prefix, ".C * D == Y"));
        pb.add_r1cs_constraint(ConstraintT(Y + rest, FieldT::one(), X), FMT(annotation_prefix, ".Y + rest == X"));

        rest_lt_C.generate_r1cs_constraints();
        rest_eq_0.generate_r1cs_constraints();
        rest_lt_C_OR_rest_eq_0.generate_r1cs_constraints();

        pb.add_r1cs_constraint(ConstraintT(rest_lt_C_OR_rest_eq_0.Or(), FieldT::one(), FieldT::one()), FMT(annotation_prefix, ".rest_lt_C_OR_rest_eq_0 == 1"));
    }
};

class SignatureVerifier : public GadgetT
{
public:

    const jubjub::VariablePointT sig_R;
    const VariableArrayT sig_s;
    const VariableArrayT sig_m;
    jubjub::PureEdDSA signatureVerifier;

    SignatureVerifier(
        ProtoboardT& pb,
        const jubjub::Params& params,
        const jubjub::VariablePointT& publicKey,
        const VariableArrayT& _message,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        sig_R(pb, FMT(prefix, ".R")),
        sig_s(make_var_array(pb, FieldT::size_in_bits(), FMT(prefix, ".s"))),
        sig_m(_message),
        signatureVerifier(pb, params, jubjub::EdwardsPoint(params.Gx, params.Gy), publicKey, sig_R, sig_s, sig_m, FMT(prefix, ".signatureVerifier"))
    {

    }

    const VariableArrayT& getHash()
    {
        return signatureVerifier.m_hash_RAM.result();
    }

    void generate_r1cs_witness(Signature sig)
    {
        pb.val(sig_R.x) = sig.R.x;
        pb.val(sig_R.y) = sig.R.y;
        sig_s.fill_with_bits_of_field_element(pb, sig.s);
        signatureVerifier.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        signatureVerifier.generate_r1cs_constraints();
    }
};

class PublicDataGadget : public GadgetT
{
public:

    libsnark::dual_variable_gadget<FieldT>& inputHash;
    std::vector<VariableArrayT> publicDataBits;

    sha256_many* hasher;

    PublicDataGadget(
        ProtoboardT& pb,
        libsnark::dual_variable_gadget<FieldT>& _inputHash,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),
        inputHash(_inputHash)
    {
        this->hasher = nullptr;
    }

    ~PublicDataGadget()
    {
        if (hasher)
        {
            delete hasher;
        }
    }

    void add(const VariableArrayT& bits)
    {
        publicDataBits.push_back(bits);
    }

    void add(const std::vector<VariableArrayT>& bits)
    {
        publicDataBits.insert(publicDataBits.end(), bits.begin(), bits.end());
    }

    void generate_r1cs_witness()
    {
        hasher->generate_r1cs_witness();

         // Get the calculated hash in bits
        auto full_output_bits = hasher->result().get_digest();
        BigInt publicDataHashDec = 0;
        for (unsigned int i = 0; i < full_output_bits.size(); i++)
        {
            publicDataHashDec = publicDataHashDec * 2 + (full_output_bits[i] ? 1 : 0);
        }
        libff::bigint<libff::alt_bn128_r_limbs> bn = libff::bigint<libff::alt_bn128_r_limbs>(publicDataHashDec.to_string().c_str());
        printBits("publicDataHash: 0x", flattenReverse({hasher->result().bits}).get_bits(pb), true);

        // Store the input hash
        for (unsigned int i = 0; i < 256; i++)
        {
            pb.val(inputHash.bits[i]) = bn.test_bit(i);
        }
        inputHash.generate_r1cs_witness_from_bits();
    }

    void generate_r1cs_constraints()
    {
        hasher = new sha256_many(pb, flattenReverse(publicDataBits), ".hasher");
        hasher->generate_r1cs_constraints();

        // Check that the hash matches the public input
        for (unsigned int i = 0; i < 256; i++)
        {
            pb.add_r1cs_constraint(ConstraintT(hasher->result().bits[255-i], 1, inputHash.bits[i]), "publicData.check()");
        }
    }
};

}

#endif
