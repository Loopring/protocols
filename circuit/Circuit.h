#ifndef _CIRCUIT_H_
#define _CIRCUIT_H_

#include "Constants.h"
#include "Data.h"

#include "BigInt.hpp"
#include "ethsnarks.hpp"
#include "utils.hpp"
#include "jubjub/point.hpp"
#include "jubjub/eddsa.hpp"
#include "gadgets/mimc.hpp"
#include "gadgets/merkle_tree.hpp"
#include "gadgets/sha256_many.hpp"
#include "gadgets/subadd.hpp"

using namespace ethsnarks;


namespace Loopring
{

void printBits(const char* name, const libff::bit_vector& _bits, bool reverse = false)
{
    libff::bit_vector bits = _bits;
    if(reverse)
    {
        std::reverse(std::begin(bits), std::end(bits));
    }
    unsigned int numBytes = (bits.size() + 7) / 8;
    uint8_t* full_output_bytes = new uint8_t[numBytes];
    bv_to_bytes(bits, full_output_bytes);
    char* hexstr = new char[numBytes*2 + 1];
    hexstr[numBytes*2] = '\0';
    for(int i = 0; i < bits.size()/8; i++)
    {
        sprintf(hexstr + i*2, "%02x", full_output_bytes[i]);
    }
    std::cout << name << hexstr << std::endl;
    delete [] full_output_bytes;
    delete [] hexstr;
}

/**
* Convert an array of variable arrays into a flat contiguous array of variables
*/
const VariableArrayT flattenReverse( const std::vector<VariableArrayT> &in_scalars )
{
    size_t total_sz = 0;
    for( const auto& scalar : in_scalars )
        total_sz += scalar.size();

    VariableArrayT result;
    result.resize(total_sz);

    size_t offset = 0;
    for( const auto& scalar : in_scalars )
    {
        for (int i = int(scalar.size()) - 1; i >= 0; i--)
        {
            result[offset++].index = scalar[i].index;
        }
    }

    return result;
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

        invCondition(make_variable(pb, "invCondition")),
        resultT(make_variable(pb, "resultT")),
        resultF(make_variable(pb, "resultF")),

        selected(make_variable(pb, "selected"))
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
        libsnark::generate_boolean_r1cs_constraint<ethsnarks::FieldT>(pb, condition, "bitness");
        pb.add_r1cs_constraint(ConstraintT(condition + invCondition, FieldT::one(), FieldT::one()), "condition + invCondition == 1");
        pb.add_r1cs_constraint(ConstraintT(T, condition, resultT), "T * condition == resultT");
        pb.add_r1cs_constraint(ConstraintT(F, invCondition, resultF), "F * invCondition == resultF");
        pb.add_r1cs_constraint(ConstraintT(resultT + resultF, FieldT::one(), selected), "resultT + resultF == selected");
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

        _lt(make_variable(pb, 1, FMT(prefix, "lt"))),
        _leq(make_variable(pb, 1, FMT(prefix, "leq"))),
        comparison(pb, 128, A, B, _lt, _leq, FMT(prefix, "A <(=) B"))
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

        leqGadget(pb, A, B, FMT(prefix, "leq"))
    {

    }

    void generate_r1cs_witness()
    {
        leqGadget.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        leqGadget.generate_r1cs_constraints();
        pb.add_r1cs_constraint(ConstraintT(leqGadget.leq(), FieldT::one(), FieldT::one()), FMT(annotation_prefix, "leq == 1"));
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

        D(make_variable(pb, "D")),

        X(make_variable(pb, "X")),
        Y(make_variable(pb, "Y")),
        rest(make_variable(pb, "rest")),

        lt(make_variable(pb, "lt")),
        leq(make_variable(pb, "leq")),
        comparison(pb, 2*96, rest, C, lt, leq, "rest < C")
    {

    }

    const VariableT& result() const
    {
        return D;
    }

    void generate_r1cs_witness()
    {
        pb.val(D) = (pb.val(A) * pb.val(B)).as_ulong() / pb.val(C).as_ulong();
        pb.val(X) = pb.val(A) * pb.val(B);
        pb.val(Y) = pb.val(C) * pb.val(D);
        pb.val(rest) = pb.val(X) - pb.val(Y);

        comparison.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        pb.add_r1cs_constraint(ConstraintT(A, B, X), "A * B == X");
        pb.add_r1cs_constraint(ConstraintT(C, D, Y), "C * D == Y");
        pb.add_r1cs_constraint(ConstraintT(Y + rest, FieldT::one(), X), "Y + rest == X");

        comparison.generate_r1cs_constraints();
        pb.add_r1cs_constraint(ConstraintT(lt, FieldT::one(), FieldT::one()), "lt == 1");
    }
};


class FeePaymentCalculator : public GadgetT
{
public:

    VariableT constant1000;
    VariableT constant100;

    VariableT fee;
    VariableT burnRate;
    VariableT walletSplitPercentage;
    VariableT waiveFeePercentage;

    VariableT matchingFee;
    VariableT walletFeeToPay;
    VariableT matchingFeeToPay;
    VariableT feeToBurn;

    MulDivGadget walletFee;
    MulDivGadget walletFeeToBurn;
    MulDivGadget matchingFeeAfterWaiving;
    MulDivGadget matchingFeeToBurn;

    FeePaymentCalculator(
        ProtoboardT& pb,
        const VariableT& _fee,
        const VariableT& _burnRate,
        const VariableT& _walletSplitPercentage,
        const VariableT& _waiveFeePercentage,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        constant100(make_variable(pb, 100, FMT(prefix, ".constant100"))),
        constant1000(make_variable(pb, 1000, FMT(prefix, ".constant1000"))),

        fee(_fee),
        burnRate(_burnRate),
        walletSplitPercentage(_walletSplitPercentage),
        waiveFeePercentage(_waiveFeePercentage),

        matchingFee(make_variable(pb, FMT(prefix, ".matchingFee"))),
        walletFeeToPay(make_variable(pb, FMT(prefix, ".walletFeeToPay"))),
        matchingFeeToPay(make_variable(pb, FMT(prefix, ".matchingFeeToPay"))),
        feeToBurn(make_variable(pb, FMT(prefix, ".feeToBurn"))),

        walletFee(pb, fee, walletSplitPercentage, constant100, FMT(prefix, "(amount * walletSplitPercentage) / 100 == walletFee")),
        walletFeeToBurn(pb, walletFee.result(), burnRate, constant1000, FMT(prefix, "(walletFee * burnRate) / 1000 == walletFeeToBurn")),
        matchingFeeAfterWaiving(pb, matchingFee, waiveFeePercentage, constant100, FMT(prefix, "(matchingFee * waiveFeePercentage) / 100 == matchingFeeAfterWaiving")),
        matchingFeeToBurn(pb, matchingFeeAfterWaiving.result(), burnRate, constant1000, FMT(prefix, "(matchingFeeAfterWaiving * burnRate) / 1000 == matchingFeeToBurn"))
    {

    }

    const VariableT getWalletFee() const
    {
        return walletFeeToPay;
    }

    const VariableT getMatchingFee() const
    {
        return matchingFeeToPay;
    }

    const VariableT getBurnFee() const
    {
        return feeToBurn;
    }

    void generate_r1cs_witness()
    {
        walletFee.generate_r1cs_witness();
        walletFeeToBurn.generate_r1cs_witness();
        pb.val(walletFeeToPay) = pb.val(walletFee.result()) - pb.val(walletFeeToBurn.result());

        pb.val(matchingFee) = pb.val(fee) - pb.val(walletFee.result());
        matchingFeeAfterWaiving.generate_r1cs_witness();
        matchingFeeToBurn.generate_r1cs_witness();
        pb.val(matchingFeeToPay) = pb.val(matchingFeeAfterWaiving.result()) - pb.val(matchingFeeToBurn.result());

        pb.val(feeToBurn) = pb.val(walletFeeToBurn.result()) + pb.val(matchingFeeToBurn.result());
    }

    void generate_r1cs_constraints()
    {
        walletFee.generate_r1cs_constraints();
        walletFeeToBurn.generate_r1cs_constraints();
        matchingFeeAfterWaiving.generate_r1cs_constraints();
        matchingFeeToBurn.generate_r1cs_constraints();

        pb.add_r1cs_constraint(ConstraintT(walletFeeToPay + walletFeeToBurn.result(), FieldT::one(), walletFee.result()), "walletFeeToPay + walletFeeToBurn == walletFee");
        pb.add_r1cs_constraint(ConstraintT(walletFee.result() + matchingFee, FieldT::one(), fee), "walletFee + matchingFee == fee");
        pb.add_r1cs_constraint(ConstraintT(matchingFeeToPay + matchingFeeToBurn.result(), FieldT::one(), matchingFeeAfterWaiving.result()), "matchingFeeToPay + matchingFeeToBurn == matchingFeeAfterWaiving");
        pb.add_r1cs_constraint(ConstraintT(walletFeeToBurn.result() + matchingFeeToBurn.result(), FieldT::one(), feeToBurn), "walletFeeToBurn + matchingFeeToBurn == feeToBurn");
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


class OrderGadget : public GadgetT
{
public:

    libsnark::dual_variable_gadget<FieldT> dexID;
    libsnark::dual_variable_gadget<FieldT> orderID;
    libsnark::dual_variable_gadget<FieldT> accountS;
    libsnark::dual_variable_gadget<FieldT> accountB;
    libsnark::dual_variable_gadget<FieldT> accountF;
    libsnark::dual_variable_gadget<FieldT> amountS;
    libsnark::dual_variable_gadget<FieldT> amountB;
    libsnark::dual_variable_gadget<FieldT> amountF;
    libsnark::dual_variable_gadget<FieldT> walletF;
    libsnark::dual_variable_gadget<FieldT> minerF;
    libsnark::dual_variable_gadget<FieldT> minerS;
    libsnark::dual_variable_gadget<FieldT> walletSplitPercentage;
    libsnark::dual_variable_gadget<FieldT> validSince;
    libsnark::dual_variable_gadget<FieldT> validUntil;
    libsnark::dual_variable_gadget<FieldT> allOrNone;
    libsnark::dual_variable_gadget<FieldT> padding;

    libsnark::dual_variable_gadget<FieldT> waiveFeePercentage;

    VariableT tokenS;
    VariableT tokenB;
    libsnark::dual_variable_gadget<FieldT> tokenF;

    const jubjub::VariablePointT publicKey;
    const jubjub::VariablePointT walletPublicKey;
    const jubjub::VariablePointT minerPublicKeyF;
    const jubjub::VariablePointT minerPublicKeyS;

    VariableT filledBefore;
    VariableT cancelled;

    VariableT balanceS;
    VariableT balanceB;
    VariableT balanceF;

    SignatureVerifier signatureVerifier;

    // Validity checking
    LeqGadget validSince_leq_timestamp;
    LeqGadget timestamp_leq_validUntil;

    VariableT valid;

    OrderGadget(
        ProtoboardT& pb,
        const jubjub::Params& params,
        const VariableT& timestamp,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        dexID(pb, 16, FMT(prefix, ".dexID")),
        orderID(pb, 4, FMT(prefix, ".orderID")),
        accountS(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".accountS")),
        accountB(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".accountB")),
        accountF(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".accountF")),
        amountS(pb, 96, FMT(prefix, ".amountS")),
        amountB(pb, 96, FMT(prefix, ".amountB")),
        amountF(pb, 96, FMT(prefix, ".amountF")),
        walletF(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".walletF")),
        minerF(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".minerF")),
        minerS(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".minerS")),
        validSince(pb, 32, FMT(prefix, ".validSince")),
        validUntil(pb, 32, FMT(prefix, ".validUntil")),
        allOrNone(pb, 1, FMT(prefix, ".allOrNone")),
        padding(pb, 1, FMT(prefix, ".padding")),

        walletSplitPercentage(pb, 8, FMT(prefix, ".walletSplitPercentage")),
        waiveFeePercentage(pb, 7, FMT(prefix, ".waiveFeePercentage")),

        tokenS(make_variable(pb, FMT(prefix, ".tokenS"))),
        tokenB(make_variable(pb, FMT(prefix, ".tokenB"))),
        tokenF(pb, TREE_DEPTH_TOKENS, FMT(prefix, ".tokenF")),

        publicKey(pb, FMT(prefix, ".publicKey")),
        walletPublicKey(pb, FMT(prefix, ".walletPublicKey")),
        minerPublicKeyF(pb, FMT(prefix, ".minerPublicKeyF")),
        minerPublicKeyS(pb, FMT(prefix, ".minerPublicKeyS")),

        filledBefore(make_variable(pb, FMT(prefix, ".filledBefore"))),
        cancelled(make_variable(pb, FMT(prefix, ".cancelled"))),

