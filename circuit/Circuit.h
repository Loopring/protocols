#ifndef _CIRCUIT_H_
#define _CIRCUIT_H_

#include "Constants.h"
#include "Data.h"

#include "BigInt.hpp"
#include "ethsnarks.hpp"
#include "utils.hpp"
#include "jubjub/point.hpp"
#include "jubjub/eddsa.hpp"
#include "gadgets/longsightl.hpp"
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

class LeqGadget : public GadgetT
{
public:
    VariableT lt;
    VariableT leq;
    libsnark::comparison_gadget<ethsnarks::FieldT> comparison;

    LeqGadget(
        ProtoboardT& pb,
        const VariableT& A,
        const VariableT& B,
        const std::string& annotation_prefix
    ) :
        GadgetT(pb, annotation_prefix),

        lt(make_variable(pb, 1, "lt")),
        leq(make_variable(pb, 1, "leq")),
        comparison(pb, 128, A, B, lt, leq, "A <= B")
    {

    }

    const VariableT result() const
    {
        return leq;
    }

    void generate_r1cs_witness()
    {
        comparison.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        comparison.generate_r1cs_constraints();
        pb.add_r1cs_constraint(ConstraintT(leq, 1, 1), "leq == 1");
    }
};

class RateCheckerGadget : public GadgetT
{
public:
    VariableT fillS;
    VariableT fillB;
    VariableT amountS;
    VariableT amountB;

    VariableT invariant;

    RateCheckerGadget(
        ProtoboardT& pb,
        const VariableT& _fillS,
        const VariableT& _fillB,
        const VariableT& _amountS,
        const VariableT& _amountB,
        const std::string& annotation_prefix
    ) :
        GadgetT(pb, annotation_prefix),

        fillS(_fillS),
        fillB(_fillB),
        amountS(_amountS),
        amountB(_amountB),

        invariant(make_variable(pb, ".invariant"))
    {

    }

    void generate_r1cs_witness()
    {
        pb.val(invariant) = pb.val(amountS) * pb.val(fillB);
    }

    void generate_r1cs_constraints()
    {
        pb.add_r1cs_constraint(ConstraintT(amountS, fillB, invariant), "fillB == invariant");
        pb.add_r1cs_constraint(ConstraintT(amountB, fillS, invariant), "fillS == invariant");
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
    libsnark::dual_variable_gadget<FieldT> padding;

    VariableT tokenS;
    VariableT tokenB;
    VariableT tokenF;

    const jubjub::VariablePointT publicKey;
    const jubjub::VariablePointT walletPublicKey;

    // variables for signature
    const jubjub::VariablePointT sig_R;
    const VariableArrayT sig_s;
    const VariableArrayT sig_m;
    jubjub::PureEdDSA_Verify signatureVerifier;

    OrderGadget(
        ProtoboardT& pb,
        const jubjub::Params& params,
        const std::string& annotation_prefix
    ) :
        GadgetT(pb, annotation_prefix),

        dexID(pb, 16, FMT(annotation_prefix, ".dexID")),
        orderID(pb, 4, FMT(annotation_prefix, ".orderID")),
        accountS(pb, 24, FMT(annotation_prefix, ".accountS")),
        accountB(pb, 24, FMT(annotation_prefix, ".accountB")),
        accountF(pb, 24, FMT(annotation_prefix, ".accountF")),
        amountS(pb, 96, FMT(annotation_prefix, ".amountS")),
        amountB(pb, 96, FMT(annotation_prefix, ".amountB")),
        amountF(pb, 96, FMT(annotation_prefix, ".amountF")),
        walletF(pb, 24, FMT(annotation_prefix, ".walletF")),
        padding(pb, 1, FMT(annotation_prefix, ".padding")),

        tokenS(make_variable(pb, FMT(annotation_prefix, ".tokenS"))),
        tokenB(make_variable(pb, FMT(annotation_prefix, ".tokenB"))),
        tokenF(make_variable(pb, FMT(annotation_prefix, ".tokenF"))),

        publicKey(pb, FMT(annotation_prefix, ".publicKey")),
        walletPublicKey(pb, FMT(annotation_prefix, ".walletPublicKey")),


        sig_R(pb, FMT(annotation_prefix, ".R")),
        sig_s(make_var_array(pb, FieldT::size_in_bits(), FMT(annotation_prefix, ".s"))),
        sig_m(flatten({dexID.bits, orderID.bits, accountS.bits, accountB.bits, accountF.bits, amountS.bits, amountB.bits, amountF.bits})),

        signatureVerifier(pb, params, jubjub::EdwardsPoint(params.Gx, params.Gy), publicKey, sig_R, sig_s, sig_m, FMT(annotation_prefix, ".signatureVerifier"))
    {

    }

    void generate_r1cs_witness(const Order& order)
    {
        dexID.bits.fill_with_bits_of_field_element(this->pb, order.dexID);
        dexID.generate_r1cs_witness_from_bits();
        orderID.bits.fill_with_bits_of_field_element(this->pb, order.orderID);
        orderID.generate_r1cs_witness_from_bits();

        accountS.bits.fill_with_bits_of_field_element(this->pb, order.accountS);
        accountS.generate_r1cs_witness_from_bits();
        accountB.bits.fill_with_bits_of_field_element(this->pb, order.accountB);
        accountB.generate_r1cs_witness_from_bits();
        accountF.bits.fill_with_bits_of_field_element(this->pb, order.accountF);
        accountF.generate_r1cs_witness_from_bits();

        amountS.bits.fill_with_bits_of_field_element(this->pb, order.amountS);
        amountS.generate_r1cs_witness_from_bits();
        amountB.bits.fill_with_bits_of_field_element(this->pb, order.amountB);
        amountB.generate_r1cs_witness_from_bits();
        amountF.bits.fill_with_bits_of_field_element(this->pb, order.amountF);
        amountF.generate_r1cs_witness_from_bits();

        walletF.bits.fill_with_bits_of_field_element(this->pb, order.walletF);
        walletF.generate_r1cs_witness_from_bits();

        padding.bits.fill_with_bits_of_field_element(this->pb, 0);
        padding.generate_r1cs_witness_from_bits();

        this->pb.val(tokenS) = order.tokenS;
        this->pb.val(tokenB) = order.tokenB;
        this->pb.val(tokenF) = order.tokenF;

        this->pb.val(publicKey.x) = order.publicKey.x;
        this->pb.val(publicKey.y) = order.publicKey.y;

        this->pb.val(walletPublicKey.x) = order.walletPublicKey.x;
        this->pb.val(walletPublicKey.y) = order.walletPublicKey.y;

        this->pb.val(sig_R.x) = order.sig.R.x;
        this->pb.val(sig_R.y) = order.sig.R.y;
        sig_s.fill_with_bits_of_field_element(this->pb, order.sig.s);
        signatureVerifier.generate_r1cs_witness();
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
        padding.generate_r1cs_constraints(true);

        signatureVerifier.generate_r1cs_constraints();
    }
};

class UpdateFilledGadget : public GadgetT
{
public:
    typedef merkle_path_authenticator<LongsightL12p5_MP_gadget> MerklePathCheckT;
    typedef markle_path_compute<LongsightL12p5_MP_gadget> MerklePathT;

