#ifndef _SIGNATUREGADGETS_H_
#define _SIGNATUREGADGETS_H_

#include "../Utils/Constants.h"

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

class RequireValidPublicKey : public GadgetT
{
public:

    const Params& params;

    // Needs to be a valid point
    PointValidator requireValidPoint;

    // Point needs to be compressable
    const VariableT& y;
    VariableT yy;
    VariableT lhs;
    VariableT rhs;
    VariableT irhs;
    VariableT xx;
    VariableT x;

    RequireValidPublicKey(
        ProtoboardT& pb,
        const Params& _params,
        const VariableT& _x,
        const VariableT& _y,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        params(_params),

        requireValidPoint(pb, params, _x, _y, FMT(prefix, ".requireValidPoint")),

        y(_y),
        yy(make_variable(pb, FMT(prefix, ".yy"))),
        lhs(make_variable(pb, FMT(prefix, ".lhs"))),
        rhs(make_variable(pb, FMT(prefix, ".rhs"))),
        irhs(make_variable(pb, FMT(prefix, ".irhs"))),
        xx(make_variable(pb, FMT(prefix, ".xx"))),
        x(make_variable(pb, FMT(prefix, ".x")))
    {

    }

    void generate_r1cs_witness()
    {
        requireValidPoint.generate_r1cs_witness();

        pb.val(yy) = pb.val(y).squared();
        pb.val(lhs) = pb.val(yy) - 1;
        pb.val(rhs) = params.d * pb.val(yy) - params.a;
        pb.val(irhs) = pb.val(rhs).inverse();
        pb.val(xx) = pb.val(lhs) * pb.val(irhs);
        pb.val(x) = pb.val(xx).sqrt();
    }

    void generate_r1cs_constraints()
    {
        requireValidPoint.generate_r1cs_constraints();

        pb.add_r1cs_constraint(ConstraintT(y, y, yy), FMT(annotation_prefix, ".yy"));
        pb.add_r1cs_constraint(ConstraintT(yy - 1, 1, lhs), FMT(annotation_prefix, ".lhs"));
        pb.add_r1cs_constraint(ConstraintT((params.d * yy) - params.a, 1, rhs), FMT(annotation_prefix, ".rhs"));
        pb.add_r1cs_constraint(ConstraintT(rhs, irhs, 1), FMT(annotation_prefix, ".irhs"));
        pb.add_r1cs_constraint(ConstraintT(lhs, irhs, xx), FMT(annotation_prefix, ".xx"));
        pb.add_r1cs_constraint(ConstraintT(x, x, xx), FMT(annotation_prefix, ".x"));
    }
};

class CompressPublicKey : public GadgetT
{
public:

    const Params& params;
    const Constants& constants;

    // Special case to allow the public key to be 0
    EqualGadget isZeroX;
    EqualGadget isZeroY;
    AndGadget   isZero;
    TernaryGadget valueX;
    TernaryGadget valueY;

    // Check if the public key is valid
    RequireValidPublicKey requireValidPublicKey;

    // Point compression
    UnsafeSubGadget negPublicKeyX;
    LtFieldGadget isNegativeX;
    field2bits_strict publicKeyYBits;

