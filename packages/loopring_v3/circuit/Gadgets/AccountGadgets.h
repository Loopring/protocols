#ifndef _ACCOUNTGADGETS_H_
#define _ACCOUNTGADGETS_H_

#include "../Utils/Constants.h"
#include "../Utils/Data.h"

#include "ethsnarks.hpp"
#include "utils.hpp"
#include "gadgets/mimc.hpp"
#include "gadgets/merkle_tree.hpp"

using namespace ethsnarks;

namespace Loopring
{

struct AccountState
{
    const VariableT publicKeyX;
    const VariableT publicKeyY;
    const VariableT nonce;
    const VariableT balancesRoot;
};

class UpdateAccountGadget : public GadgetT
{
public:
    typedef merkle_path_authenticator<MiMC_hash_gadget> MerklePathCheckT;
    typedef markle_path_compute<MiMC_hash_gadget> MerklePathT;

    MiMC_hash_gadget leafBefore;
    MiMC_hash_gadget leafAfter;

    const VariableArrayT proof;
    MerklePathCheckT proofVerifierBefore;
    MerklePathT rootCalculatorAfter;

    UpdateAccountGadget(
        ProtoboardT& pb,
        const VariableT& root,
        const VariableArrayT& address,
        const AccountState& before,
        const AccountState& after,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        leafBefore(pb, libsnark::ONE, {before.publicKeyX, before.publicKeyY, before.nonce, before.balancesRoot}, FMT(prefix, ".leafBefore")),
        leafAfter(pb, libsnark::ONE, {after.publicKeyX, after.publicKeyY, after.nonce, after.balancesRoot}, FMT(prefix, ".leafAfter")),

        proof(make_var_array(pb, TREE_DEPTH_ACCOUNTS, FMT(prefix, ".proof"))),
        proofVerifierBefore(pb, TREE_DEPTH_ACCOUNTS, address, merkle_tree_IVs(pb), leafBefore.result(), root, proof, FMT(prefix, ".pathBefore")),
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

struct BalanceState
{
    const VariableT balance;
    const VariableT tradingHistory;
};

class UpdateBalanceGadget : public GadgetT
{
public:
    typedef merkle_path_authenticator<MiMC_hash_gadget> MerklePathCheckT;
    typedef markle_path_compute<MiMC_hash_gadget> MerklePathT;

    MiMC_hash_gadget leafBefore;
    MiMC_hash_gadget leafAfter;

    const VariableArrayT proof;
    MerklePathCheckT proofVerifierBefore;
    MerklePathT rootCalculatorAfter;

    UpdateBalanceGadget(
        ProtoboardT& pb,
        const VariableT& root,
        const VariableArrayT& tokenID,
        const BalanceState before,
        const BalanceState after,
        const std::string& prefix
    ) :
        GadgetT(pb, prefix),

        leafBefore(pb, libsnark::ONE, {before.balance, before.tradingHistory}, FMT(prefix, ".leafBefore")),
        leafAfter(pb, libsnark::ONE, {after.balance, after.tradingHistory}, FMT(prefix, ".leafAfter")),

        proof(make_var_array(pb, TREE_DEPTH_TOKENS, FMT(prefix, ".proof"))),
        proofVerifierBefore(pb, TREE_DEPTH_TOKENS, tokenID, merkle_tree_IVs(pb), leafBefore.result(), root, proof, FMT(prefix, ".pathBefore")),
        rootCalculatorAfter(pb, TREE_DEPTH_TOKENS, tokenID, merkle_tree_IVs(pb), leafAfter.result(), proof, FMT(prefix, ".pathAfter"))
    {

    }

    const VariableT getNewRoot() const
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

}

#endif