    const VariableT merkleRootBefore;

    libsnark::dual_variable_gadget<FieldT> fill;

    VariableT filledBefore;
    VariableT filledAfter;

    LongsightL12p5_MP_gadget leafBefore;
    LongsightL12p5_MP_gadget leafAfter;

    const VariableArrayT proof;
    MerklePathCheckT proofVerifierBefore;
    MerklePathT rootCalculatorAfter;

    UpdateFilledGadget(
        ProtoboardT& pb,
        const VariableT& _merkleRoot,
        const VariableArrayT& address,
        const std::string& annotation_prefix
    ) :
        GadgetT(pb, annotation_prefix),

        merkleRootBefore(_merkleRoot),

        fill(pb, 96, FMT(annotation_prefix, ".fill")),

        filledBefore(make_variable(pb, FMT(annotation_prefix, ".filledBefore"))),
        filledAfter(make_variable(pb, FMT(annotation_prefix, ".filledAfter"))),

        leafBefore(pb, libsnark::ONE, {filledBefore, filledBefore}, FMT(annotation_prefix, ".leafBefore")),
        leafAfter(pb, libsnark::ONE, {filledAfter, filledAfter}, FMT(annotation_prefix, ".leafAfter")),

        proof(make_var_array(pb, TREE_DEPTH_FILLED, FMT(annotation_prefix, ".proof"))),
        proofVerifierBefore(pb, TREE_DEPTH_FILLED, address, merkle_tree_IVs(pb), leafBefore.result(), merkleRootBefore, proof, FMT(annotation_prefix, ".pathBefore")),
        rootCalculatorAfter(pb, TREE_DEPTH_FILLED, address, merkle_tree_IVs(pb), leafAfter.result(), proof, FMT(annotation_prefix, ".pathAfter"))
    {

    }

    const VariableT result() const
    {
        return rootCalculatorAfter.result();
    }

    const VariableT getFilledAfter() const
    {
        return filledAfter;
    }

    void generate_r1cs_witness(const ethsnarks::FieldT& filled, const Proof& _proof, const libsnark::dual_variable_gadget<FieldT>& fill)
    {
        this->pb.val(filledBefore) = filled;
        this->pb.val(filledAfter) = this->pb.val(filledBefore) + this->pb.val(fill.packed);

        leafBefore.generate_r1cs_witness();
        leafAfter.generate_r1cs_witness();

        proof.fill_with_field_elements(this->pb, _proof.data);
        proofVerifierBefore.generate_r1cs_witness();
        rootCalculatorAfter.generate_r1cs_witness();
    }

    void generate_r1cs_constraints(const libsnark::dual_variable_gadget<FieldT>& fill)
    {
        this->pb.add_r1cs_constraint(ConstraintT(filledBefore + fill.packed, 1, filledAfter), "filledBefore + fill = filledAfter");

        leafBefore.generate_r1cs_constraints();
        leafAfter.generate_r1cs_constraints();

        proofVerifierBefore.generate_r1cs_constraints();
        rootCalculatorAfter.generate_r1cs_constraints();
    }
};

class UpdateBalanceGadget : public GadgetT
{
public:
    typedef merkle_path_authenticator<LongsightL12p5_MP_gadget> MerklePathCheckT;
    typedef markle_path_compute<LongsightL12p5_MP_gadget> MerklePathT;

    const VariableT merkleRootBefore;

    LongsightL12p5_MP_gadget leafBefore;
    LongsightL12p5_MP_gadget leafAfter;

    const VariableArrayT proof;
    MerklePathCheckT proofVerifierBefore;
    MerklePathT rootCalculatorAfter;

    UpdateBalanceGadget(
        ProtoboardT& pb,
        const VariableT& _merkleRoot,
        const VariableArrayT& address,
        const jubjub::VariablePointT& publicKey,
        const VariableT& dex,
        const VariableT& token,
        const VariableT& balanceBefore,
        const VariableT& balanceAfter,
        const std::string& annotation_prefix
    ) :
        GadgetT(pb, annotation_prefix),

        merkleRootBefore(_merkleRoot),

        leafBefore(pb, libsnark::ONE, {publicKey.x, publicKey.y, token, balanceBefore}, FMT(annotation_prefix, ".leafBefore")),
        leafAfter(pb, libsnark::ONE, {publicKey.x, publicKey.y, token, balanceAfter}, FMT(annotation_prefix, ".leafAfter")),

        proof(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(annotation_prefix, ".proof"))),
        proofVerifierBefore(pb, TREE_DEPTH_ACCOUNTS, address, merkle_tree_IVs(pb), leafBefore.result(), merkleRootBefore, proof, FMT(annotation_prefix, ".pathBefore")),
        rootCalculatorAfter(pb, TREE_DEPTH_ACCOUNTS, address, merkle_tree_IVs(pb), leafAfter.result(), proof, FMT(annotation_prefix, ".pathAfter"))
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

