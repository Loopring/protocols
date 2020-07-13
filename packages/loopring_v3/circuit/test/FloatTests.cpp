#include "../ThirdParty/catch.hpp"
#include "TestUtils.h"

#include "../Gadgets/MathGadgets.h"

TEST_CASE("RequireAccuracy", "[RequireAccuracyGadget]")
{
    unsigned int maxLength = 126;
    unsigned int numIterations = 8;
    for (unsigned int n = 1; n <= maxLength; n++) {
        DYNAMIC_SECTION("Bit-length: " << n)
    {
        auto requireAccuracyChecked = [n](const FieldT& _A, const FieldT& _B, bool expectedSatisfied)
        {
            protoboard<FieldT> pb;

            pb_variable<FieldT> a = make_variable(pb, _A, ".A");
            pb_variable<FieldT> b = make_variable(pb, _B, ".B");

            Accuracy accuracy = {100 - 1, 100};
            RequireAccuracyGadget requireAccuracyGadget(pb, a, b, accuracy, n, "requireAccuracyGadget");
            requireAccuracyGadget.generate_r1cs_constraints();
            requireAccuracyGadget.generate_r1cs_witness();

            REQUIRE(pb.is_satisfied() == expectedSatisfied);
        };

        FieldT max = getMaxFieldElement(n);

        SECTION("0, 0")
        {
            requireAccuracyChecked(0, 0, true);
        }

        SECTION("0, 1")
        {
            requireAccuracyChecked(0, 1, false);
        }

        SECTION("0, max")
        {
            requireAccuracyChecked(0, max, false);
        }

        SECTION("max, 0")
        {
            requireAccuracyChecked(max, 0, false);
        }

        SECTION("value > original value")
        {
            FieldT A = getRandomFieldElement(n);
            while (A == FieldT::zero())
            {
                A = getRandomFieldElement(n);
            }
            FieldT B = A - 1;
            requireAccuracyChecked(A, B, false);
        }

        // Do some specific tests
        if (n == NUM_BITS_AMOUNT)
        {
            SECTION("100, 100")
            {
                requireAccuracyChecked(100, 100, true);
            }

            SECTION("101, 100")
            {
                requireAccuracyChecked(101, 100, false);
            }

            SECTION("99, 100")
            {
                requireAccuracyChecked(99, 100, true);
            }

            SECTION("max + 1, max")
            {
                requireAccuracyChecked(max + 1, max, false);
            }

            SECTION("max, 3000")
            {
                requireAccuracyChecked(max, 3000, false);
            }

            SECTION("Exhaustive checks against a single value")
            {
                unsigned int originalValue = 3000;
                for(unsigned int i = 0; i < originalValue * 3; i++)
                {
                    bool expectedSatisfied = (i >= 2970 && i <= 3000);
                    requireAccuracyChecked(i, 3000, expectedSatisfied);
                }
            }
        }
    }}
}

TEST_CASE("Float", "[FloatGadget]")
{
    FloatEncoding encoding = Float24Encoding;
    unsigned int numBitsFloat = encoding.numBitsExponent + encoding.numBitsMantissa;

    unsigned int maxLength = NUM_BITS_AMOUNT;
    unsigned int numIterations = 8;
    for (unsigned int n = 1; n <= maxLength; n++) {
        DYNAMIC_SECTION("Bit-length: " << n)
    {
        auto floatChecked = [n, encoding, numBitsFloat](const FieldT& _value)
        {
            protoboard<FieldT> pb;

            Constants constants(pb, "constants");
            FloatGadget floatGadget(pb, constants, encoding, "floatGadget");
            floatGadget.generate_r1cs_constraints();
            unsigned int f = toFloat(_value, encoding);
            floatGadget.generate_r1cs_witness(f);

            FieldT rValue = toFieldElement(fromFloat(f, encoding));
            REQUIRE(pb.is_satisfied());
            REQUIRE((pb.val(floatGadget.value()) == rValue));
            REQUIRE(compareBits(floatGadget.bits().get_bits(pb), toBits(f, numBitsFloat)));
        };

        SECTION("0")
        {
            floatChecked(0);
        }

        SECTION("1")
        {
            floatChecked(1);
        }

        SECTION("max")
        {
            floatChecked(getMaxFieldElement(n));
        }

        SECTION("Random")
        {
            for (unsigned int j = 0; j < numIterations; j++)
            {
                floatChecked(getRandomFieldElement(n));
            }
        }
    }}
}

TEST_CASE("Float+Accuracy", "[FloatGadget+RequireAccuracy]")
{
    std::vector<FloatEncoding> encodings = {Float16Encoding, Float24Encoding, Float28Encoding};
    std::vector<Accuracy> accuracies = {Float16Accuracy, Float24Accuracy, Float28Accuracy};
    std::vector<FieldT> worstAccuracyValues = {FieldT("20499999999999999999999999999"), FieldT("52428999999999999999999999999"), FieldT("8388609999999999999999999999")};
    for (unsigned int e = 0; e < encodings.size(); e++) {
        DYNAMIC_SECTION("Encoding: " << encodings[e].numBitsExponent + encodings[e].numBitsMantissa)
    {
        const FloatEncoding& encoding = encodings[e];
        const Accuracy& accuracy = accuracies[e];
        const FieldT& worstAccuracyValue = worstAccuracyValues[e];

        unsigned int n = NUM_BITS_AMOUNT;
        unsigned int numBitsFloat = encoding.numBitsExponent + encoding.numBitsMantissa;

        protoboard<FieldT> pb;

        Constants constants(pb, "constants");
        FloatGadget floatGadget(pb, constants, encoding, "floatGadget");
        floatGadget.generate_r1cs_constraints();

        pb_variable<FieldT> value = make_variable(pb, ".value");
        pb_variable<FieldT> rValue = make_variable(pb, ".rValue");
        RequireAccuracyGadget requireAccuracyGadget(pb, rValue, value, accuracy, n, "requireAccuracyGadget");
        requireAccuracyGadget.generate_r1cs_constraints();

        SECTION("Value with the worst accuracy")
        {
            unsigned int f = toFloat(worstAccuracyValue, encoding);
            floatGadget.generate_r1cs_witness(FieldT(f));

            pb.val(value) = worstAccuracyValue;
            pb.val(rValue) = pb.val(floatGadget.value());
            requireAccuracyGadget.generate_r1cs_witness();

            REQUIRE(pb.is_satisfied());
        }

        SECTION("Random")
        {
            unsigned int numIterations = 4 * 1024;
            for (unsigned int j = 0; j < numIterations; j++)
            {
                FieldT _value = getRandomFieldElement(n);
                unsigned int f = toFloat(_value, encoding);
                floatGadget.generate_r1cs_witness(FieldT(f));

                pb.val(value) = _value;
                pb.val(rValue) = pb.val(floatGadget.value());
                requireAccuracyGadget.generate_r1cs_witness();

                REQUIRE(pb.is_satisfied());
            }
        }
    }}
}