        balanceS(make_variable(pb, FMT(prefix, ".balanceS"))),
        balanceB(make_variable(pb, FMT(prefix, ".balanceB"))),
        balanceF(make_variable(pb, FMT(prefix, ".balanceF"))),

        signatureVerifier(pb, params, publicKey,
                          flatten({dexID.bits, orderID.bits, accountS.bits, accountB.bits, accountF.bits, amountS.bits, amountB.bits, amountF.bits}),
                          FMT(prefix, ".signatureVerifier")),

        validSince_leq_timestamp(pb, validSince.packed, timestamp, FMT(prefix, "validSince <= timestamp")),
        timestamp_leq_validUntil(pb, timestamp, validUntil.packed, FMT(prefix, "timestamp <= validUntil")),

        valid(make_variable(pb, FMT(prefix, ".valid")))
    {

    }

    const VariableArrayT& getHash()
    {
        return signatureVerifier.getHash();
    }

    const VariableT& isValid() const
    {
        return valid;
    }

    void generate_r1cs_witness(const Order& order)
    {
        dexID.bits.fill_with_bits_of_field_element(pb, order.dexID);
        dexID.generate_r1cs_witness_from_bits();
        orderID.bits.fill_with_bits_of_field_element(pb, order.orderID);
        orderID.generate_r1cs_witness_from_bits();

        accountS.bits.fill_with_bits_of_field_element(pb, order.accountS);
        accountS.generate_r1cs_witness_from_bits();
        accountB.bits.fill_with_bits_of_field_element(pb, order.accountB);
        accountB.generate_r1cs_witness_from_bits();
        accountF.bits.fill_with_bits_of_field_element(pb, order.accountF);
        accountF.generate_r1cs_witness_from_bits();

        amountS.bits.fill_with_bits_of_field_element(pb, order.amountS);
        amountS.generate_r1cs_witness_from_bits();
        amountB.bits.fill_with_bits_of_field_element(pb, order.amountB);
        amountB.generate_r1cs_witness_from_bits();
        amountF.bits.fill_with_bits_of_field_element(pb, order.amountF);
        amountF.generate_r1cs_witness_from_bits();

        walletF.bits.fill_with_bits_of_field_element(pb, order.walletF);
        walletF.generate_r1cs_witness_from_bits();
        minerF.bits.fill_with_bits_of_field_element(pb, order.minerF);
        minerF.generate_r1cs_witness_from_bits();
        minerS.bits.fill_with_bits_of_field_element(pb, order.minerS);
        minerS.generate_r1cs_witness_from_bits();

        padding.bits.fill_with_bits_of_field_element(pb, 0);
        padding.generate_r1cs_witness_from_bits();

        walletSplitPercentage.bits.fill_with_bits_of_field_element(pb, order.walletSplitPercentage);
        walletSplitPercentage.generate_r1cs_witness_from_bits();

        validSince.bits.fill_with_bits_of_field_element(pb, order.validSince);
        validSince.generate_r1cs_witness_from_bits();
        validUntil.bits.fill_with_bits_of_field_element(pb, order.validUntil);
        validUntil.generate_r1cs_witness_from_bits();

        allOrNone.bits.fill_with_bits_of_field_element(pb, order.allOrNone);
        allOrNone.generate_r1cs_witness_from_bits();

        waiveFeePercentage.bits.fill_with_bits_of_field_element(pb, order.waiveFeePercentage);
        waiveFeePercentage.generate_r1cs_witness_from_bits();

        pb.val(tokenS) = order.tokenS;
        pb.val(tokenB) = order.tokenB;
        tokenF.bits.fill_with_bits_of_field_element(pb, order.tokenF);
        tokenF.generate_r1cs_witness_from_bits();

        pb.val(filledBefore) = order.filledBefore;
        pb.val(cancelled) = order.cancelled;

        pb.val(balanceS) = order.balanceS;
        pb.val(balanceB) = order.balanceB;
        pb.val(balanceF) = order.balanceF;

        pb.val(publicKey.x) = order.publicKey.x;
        pb.val(publicKey.y) = order.publicKey.y;

        pb.val(walletPublicKey.x) = order.walletPublicKey.x;
        pb.val(walletPublicKey.y) = order.walletPublicKey.y;
        pb.val(minerPublicKeyF.x) = order.minerPublicKeyF.x;
        pb.val(minerPublicKeyF.y) = order.minerPublicKeyF.y;
        pb.val(minerPublicKeyS.x) = order.minerPublicKeyS.x;
        pb.val(minerPublicKeyS.y) = order.minerPublicKeyS.y;

        signatureVerifier.generate_r1cs_witness(order.signature);

        validSince_leq_timestamp.generate_r1cs_witness();
        timestamp_leq_validUntil.generate_r1cs_witness();

        pb.val(valid) = order.valid;
    }

    void generate_r1cs_constraints()
    {
        dexID.generate_r1cs_constraints(true);
        orderID.generate_r1cs_constraints(true);
        accountS.generate_r1cs_constraints(true);
        accountB.generate_r1cs_constraints(true);
        accountF.generate_r1cs_constraints(true);
        amountS.generate_r1cs_constraints(true);
        amountB.generate_r1cs_constraints(true);
        amountF.generate_r1cs_constraints(true);
        walletF.generate_r1cs_constraints(true);
        minerF.generate_r1cs_constraints(true);
        minerS.generate_r1cs_constraints(true);
        validSince.generate_r1cs_constraints(true);
        validUntil.generate_r1cs_constraints(true);
        allOrNone.generate_r1cs_constraints(true);
        padding.generate_r1cs_constraints(true);

        walletSplitPercentage.generate_r1cs_constraints(true);
        waiveFeePercentage.generate_r1cs_constraints(true);

        tokenF.generate_r1cs_constraints(true);

        signatureVerifier.generate_r1cs_constraints();

        validSince_leq_timestamp.generate_r1cs_constraints();
        timestamp_leq_validUntil.generate_r1cs_constraints();

        pb.add_r1cs_constraint(ConstraintT(validSince_leq_timestamp.leq(), timestamp_leq_validUntil.leq(), valid),
                               "validSince_leq_timestamp && timestamp_leq_validUntil = valid");
    }
};

class UpdateTradeHistoryGadget : public GadgetT
{
public:
    typedef merkle_path_authenticator<MiMC_hash_gadget> MerklePathCheckT;
    typedef markle_path_compute<MiMC_hash_gadget> MerklePathT;

    const VariableT merkleRootBefore;

    libsnark::dual_variable_gadget<FieldT> fill;

    MiMC_hash_gadget leafBefore;
    MiMC_hash_gadget leafAfter;

    const VariableArrayT proof;
    MerklePathCheckT proofVerifierBefore;
    MerklePathT rootCalculatorAfter;

    UpdateTradeHistoryGadget(
        ProtoboardT& pb,
        const VariableT& _merkleRoot,
        const VariableArrayT& address,
        const VariableT& filledBefore,
        const VariableT& cancelledBefore,
        const VariableT& filledAfter,
        const VariableT& cancelledAfter,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        merkleRootBefore(_merkleRoot),

        fill(pb, 96, FMT(prefix, ".fill")),

        leafBefore(pb, libsnark::ONE, {filledBefore, cancelledBefore}, FMT(prefix, ".leafBefore")),
        leafAfter(pb, libsnark::ONE, {filledAfter, cancelledAfter}, FMT(prefix, ".leafAfter")),

        proof(make_var_array(pb, TREE_DEPTH_FILLED, FMT(prefix, ".proof"))),
        proofVerifierBefore(pb, TREE_DEPTH_FILLED, address, merkle_tree_IVs(pb), leafBefore.result(), merkleRootBefore, proof, FMT(prefix, ".pathBefore")),
        rootCalculatorAfter(pb, TREE_DEPTH_FILLED, address, merkle_tree_IVs(pb), leafAfter.result(), proof, FMT(prefix, ".pathAfter"))
    {

    }

    const VariableT getNewTradingHistoryMerkleRoot() const
    {
        return rootCalculatorAfter.result();
    }

    void generate_r1cs_witness(const Proof& _proof)
    {
        leafBefore.generate_r1cs_witness();
        leafAfter.generate_r1cs_witness();

        proof.fill_with_field_elements(pb, _proof.data);
        proofVerifierBefore.generate_r1cs_witness();
        rootCalculatorAfter.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        leafBefore.generate_r1cs_constraints();
        leafAfter.generate_r1cs_constraints();

        proofVerifierBefore.generate_r1cs_constraints();
        rootCalculatorAfter.generate_r1cs_constraints();
    }
};

class UpdateAccountGadget : public GadgetT
{
public:
    typedef merkle_path_authenticator<MiMC_hash_gadget> MerklePathCheckT;
    typedef markle_path_compute<MiMC_hash_gadget> MerklePathT;

    const VariableT merkleRootBefore;

    MiMC_hash_gadget leafBefore;
    MiMC_hash_gadget leafAfter;

    const VariableArrayT proof;
    MerklePathCheckT proofVerifierBefore;
    MerklePathT rootCalculatorAfter;

    UpdateAccountGadget(
        ProtoboardT& pb,
        const VariableT& _merkleRoot,
        const VariableArrayT& address,
        const jubjub::VariablePointT& publicKey,
        const VariableT& dex,
        const VariableT& token,
        const VariableT& balanceBefore,
        const VariableT& balanceAfter,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        merkleRootBefore(_merkleRoot),

        leafBefore(pb, libsnark::ONE, {publicKey.x, publicKey.y, token, balanceBefore}, FMT(prefix, ".leafBefore")),
        leafAfter(pb, libsnark::ONE, {publicKey.x, publicKey.y, token, balanceAfter}, FMT(prefix, ".leafAfter")),

        proof(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".proof"))),
        proofVerifierBefore(pb, TREE_DEPTH_ACCOUNTS, address, merkle_tree_IVs(pb), leafBefore.result(), merkleRootBefore, proof, FMT(prefix, ".pathBefore")),
        rootCalculatorAfter(pb, TREE_DEPTH_ACCOUNTS, address, merkle_tree_IVs(pb), leafAfter.result(), proof, FMT(prefix, ".pathAfter"))
    {

    }

    const VariableT result() const
    {
        return rootCalculatorAfter.result();
    }

    void generate_r1cs_witness(const Proof& _proof)
    {
        leafBefore.generate_r1cs_witness();
        leafAfter.generate_r1cs_witness();

        proof.fill_with_field_elements(pb, _proof.data);
        proofVerifierBefore.generate_r1cs_witness();
        rootCalculatorAfter.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        leafBefore.generate_r1cs_constraints();
        leafAfter.generate_r1cs_constraints();

        proofVerifierBefore.generate_r1cs_constraints();
        rootCalculatorAfter.generate_r1cs_constraints();
    }
};

class CheckBurnRateGadget : public GadgetT
{
public:
    typedef merkle_path_authenticator<MiMC_hash_gadget> MerklePathCheckT;

    const VariableArrayT proof;
    MerklePathCheckT proofVerifier;

    CheckBurnRateGadget(
        ProtoboardT& pb,
        const VariableT& merkleRoot,
        const VariableArrayT& address,
        const VariableT& burnRate,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        proof(make_var_array(pb, TREE_DEPTH_TOKENS, FMT(prefix, ".proof"))),
        proofVerifier(pb, TREE_DEPTH_TOKENS, address, merkle_tree_IVs(pb), burnRate, merkleRoot, proof, FMT(prefix, ".path"))
    {

    }

    void generate_r1cs_witness(const Proof& _proof)
    {
        proof.fill_with_field_elements(pb, _proof.data);
        proofVerifier.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        proofVerifier.generate_r1cs_constraints();
    }
};

class MaxFillAmountsGadget : public GadgetT
{
public:
    const OrderGadget& order;

    VariableT remainingS;
    LeqGadget balanceS_lt_remainingS;
    TernaryGadget fillAmountS;
    MulDivGadget fillAmountB;