        proof.fill_with_field_elements(this->pb, _proof.data);
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

class RingSettlementGadget : public GadgetT
{
public:
    const VariableT tradingHistoryMerkleRoot;
    const VariableT accountsMerkleRoot;

    OrderGadget orderA;
    OrderGadget orderB;

    libsnark::dual_variable_gadget<FieldT> fillS_A;
    libsnark::dual_variable_gadget<FieldT> fillB_A;
    libsnark::dual_variable_gadget<FieldT> fillF_A;
    libsnark::dual_variable_gadget<FieldT> fillS_B;
    libsnark::dual_variable_gadget<FieldT> fillB_B;
    libsnark::dual_variable_gadget<FieldT> fillF_B;

    VariableT balanceS_A_before;
    VariableT balanceB_A_before;
    VariableT balanceF_A_before;
    VariableT balanceF_WA_before;
    VariableT balanceS_B_before;
    VariableT balanceB_B_before;
    VariableT balanceF_B_before;
    VariableT balanceF_WB_before;
    subadd_gadget balanceSB_A;
    subadd_gadget balanceSB_B;
    subadd_gadget balanceF_A;
    subadd_gadget balanceF_B;

    UpdateFilledGadget updateFilledA;
    UpdateFilledGadget updateFilledB;

    UpdateBalanceGadget updateBalanceS_A;
    UpdateBalanceGadget updateBalanceB_A;
    UpdateBalanceGadget updateBalanceF_A;
    UpdateBalanceGadget updateBalanceF_WA;
    UpdateBalanceGadget updateBalanceS_B;
    UpdateBalanceGadget updateBalanceB_B;
    UpdateBalanceGadget updateBalanceF_B;
    UpdateBalanceGadget updateBalanceF_WB;

    LeqGadget filledLeqA;
    LeqGadget filledLeqB;

    RateCheckerGadget rateCheckerA;
    RateCheckerGadget rateCheckerB;

    RateCheckerGadget rateCheckerFeeA;
    RateCheckerGadget rateCheckerFeeB;

    LeqGadget matchLeqA;
    LeqGadget matchLeqB;

    RingSettlementGadget(
        ProtoboardT& pb,
        const jubjub::Params& params,
        const VariableT& _tradingHistoryMerkleRoot,
        const VariableT& _accountsMerkleRoot,
        const std::string& annotation_prefix
    ) :
        GadgetT(pb, annotation_prefix),

        orderA(pb, params, FMT(annotation_prefix, ".orderA")),
        orderB(pb, params, FMT(annotation_prefix, ".orderB")),

        fillS_A(pb, 96, FMT(annotation_prefix, ".fillS_A")),
        fillB_A(pb, 96, FMT(annotation_prefix, ".fillB_A")),
        fillF_A(pb, 96, FMT(annotation_prefix, ".fillF_A")),
        fillS_B(pb, 96, FMT(annotation_prefix, ".fillS_B")),
        fillB_B(pb, 96, FMT(annotation_prefix, ".fillB_B")),
        fillF_B(pb, 96, FMT(annotation_prefix, ".fillF_B")),

        balanceS_A_before(make_variable(pb, FMT(annotation_prefix, ".balanceS_A_before"))),
        balanceB_A_before(make_variable(pb, FMT(annotation_prefix, ".balanceB_A_before"))),
        balanceF_A_before(make_variable(pb, FMT(annotation_prefix, ".balanceF_A_before"))),
        balanceF_WA_before(make_variable(pb, FMT(annotation_prefix, ".balanceF_WA_before"))),
        balanceS_B_before(make_variable(pb, FMT(annotation_prefix, ".balanceS_B_before"))),
        balanceB_B_before(make_variable(pb, FMT(annotation_prefix, ".balanceB_B_before"))),
        balanceF_B_before(make_variable(pb, FMT(annotation_prefix, ".balanceF_B_before"))),
        balanceF_WB_before(make_variable(pb, FMT(annotation_prefix, ".balanceF_WB_before"))),
        balanceSB_A(pb, 96, balanceS_A_before, balanceB_B_before, fillS_A.packed, FMT(annotation_prefix, ".balanceSB_A")),
        balanceSB_B(pb, 96, balanceS_B_before, balanceB_A_before, fillS_B.packed, FMT(annotation_prefix, ".balanceSB_B")),
        balanceF_A(pb, 96, balanceF_A_before, balanceF_WA_before, fillF_A.packed, FMT(annotation_prefix, ".balanceF_A")),
        balanceF_B(pb, 96, balanceF_B_before, balanceF_WB_before, fillF_B.packed, FMT(annotation_prefix, ".balanceF_B")),

        tradingHistoryMerkleRoot(_tradingHistoryMerkleRoot),
        updateFilledA(pb, tradingHistoryMerkleRoot, flatten({orderA.orderID.bits, orderA.accountS.bits}), FMT(annotation_prefix, ".updateFilledA")),
        updateFilledB(pb, updateFilledA.result(), flatten({orderB.orderID.bits, orderB.accountS.bits}), FMT(annotation_prefix, ".updateFilledB")),

