#ifndef _CIRCUIT_H_
#define _CIRCUIT_H_

#include "ethsnarks.hpp"
#include "../Utils/Data.h"

using namespace ethsnarks;

namespace Loopring
{

class Circuit : public GadgetT
{
public:
    Circuit(libsnark::protoboard<FieldT> &pb, const std::string &annotation_prefix) : GadgetT(pb, annotation_prefix) {};
    virtual ~Circuit() {};
    virtual void generateConstraints(bool onchainDataAvailability, unsigned int blockSize) = 0;
    virtual bool generateWitness(const json& input) = 0;
    virtual BlockType getBlockType() = 0;
    virtual unsigned int getBlockSize() = 0;
    virtual void printInfo() = 0;

    libsnark::protoboard<FieldT>& getPb()
    {
        return pb;
    }
};

}

#endif
