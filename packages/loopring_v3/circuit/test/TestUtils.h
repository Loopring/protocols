#ifndef _TEST_UTILS_H_
#define _TEST_UTILS_H_

#include "ethsnarks.hpp"
#include "../Utils/Utils.h"
#include "../ThirdParty/BigIntHeader.hpp"

using namespace std;
using namespace libff;
using namespace libsnark;
using namespace ethsnarks;
using namespace Loopring;

static const char *TEST_DATA_PATH = "./circuit/test/data/";
static BigInt SNARK_SCALAR_FIELD = BigInt("2188824287183927522224640574525727508854836440041603434369820418657"
                                          "5808495617");

static const BigInt &validate(const BigInt &v)
{
    // Check for overflow
    REQUIRE(v < SNARK_SCALAR_FIELD);
    // Check for underflow
    REQUIRE(v >= 0);
    return v;
}

static BigInt abs(const BigInt& num) {
    return num < 0 ? -num : num;
}

static FieldT toFieldElement(const BigInt &v)
{
    return FieldT(validate(v).to_string().c_str());
}

static BigInt getRandomFieldElementAsBigInt(unsigned int numBits = 254)
{
    BigInt v(rand());
    for (unsigned int i = 0; i < 32 / 4; i++)
    {
        v *= 32;
        v += rand();
    }

    if (numBits >= 254)
    {
        v %= SNARK_SCALAR_FIELD;
    }
    else
    {
        BigInt m(1);
        for (unsigned int b = 0; b < numBits; b++)
        {
            m *= 2;
        }
        v %= m;
    }
    return v;
}

static BigInt getMaxFieldElementAsBigInt(unsigned int numBits = 254)
{
    if (numBits >= 254)
    {
        return SNARK_SCALAR_FIELD - 1;
    }
    else
    {
        BigInt m(1);
        for (unsigned int b = 0; b < numBits; b++)
        {
            m *= 2;
        }
        m -= 1;
        return m;
    }
}

static FieldT getRandomFieldElement(unsigned int numBits = 254)
{
    return toFieldElement(getRandomFieldElementAsBigInt(numBits));
}

static FieldT getMaxFieldElement(unsigned int numBits = 254)
{
    if (numBits == 254)
    {
        return FieldT("218882428718392752222464057452572750885483644004160343436982"
                      "04186575808495616");
    }
    else
    {
        return (FieldT(2) ^ numBits) - 1;
    }
}

static libff::bit_vector toBits(const FieldT value, unsigned int numBits)
{
    libff::bit_vector vector;
    const bigint<FieldT::num_limbs> rint = value.as_bigint();
    for (size_t i = 0; i < numBits; ++i)
    {
        vector.push_back(rint.test_bit(i));
    }
    return vector;
}

static bool compareBits(const libff::bit_vector &A, const libff::bit_vector &B)
{
    if (A.size() != B.size())
    {
        return false;
    }

    for (unsigned int i = 0; i < A.size(); i++)
    {
        if (A[i] != B[i])
        {
            return false;
        }
    }
    return true;
}

static Block getBlock()
{
    // Read the JSON file
    string filename = string(TEST_DATA_PATH) + "block.json";
    ifstream file(filename);
    if (!file.is_open())
    {
        cerr << "Cannot open input file: " << filename << endl;
        REQUIRE(false);
    }
    json input;
    file >> input;
    file.close();

    Block block = input.get<Block>();
    return block;
}

static UniversalTransaction getSpotTrade(const Block &block)
{
    REQUIRE(block.transactions.size() > 0);
    const UniversalTransaction &tx = block.transactions[2];
    return tx;
}

struct PowResult
{
    bool valid;
    FieldT value;
};

static PowResult pow_approx(const FieldT& _x, const FieldT& _y, unsigned int iterations)
{
    BigInt BASE(FIXED_BASE);

    BigInt x = toBigInt(_x) - BASE;
    BigInt a = toBigInt(_y);

    std::vector<BigInt> bn = {BASE, BASE};
    std::vector<BigInt> cn = {BASE, a};
    std::vector<BigInt> xn = {BASE, x};
    BigInt sum = xn[0]*cn[0] + xn[1]*cn[1];
    for (unsigned int i = 2; i < iterations; i++)
    {
        BigInt v = a - bn[i-1];
        bn.push_back(bn[i-1] + BASE);
        cn.push_back((cn[i-1] * v) / bn[i]);
        xn.push_back((xn[i-1] * x) / BASE);
        sum += xn[i]*cn[i];
        if(cn.back() > getMaxFieldElementAsBigInt(NUM_BITS_AMOUNT))
        {
            return {false, 0};
        }
    }
    sum /= BASE;

    bool valid = true;
    if (sum <= 0 || sum > getMaxFieldElementAsBigInt(NUM_BITS_AMOUNT))
    {
        return {false, 0};
    }
    return {valid, toFieldElement(sum)};
}

#endif