        accountsMerkleRoot(_accountsMerkleRoot),
        updateBalanceS_A(pb, accountsMerkleRoot,        orderA.accountS.bits, orderA.publicKey, orderA.dexID.packed, orderA.tokenS, balanceS_A_before, balanceSB_A.X, FMT(annotation_prefix, ".updateBalanceS_A")),
        updateBalanceB_A(pb, updateBalanceS_A.result(), orderA.accountB.bits, orderA.publicKey, orderA.dexID.packed, orderA.tokenB, balanceB_A_before, balanceSB_B.Y, FMT(annotation_prefix, ".updateBalanceB_A")),
        updateBalanceF_A(pb, updateBalanceB_A.result(), orderA.accountF.bits, orderA.publicKey, orderA.dexID.packed, orderA.tokenF, balanceF_A_before, balanceF_A.X, FMT(annotation_prefix, ".updateBalanceF_A")),
        updateBalanceF_WA(pb, updateBalanceF_A.result(), orderA.walletF.bits, orderA.walletPublicKey, orderA.dexID.packed, orderA.tokenF, balanceF_WA_before, balanceF_A.Y, FMT(annotation_prefix, ".updateBalanceF_WA")),
        updateBalanceS_B(pb, updateBalanceF_WA.result(), orderB.accountS.bits, orderB.publicKey, orderB.dexID.packed, orderB.tokenS, balanceS_B_before, balanceSB_B.X, FMT(annotation_prefix, ".updateBalanceS_B")),
        updateBalanceB_B(pb, updateBalanceS_B.result(), orderB.accountB.bits, orderB.publicKey, orderB.dexID.packed, orderB.tokenB, balanceB_B_before, balanceSB_A.Y, FMT(annotation_prefix, ".updateBalanceB_B")),
        updateBalanceF_B(pb, updateBalanceB_B.result(), orderB.accountF.bits, orderB.publicKey, orderB.dexID.packed, orderB.tokenF, balanceF_B_before, balanceF_B.X, FMT(annotation_prefix, ".updateBalanceF_B")),
        updateBalanceF_WB(pb, updateBalanceF_B.result(), orderB.walletF.bits, orderB.walletPublicKey, orderB.dexID.packed, orderB.tokenF, balanceF_WB_before, balanceF_B.Y, FMT(annotation_prefix, ".updateBalanceF_WB")),

        filledLeqA(pb, updateFilledA.getFilledAfter(), orderA.amountS.packed, FMT(annotation_prefix, ".filled_A < .amountSA")),
        filledLeqB(pb, updateFilledB.getFilledAfter(), orderB.amountS.packed, FMT(annotation_prefix, ".filled_B < .amountSB")),

        rateCheckerA(pb, fillS_A.packed, fillB_A.packed, orderA.amountS.packed, orderA.amountB.packed, FMT(annotation_prefix, ".rateA")),
        rateCheckerB(pb, fillS_B.packed, fillB_B.packed, orderA.amountB.packed, orderB.amountB.packed, FMT(annotation_prefix, ".rateB")),

        rateCheckerFeeA(pb, fillF_A.packed, fillS_A.packed, orderA.amountF.packed, orderA.amountS.packed, FMT(annotation_prefix, ".rateFeeA")),
        rateCheckerFeeB(pb, fillF_B.packed, fillS_B.packed, orderA.amountF.packed, orderB.amountS.packed, FMT(annotation_prefix, ".rateFeeB")),

        matchLeqA(pb, fillB_B.packed, fillS_A.packed, FMT(annotation_prefix, ".fillB_B <= .fillS_A")),
        matchLeqB(pb, fillB_A.packed, fillS_B.packed, FMT(annotation_prefix, ".fillB_A <= .fillS_B"))
    {

    }

    const VariableT getNewTradingHistoryMerkleRoot() const
    {
        return updateFilledB.result();
    }

    const VariableT getNewAccountsMerkleRoot() const
    {
        return updateBalanceB_B.result();
    }

    const std::vector<VariableArrayT> getPublicData() const
    {
        return {orderA.dexID.bits, orderA.orderID.bits,
                orderA.accountS.bits, orderB.accountB.bits, fillS_A.bits,
                orderA.accountF.bits, fillF_A.bits,

                orderB.dexID.bits, orderB.orderID.bits,
                orderB.accountS.bits, orderA.accountB.bits, fillS_B.bits,
                orderB.accountF.bits, fillF_B.bits};
    }

    void generate_r1cs_witness (const RingSettlement& ringSettlement)
    {
        orderA.generate_r1cs_witness(ringSettlement.ring.orderA);
        orderB.generate_r1cs_witness(ringSettlement.ring.orderB);

        fillS_A.bits.fill_with_bits_of_field_element(this->pb, ringSettlement.ring.fillS_A);
        fillS_A.generate_r1cs_witness_from_bits();
        fillB_A.bits.fill_with_bits_of_field_element(this->pb, ringSettlement.ring.fillB_A);
        fillB_A.generate_r1cs_witness_from_bits();
        fillF_A.bits.fill_with_bits_of_field_element(this->pb, ringSettlement.ring.fillF_A);
        fillF_A.generate_r1cs_witness_from_bits();
        fillS_B.bits.fill_with_bits_of_field_element(this->pb, ringSettlement.ring.fillS_B);
        fillS_B.generate_r1cs_witness_from_bits();
        fillB_B.bits.fill_with_bits_of_field_element(this->pb, ringSettlement.ring.fillB_B);
        fillB_B.generate_r1cs_witness_from_bits();
        fillF_B.bits.fill_with_bits_of_field_element(this->pb, ringSettlement.ring.fillF_B);
        fillF_B.generate_r1cs_witness_from_bits();

        this->pb.val(balanceS_A_before) = ringSettlement.balanceUpdateS_A.before.balance;
        this->pb.val(balanceB_A_before) = ringSettlement.balanceUpdateB_A.before.balance;
        this->pb.val(balanceF_A_before) = ringSettlement.balanceUpdateF_A.before.balance;
        this->pb.val(balanceF_WA_before) = ringSettlement.balanceUpdateF_WA.before.balance;
        this->pb.val(balanceS_B_before) = ringSettlement.balanceUpdateS_B.before.balance;
        this->pb.val(balanceB_B_before) = ringSettlement.balanceUpdateB_B.before.balance;
        this->pb.val(balanceF_B_before) = ringSettlement.balanceUpdateF_B.before.balance;
        this->pb.val(balanceF_WB_before) = ringSettlement.balanceUpdateF_WB.before.balance;
        balanceSB_A.generate_r1cs_witness();
        balanceSB_B.generate_r1cs_witness();
        balanceF_A.generate_r1cs_witness();
        balanceF_B.generate_r1cs_witness();

        //
        // Update trading history
        //

        this->pb.val(tradingHistoryMerkleRoot) = ringSettlement.tradingHistoryMerkleRoot;
        updateFilledA.generate_r1cs_witness(ringSettlement.filledA, ringSettlement.proofFilledA, fillS_A);
        updateFilledB.generate_r1cs_witness(ringSettlement.filledB, ringSettlement.proofFilledB, fillS_B);

        filledLeqA.generate_r1cs_witness();
        filledLeqB.generate_r1cs_witness();

        //
        // Update accounts
        //

        updateBalanceS_A.generate_r1cs_witness(ringSettlement.balanceUpdateS_A.proof);
        updateBalanceB_A.generate_r1cs_witness(ringSettlement.balanceUpdateB_A.proof);
        updateBalanceF_A.generate_r1cs_witness(ringSettlement.balanceUpdateF_A.proof);
        updateBalanceF_WA.generate_r1cs_witness(ringSettlement.balanceUpdateF_WA.proof);
        updateBalanceS_B.generate_r1cs_witness(ringSettlement.balanceUpdateS_B.proof);
        updateBalanceB_B.generate_r1cs_witness(ringSettlement.balanceUpdateB_B.proof);
        updateBalanceF_B.generate_r1cs_witness(ringSettlement.balanceUpdateF_B.proof);
        updateBalanceF_WB.generate_r1cs_witness(ringSettlement.balanceUpdateF_WB.proof);

        //
        // Matching
        //

        // Check rates
        rateCheckerA.generate_r1cs_witness();
        rateCheckerB.generate_r1cs_witness();
        rateCheckerFeeA.generate_r1cs_witness();
        rateCheckerFeeB.generate_r1cs_witness();

        // Check settlement
        matchLeqA.generate_r1cs_witness();
        matchLeqB.generate_r1cs_witness();
    }


