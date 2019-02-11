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
    const VariableT A;
    const VariableT B;
    const VariableT C;
    const VariableT D;

    const VariableT X;
    const VariableT Y;
    const VariableT rest;

    const VariableT lt;
    const VariableT leq;
    libsnark::comparison_gadget<ethsnarks::FieldT> comparison;

    // (A * B) / C = D
    MulDivGadget(
        ProtoboardT& pb,
        const VariableT& _A,
        const VariableT& _B,
        const VariableT& _C,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        A(_A),
        B(_B),
        C(_C),

        D(make_variable(pb, FMT(prefix, ".D"))),

        X(make_variable(pb, FMT(prefix, ".X"))),
        Y(make_variable(pb, FMT(prefix, ".Y"))),
        rest(make_variable(pb, FMT(prefix, ".rest"))),

        lt(make_variable(pb, FMT(prefix, ".lt"))),
        leq(make_variable(pb, FMT(prefix, ".leq"))),
        comparison(pb, 2*96, rest, C, lt, leq, FMT(prefix, ".rest < C"))
    {

    }

    const VariableT& result() const
    {
        return D;
    }

    void generate_r1cs_witness()
    {
        pb.val(D) = (pb.val(A) * pb.val(B)) * pb.val(C).inverse();
        pb.val(X) = pb.val(A) * pb.val(B);
        pb.val(Y) = pb.val(C) * pb.val(D);
        pb.val(rest) = pb.val(X) - pb.val(Y);

        comparison.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        pb.add_r1cs_constraint(ConstraintT(A, B, X), FMT(annotation_prefix, ".A * B == X"));
        pb.add_r1cs_constraint(ConstraintT(C, D, Y), FMT(annotation_prefix, ".C * D == Y"));
        pb.add_r1cs_constraint(ConstraintT(Y + rest, FieldT::one(), X), FMT(annotation_prefix, ".Y + rest == X"));

        comparison.generate_r1cs_constraints();
        pb.add_r1cs_constraint(ConstraintT(lt, FieldT::one(), FieldT::one()), FMT(annotation_prefix, ".(rest < C) == 1"));
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

}

#endif