    MaxFillAmountsGadget(
        ProtoboardT& pb,
        const OrderGadget& _order,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        order(_order),

        remainingS(make_variable(pb, FMT(prefix, ".remainingS"))),
        balanceS_lt_remainingS(pb, order.balanceS, remainingS, FMT(prefix, ".(spendableS < remainingS)")),
        fillAmountS(pb, balanceS_lt_remainingS.lt(), order.balanceS, remainingS, FMT(prefix, "fillAmountS = (balanceS < remainingS) ? balanceS : remainingS")),
        fillAmountB(pb, fillAmountS.result(), order.amountB.packed, order.amountS.packed, FMT(prefix, "(fillAmountS * amountB) / amountS"))
    {

    }

    const VariableT& getAmountS()
    {
        return fillAmountS.result();
    }

    const VariableT& getAmountB()
    {
        return fillAmountB.result();
    }

    void generate_r1cs_witness ()
    {
        pb.val(remainingS) = pb.val(order.amountS.packed) - pb.val(order.filledBefore);
        balanceS_lt_remainingS.generate_r1cs_witness();
        fillAmountS.generate_r1cs_witness();
        fillAmountB.generate_r1cs_witness();
        std::cout << "amountS: " << pb.val(order.amountS.packed).as_ulong() << std::endl;
        std::cout << "filledBefore: " << pb.val(order.filledBefore).as_ulong() << std::endl;
        std::cout << "order.balanceS: " << pb.val(order.balanceS).as_ulong() << std::endl;
        std::cout << "fillAmountS: " << pb.val(fillAmountS.result()).as_ulong() << std::endl;
        std::cout << "fillAmountB: " << pb.val(fillAmountB.result()).as_ulong() << std::endl;
    }

    void generate_r1cs_constraints()
    {
        pb.add_r1cs_constraint(ConstraintT(order.filledBefore + remainingS, 1, order.amountS.packed), "filledBeforeA + remainingS = amountS");
        balanceS_lt_remainingS.generate_r1cs_constraints();
        fillAmountS.generate_r1cs_constraints();
        fillAmountB.generate_r1cs_constraints();
    }
};

class CheckFillsGadget : public GadgetT
{
public:
    const OrderGadget& order;

    VariableT fillAmountS;
    VariableT fillAmountB;

    LeqGadget fillAmountS_leq_amountS;
    VariableT valid;

    CheckFillsGadget(
        ProtoboardT& pb,
        const OrderGadget& _order,
        const VariableT& _fillAmountS,
        const VariableT& _fillAmountB,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        order(_order),
        fillAmountS(_fillAmountS),
        fillAmountB(_fillAmountB),

        fillAmountS_leq_amountS(pb, fillAmountS, order.amountS.packed, FMT(prefix, ".fillAmountS_eq_amountS")),
        valid(make_variable(pb, FMT(prefix, ".valid")))
    {

    }

    const VariableT& isValid()
    {
        return valid;
    }

    void generate_r1cs_witness ()
    {
        fillAmountS_leq_amountS.generate_r1cs_witness();
        pb.val(valid) = FieldT::one() - (pb.val(order.allOrNone.packed) * (pb.val(fillAmountS_leq_amountS.lt())));
    }

    void generate_r1cs_constraints()
    {
        fillAmountS_leq_amountS.generate_r1cs_constraints();
        pb.add_r1cs_constraint(ConstraintT(order.allOrNone.packed, fillAmountS_leq_amountS.lt(), FieldT::one() - valid),
                               "allOrNone * (fillAmountS < amountS) = !valid");
    }
};

class OrderMatchingGadget : public GadgetT
{
public:
    const OrderGadget& orderA;
    const OrderGadget& orderB;

    MaxFillAmountsGadget maxFillAmountA;
    MaxFillAmountsGadget maxFillAmountB;

    LeqGadget fillAmountB_A_lt_fillAmountS_B;

    VariableT fillAmountB_B_T;
    MulDivGadget fillAmountS_B_T;

    VariableT fillAmountB_A_F;
    MulDivGadget fillAmountS_A_F;

    TernaryGadget fillAmountS_A;
    TernaryGadget fillAmountB_A;
    TernaryGadget fillAmountS_B;
    TernaryGadget fillAmountB_B;

    VariableT margin;

    MulDivGadget fillAmountF_A;
    MulDivGadget fillAmountF_B;

    LeqGadget fillAmountS_A_lt_fillAmountB_B;

    CheckFillsGadget checkFillsA;
    CheckFillsGadget checkFillsB;

    VariableT fillsValid;
    VariableT valid;

    OrderMatchingGadget(
        ProtoboardT& pb,
        const OrderGadget& _orderA,
        const OrderGadget& _orderB,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        orderA(_orderA),
        orderB(_orderB),

        maxFillAmountA(pb, orderA, FMT(prefix, ".maxFillAmountA")),
        maxFillAmountB(pb, orderB, FMT(prefix, ".maxFillAmountB")),

        fillAmountB_A_lt_fillAmountS_B(pb, maxFillAmountA.getAmountB(), maxFillAmountB.getAmountS(),
                                       FMT(prefix, "fillAmountB_A < fillAmountS_B")),

        fillAmountB_B_T(maxFillAmountA.getAmountS()),
        fillAmountS_B_T(pb, fillAmountB_B_T, orderB.amountS.packed, orderB.amountB.packed,
                        FMT(prefix, "fillAmountS_B = (fillAmountB_B * orderB.amountS) // orderB.amountB")),

        fillAmountB_A_F(maxFillAmountB.getAmountS()),
        fillAmountS_A_F(pb, fillAmountB_A_F, orderA.amountS.packed, orderA.amountB.packed,
                        FMT(prefix, "fillAmountS_A = (fillAmountB_A * orderA.amountS) // orderA.amountB")),

        fillAmountS_A(pb, fillAmountB_A_lt_fillAmountS_B.lt(), maxFillAmountA.getAmountS(), fillAmountS_A_F.result(), FMT(prefix, "fillAmountS_A")),
        fillAmountB_A(pb, fillAmountB_A_lt_fillAmountS_B.lt(), maxFillAmountA.getAmountB(), fillAmountB_A_F, FMT(prefix, "fillAmountB_A")),
        fillAmountS_B(pb, fillAmountB_A_lt_fillAmountS_B.lt(), fillAmountS_B_T.result(), maxFillAmountB.getAmountS(), FMT(prefix, "fillAmountS_B")),
        fillAmountB_B(pb, fillAmountB_A_lt_fillAmountS_B.lt(), fillAmountB_B_T, maxFillAmountB.getAmountB(), FMT(prefix, "fillAmountB_B")),

        margin(make_variable(pb, FMT(prefix, ".margin"))),

        fillAmountF_A(pb, orderA.amountF.packed, fillAmountS_A.result(), orderA.amountS.packed,
                      FMT(prefix, "fillAmountF_A = (orderA.amountF * fillAmountS_A) // orderA.amountS")),
        fillAmountF_B(pb, orderB.amountF.packed, fillAmountS_B.result(), orderB.amountS.packed,
                      FMT(prefix, "fillAmountF_B = (orderB.amountF * fillAmountS_B) // orderB.amountS")),

        fillAmountS_A_lt_fillAmountB_B(pb, fillAmountS_A.result(), fillAmountB_B.result(),
                                       FMT(prefix, "fillAmountS_A < fillAmountB_B")),

        checkFillsA(pb, orderA, fillAmountS_A.result(), fillAmountB_A.result(), FMT(prefix, ".checkFillA")),
        checkFillsB(pb, orderB, fillAmountS_B.result(), fillAmountB_B.result(), FMT(prefix, ".checkFillB")),

        fillsValid(make_variable(pb, FMT(prefix, ".fillsValid"))),
        valid(make_variable(pb, FMT(prefix, ".valid")))
    {

    }

    const VariableT& getFillAmountS_A() const
    {
        return fillAmountS_A.result();
    }

    const VariableT& getFillAmountB_A() const
    {
        return fillAmountB_A.result();
    }

    const VariableT& getFillAmountF_A() const
    {
        return fillAmountF_A.result();
    }

    const VariableT& getFillAmountS_B() const
    {
        return fillAmountS_B.result();
    }

    const VariableT& getFillAmountB_B() const
    {
        return fillAmountB_B.result();
    }

    const VariableT& getFillAmountF_B() const
    {
        return fillAmountF_B.result();
    }

    const VariableT& getMargin() const
    {
        return margin;
    }

    const VariableT& isValid() const
    {
        return valid;
    }

    void generate_r1cs_witness()
    {
        maxFillAmountA.generate_r1cs_witness();
        maxFillAmountB.generate_r1cs_witness();

        fillAmountB_A_lt_fillAmountS_B.generate_r1cs_witness();

        fillAmountS_B_T.generate_r1cs_witness();
        fillAmountS_A_F.generate_r1cs_witness();

        fillAmountS_A.generate_r1cs_witness();
        fillAmountB_A.generate_r1cs_witness();
        fillAmountS_B.generate_r1cs_witness();
        fillAmountB_B.generate_r1cs_witness();

        pb.val(margin) = pb.val(fillAmountS_A.result()) - pb.val(fillAmountB_B.result());

        fillAmountF_A.generate_r1cs_witness();
        fillAmountF_B.generate_r1cs_witness();

        fillAmountS_A_lt_fillAmountB_B.generate_r1cs_witness();

        checkFillsA.generate_r1cs_witness();
        checkFillsB.generate_r1cs_witness();

        pb.val(fillsValid) = pb.val(checkFillsA.isValid()) * pb.val(checkFillsB.isValid());
        pb.val(valid) = pb.val(fillsValid) * (FieldT::one() - pb.val(fillAmountS_A_lt_fillAmountB_B.lt()));

        std::cout << "margin: " << pb.val(margin).as_ulong() << std::endl;
    }

    void generate_r1cs_constraints()
    {
        // Check if tokenS/tokenB match
        pb.add_r1cs_constraint(ConstraintT(orderA.tokenS, 1, orderB.tokenB), "orderA.tokenS == orderB.tokenB");
        pb.add_r1cs_constraint(ConstraintT(orderA.tokenB, 1, orderB.tokenS), "orderA.tokenB == orderB.tokenS");

        maxFillAmountA.generate_r1cs_constraints();
        maxFillAmountB.generate_r1cs_constraints();

        fillAmountB_A_lt_fillAmountS_B.generate_r1cs_constraints();

        fillAmountS_B_T.generate_r1cs_constraints();
        fillAmountS_A_F.generate_r1cs_constraints();

        fillAmountS_A.generate_r1cs_constraints();
        fillAmountB_A.generate_r1cs_constraints();
        fillAmountS_B.generate_r1cs_constraints();
        fillAmountB_B.generate_r1cs_constraints();

        pb.add_r1cs_constraint(ConstraintT(fillAmountB_B.result() + margin, 1, fillAmountS_A.result()), "fillAmountB_B + margin = fillAmountS_A");

        fillAmountF_A.generate_r1cs_constraints();
        fillAmountF_B.generate_r1cs_constraints();

        fillAmountS_A_lt_fillAmountB_B.generate_r1cs_constraints();

        checkFillsA.generate_r1cs_constraints();
        checkFillsB.generate_r1cs_constraints();

        pb.add_r1cs_constraint(ConstraintT(checkFillsA.isValid(), checkFillsB.isValid(), fillsValid), "checkFillsA.isValid() * checkFillsB.isValid() = fillsValid");
        pb.add_r1cs_constraint(ConstraintT(1 - fillAmountS_A_lt_fillAmountB_B.lt(), fillsValid, valid), "fillAmountS_A_lt_fillAmountB_B * fillsValid = valid");
    }
};


class RingSettlementGadget : public GadgetT
{
public:
    const VariableT tradingHistoryMerkleRoot;
    const VariableT accountsMerkleRoot;

    VariableT constant0;

    const jubjub::VariablePointT publicKey;
    libsnark::dual_variable_gadget<FieldT> nonce;

    OrderGadget orderA;
    OrderGadget orderB;

    OrderMatchingGadget orderMatching;

    VariableT ordersValid;
    VariableT valid;

    VariableArrayT orderIDPadding;

    libsnark::dual_variable_gadget<FieldT> fillS_A;
    libsnark::dual_variable_gadget<FieldT> fillB_A;
    libsnark::dual_variable_gadget<FieldT> fillF_A;
    libsnark::dual_variable_gadget<FieldT> fillS_B;
    libsnark::dual_variable_gadget<FieldT> fillB_B;
    libsnark::dual_variable_gadget<FieldT> fillF_B;
    libsnark::dual_variable_gadget<FieldT> margin;
    libsnark::dual_variable_gadget<FieldT> miner;
    libsnark::dual_variable_gadget<FieldT> fee;

    VariableT filledAfterA;
    VariableT filledAfterB;

    VariableT burnRateF_A;
    VariableT burnRateF_B;

    CheckBurnRateGadget checkBurnRateF_A;
    CheckBurnRateGadget checkBurnRateF_B;

    FeePaymentCalculator feePaymentA;
    FeePaymentCalculator feePaymentB;

    VariableT balanceS_A_before;
    VariableT balanceB_A_before;
    VariableT balanceF_A_before;
    VariableT balanceF_WA_before;
    VariableT balanceF_MA_before;
    VariableT balanceF_BA_before;
    VariableT balanceS_B_before;
    VariableT balanceB_B_before;
    VariableT balanceF_B_before;
    VariableT balanceF_WB_before;
    VariableT balanceF_MB_before;
    VariableT balanceF_BB_before;
    VariableT balanceS_M_before;
    VariableT balance_M_before;

    subadd_gadget balanceSB_A;
    subadd_gadget balanceSB_B;
    subadd_gadget balanceF_WA;
    subadd_gadget balanceF_MA;
    subadd_gadget balanceF_BA;
    subadd_gadget balanceF_WB;
    subadd_gadget balanceF_MB;
    subadd_gadget balanceF_BB;
    subadd_gadget balanceS_MA;
    subadd_gadget balance_M;

