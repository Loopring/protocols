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

}

#endif