    CompressPublicKey(
        ProtoboardT& pb,
        const Params& _params,
        const Constants& _constants,
        const VariableT& publicKeyX,
        const VariableT& publicKeyY,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        params(_params),
        constants(_constants),

        // Special case to allow the public key to be 0
        isZeroX(pb, publicKeyX, constants.zero, FMT(prefix, ".isZeroX")),
        isZeroY(pb, publicKeyY, constants.zero, FMT(prefix, ".isZeroY")),
        isZero(pb, {isZeroX.result(), isZeroY.result()}, FMT(prefix, ".isZero")),
        valueX(pb, isZero.result(), constants.dummyPublicKeyX, publicKeyX, FMT(prefix, ".valueX")),
        valueY(pb, isZero.result(), constants.dummyPublicKeyY, publicKeyY, FMT(prefix, ".valueY")),

        // Check if the public key is valid
        requireValidPublicKey(pb, params, valueX.result(), valueY.result(), FMT(prefix, ".requireValidPublicKey")),

        // Point compression
        negPublicKeyX(pb, constants.zero, publicKeyX, FMT(prefix, ".negPublicKeyX")),
        isNegativeX(pb, negPublicKeyX.result(), publicKeyX, FMT(prefix, ".isNegativeX")),
        publicKeyYBits(pb, publicKeyY, FMT(prefix, ".publicKeyYBits"))
    {

    }

    void generate_r1cs_witness()
    {
        // Special case to allow the public key to be 0
        isZeroX.generate_r1cs_witness();
        isZeroY.generate_r1cs_witness();
        isZero.generate_r1cs_witness();
        valueX.generate_r1cs_witness();
        valueY.generate_r1cs_witness();

        // Check if the public key is valid
        requireValidPublicKey.generate_r1cs_witness();

        // Point compression
        negPublicKeyX.generate_r1cs_witness();
        isNegativeX.generate_r1cs_witness();
        publicKeyYBits.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        // Special case to allow the public key to be 0
        isZeroX.generate_r1cs_constraints();
        isZeroY.generate_r1cs_constraints();
        isZero.generate_r1cs_constraints();
        valueX.generate_r1cs_constraints();
        valueY.generate_r1cs_constraints();

        // Check if the public key is valid
        requireValidPublicKey.generate_r1cs_constraints();

        // Point compression
        negPublicKeyX.generate_r1cs_constraints();
        isNegativeX.generate_r1cs_constraints();
        publicKeyYBits.generate_r1cs_constraints();
    }

    VariableArrayT result() const
    {
        return reverse(flattenReverse({VariableArrayT(1, isNegativeX.lt()), VariableArrayT(1, constants.zero), publicKeyYBits.result()}));
    }
};

class EdDSA_HashRAM_Poseidon_gadget : public GadgetT
{
public:
    Poseidon_gadget_T<6, 1, 6, 52, 5, 1> m_hash_RAM;      // hash_RAM = H(R, A, M)
    libsnark::dual_variable_gadget<FieldT> hash;

    EdDSA_HashRAM_Poseidon_gadget(
        ProtoboardT& in_pb,
        const Params& in_params,
        const VariablePointT& in_R,
        const VariablePointT& in_A,
        const VariableT& in_M,
        const std::string& annotation_prefix
    ) :
        GadgetT(in_pb, annotation_prefix),
        // Prefix the message with R and A.
        m_hash_RAM(in_pb, var_array({in_R.x, in_R.y, in_A.x, in_A.y, in_M}), FMT(annotation_prefix, ".hash_RAM")),
        hash(pb, NUM_BITS_MAX_VALUE, FMT(annotation_prefix, ".hash"))
    {

    }

    void generate_r1cs_constraints()
    {
        m_hash_RAM.generate_r1cs_constraints();
        hash.generate_r1cs_constraints(true);
    }

    void generate_r1cs_witness()
    {
        m_hash_RAM.generate_r1cs_witness();
        hash.bits.fill_with_bits_of_field_element(pb, pb.val(m_hash_RAM.result()));
        hash.generate_r1cs_witness_from_bits();
    }

    const VariableArrayT& result()
    {
        return hash.bits;
    }
};

class EdDSA_Poseidon: public GadgetT
{
public:
    PointValidator m_validator_R;                       // IsValid(R)
    fixed_base_mul m_lhs;                               // lhs = B*s
    EdDSA_HashRAM_Poseidon_gadget m_hash_RAM;           // hash_RAM = H(R,A,M)
    ScalarMult m_At;                                    // A*hash_RAM
    PointAdder m_rhs;                                   // rhs = R + (A*hash_RAM)

    EqualGadget equalX;
    EqualGadget equalY;
    AndGadget valid;