    UpdateTradeHistoryGadget updateTradeHistoryA;
    UpdateTradeHistoryGadget updateTradeHistoryB;

    UpdateAccountGadget updateAccountS_A;
    UpdateAccountGadget updateAccountB_A;
    UpdateAccountGadget updateAccountF_A;
    UpdateAccountGadget updateAccountF_WA;
    UpdateAccountGadget updateAccountF_MA;
    UpdateAccountGadget updateAccountF_BA;
    UpdateAccountGadget updateAccountS_B;
    UpdateAccountGadget updateAccountB_B;
    UpdateAccountGadget updateAccountF_B;
    UpdateAccountGadget updateAccountF_WB;
    UpdateAccountGadget updateAccountF_MB;
    UpdateAccountGadget updateAccountF_BB;

    UpdateAccountGadget updateAccountS_M;

    UpdateAccountGadget updateAccount_M;

    ForceLeqGadget filledLeqA;
    ForceLeqGadget filledLeqB;

    const VariableArrayT ringMessage;
    SignatureVerifier minerSignatureVerifier;
    SignatureVerifier walletASignatureVerifier;
    SignatureVerifier walletBSignatureVerifier;

    RingSettlementGadget(
        ProtoboardT& pb,
        const jubjub::Params& params,
        const VariableT& _tradingHistoryMerkleRoot,
        const VariableT& _accountsMerkleRoot,
        const VariableT& _burnRateMerkleRoot,
        const VariableT& _timestamp,
        const VariableT& _operatorBalance,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        constant0(make_variable(pb, 0, FMT(prefix, ".constant0"))),

        publicKey(pb, FMT(prefix, ".publicKey")),
        nonce(pb, 32, FMT(prefix, ".nonce")),

        orderA(pb, params, _timestamp, FMT(prefix, ".orderA")),
        orderB(pb, params, _timestamp, FMT(prefix, ".orderB")),

        orderMatching(pb, orderA, orderB, FMT(prefix, ".orderMatching")),

        ordersValid(make_variable(pb, FMT(prefix, ".ordersValid"))),
        valid(make_variable(pb, FMT(prefix, ".valid"))),

        orderIDPadding(make_var_array(pb, 12, FMT(prefix, ".orderIDPadding"))),

        fillS_A(pb, 96, FMT(prefix, ".fillS_A")),
        fillB_A(pb, 96, FMT(prefix, ".fillB_A")),
        fillF_A(pb, 96, FMT(prefix, ".fillF_A")),
        fillS_B(pb, 96, FMT(prefix, ".fillS_B")),
        fillB_B(pb, 96, FMT(prefix, ".fillB_B")),
        fillF_B(pb, 96, FMT(prefix, ".fillF_B")),
        margin(pb, 96, FMT(prefix, ".margin")),
        miner(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".miner")),
        fee(pb, 16, FMT(prefix, ".fee")),

        filledAfterA(make_variable(pb, FMT(prefix, ".filledAfterA"))),
        filledAfterB(make_variable(pb, FMT(prefix, ".filledAfterB"))),

        burnRateF_A(make_variable(pb, FMT(prefix, ".burnRateF_A"))),
        burnRateF_B(make_variable(pb, FMT(prefix, ".burnRateF_B"))),

        checkBurnRateF_A(pb, _burnRateMerkleRoot, orderA.tokenF.bits, burnRateF_A, FMT(prefix, ".checkBurnRateF_A")),
        checkBurnRateF_B(pb, _burnRateMerkleRoot, orderB.tokenF.bits, burnRateF_B, FMT(prefix, ".checkBurnRateF_B")),

        feePaymentA(pb, fillF_A.packed, burnRateF_A, orderA.walletSplitPercentage.packed, orderA.waiveFeePercentage.packed, FMT(prefix, "feePaymentA")),
        feePaymentB(pb, fillF_B.packed, burnRateF_B, orderB.walletSplitPercentage.packed, orderB.waiveFeePercentage.packed, FMT(prefix, "feePaymentB")),

        balanceS_A_before(make_variable(pb, FMT(prefix, ".balanceS_A_before"))),
        balanceB_A_before(make_variable(pb, FMT(prefix, ".balanceB_A_before"))),
        balanceF_A_before(make_variable(pb, FMT(prefix, ".balanceF_A_before"))),
        balanceF_WA_before(make_variable(pb, FMT(prefix, ".balanceF_WA_before"))),
        balanceF_MA_before(make_variable(pb, FMT(prefix, ".balanceF_MA_before"))),
        balanceF_BA_before(make_variable(pb, FMT(prefix, ".balanceF_BA_before"))),
        balanceS_B_before(make_variable(pb, FMT(prefix, ".balanceS_B_before"))),
        balanceB_B_before(make_variable(pb, FMT(prefix, ".balanceB_B_before"))),
        balanceF_B_before(make_variable(pb, FMT(prefix, ".balanceF_B_before"))),
        balanceF_WB_before(make_variable(pb, FMT(prefix, ".balanceF_WB_before"))),
        balanceF_MB_before(make_variable(pb, FMT(prefix, ".balanceF_MB_before"))),
        balanceF_BB_before(make_variable(pb, FMT(prefix, ".balanceF_BB_before"))),
        balanceS_M_before(make_variable(pb, FMT(prefix, ".balanceS_M_before"))),
        balance_M_before(make_variable(pb, FMT(prefix, ".balance_M_before"))),

        // fillB_B == fillS_A - margin
        balanceSB_A(pb, 96, balanceS_A_before, balanceB_B_before, fillB_B.packed, FMT(prefix, ".balanceSB_A")),
        balanceSB_B(pb, 96, balanceS_B_before, balanceB_A_before, fillS_B.packed, FMT(prefix, ".balanceSB_B")),

        balanceF_WA(pb, 96, balanceF_A_before, balanceF_WA_before, feePaymentA.getWalletFee(), FMT(prefix, ".balanceF_WA")),
        balanceF_MA(pb, 96, balanceF_WA.X, balanceF_MA_before, feePaymentA.getMatchingFee(), FMT(prefix, ".balanceF_MA")),
        balanceF_BA(pb, 96, balanceF_MA.X, balanceF_BA_before, feePaymentA.getBurnFee(), FMT(prefix, ".balanceF_BA")),

        balanceF_WB(pb, 96, balanceF_B_before, balanceF_WB_before, feePaymentB.getWalletFee(), FMT(prefix, ".balanceF_WB")),
        balanceF_MB(pb, 96, balanceF_WB.X, balanceF_MB_before, feePaymentB.getMatchingFee(), FMT(prefix, ".balanceF_MB")),
        balanceF_BB(pb, 96, balanceF_MB.X, balanceF_BB_before, feePaymentB.getBurnFee(), FMT(prefix, ".balanceF_BB")),

        balanceS_MA(pb, 96, balanceSB_A.X, balanceS_M_before, margin.packed, FMT(prefix, ".balanceS_MA")),

        balance_M(pb, 96, balance_M_before, _operatorBalance, fee.packed, FMT(prefix, ".balance_M")),

        tradingHistoryMerkleRoot(_tradingHistoryMerkleRoot),
        updateTradeHistoryA(pb, tradingHistoryMerkleRoot, flatten({orderA.orderID.bits, orderA.accountS.bits}),
                            orderA.filledBefore, orderA.cancelled, filledAfterA, orderA.cancelled, FMT(prefix, ".updateTradeHistoryA")),
        updateTradeHistoryB(pb, updateTradeHistoryA.getNewTradingHistoryMerkleRoot(), flatten({orderB.orderID.bits, orderB.accountS.bits}),
                            orderB.filledBefore, orderB.cancelled, filledAfterB, orderB.cancelled, FMT(prefix, ".updateTradeHistoryB")),

        accountsMerkleRoot(_accountsMerkleRoot),
        updateAccountS_A(pb, accountsMerkleRoot, orderA.accountS.bits, orderA.publicKey, orderA.dexID.packed, orderA.tokenS, balanceS_A_before, balanceS_MA.X, FMT(prefix, ".updateAccountS_A")),
        updateAccountB_A(pb, updateAccountS_A.result(), orderA.accountB.bits, orderA.publicKey, orderA.dexID.packed, orderA.tokenB, balanceB_A_before, balanceSB_B.Y, FMT(prefix, ".updateAccountB_A")),
        updateAccountF_A(pb, updateAccountB_A.result(), orderA.accountF.bits, orderA.publicKey, orderA.dexID.packed, orderA.tokenF.packed, balanceF_A_before, balanceF_BA.X, FMT(prefix, ".updateAccountF_A")),
        updateAccountF_WA(pb, updateAccountF_A.result(), orderA.walletF.bits, orderA.walletPublicKey, orderA.dexID.packed, orderA.tokenF.packed, balanceF_WA_before, balanceF_WA.Y, FMT(prefix, ".updateAccountF_WA")),
        updateAccountF_MA(pb, updateAccountF_WA.result(), orderA.minerF.bits, orderA.minerPublicKeyF, orderA.dexID.packed, orderA.tokenF.packed, balanceF_MA_before, balanceF_MA.Y, FMT(prefix, ".updateAccountF_MA")),
        updateAccountF_BA(pb, updateAccountF_MA.result(), orderA.walletF.bits, orderA.walletPublicKey, orderA.dexID.packed, orderA.tokenF.packed, balanceF_BA_before, balanceF_BA.Y, FMT(prefix, ".updateAccountF_BA")),

        updateAccountS_B(pb, updateAccountF_BA.result(), orderB.accountS.bits, orderB.publicKey, orderB.dexID.packed, orderB.tokenS, balanceS_B_before, balanceSB_B.X, FMT(prefix, ".updateAccountS_B")),
        updateAccountB_B(pb, updateAccountS_B.result(), orderB.accountB.bits, orderB.publicKey, orderB.dexID.packed, orderB.tokenB, balanceB_B_before, balanceSB_A.Y, FMT(prefix, ".updateAccountB_B")),
        updateAccountF_B(pb, updateAccountB_B.result(), orderB.accountF.bits, orderB.publicKey, orderB.dexID.packed, orderB.tokenF.packed, balanceF_B_before, balanceF_BB.X, FMT(prefix, ".updateAccountF_B")),
        updateAccountF_WB(pb, updateAccountF_B.result(), orderB.walletF.bits, orderB.walletPublicKey, orderB.dexID.packed, orderB.tokenF.packed, balanceF_WB_before, balanceF_WB.Y, FMT(prefix, ".updateAccountF_WB")),
        updateAccountF_MB(pb, updateAccountF_WB.result(), orderB.minerF.bits, orderB.minerPublicKeyF, orderB.dexID.packed, orderB.tokenF.packed, balanceF_MB_before, balanceF_MB.Y, FMT(prefix, ".updateAccountF_MB")),
        updateAccountF_BB(pb, updateAccountF_MB.result(), orderB.walletF.bits, orderB.walletPublicKey, orderB.dexID.packed, orderB.tokenF.packed, balanceF_BB_before, balanceF_BB.Y, FMT(prefix, ".updateAccountF_BB")),

        updateAccountS_M(pb, updateAccountF_BB.result(), orderA.minerS.bits, orderA.minerPublicKeyS, constant0, orderA.tokenS, balanceS_M_before, balanceS_MA.Y, FMT(prefix, ".updateAccountS_M")),

        updateAccount_M(pb, updateAccountS_M.result(), miner.bits, publicKey, constant0, constant0, balance_M_before, balance_M.X, FMT(prefix, ".updateAccount_M")),

        filledLeqA(pb, filledAfterA, orderA.amountS.packed, FMT(prefix, ".filled_A <= .amountSA")),
        filledLeqB(pb, filledAfterB, orderB.amountS.packed, FMT(prefix, ".filled_B <= .amountSB")),

        ringMessage(flatten({orderA.getHash(), orderB.getHash(),
                             orderA.waiveFeePercentage.bits, orderB.waiveFeePercentage.bits,
                             orderA.minerF.bits, orderB.minerF.bits,
                             orderA.minerS.bits,
                             nonce.bits})),
        minerSignatureVerifier(pb, params, publicKey, ringMessage, FMT(prefix, ".minerSignatureVerifier")),
        walletASignatureVerifier(pb, params, orderA.walletPublicKey, ringMessage, FMT(prefix, ".walletASignatureVerifier")),
        walletBSignatureVerifier(pb, params, orderB.walletPublicKey, ringMessage, FMT(prefix, ".walletASignatureVerifier"))
    {

    }

    const VariableT getNewTradingHistoryMerkleRoot() const
    {
        return updateTradeHistoryB.getNewTradingHistoryMerkleRoot();
    }

    const VariableT getNewAccountsMerkleRoot() const
    {
        return updateAccount_M.result();
    }

