#define CATCH_CONFIG_MAIN  // This tells Catch to provide a main() - only do this in one cpp file
#include "../ThirdParty/catch.hpp"
#include "../ThirdParty/BigInt.hpp"
#include "ethsnarks.hpp"

struct Initialize
{
    Initialize()
    {
        ethsnarks::ppT::init_public_params();
        srand(time(NULL));
    }
} initialize;