    EdDSA_Poseidon(
        ProtoboardT& in_pb,
        const Params& in_params,
        const EdwardsPoint& in_base,     // B
        const VariablePointT& in_A,      // A
        const VariablePointT& in_R,      // R
        const VariableArrayT& in_s,      // s
        const VariableT& in_msg,         // m
        const std::string& annotation_prefix
    ) :
        GadgetT(in_pb, annotation_prefix),
        // IsValid(R)
        m_validator_R(in_pb, in_params, in_R.x, in_R.y, FMT(this->annotation_prefix, ".validator_R")),

        // lhs = ScalarMult(B, s)
        m_lhs(in_pb, in_params, in_base.x, in_base.y, in_s, FMT(this->annotation_prefix, ".lhs")),

        // hash_RAM = H(R, A, M)
        m_hash_RAM(in_pb, in_params, in_R, in_A, in_msg, FMT(this->annotation_prefix, ".hash_RAM")),

        // At = ScalarMult(A,hash_RAM)
        m_At(in_pb, in_params, in_A.x, in_A.y, m_hash_RAM.result(), FMT(this->annotation_prefix, ".At = A * hash_RAM")),

        // rhs = PointAdd(R, At)
        m_rhs(in_pb, in_params, in_R.x, in_R.y, m_At.result_x(), m_At.result_y(), FMT(this->annotation_prefix, ".rhs")),

        // Verify the two points are equal
        equalX(in_pb, m_lhs.result_x(), m_rhs.result_x(), ".equalX"),
        equalY(in_pb, m_lhs.result_y(), m_rhs.result_y(), ".equalY"),
        valid(in_pb, {equalX.result(), equalY.result()}, ".valid")
    {

    }

    void generate_r1cs_constraints()
    {
        m_validator_R.generate_r1cs_constraints();
        m_lhs.generate_r1cs_constraints();
        m_hash_RAM.generate_r1cs_constraints();
        m_At.generate_r1cs_constraints();
        m_rhs.generate_r1cs_constraints();

        // Verify the two points are equal
        equalX.generate_r1cs_constraints();
        equalY.generate_r1cs_constraints();
        valid.generate_r1cs_constraints();
    }

    void generate_r1cs_witness()
    {
        m_validator_R.generate_r1cs_witness();
        m_lhs.generate_r1cs_witness();
        m_hash_RAM.generate_r1cs_witness();
        m_At.generate_r1cs_witness();
        m_rhs.generate_r1cs_witness();

        // Verify the two points are equal
        equalX.generate_r1cs_witness();
        equalY.generate_r1cs_witness();
        valid.generate_r1cs_witness();
    }

    const VariableT& result() const
    {
        return valid.result();
    }
};

// Verifies a signature hashed with Poseidon
class SignatureVerifier : public GadgetT
{
public:
    const Constants& constants;
    const jubjub::VariablePointT sig_R;
    const VariableArrayT sig_s;
    EdDSA_Poseidon signatureVerifier;

    IfThenRequireGadget valid;

    SignatureVerifier(
        ProtoboardT& pb,
        const jubjub::Params& params,
        const Constants& _constants,
        const jubjub::VariablePointT& publicKey,
        const VariableT& message,
        const VariableT& required,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        constants(_constants),
        sig_R(pb, FMT(prefix, ".R")),
        sig_s(make_var_array(pb, FieldT::size_in_bits(), FMT(prefix, ".s"))),
        signatureVerifier(pb, params, jubjub::EdwardsPoint(params.Gx, params.Gy), publicKey, sig_R, sig_s, message, FMT(prefix, ".signatureVerifier")),
        valid(pb, required, signatureVerifier.result(), FMT(prefix, ".valid"))
    {

    }

    void generate_r1cs_witness(Signature sig)
    {
        pb.val(sig_R.x) = sig.R.x;
        pb.val(sig_R.y) = sig.R.y;
        sig_s.fill_with_bits_of_field_element(pb, sig.s);
        signatureVerifier.generate_r1cs_witness();
        valid.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        signatureVerifier.generate_r1cs_constraints();
        valid.generate_r1cs_constraints();
    }

    const VariableT& result() const
    {
        return signatureVerifier.result();
    }
};

}

#endif