    const VariableT& getOperatorBalance() const
    {
        return balance_M.Y;
    }

    const std::vector<VariableArrayT> getPublicData() const
    {
        return {orderA.dexID.bits, orderIDPadding, orderA.orderID.bits,
                orderA.accountS.bits, orderB.accountB.bits, fillS_A.bits,
                orderA.accountF.bits, fillF_A.bits,

                orderB.dexID.bits, orderIDPadding, orderB.orderID.bits,
                orderB.accountS.bits, orderA.accountB.bits, fillS_B.bits,
                orderB.accountF.bits, fillF_B.bits};
    }

    void generate_r1cs_witness (const RingSettlement& ringSettlement)
    {
        pb.val(publicKey.x) = ringSettlement.ring.publicKey.x;
        pb.val(publicKey.y) = ringSettlement.ring.publicKey.y;

        nonce.bits.fill_with_bits_of_field_element(pb, 0);
        nonce.generate_r1cs_witness_from_bits();


        orderA.generate_r1cs_witness(ringSettlement.ring.orderA);
        orderB.generate_r1cs_witness(ringSettlement.ring.orderB);

        orderMatching.generate_r1cs_witness();

        pb.val(ordersValid) = pb.val(orderA.isValid()) * pb.val(orderB.isValid());
        pb.val(valid) = ringSettlement.ring.valid;

        orderIDPadding.fill_with_bits_of_ulong(pb, 0);

        fillS_A.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.fillS_A);
        fillS_A.generate_r1cs_witness_from_bits();
        fillB_A.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.fillB_A);
        fillB_A.generate_r1cs_witness_from_bits();
        fillF_A.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.fillF_A);
        fillF_A.generate_r1cs_witness_from_bits();
        fillS_B.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.fillS_B);
        fillS_B.generate_r1cs_witness_from_bits();
        fillB_B.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.fillB_B);
        fillB_B.generate_r1cs_witness_from_bits();
        fillF_B.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.fillF_B);
        fillF_B.generate_r1cs_witness_from_bits();
        margin.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.margin);
        margin.generate_r1cs_witness_from_bits();
        miner.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.miner);
        miner.generate_r1cs_witness_from_bits();
        fee.bits.fill_with_bits_of_field_element(pb, ringSettlement.ring.fee);
        fee.generate_r1cs_witness_from_bits();

        pb.val(filledAfterA) = pb.val(orderA.filledBefore) + pb.val(fillS_A.packed);
        pb.val(filledAfterB) = pb.val(orderB.filledBefore) + pb.val(fillS_B.packed);

        pb.val(burnRateF_A) = ringSettlement.burnRateCheckF_A.burnRateData.burnRate;
        pb.val(burnRateF_B) = ringSettlement.burnRateCheckF_B.burnRateData.burnRate;
        checkBurnRateF_A.generate_r1cs_witness(ringSettlement.burnRateCheckF_A.proof);
        checkBurnRateF_B.generate_r1cs_witness(ringSettlement.burnRateCheckF_B.proof);

        feePaymentA.generate_r1cs_witness();
        feePaymentB.generate_r1cs_witness();

        pb.val(balanceS_A_before) = ringSettlement.accountUpdateS_A.before.balance;
        pb.val(balanceB_A_before) = ringSettlement.accountUpdateB_A.before.balance;
        pb.val(balanceF_A_before) = ringSettlement.accountUpdateF_A.before.balance;
        pb.val(balanceF_WA_before) = ringSettlement.accountUpdateF_WA.before.balance;
        pb.val(balanceF_MA_before) = ringSettlement.accountUpdateF_MA.before.balance;
        pb.val(balanceF_BA_before) = ringSettlement.accountUpdateF_BA.before.balance;
        pb.val(balanceS_B_before) = ringSettlement.accountUpdateS_B.before.balance;
        pb.val(balanceB_B_before) = ringSettlement.accountUpdateB_B.before.balance;
        pb.val(balanceF_B_before) = ringSettlement.accountUpdateF_B.before.balance;
        pb.val(balanceF_WB_before) = ringSettlement.accountUpdateF_WB.before.balance;
        pb.val(balanceF_MB_before) = ringSettlement.accountUpdateF_MB.before.balance;
        pb.val(balanceF_BB_before) = ringSettlement.accountUpdateF_BB.before.balance;
        pb.val(balanceS_M_before) = ringSettlement.accountUpdateS_M.before.balance;
        pb.val(balance_M_before) = ringSettlement.accountUpdate_M.before.balance;

        balanceSB_A.generate_r1cs_witness();
        balanceSB_B.generate_r1cs_witness();
        balanceF_WA.generate_r1cs_witness();
        balanceF_MA.generate_r1cs_witness();
        balanceF_BA.generate_r1cs_witness();
        balanceF_WB.generate_r1cs_witness();
        balanceF_MB.generate_r1cs_witness();
        balanceF_BB.generate_r1cs_witness();
        balanceS_MA.generate_r1cs_witness();
        balance_M.generate_r1cs_witness();

        //
        // Update trading history
        //

        pb.val(tradingHistoryMerkleRoot) = ringSettlement.tradingHistoryMerkleRoot;
        updateTradeHistoryA.generate_r1cs_witness(ringSettlement.tradeHistoryUpdate_A.proof);
        updateTradeHistoryB.generate_r1cs_witness(ringSettlement.tradeHistoryUpdate_B.proof);

        filledLeqA.generate_r1cs_witness();
        filledLeqB.generate_r1cs_witness();

        //
        // Update accounts
        //

        updateAccountS_A.generate_r1cs_witness(ringSettlement.accountUpdateS_A.proof);
        updateAccountB_A.generate_r1cs_witness(ringSettlement.accountUpdateB_A.proof);
        updateAccountF_A.generate_r1cs_witness(ringSettlement.accountUpdateF_A.proof);
        updateAccountF_WA.generate_r1cs_witness(ringSettlement.accountUpdateF_WA.proof);
        updateAccountF_MA.generate_r1cs_witness(ringSettlement.accountUpdateF_MA.proof);
        updateAccountF_BA.generate_r1cs_witness(ringSettlement.accountUpdateF_BA.proof);
        updateAccountS_B.generate_r1cs_witness(ringSettlement.accountUpdateS_B.proof);
        updateAccountB_B.generate_r1cs_witness(ringSettlement.accountUpdateB_B.proof);
        updateAccountF_B.generate_r1cs_witness(ringSettlement.accountUpdateF_B.proof);
        updateAccountF_WB.generate_r1cs_witness(ringSettlement.accountUpdateF_WB.proof);
        updateAccountF_MB.generate_r1cs_witness(ringSettlement.accountUpdateF_MB.proof);
        updateAccountF_BB.generate_r1cs_witness(ringSettlement.accountUpdateF_BB.proof);
        updateAccountS_M.generate_r1cs_witness(ringSettlement.accountUpdateS_M.proof);
        updateAccount_M.generate_r1cs_witness(ringSettlement.accountUpdate_M.proof);

        minerSignatureVerifier.generate_r1cs_witness(ringSettlement.ring.minerSignature);
        walletASignatureVerifier.generate_r1cs_witness(ringSettlement.ring.walletASignature);
        walletBSignatureVerifier.generate_r1cs_witness(ringSettlement.ring.walletBSignature);
    }


    void generate_r1cs_constraints()
    {
        nonce.generate_r1cs_constraints(true);

        orderA.generate_r1cs_constraints();
        orderB.generate_r1cs_constraints();

        orderMatching.generate_r1cs_constraints();

        pb.add_r1cs_constraint(ConstraintT(orderA.isValid(), orderB.isValid(), ordersValid), "orderA.isValid() && orderA.isValid() == ordersValid");
        pb.add_r1cs_constraint(ConstraintT(ordersValid, orderMatching.isValid(), valid), "ordersValid && orderMatching.isValid() == valid");

        pb.add_r1cs_constraint(ConstraintT(orderMatching.getFillAmountS_A(), valid, fillS_A.packed), "FillAmountS_A == fillS_A");
        pb.add_r1cs_constraint(ConstraintT(orderMatching.getFillAmountB_A(), valid, fillB_A.packed), "FillAmountB_A == fillB_A");
        pb.add_r1cs_constraint(ConstraintT(orderMatching.getFillAmountF_A(), valid, fillF_A.packed), "FillAmountF_A == fillF_A");
        pb.add_r1cs_constraint(ConstraintT(orderMatching.getFillAmountS_B(), valid, fillS_B.packed), "FillAmountS_B == fillS_B");
        pb.add_r1cs_constraint(ConstraintT(orderMatching.getFillAmountB_B(), valid, fillB_B.packed), "FillAmountB_B == fillB_B");
        pb.add_r1cs_constraint(ConstraintT(orderMatching.getFillAmountF_B(), valid, fillF_B.packed), "FillAmountF_B == fillF_B");
        pb.add_r1cs_constraint(ConstraintT(orderMatching.getMargin(), valid, margin.packed), "Margin == margin");

        fillS_A.generate_r1cs_constraints(true);
        fillB_A.generate_r1cs_constraints(true);
        fillF_A.generate_r1cs_constraints(true);
        fillS_B.generate_r1cs_constraints(true);
        fillB_B.generate_r1cs_constraints(true);
        fillF_B.generate_r1cs_constraints(true);
        miner.generate_r1cs_constraints(true);
        fee.generate_r1cs_constraints(true);
        margin.generate_r1cs_constraints(true);

        pb.add_r1cs_constraint(ConstraintT(orderA.filledBefore + fillS_A.packed, 1, filledAfterA), "filledBeforeA + fillA = filledAfterA");
        pb.add_r1cs_constraint(ConstraintT(orderB.filledBefore + fillS_B.packed, 1, filledAfterB), "filledBeforeB + fillB = filledAfterB");

        checkBurnRateF_A.generate_r1cs_constraints();
        checkBurnRateF_B.generate_r1cs_constraints();

        balanceSB_A.generate_r1cs_constraints();
        balanceSB_B.generate_r1cs_constraints();
        balanceF_WA.generate_r1cs_constraints();
        balanceF_MA.generate_r1cs_constraints();
        balanceF_BA.generate_r1cs_constraints();
        balanceF_WB.generate_r1cs_constraints();
        balanceF_MB.generate_r1cs_constraints();
        balanceF_BB.generate_r1cs_constraints();
        balanceS_MA.generate_r1cs_constraints();
        balance_M.generate_r1cs_constraints();

        //
        // Check burnrate
        //

        feePaymentA.generate_r1cs_witness();
        feePaymentB.generate_r1cs_witness();

        //
        // Update trading history
        //

        updateTradeHistoryA.generate_r1cs_constraints();
        updateTradeHistoryB.generate_r1cs_constraints();

        filledLeqA.generate_r1cs_constraints();
        filledLeqB.generate_r1cs_constraints();

        //
        // Update accounts
        //

        updateAccountS_A.generate_r1cs_constraints();
        updateAccountB_A.generate_r1cs_constraints();
        updateAccountF_A.generate_r1cs_constraints();
        updateAccountF_WA.generate_r1cs_constraints();
        updateAccountF_MA.generate_r1cs_constraints();
        updateAccountF_BA.generate_r1cs_constraints();
        updateAccountS_B.generate_r1cs_constraints();
        updateAccountB_B.generate_r1cs_constraints();
        updateAccountF_B.generate_r1cs_constraints();
        updateAccountF_WB.generate_r1cs_constraints();
        updateAccountF_MB.generate_r1cs_constraints();
        updateAccountF_BB.generate_r1cs_constraints();
        updateAccountS_M.generate_r1cs_constraints();
        updateAccount_M.generate_r1cs_constraints();

        //
        // Signatures
        //

        minerSignatureVerifier.generate_r1cs_constraints();
        walletASignatureVerifier.generate_r1cs_constraints();
        walletBSignatureVerifier.generate_r1cs_constraints();
    }
};

class TradeCircuitGadget : public GadgetT
{
public:

    unsigned int numRings;
    jubjub::Params params;
    std::vector<RingSettlementGadget> ringSettlements;

    libsnark::dual_variable_gadget<FieldT> publicDataHash;
    libsnark::dual_variable_gadget<FieldT> tradingHistoryMerkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> tradingHistoryMerkleRootAfter;
    libsnark::dual_variable_gadget<FieldT> accountsMerkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> accountsMerkleRootAfter;
    libsnark::dual_variable_gadget<FieldT> burnRateMerkleRoot;
    libsnark::dual_variable_gadget<FieldT> timestamp;

    std::vector<VariableArrayT> publicDataBits;
    VariableArrayT publicData;

    sha256_many* publicDataHasher;

    VariableT constant0;

    const jubjub::VariablePointT publicKey;
    libsnark::dual_variable_gadget<FieldT> operatorID;
    VariableT balance_O_before;
    UpdateAccountGadget* updateAccount_O;