    void generate_r1cs_constraints()
    {
        orderA.generate_r1cs_constraints();
        orderB.generate_r1cs_constraints();

        fillS_A.generate_r1cs_constraints(true);
        fillB_A.generate_r1cs_constraints(true);
        fillF_A.generate_r1cs_constraints(true);
        fillS_B.generate_r1cs_constraints(true);
        fillB_B.generate_r1cs_constraints(true);
        fillF_B.generate_r1cs_constraints(true);

        balanceSB_A.generate_r1cs_constraints();
        balanceSB_B.generate_r1cs_constraints();
        balanceF_A.generate_r1cs_constraints();
        balanceF_B.generate_r1cs_constraints();


        //
        // Update trading history
        //

        updateFilledA.generate_r1cs_constraints(fillS_A);
        updateFilledB.generate_r1cs_constraints(fillS_B);

        filledLeqA.generate_r1cs_constraints();
        filledLeqB.generate_r1cs_constraints();

        //
        // Update accounts
        //

        updateBalanceS_A.generate_r1cs_constraints();
        updateBalanceB_A.generate_r1cs_constraints();
        updateBalanceF_A.generate_r1cs_constraints();
        updateBalanceF_WA.generate_r1cs_constraints();
        updateBalanceS_B.generate_r1cs_constraints();
        updateBalanceB_B.generate_r1cs_constraints();
        updateBalanceF_B.generate_r1cs_constraints();
        updateBalanceF_WB.generate_r1cs_constraints();

        //
        // Matching
        //

        // Check if tokenS/tokenB match
        pb.add_r1cs_constraint(ConstraintT(orderA.tokenS, 1, orderB.tokenB), "orderA.tokenS == orderB.tokenB");
        pb.add_r1cs_constraint(ConstraintT(orderA.tokenB, 1, orderB.tokenS), "orderA.tokenB == orderB.tokenS");

        // Check rates
        rateCheckerA.generate_r1cs_constraints();
        rateCheckerB.generate_r1cs_constraints();
        rateCheckerFeeA.generate_r1cs_constraints();
        rateCheckerFeeB.generate_r1cs_constraints();

        // Check settlement
        matchLeqA.generate_r1cs_constraints();
        matchLeqB.generate_r1cs_constraints();
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

    std::vector<VariableArrayT> publicDataBits;
    VariableArrayT publicData;

    sha256_many* publicDataHasher;

    TradeCircuitGadget(ProtoboardT& pb, const std::string& annotation_prefix) :
        GadgetT(pb, annotation_prefix),

        publicDataHash(pb, 256, FMT(annotation_prefix, ".publicDataHash")),

        tradingHistoryMerkleRootBefore(pb, 256, FMT(annotation_prefix, ".tradingHistoryMerkleRootBefore")),
        tradingHistoryMerkleRootAfter(pb, 256, FMT(annotation_prefix, ".tradingHistoryMerkleRootAfter")),
        accountsMerkleRootBefore(pb, 256, FMT(annotation_prefix, ".accountsMerkleRootBefore")),
        accountsMerkleRootAfter(pb, 256, FMT(annotation_prefix, ".accountsMerkleRootAfter"))
    {
        this->publicDataHasher = nullptr;
    }

    ~TradeCircuitGadget()
    {
        if (publicDataHasher)
        {
            delete publicDataHasher;
        }
    }

    void generate_r1cs_constraints(int numRings)
    {
        this->numRings = numRings;

        pb.set_input_sizes(1);
        tradingHistoryMerkleRootBefore.generate_r1cs_constraints(true);
        publicDataBits.push_back(tradingHistoryMerkleRootBefore.bits);
        publicDataBits.push_back(tradingHistoryMerkleRootAfter.bits);
        for (size_t j = 0; j < numRings; j++)
        {
            VariableT ringTradingHistoryMerkleRoot = (j == 0) ? tradingHistoryMerkleRootBefore.packed : ringSettlements.back().getNewTradingHistoryMerkleRoot();
            VariableT ringAccountsMerkleRoot = (j == 0) ? accountsMerkleRootBefore.packed : ringSettlements.back().getNewTradingHistoryMerkleRoot();
            ringSettlements.emplace_back(pb, params, ringTradingHistoryMerkleRoot, ringAccountsMerkleRoot, "ringSettlement");

            // Store transfers from ring settlement
            std::vector<VariableArrayT> ringPublicData = ringSettlements.back().getPublicData();
            publicDataBits.insert(publicDataBits.end(), ringPublicData.begin(), ringPublicData.end());
        }

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

        // Make sure the merkle root afterwards is correctly passed in
        pb.add_r1cs_constraint(ConstraintT(ringSettlements.back().getNewTradingHistoryMerkleRoot(), 1, tradingHistoryMerkleRootAfter.packed), "newMerkleRoot");
    }

    void printInfo()
    {
        std::cout << pb.num_constraints() << " constraints (" << (pb.num_constraints() / numRings) << "/ring)" << std::endl;
    }

    bool generateWitness(const std::vector<Loopring::RingSettlement>& ringSettlementsData,
                         const std::string& strTradingHistoryMerkleRootBefore, const std::string& strTradingHistoryMerkleRootAfter,
                         const std::string& strAccountsMerkleRootBefore, const std::string& strAccountsMerkleRootAfter)
    {
        ethsnarks::FieldT tradingHistoryMerkleRootBeforeValue = ethsnarks::FieldT(strTradingHistoryMerkleRootBefore.c_str());
        ethsnarks::FieldT tradingHistoryMerkleRootAfterValue = ethsnarks::FieldT(strTradingHistoryMerkleRootAfter.c_str());
        tradingHistoryMerkleRootBefore.bits.fill_with_bits_of_field_element(this->pb, tradingHistoryMerkleRootBeforeValue);
        tradingHistoryMerkleRootBefore.generate_r1cs_witness_from_bits();
        tradingHistoryMerkleRootAfter.bits.fill_with_bits_of_field_element(this->pb, tradingHistoryMerkleRootAfterValue);
        tradingHistoryMerkleRootAfter.generate_r1cs_witness_from_bits();

        ethsnarks::FieldT accountsMerkleRootBeforeValue = ethsnarks::FieldT(strAccountsMerkleRootBefore.c_str());
        ethsnarks::FieldT accountsMerkleRootAfterValue = ethsnarks::FieldT(strAccountsMerkleRootAfter.c_str());
        accountsMerkleRootBefore.bits.fill_with_bits_of_field_element(this->pb, accountsMerkleRootBeforeValue);
        accountsMerkleRootBefore.generate_r1cs_witness_from_bits();
        accountsMerkleRootAfter.bits.fill_with_bits_of_field_element(this->pb, accountsMerkleRootAfterValue);
        accountsMerkleRootAfter.generate_r1cs_witness_from_bits();

        for(unsigned int i = 0; i < ringSettlementsData.size(); i++)
        {
            ringSettlements[i].generate_r1cs_witness(ringSettlementsData[i]);
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

class DepositGadget : public GadgetT
{
public:
    typedef merkle_path_authenticator<LongsightL12p5_MP_gadget> MerklePathCheckT;
    typedef markle_path_compute<LongsightL12p5_MP_gadget> MerklePathT;

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

    LongsightL12p5_MP_gadget leafBefore;
    LongsightL12p5_MP_gadget leafAfter;

    const VariableArrayT proof;
    MerklePathCheckT proofVerifierBefore;
    MerklePathT rootCalculatorAfter;

    DepositGadget(
        ProtoboardT& pb,
        const VariableT& _merkleRoot,
        const std::string& annotation_prefix
    ) :
        GadgetT(pb, annotation_prefix),

        address(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(annotation_prefix, ".address"))),

        emptyPublicKeyX(make_variable(pb, 0, FMT(annotation_prefix, ".emptyPublicKeyX"))),
        emptyPublicKeyY(make_variable(pb, 0, FMT(annotation_prefix, ".emptyPublicKeyY"))),
        emptyDex(make_variable(pb, 0, FMT(annotation_prefix, ".emptyDex"))),
        emptyToken(make_variable(pb, 0, FMT(annotation_prefix, ".emptyToken"))),
        emptyBalance(make_variable(pb, 0, FMT(annotation_prefix, ".emptyBalance"))),

        publicKeyX(pb, 256, FMT(annotation_prefix, ".publicKeyX")),
        publicKeyY(pb, 256, FMT(annotation_prefix, ".publicKeyY")),
        dex(pb, 16, FMT(annotation_prefix, ".dex")),
        token(pb, 16, FMT(annotation_prefix, ".token")),
        balance(pb, 96, FMT(annotation_prefix, ".balance")),

        merkleRootBefore(_merkleRoot),

        leafBefore(pb, libsnark::ONE, {emptyPublicKeyX, emptyPublicKeyY, emptyToken, emptyBalance}, FMT(annotation_prefix, ".leafBefore")),
        leafAfter(pb, libsnark::ONE, {publicKeyX.packed, publicKeyY.packed, token.packed, balance.packed}, FMT(annotation_prefix, ".leafAfter")),

        proof(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(annotation_prefix, ".proof"))),
        proofVerifierBefore(pb, TREE_DEPTH_ACCOUNTS, address, merkle_tree_IVs(pb), leafBefore.result(), merkleRootBefore, proof, FMT(annotation_prefix, ".pathBefore")),
        rootCalculatorAfter(pb, TREE_DEPTH_ACCOUNTS, address, merkle_tree_IVs(pb), leafAfter.result(), proof, FMT(annotation_prefix, ".pathAfter"))
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
        address.fill_with_bits_of_field_element(this->pb, deposit.address);

        publicKeyX.bits.fill_with_bits_of_field_element(this->pb, deposit.balanceUpdate.after.publicKey.x);
        publicKeyX.generate_r1cs_witness_from_bits();
        publicKeyY.bits.fill_with_bits_of_field_element(this->pb, deposit.balanceUpdate.after.publicKey.y);
        publicKeyY.generate_r1cs_witness_from_bits();
        dex.bits.fill_with_bits_of_field_element(this->pb, deposit.balanceUpdate.after.dexID);
        dex.generate_r1cs_witness_from_bits();
        token.bits.fill_with_bits_of_field_element(this->pb, deposit.balanceUpdate.after.token);
        token.generate_r1cs_witness_from_bits();
        balance.bits.fill_with_bits_of_field_element(this->pb, deposit.balanceUpdate.after.balance);
        balance.generate_r1cs_witness_from_bits();

        leafBefore.generate_r1cs_witness();
        leafAfter.generate_r1cs_witness();

        proof.fill_with_field_elements(this->pb, deposit.balanceUpdate.proof.data);
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

    DepositsCircuitGadget(ProtoboardT& pb, const std::string& annotation_prefix) :
        GadgetT(pb, annotation_prefix),

        publicDataHash(pb, 256, FMT(annotation_prefix, ".publicDataHash")),

        accountsMerkleRootBefore(pb, 256, FMT(annotation_prefix, ".accountsMerkleRootBefore")),
        accountsMerkleRootAfter(pb, 256, FMT(annotation_prefix, ".accountsMerkleRootAfter"))
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

        // publicDataHash.generate_r1cs_constraints(true);
        for (auto& deposit : deposits)
        {
            deposit.generate_r1cs_constraints();
        }

        // Check public data
        /*publicData = flattenReverse(publicDataBits);
        publicDataHasher = new sha256_many(pb, publicData, ".publicDataHash");
        publicDataHasher->generate_r1cs_constraints();

        // Check that the hash matches the public input
        for (unsigned int i = 0; i < 256; i++)
        {
            pb.add_r1cs_constraint(ConstraintT(publicDataHasher->result().bits[255-i], 1, publicDataHash.bits[i]), "publicData.check()");
        }

        // Make sure the merkle root afterwards is correctly passed in
        //pb.add_r1cs_constraint(ConstraintT(ringSettlements.back().getNewTradingHistoryMerkleRoot(), 1, tradingHistoryMerkleRootAfter.packed), "newMerkleRoot");
        */
    }

    void printInfo()
    {
        std::cout << pb.num_constraints() << " constraints (" << (pb.num_constraints() / numAccounts) << "/account)" << std::endl;
    }

    bool generateWitness(const std::vector<Loopring::Deposit>& depositsData,
                         const std::string& strAccountsMerkleRootBefore, const std::string& strAccountsMerkleRootAfter)
    {
        ethsnarks::FieldT accountsMerkleRootBeforeValue = ethsnarks::FieldT(strAccountsMerkleRootBefore.c_str());
        ethsnarks::FieldT accountsMerkleRootAfterValue = ethsnarks::FieldT(strAccountsMerkleRootAfter.c_str());
        accountsMerkleRootBefore.bits.fill_with_bits_of_field_element(this->pb, accountsMerkleRootBeforeValue);
        accountsMerkleRootBefore.generate_r1cs_witness_from_bits();
        accountsMerkleRootAfter.bits.fill_with_bits_of_field_element(this->pb, accountsMerkleRootAfterValue);
        accountsMerkleRootAfter.generate_r1cs_witness_from_bits();

        for(unsigned int i = 0; i < depositsData.size(); i++)
        {
            deposits[i].generate_r1cs_witness(depositsData[i]);
        }

        /*publicDataHasher->generate_r1cs_witness();

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
        printBits("Hash bits: ", publicDataHasher->result().bits.get_bits(pb), true);*/

        return true;
    }
};

class WithdrawalGadget : public GadgetT
{
public:
    typedef merkle_path_authenticator<LongsightL12p5_MP_gadget> MerklePathCheckT;
    typedef markle_path_compute<LongsightL12p5_MP_gadget> MerklePathT;