    TradeCircuitGadget(ProtoboardT& pb, const std::string& prefix) :
        GadgetT(pb, prefix),

        publicDataHash(pb, 256, FMT(prefix, ".publicDataHash")),

        tradingHistoryMerkleRootBefore(pb, 256, FMT(prefix, ".tradingHistoryMerkleRootBefore")),
        tradingHistoryMerkleRootAfter(pb, 256, FMT(prefix, ".tradingHistoryMerkleRootAfter")),
        accountsMerkleRootBefore(pb, 256, FMT(prefix, ".accountsMerkleRootBefore")),
        accountsMerkleRootAfter(pb, 256, FMT(prefix, ".accountsMerkleRootAfter")),
        burnRateMerkleRoot(pb, 256, FMT(prefix, ".burnRateMerkleRoot")),
        constant0(make_variable(pb, 0, FMT(prefix, ".constant0"))),
        publicKey(pb, FMT(prefix, ".publicKey")),
        operatorID(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".operator")),
        balance_O_before(make_variable(pb, FMT(prefix, ".balance_O_before"))),
        timestamp(pb, 32, FMT(prefix, ".timestamp"))
    {
        this->publicDataHasher = nullptr;
        this->updateAccount_O = nullptr;
    }

    ~TradeCircuitGadget()
    {
        if (publicDataHasher)
        {
            delete publicDataHasher;
        }

        if (updateAccount_O)
        {
            delete updateAccount_O;
        }
    }

    void generate_r1cs_constraints(int numRings)
    {
        this->numRings = numRings;

        pb.set_input_sizes(1);

        tradingHistoryMerkleRootBefore.generate_r1cs_constraints(true);
        tradingHistoryMerkleRootAfter.generate_r1cs_constraints(true);
        accountsMerkleRootBefore.generate_r1cs_constraints(true);
        accountsMerkleRootAfter.generate_r1cs_constraints(true);
        burnRateMerkleRoot.generate_r1cs_constraints(true);
        timestamp.generate_r1cs_constraints(true);

        publicDataBits.push_back(accountsMerkleRootBefore.bits);
        publicDataBits.push_back(accountsMerkleRootAfter.bits);
        publicDataBits.push_back(tradingHistoryMerkleRootBefore.bits);
        publicDataBits.push_back(tradingHistoryMerkleRootAfter.bits);
        publicDataBits.push_back(burnRateMerkleRoot.bits);
        publicDataBits.push_back(timestamp.bits);
        for (size_t j = 0; j < numRings; j++)
        {
            const VariableT ringTradingHistoryMerkleRoot = (j == 0) ? tradingHistoryMerkleRootBefore.packed : ringSettlements.back().getNewTradingHistoryMerkleRoot();
            const VariableT ringAccountsMerkleRoot = (j == 0) ? accountsMerkleRootBefore.packed : ringSettlements.back().getNewTradingHistoryMerkleRoot();
            const VariableT& ringOperatorBalance = (j == 0) ? balance_O_before : ringSettlements.back().getOperatorBalance();
            ringSettlements.emplace_back(pb, params, ringTradingHistoryMerkleRoot, ringAccountsMerkleRoot, burnRateMerkleRoot.packed, timestamp.packed, ringOperatorBalance, std::string("trade") + std::to_string(j));

            // Store transfers from ring settlement
            std::vector<VariableArrayT> ringPublicData = ringSettlements.back().getPublicData();
            publicDataBits.insert(publicDataBits.end(), ringPublicData.begin(), ringPublicData.end());
        }

        updateAccount_O = new UpdateAccountGadget(pb, ringSettlements.back().getNewAccountsMerkleRoot(), operatorID.bits, publicKey, constant0, constant0, balance_O_before, ringSettlements.back().getOperatorBalance(), ".updateAccount_O");
        updateAccount_O->generate_r1cs_constraints();

        publicDataHash.generate_r1cs_constraints(true);
        for (auto& ringSettlement : ringSettlements)
        {
            ringSettlement.generate_r1cs_constraints();
        }

        // Check public data
        publicData = flattenReverse(publicDataBits);
        publicDataHasher = new sha256_many(pb, publicData, ".publicDataHash");
        publicDataHasher->generate_r1cs_constraints();

        // Check that the hash matches the public input
        for (unsigned int i = 0; i < 256; i++)
        {
            pb.add_r1cs_constraint(ConstraintT(publicDataHasher->result().bits[255-i], 1, publicDataHash.bits[i]), "publicData.check()");
        }

        // Make sure the merkle roots afterwards are correctly passed in
        pb.add_r1cs_constraint(ConstraintT(updateAccount_O->result(), 1, accountsMerkleRootAfter.packed), "newAccountsMerkleRoot");
        pb.add_r1cs_constraint(ConstraintT(ringSettlements.back().getNewTradingHistoryMerkleRoot(), 1, tradingHistoryMerkleRootAfter.packed), "newTradingHistoryMerkleRoot");
    }

    void printInfo()
    {
        std::cout << pb.num_constraints() << " constraints (" << (pb.num_constraints() / numRings) << "/ring)" << std::endl;
    }

    bool generateWitness(const TradeContext& context)
    {
        tradingHistoryMerkleRootBefore.bits.fill_with_bits_of_field_element(pb, context.tradingHistoryMerkleRootBefore);
        tradingHistoryMerkleRootBefore.generate_r1cs_witness_from_bits();
        tradingHistoryMerkleRootAfter.bits.fill_with_bits_of_field_element(pb, context.tradingHistoryMerkleRootAfter);
        tradingHistoryMerkleRootAfter.generate_r1cs_witness_from_bits();

        accountsMerkleRootBefore.bits.fill_with_bits_of_field_element(pb, context.accountsMerkleRootBefore);
        accountsMerkleRootBefore.generate_r1cs_witness_from_bits();
        accountsMerkleRootAfter.bits.fill_with_bits_of_field_element(pb, context.accountsMerkleRootAfter);
        accountsMerkleRootAfter.generate_r1cs_witness_from_bits();

        burnRateMerkleRoot.bits.fill_with_bits_of_field_element(pb, context.burnRateMerkleRoot);
        burnRateMerkleRoot.generate_r1cs_witness_from_bits();

        timestamp.bits.fill_with_bits_of_field_element(pb, context.timestamp);
        timestamp.generate_r1cs_witness_from_bits();

        operatorID.bits.fill_with_bits_of_field_element(pb, context.operatorID);
        operatorID.generate_r1cs_witness_from_bits();

        pb.val(publicKey.x) = context.accountUpdate_O.before.publicKey.x;
        pb.val(publicKey.y) = context.accountUpdate_O.before.publicKey.y;

        for(unsigned int i = 0; i < context.ringSettlements.size(); i++)
        {
            ringSettlements[i].generate_r1cs_witness(context.ringSettlements[i]);
        }

        pb.val(balance_O_before) = context.accountUpdate_O.before.balance;
        updateAccount_O->generate_r1cs_witness(context.accountUpdate_O.proof);

        publicDataHasher->generate_r1cs_witness();

        // Print out calculated hash of transfer data
        auto full_output_bits = publicDataHasher->result().get_digest();
        //printBits("HashC: ", full_output_bits);
        BigInt publicDataHashDec = 0;
        for (unsigned int i = 0; i < full_output_bits.size(); i++)
        {
            publicDataHashDec = publicDataHashDec * 2 + (full_output_bits[i] ? 1 : 0);
        }
        //std::cout << "publicDataHashDec: " << publicDataHashDec.to_string() << std::endl;
        libff::bigint<libff::alt_bn128_r_limbs> bn = libff::bigint<libff::alt_bn128_r_limbs>(publicDataHashDec.to_string().c_str());
        for (unsigned int i = 0; i < 256; i++)
        {
            pb.val(publicDataHash.bits[i]) = bn.test_bit(i);
        }
        publicDataHash.generate_r1cs_witness_from_bits();
        //printBits("publicData: ", publicData.get_bits(pb));

        //printBits("Public data bits: ", publicDataHash.bits.get_bits(pb));
        //printBits("Hash bits: ", publicDataHasher->result().bits.get_bits(pb), true);

        return true;
    }
};

class DepositGadget : public GadgetT
{
public:
    typedef merkle_path_authenticator<MiMC_hash_gadget> MerklePathCheckT;
    typedef markle_path_compute<MiMC_hash_gadget> MerklePathT;

    const VariableT merkleRootBefore;

    VariableArrayT address;

    const VariableT emptyPublicKeyX;
    const VariableT emptyPublicKeyY;
    const VariableT emptyDex;
    const VariableT emptyToken;
    const VariableT emptyBalance;

    libsnark::dual_variable_gadget<FieldT> publicKeyX;
    libsnark::dual_variable_gadget<FieldT> publicKeyY;
    libsnark::dual_variable_gadget<FieldT> dex;
    libsnark::dual_variable_gadget<FieldT> token;
    libsnark::dual_variable_gadget<FieldT> balance;

    MiMC_hash_gadget leafBefore;
    MiMC_hash_gadget leafAfter;

    const VariableArrayT proof;
    MerklePathCheckT proofVerifierBefore;
    MerklePathT rootCalculatorAfter;

    DepositGadget(
        ProtoboardT& pb,
        const VariableT& _merkleRoot,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        address(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".address"))),

        emptyPublicKeyX(make_variable(pb, 0, FMT(prefix, ".emptyPublicKeyX"))),
        emptyPublicKeyY(make_variable(pb, 0, FMT(prefix, ".emptyPublicKeyY"))),
        emptyDex(make_variable(pb, 0, FMT(prefix, ".emptyDex"))),
        emptyToken(make_variable(pb, 0, FMT(prefix, ".emptyToken"))),
        emptyBalance(make_variable(pb, 0, FMT(prefix, ".emptyBalance"))),

        publicKeyX(pb, 256, FMT(prefix, ".publicKeyX")),
        publicKeyY(pb, 256, FMT(prefix, ".publicKeyY")),
        dex(pb, 16, FMT(prefix, ".dex")),
        token(pb, 16, FMT(prefix, ".token")),
        balance(pb, 96, FMT(prefix, ".balance")),

        merkleRootBefore(_merkleRoot),

        leafBefore(pb, libsnark::ONE, {emptyPublicKeyX, emptyPublicKeyY, emptyToken, emptyBalance}, FMT(prefix, ".leafBefore")),
        leafAfter(pb, libsnark::ONE, {publicKeyX.packed, publicKeyY.packed, token.packed, balance.packed}, FMT(prefix, ".leafAfter")),

        proof(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".proof"))),
        proofVerifierBefore(pb, TREE_DEPTH_ACCOUNTS, address, merkle_tree_IVs(pb), leafBefore.result(), merkleRootBefore, proof, FMT(prefix, ".pathBefore")),
        rootCalculatorAfter(pb, TREE_DEPTH_ACCOUNTS, address, merkle_tree_IVs(pb), leafAfter.result(), proof, FMT(prefix, ".pathAfter"))
    {

    }

    const VariableT getNewAccountsMerkleRoot() const
    {
        return rootCalculatorAfter.result();
    }

    const std::vector<VariableArrayT> getPublicData() const
    {
        return {publicKeyX.bits, publicKeyY.bits, dex.bits, token.bits, balance.bits};
    }

    void generate_r1cs_witness(const Deposit& deposit)
    {
        address.fill_with_bits_of_field_element(pb, deposit.address);

        publicKeyX.bits.fill_with_bits_of_field_element(pb, deposit.accountUpdate.after.publicKey.x);
        publicKeyX.generate_r1cs_witness_from_bits();
        publicKeyY.bits.fill_with_bits_of_field_element(pb, deposit.accountUpdate.after.publicKey.y);
        publicKeyY.generate_r1cs_witness_from_bits();
        dex.bits.fill_with_bits_of_field_element(pb, deposit.accountUpdate.after.dexID);
        dex.generate_r1cs_witness_from_bits();
        token.bits.fill_with_bits_of_field_element(pb, deposit.accountUpdate.after.token);
        token.generate_r1cs_witness_from_bits();
        balance.bits.fill_with_bits_of_field_element(pb, deposit.accountUpdate.after.balance);
        balance.generate_r1cs_witness_from_bits();

        leafBefore.generate_r1cs_witness();
        leafAfter.generate_r1cs_witness();

        proof.fill_with_field_elements(pb, deposit.accountUpdate.proof.data);
        proofVerifierBefore.generate_r1cs_witness();
        rootCalculatorAfter.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        // Force constants
        pb.add_r1cs_constraint(ConstraintT(emptyPublicKeyX, 1, 0), "emptyPublicKeyX == 0");
        pb.add_r1cs_constraint(ConstraintT(emptyPublicKeyY, 1, 0), "emptyPublicKeyY == 0");
        pb.add_r1cs_constraint(ConstraintT(emptyDex, 1, 0), "emptyDex == 0");
        pb.add_r1cs_constraint(ConstraintT(emptyToken, 1, 0), "emptyToken == 0");
        pb.add_r1cs_constraint(ConstraintT(emptyBalance, 1, 0), "emptyBalance == 0");

        publicKeyX.generate_r1cs_constraints(true);
        publicKeyY.generate_r1cs_constraints(true);
        dex.generate_r1cs_constraints(true);
        token.generate_r1cs_constraints(true);
        balance.generate_r1cs_constraints(true);

        leafBefore.generate_r1cs_constraints();
        leafAfter.generate_r1cs_constraints();

        proofVerifierBefore.generate_r1cs_constraints();
        rootCalculatorAfter.generate_r1cs_constraints();
    }
};

class DepositsCircuitGadget : public GadgetT
{
public:

    unsigned int numAccounts;
    std::vector<DepositGadget> deposits;

    libsnark::dual_variable_gadget<FieldT> publicDataHash;
    libsnark::dual_variable_gadget<FieldT> accountsMerkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> accountsMerkleRootAfter;

    std::vector<VariableArrayT> publicDataBits;
    VariableArrayT publicData;

    sha256_many* publicDataHasher;

    DepositsCircuitGadget(ProtoboardT& pb, const std::string& prefix) :
        GadgetT(pb, prefix),

        publicDataHash(pb, 256, FMT(prefix, ".publicDataHash")),

        accountsMerkleRootBefore(pb, 256, FMT(prefix, ".accountsMerkleRootBefore")),
        accountsMerkleRootAfter(pb, 256, FMT(prefix, ".accountsMerkleRootAfter"))
    {
        this->publicDataHasher = nullptr;
    }

    ~DepositsCircuitGadget()
    {
        if (publicDataHasher)
        {
            delete publicDataHasher;
        }
    }

    void generate_r1cs_constraints(int numAccounts)
    {
        this->numAccounts = numAccounts;

        pb.set_input_sizes(1);
        accountsMerkleRootBefore.generate_r1cs_constraints(true);
        publicDataBits.push_back(accountsMerkleRootBefore.bits);
        publicDataBits.push_back(accountsMerkleRootAfter.bits);
        for (size_t j = 0; j < numAccounts; j++)
        {
            VariableT depositAccountsMerkleRoot = (j == 0) ? accountsMerkleRootBefore.packed : deposits.back().getNewAccountsMerkleRoot();
            deposits.emplace_back(pb, depositAccountsMerkleRoot, std::string("deposits") + std::to_string(j));

            // Store data from deposit
            //std::vector<VariableArrayT> ringPublicData = deposits.back().getPublicData();
            //publicDataBits.insert(publicDataBits.end(), ringPublicData.begin(), ringPublicData.end());
        }

        publicDataHash.generate_r1cs_constraints(true);
        for (auto& deposit : deposits)
        {
            deposit.generate_r1cs_constraints();
        }

        // Check public data
        publicData = flattenReverse(publicDataBits);
        publicDataHasher = new sha256_many(pb, publicData, ".publicDataHash");
        publicDataHasher->generate_r1cs_constraints();

        // Check that the hash matches the public input
        for (unsigned int i = 0; i < 256; i++)
        {
            pb.add_r1cs_constraint(ConstraintT(publicDataHasher->result().bits[255-i], 1, publicDataHash.bits[i]), "publicData.check()");
        }

        // Make sure the merkle root afterwards is correctly passed in
        pb.add_r1cs_constraint(ConstraintT(deposits.back().getNewAccountsMerkleRoot(), 1, accountsMerkleRootAfter.packed), "newMerkleRoot");
    }

    void printInfo()
    {
        std::cout << pb.num_constraints() << " constraints (" << (pb.num_constraints() / numAccounts) << "/deposit)" << std::endl;
    }

    bool generateWitness(const std::vector<Loopring::Deposit>& depositsData,
                         const std::string& strAccountsMerkleRootBefore, const std::string& strAccountsMerkleRootAfter)
    {
        ethsnarks::FieldT accountsMerkleRootBeforeValue = ethsnarks::FieldT(strAccountsMerkleRootBefore.c_str());
        ethsnarks::FieldT accountsMerkleRootAfterValue = ethsnarks::FieldT(strAccountsMerkleRootAfter.c_str());
        accountsMerkleRootBefore.bits.fill_with_bits_of_field_element(pb, accountsMerkleRootBeforeValue);
        accountsMerkleRootBefore.generate_r1cs_witness_from_bits();
        accountsMerkleRootAfter.bits.fill_with_bits_of_field_element(pb, accountsMerkleRootAfterValue);
        accountsMerkleRootAfter.generate_r1cs_witness_from_bits();

        for(unsigned int i = 0; i < depositsData.size(); i++)
        {
            deposits[i].generate_r1cs_witness(depositsData[i]);
        }

        publicDataHasher->generate_r1cs_witness();

        // Print out calculated hash of transfer data
        auto full_output_bits = publicDataHasher->result().get_digest();
        //printBits("HashC: ", full_output_bits);
        BigInt publicDataHashDec = 0;
        for (unsigned int i = 0; i < full_output_bits.size(); i++)
        {
            publicDataHashDec = publicDataHashDec * 2 + (full_output_bits[i] ? 1 : 0);
        }
        //std::cout << "publicDataHashDec: " << publicDataHashDec.to_string() << std::endl;
        libff::bigint<libff::alt_bn128_r_limbs> bn = libff::bigint<libff::alt_bn128_r_limbs>(publicDataHashDec.to_string().c_str());
        for (unsigned int i = 0; i < 256; i++)
        {
            pb.val(publicDataHash.bits[i]) = bn.test_bit(i);
        }
        publicDataHash.generate_r1cs_witness_from_bits();
        //printBits("publicData: ", publicData.get_bits(pb));

        //printBits("Public data bits: ", publicDataHash.bits.get_bits(pb));
        //printBits("Hash bits: ", publicDataHasher->result().bits.get_bits(pb), true);

        return true;
    }
};

class WithdrawalGadget : public GadgetT
{
public:
    typedef merkle_path_authenticator<MiMC_hash_gadget> MerklePathCheckT;
    typedef markle_path_compute<MiMC_hash_gadget> MerklePathT;

    const VariableT merkleRootBefore;

    const jubjub::VariablePointT publicKey;

    VariableArrayT account;
    libsnark::dual_variable_gadget<FieldT> amount;
    libsnark::dual_variable_gadget<FieldT> padding;

    VariableT dex;
    VariableT token;
    VariableT balance_before;
    VariableT balance_after;

    UpdateAccountGadget updateAccount;

    // variables for signature
    const jubjub::VariablePointT sig_R;
    const VariableArrayT sig_s;
    const VariableArrayT sig_m;
    jubjub::PureEdDSA signatureVerifier;

    WithdrawalGadget(
        ProtoboardT& pb,
        const jubjub::Params& params,
        const VariableT& _merkleRoot,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        merkleRootBefore(_merkleRoot),

        publicKey(pb, FMT(prefix, ".publicKey")),

        account(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".account"))),
        amount(pb, 96, FMT(prefix, ".amount")),
        padding(pb, 2, FMT(prefix, ".padding")),

        dex(make_variable(pb, FMT(prefix, ".dex"))),
        token(make_variable(pb, FMT(prefix, ".token"))),
        balance_before(make_variable(pb, FMT(prefix, ".balance_before"))),
        balance_after(make_variable(pb, FMT(prefix, ".balance_after"))),

        updateAccount(pb, merkleRootBefore, account, publicKey, dex, token, balance_before, balance_after, FMT(prefix, ".updateBalance")),

        sig_R(pb, FMT(prefix, ".R")),
        sig_s(make_var_array(pb, FieldT::size_in_bits(), FMT(prefix, ".s"))),
        sig_m(flatten({account, amount.bits, padding.bits})),
        signatureVerifier(pb, params, jubjub::EdwardsPoint(params.Gx, params.Gy), publicKey, sig_R, sig_s, sig_m, FMT(prefix, ".signatureVerifier"))
    {

    }

    const VariableT getNewAccountsMerkleRoot() const
    {
        return updateAccount.result();
    }

    const std::vector<VariableArrayT> getPublicData() const
    {
        return {account, amount.bits};
    }

    void generate_r1cs_witness(const Withdrawal& withdrawal)
    {
        pb.val(publicKey.x) = withdrawal.publicKey.x;
        pb.val(publicKey.y) = withdrawal.publicKey.y;

        account.fill_with_bits_of_field_element(pb, withdrawal.account);

        amount.bits.fill_with_bits_of_field_element(pb, withdrawal.amount);
        amount.generate_r1cs_witness_from_bits();

        padding.bits.fill_with_bits_of_field_element(pb, 0);
        padding.generate_r1cs_witness_from_bits();

        pb.val(dex) = withdrawal.accountUpdate.before.dexID;
        pb.val(token) = withdrawal.accountUpdate.before.token;
        pb.val(balance_before) = withdrawal.accountUpdate.before.balance;
        pb.val(balance_after) = withdrawal.accountUpdate.after.balance;

        updateAccount.generate_r1cs_witness(withdrawal.accountUpdate.proof);

        pb.val(sig_R.x) = withdrawal.signature.R.x;
        pb.val(sig_R.y) = withdrawal.signature.R.y;
        sig_s.fill_with_bits_of_field_element(pb, withdrawal.signature.s);
        signatureVerifier.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        amount.generate_r1cs_constraints(true);
        padding.generate_r1cs_constraints(true);

        signatureVerifier.generate_r1cs_constraints();

        updateAccount.generate_r1cs_constraints();
    }
};

class WithdrawalsCircuitGadget : public GadgetT
{
public:
    jubjub::Params params;

    unsigned int numAccounts;
    std::vector<WithdrawalGadget> withdrawals;

    libsnark::dual_variable_gadget<FieldT> publicDataHash;
    libsnark::dual_variable_gadget<FieldT> accountsMerkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> accountsMerkleRootAfter;

    std::vector<VariableArrayT> publicDataBits;
    VariableArrayT publicData;

    sha256_many* publicDataHasher;

    WithdrawalsCircuitGadget(ProtoboardT& pb, const std::string& prefix) :
        GadgetT(pb, prefix),

        publicDataHash(pb, 256, FMT(prefix, ".publicDataHash")),

        accountsMerkleRootBefore(pb, 256, FMT(prefix, ".accountsMerkleRootBefore")),
        accountsMerkleRootAfter(pb, 256, FMT(prefix, ".accountsMerkleRootAfter"))
    {
        this->publicDataHasher = nullptr;
    }

    ~WithdrawalsCircuitGadget()
    {
        if (publicDataHasher)
        {
            delete publicDataHasher;
        }
    }

    void generate_r1cs_constraints(int numAccounts)
    {
        this->numAccounts = numAccounts;

        pb.set_input_sizes(1);
        accountsMerkleRootBefore.generate_r1cs_constraints(true);
        publicDataBits.push_back(accountsMerkleRootBefore.bits);
        publicDataBits.push_back(accountsMerkleRootAfter.bits);
        for (size_t j = 0; j < numAccounts; j++)
        {
            VariableT withdrawalAccountsMerkleRoot = (j == 0) ? accountsMerkleRootBefore.packed : withdrawals.back().getNewAccountsMerkleRoot();
            withdrawals.emplace_back(pb, params, withdrawalAccountsMerkleRoot, std::string("withdrawals") + std::to_string(j));

            // Store data from withdrawal
            std::vector<VariableArrayT> ringPublicData = withdrawals.back().getPublicData();
            publicDataBits.insert(publicDataBits.end(), ringPublicData.begin(), ringPublicData.end());
        }

        publicDataHash.generate_r1cs_constraints(true);
        for (auto& withdrawal : withdrawals)
        {
            withdrawal.generate_r1cs_constraints();
        }

        // Check public data
        publicData = flattenReverse(publicDataBits);
        publicDataHasher = new sha256_many(pb, publicData, ".publicDataHash");
        publicDataHasher->generate_r1cs_constraints();

        // Check that the hash matches the public input
        for (unsigned int i = 0; i < 256; i++)
        {
            pb.add_r1cs_constraint(ConstraintT(publicDataHasher->result().bits[255-i], 1, publicDataHash.bits[i]), "publicData.check()");
        }

        // Make sure the merkle root afterwards is correctly passed in
        pb.add_r1cs_constraint(ConstraintT(withdrawals.back().getNewAccountsMerkleRoot(), 1, accountsMerkleRootAfter.packed), "newMerkleRoot");
    }

    void printInfo()
    {
        std::cout << pb.num_constraints() << " constraints (" << (pb.num_constraints() / numAccounts) << "/withdrawal)" << std::endl;
    }