    const VariableT merkleRootBefore;

    const jubjub::VariablePointT publicKey;

    VariableArrayT account;
    libsnark::dual_variable_gadget<FieldT> amount;
    libsnark::dual_variable_gadget<FieldT> padding;

    VariableT dex;
    VariableT token;
    VariableT balance_before;
    VariableT balance_after;

    UpdateBalanceGadget updateBalance;

    // variables for signature
    const jubjub::VariablePointT sig_R;
    const VariableArrayT sig_s;
    const VariableArrayT sig_m;
    jubjub::PureEdDSA_Verify signatureVerifier;

    WithdrawalGadget(
        ProtoboardT& pb,
        const jubjub::Params& params,
        const VariableT& _merkleRoot,
        const std::string& annotation_prefix
    ) :
        GadgetT(pb, annotation_prefix),

        merkleRootBefore(_merkleRoot),

        publicKey(pb, FMT(annotation_prefix, ".publicKey")),

        account(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(annotation_prefix, ".account"))),
        amount(pb, 96, FMT(annotation_prefix, ".amount")),
        padding(pb, 2, FMT(annotation_prefix, ".padding")),

        dex(make_variable(pb, FMT(annotation_prefix, ".dex"))),
        token(make_variable(pb, FMT(annotation_prefix, ".token"))),
        balance_before(make_variable(pb, FMT(annotation_prefix, ".balance_before"))),
        balance_after(make_variable(pb, FMT(annotation_prefix, ".balance_after"))),

        updateBalance(pb, merkleRootBefore, account, publicKey, dex, token, balance_before, balance_after, FMT(annotation_prefix, ".updateBalance")),

        sig_R(pb, FMT(annotation_prefix, ".R")),
        sig_s(make_var_array(pb, FieldT::size_in_bits(), FMT(annotation_prefix, ".s"))),
        sig_m(flatten({account, amount.bits, padding.bits})),

        signatureVerifier(pb, params, jubjub::EdwardsPoint(params.Gx, params.Gy), publicKey, sig_R, sig_s, sig_m, FMT(annotation_prefix, ".signatureVerifier"))
    {

    }

    const VariableT getNewAccountsMerkleRoot() const
    {
        return updateBalance.result();
    }

    const std::vector<VariableArrayT> getPublicData() const
    {
        return {account, amount.bits};
    }

    void generate_r1cs_witness(const Withdrawal& withdrawal)
    {
        this->pb.val(publicKey.x) = withdrawal.publicKey.x;
        this->pb.val(publicKey.y) = withdrawal.publicKey.y;

        account.fill_with_bits_of_field_element(this->pb, withdrawal.account);

        amount.bits.fill_with_bits_of_field_element(this->pb, withdrawal.amount);
        amount.generate_r1cs_witness_from_bits();

        padding.bits.fill_with_bits_of_field_element(this->pb, 0);
        padding.generate_r1cs_witness_from_bits();

        this->pb.val(dex) = withdrawal.balanceUpdate.before.dexID;
        this->pb.val(token) = withdrawal.balanceUpdate.before.token;
        this->pb.val(balance_before) = withdrawal.balanceUpdate.before.balance;
        this->pb.val(balance_after) = withdrawal.balanceUpdate.after.balance;

        updateBalance.generate_r1cs_witness(withdrawal.balanceUpdate.proof);

        this->pb.val(sig_R.x) = withdrawal.sig.R.x;
        this->pb.val(sig_R.y) = withdrawal.sig.R.y;
        sig_s.fill_with_bits_of_field_element(this->pb, withdrawal.sig.s);
        signatureVerifier.generate_r1cs_witness();
    }