    bool generateWitness(const std::vector<Loopring::Withdrawal>& withdrawalsData,
                         const std::string& strAccountsMerkleRootBefore, const std::string& strAccountsMerkleRootAfter)
    {
        ethsnarks::FieldT accountsMerkleRootBeforeValue = ethsnarks::FieldT(strAccountsMerkleRootBefore.c_str());
        ethsnarks::FieldT accountsMerkleRootAfterValue = ethsnarks::FieldT(strAccountsMerkleRootAfter.c_str());
        accountsMerkleRootBefore.bits.fill_with_bits_of_field_element(pb, accountsMerkleRootBeforeValue);
        accountsMerkleRootBefore.generate_r1cs_witness_from_bits();
        accountsMerkleRootAfter.bits.fill_with_bits_of_field_element(pb, accountsMerkleRootAfterValue);
        accountsMerkleRootAfter.generate_r1cs_witness_from_bits();

        for(unsigned int i = 0; i < withdrawalsData.size(); i++)
        {
            withdrawals[i].generate_r1cs_witness(withdrawalsData[i]);
        }

        publicDataHasher->generate_r1cs_witness();

        // Print out calculated hash of transfer data
        auto full_output_bits = publicDataHasher->result().get_digest();
        //printBits("HashC: ", full_output_bits);
        BigInt publicDataHashDec = 0;
        for (unsigned int i = 0; i < full_output_bits.size(); i++)
        {
            publicDataHashDec = publicDataHashDec * 2 + (full_output_bits[i] ? 1 : 0);
        }
        //std::cout << "publicDataHashDec: " << publicDataHashDec.to_string() << std::endl;
        libff::bigint<libff::alt_bn128_r_limbs> bn = libff::bigint<libff::alt_bn128_r_limbs>(publicDataHashDec.to_string().c_str());
        for (unsigned int i = 0; i < 256; i++)
        {
            pb.val(publicDataHash.bits[i]) = bn.test_bit(i);
        }
        publicDataHash.generate_r1cs_witness_from_bits();
        //printBits("publicData: ", publicData.get_bits(pb));

        //printBits("Public data bits: ", publicDataHash.bits.get_bits(pb));
        //printBits("Hash bits: ", publicDataHasher->result().bits.get_bits(pb), true);

        return true;
    }
};

class CancelGadget : public GadgetT
{
public:
    const VariableT tradingHistoryMerkleRoot;
    const VariableT accountsMerkleRoot;

    const jubjub::VariablePointT publicKey;

    VariableArrayT account;
    VariableArrayT orderID;
    libsnark::dual_variable_gadget<FieldT> padding;

    VariableT filled;
    VariableT cancelledBefore;
    VariableT cancelledAfter;

    VariableT dex;
    VariableT token;
    VariableT balance;
    UpdateAccountGadget checkAccount;

    UpdateTradeHistoryGadget updateTradeHistory;

    // variables for signature
    const jubjub::VariablePointT sig_R;
    const VariableArrayT sig_s;
    const VariableArrayT sig_m;
    jubjub::PureEdDSA signatureVerifier;

    CancelGadget(
        ProtoboardT& pb,
        const jubjub::Params& params,
        const VariableT& _tradingHistoryMerkleRoot,
        const VariableT& _accountsMerkleRoot,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        tradingHistoryMerkleRoot(_tradingHistoryMerkleRoot),
        accountsMerkleRoot(_accountsMerkleRoot),

        publicKey(pb, FMT(prefix, ".publicKey")),

        account(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".account"))),
        orderID(make_var_array(pb, 4, FMT(prefix, ".orderID"))),
        padding(pb, 1, FMT(prefix, ".padding")),

        filled(make_variable(pb, 0, FMT(prefix, ".filled"))),
        cancelledBefore(make_variable(pb, 0, FMT(prefix, ".cancelledBefore"))),
        cancelledAfter(make_variable(pb, 0, FMT(prefix, ".cancelledAfter"))),
        updateTradeHistory(pb, tradingHistoryMerkleRoot, flatten({orderID, account}), filled, cancelledBefore, filled, cancelledAfter, FMT(prefix, ".updateTradeHistory")),

        dex(make_variable(pb, FMT(prefix, ".dex"))),
        token(make_variable(pb, FMT(prefix, ".token"))),
        balance(make_variable(pb, FMT(prefix, ".balance"))),
        checkAccount(pb, accountsMerkleRoot, account, publicKey, dex, token, balance, balance, FMT(prefix, ".checkAccount")),

        sig_R(pb, FMT(prefix, ".R")),
        sig_s(make_var_array(pb, FieldT::size_in_bits(), FMT(prefix, ".s"))),
        sig_m(flatten({account, orderID, padding.bits})),
        signatureVerifier(pb, params, jubjub::EdwardsPoint(params.Gx, params.Gy), publicKey, sig_R, sig_s, sig_m, FMT(prefix, ".signatureVerifier"))
    {

    }

    const VariableT getNewTradingHistoryMerkleRoot() const
    {
        return updateTradeHistory.getNewTradingHistoryMerkleRoot();
    }

    const std::vector<VariableArrayT> getPublicData() const
    {
        return {account, orderID};
    }

    void generate_r1cs_witness(const Cancellation& cancellation)
    {
        pb.val(publicKey.x) = cancellation.publicKey.x;
        pb.val(publicKey.y) = cancellation.publicKey.y;

        account.fill_with_bits_of_field_element(pb, cancellation.account);
        orderID.fill_with_bits_of_field_element(pb, cancellation.orderID);

        padding.bits.fill_with_bits_of_field_element(pb, 0);
        padding.generate_r1cs_witness_from_bits();

        pb.val(filled) = cancellation.tradeHistoryUpdate.before.filled;
        pb.val(cancelledBefore) = cancellation.tradeHistoryUpdate.before.cancelled;
        pb.val(cancelledAfter) = cancellation.tradeHistoryUpdate.after.cancelled;

        pb.val(dex) = cancellation.accountUpdate.before.dexID;
        pb.val(token) = cancellation.accountUpdate.before.token;
        pb.val(balance) = cancellation.accountUpdate.before.balance;

        updateTradeHistory.generate_r1cs_witness(cancellation.tradeHistoryUpdate.proof);

        checkAccount.generate_r1cs_witness(cancellation.accountUpdate.proof);

        pb.val(sig_R.x) = cancellation.signature.R.x;
        pb.val(sig_R.y) = cancellation.signature.R.y;
        sig_s.fill_with_bits_of_field_element(pb, cancellation.signature.s);
        signatureVerifier.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        padding.generate_r1cs_constraints(true);
        signatureVerifier.generate_r1cs_constraints();
        updateTradeHistory.generate_r1cs_constraints();
        checkAccount.generate_r1cs_constraints();
        pb.add_r1cs_constraint(ConstraintT(cancelledAfter, FieldT::one(), FieldT::one()), "cancelledAfter == 1");
    }
};

class CancelsCircuitGadget : public GadgetT
{
public:
    jubjub::Params params;

    unsigned int numCancels;
    std::vector<CancelGadget> cancels;

    libsnark::dual_variable_gadget<FieldT> publicDataHash;
    libsnark::dual_variable_gadget<FieldT> tradingHistoryMerkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> tradingHistoryMerkleRootAfter;
    libsnark::dual_variable_gadget<FieldT> accountsMerkleRoot;

    std::vector<VariableArrayT> publicDataBits;
    VariableArrayT publicData;

    sha256_many* publicDataHasher;

    CancelsCircuitGadget(ProtoboardT& pb, const std::string& prefix) :
        GadgetT(pb, prefix),

        publicDataHash(pb, 256, FMT(prefix, ".publicDataHash")),

        tradingHistoryMerkleRootBefore(pb, 256, FMT(prefix, ".tradingHistoryMerkleRootBefore")),
        tradingHistoryMerkleRootAfter(pb, 256, FMT(prefix, ".tradingHistoryMerkleRootAfter")),
        accountsMerkleRoot(pb, 256, FMT(prefix, ".accountsMerkleRoot"))
    {
        this->publicDataHasher = nullptr;
    }

    ~CancelsCircuitGadget()
    {
        if (publicDataHasher)
        {
            delete publicDataHasher;
        }
    }

    void generate_r1cs_constraints(int numCancels)
    {
        this->numCancels = numCancels;

        pb.set_input_sizes(1);
        tradingHistoryMerkleRootBefore.generate_r1cs_constraints(true);
        publicDataBits.push_back(tradingHistoryMerkleRootBefore.bits);
        publicDataBits.push_back(tradingHistoryMerkleRootAfter.bits);
        for (size_t j = 0; j < numCancels; j++)
        {
            VariableT cancelTradingHistoryMerkleRoot = (j == 0) ? tradingHistoryMerkleRootBefore.packed : cancels.back().getNewTradingHistoryMerkleRoot();
            cancels.emplace_back(pb, params, cancelTradingHistoryMerkleRoot, accountsMerkleRoot.packed, std::string("cancels") + std::to_string(j));

            // Store data from withdrawal
            std::vector<VariableArrayT> ringPublicData = cancels.back().getPublicData();
            publicDataBits.insert(publicDataBits.end(), ringPublicData.begin(), ringPublicData.end());
        }

        publicDataHash.generate_r1cs_constraints(true);
        for (auto& cancel : cancels)
        {
            cancel.generate_r1cs_constraints();
        }

        // Check public data
        publicData = flattenReverse(publicDataBits);
        publicDataHasher = new sha256_many(pb, publicData, ".publicDataHash");
        publicDataHasher->generate_r1cs_constraints();

        // Check that the hash matches the public input
        /*for (unsigned int i = 0; i < 256; i++)
        {
            pb.add_r1cs_constraint(ConstraintT(publicDataHasher->result().bits[255-i], 1, publicDataHash.bits[i]), "publicData.check()");
        }*/

        // Make sure the merkle root afterwards is correctly passed in
        //pb.add_r1cs_constraint(ConstraintT(ringSettlements.back().getNewTradingHistoryMerkleRoot(), 1, tradingHistoryMerkleRootAfter.packed), "newMerkleRoot");
    }

    void printInfo()
    {
        std::cout << pb.num_constraints() << " constraints (" << (pb.num_constraints() / numCancels) << "/cancel)" << std::endl;
    }

    bool generateWitness(const std::vector<Loopring::Cancellation>& cancelsData,
                         const std::string& strTradingHistoryMerkleRootBefore, const std::string& strTradingHistoryMerkleRootAfter,
                         const std::string& strAccountsMerkleRoot)
    {
        ethsnarks::FieldT tradingHistoryMerkleRootBeforeValue = ethsnarks::FieldT(strTradingHistoryMerkleRootBefore.c_str());
        ethsnarks::FieldT tradingHistoryMerkleRootAfterValue = ethsnarks::FieldT(strTradingHistoryMerkleRootAfter.c_str());
        tradingHistoryMerkleRootBefore.bits.fill_with_bits_of_field_element(pb, tradingHistoryMerkleRootBeforeValue);
        tradingHistoryMerkleRootBefore.generate_r1cs_witness_from_bits();
        tradingHistoryMerkleRootAfter.bits.fill_with_bits_of_field_element(pb, tradingHistoryMerkleRootAfterValue);
        tradingHistoryMerkleRootAfter.generate_r1cs_witness_from_bits();

        ethsnarks::FieldT accountsMerkleRootValue = ethsnarks::FieldT(strAccountsMerkleRoot.c_str());
        accountsMerkleRoot.bits.fill_with_bits_of_field_element(pb, accountsMerkleRootValue);
        accountsMerkleRoot.generate_r1cs_witness_from_bits();

        for(unsigned int i = 0; i < cancelsData.size(); i++)
        {
            cancels[i].generate_r1cs_witness(cancelsData[i]);
        }

        publicDataHasher->generate_r1cs_witness();

        // Print out calculated hash of transfer data
        auto full_output_bits = publicDataHasher->result().get_digest();
        printBits("HashC: ", full_output_bits);
        BigInt publicDataHashDec = 0;
        for (unsigned int i = 0; i < full_output_bits.size(); i++)
        {
            publicDataHashDec = publicDataHashDec * 2 + (full_output_bits[i] ? 1 : 0);
        }
        std::cout << "publicDataHashDec: " << publicDataHashDec.to_string() << std::endl;
        libff::bigint<libff::alt_bn128_r_limbs> bn = libff::bigint<libff::alt_bn128_r_limbs>(publicDataHashDec.to_string().c_str());
        for (unsigned int i = 0; i < 256; i++)
        {
            pb.val(publicDataHash.bits[i]) = bn.test_bit(i);
        }
        publicDataHash.generate_r1cs_witness_from_bits();
        printBits("publicData: ", publicData.get_bits(pb));

        printBits("Public data bits: ", publicDataHash.bits.get_bits(pb));
        printBits("Hash bits: ", publicDataHasher->result().bits.get_bits(pb), true);

        return true;
    }
};

}

#endif