    void generate_r1cs_constraints()
    {
        amount.generate_r1cs_constraints(true);
        padding.generate_r1cs_constraints(true);

        //signatureVerifier.generate_r1cs_constraints();

        updateBalance.generate_r1cs_constraints();
    }
};

class WithdrawalsCircuitGadget : public GadgetT
{
public:

    unsigned int numAccounts;
    std::vector<WithdrawalGadget> withdrawals;

    libsnark::dual_variable_gadget<FieldT> publicDataHash;
    libsnark::dual_variable_gadget<FieldT> accountsMerkleRootBefore;
    libsnark::dual_variable_gadget<FieldT> accountsMerkleRootAfter;

    std::vector<VariableArrayT> publicDataBits;
    VariableArrayT publicData;

    sha256_many* publicDataHasher;

    WithdrawalsCircuitGadget(ProtoboardT& pb, const std::string& annotation_prefix) :
        GadgetT(pb, annotation_prefix),

        publicDataHash(pb, 256, FMT(annotation_prefix, ".publicDataHash")),

        accountsMerkleRootBefore(pb, 256, FMT(annotation_prefix, ".accountsMerkleRootBefore")),
        accountsMerkleRootAfter(pb, 256, FMT(annotation_prefix, ".accountsMerkleRootAfter"))
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
        jubjub::Params params;

        pb.set_input_sizes(1);
        accountsMerkleRootBefore.generate_r1cs_constraints(true);
        publicDataBits.push_back(accountsMerkleRootBefore.bits);
        publicDataBits.push_back(accountsMerkleRootAfter.bits);
        for (size_t j = 0; j < numAccounts; j++)
        {
            VariableT withdrawalAccountsMerkleRoot = (j == 0) ? accountsMerkleRootBefore.packed : withdrawals.back().getNewAccountsMerkleRoot();
            withdrawals.emplace_back(pb, params, withdrawalAccountsMerkleRoot, std::string("withdrawals") + std::to_string(j));

            // Store data from withdrawal
            //std::vector<VariableArrayT> ringPublicData = deposits.back().getPublicData();
            //publicDataBits.insert(publicDataBits.end(), ringPublicData.begin(), ringPublicData.end());
        }

        // publicDataHash.generate_r1cs_constraints(true);
        for (auto& withdrawal : withdrawals)
        {
            withdrawal.generate_r1cs_constraints();
        }

        // Check public data
        /*publicData = flattenReverse(publicDataBits);
        publicDataHasher = new sha256_many(pb, publicData, ".publicDataHash");
        publicDataHasher->generate_r1cs_constraints();

        // Check that the hash matches the public input
        for (unsigned int i = 0; i < 256; i++)
        {
            pb.add_r1cs_constraint(ConstraintT(publicDataHasher->result().bits[255-i], 1, publicDataHash.bits[i]), "publicData.check()");
        }

        // Make sure the merkle root afterwards is correctly passed in
        //pb.add_r1cs_constraint(ConstraintT(ringSettlements.back().getNewTradingHistoryMerkleRoot(), 1, tradingHistoryMerkleRootAfter.packed), "newMerkleRoot");
        */
    }

    void printInfo()
    {
        std::cout << pb.num_constraints() << " constraints (" << (pb.num_constraints() / numAccounts) << "/account)" << std::endl;
    }

    bool generateWitness(const std::vector<Loopring::Withdrawal>& withdrawalsData,
                         const std::string& strAccountsMerkleRootBefore, const std::string& strAccountsMerkleRootAfter)
    {
        ethsnarks::FieldT accountsMerkleRootBeforeValue = ethsnarks::FieldT(strAccountsMerkleRootBefore.c_str());
        ethsnarks::FieldT accountsMerkleRootAfterValue = ethsnarks::FieldT(strAccountsMerkleRootAfter.c_str());
        accountsMerkleRootBefore.bits.fill_with_bits_of_field_element(this->pb, accountsMerkleRootBeforeValue);
        accountsMerkleRootBefore.generate_r1cs_witness_from_bits();
        accountsMerkleRootAfter.bits.fill_with_bits_of_field_element(this->pb, accountsMerkleRootAfterValue);
        accountsMerkleRootAfter.generate_r1cs_witness_from_bits();

        for(unsigned int i = 0; i < withdrawalsData.size(); i++)
        {
            withdrawals[i].generate_r1cs_witness(withdrawalsData[i]);
        }

        /*publicDataHasher->generate_r1cs_witness();

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
        printBits("Hash bits: ", publicDataHasher->result().bits.get_bits(pb), true);*/

        return true;
    }
};


}

#endif
