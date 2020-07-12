
#include "ThirdParty/BigInt.hpp"
#include "Utils/Data.h"
#include "Circuits/RingSettlementCircuit.h"
#include "Circuits/DepositCircuit.h"
#include "Circuits/OnchainWithdrawalCircuit.h"
#include "Circuits/OffchainWithdrawalCircuit.h"
#include "Circuits/InternalTransferCircuit.h"

#include "ThirdParty/httplib.h"
//#include "ThirdParty/json.hpp"
#include "ethsnarks.hpp"
#include "import.hpp"
#include "stubs.hpp"
#include <fstream>
#include <chrono>
#include <mutex>

#ifdef MULTICORE
#include <omp.h>
#endif

#define WITH_MEMORY_STATS 0

#if WITH_MEMORY_STATS
#include <unistd.h>
#include <ios>
#include <iostream>
#include <fstream>
#include <string>

#include <malloc.h>

//////////////////////////////////////////////////////////////////////////////
//
// process_mem_usage(double &, double &) - takes two doubles by reference,
// attempts to read the system-dependent data for a process' virtual memory
// size and resident set size, and return the results in KB.
//
// On failure, returns 0.0, 0.0

void process_mem_usage(double& vm_usage, double& resident_set)
{
   using std::ios_base;
   using std::ifstream;
   using std::string;

   vm_usage     = 0.0;
   resident_set = 0.0;

   // 'file' stat seems to give the most reliable results
   //
   ifstream stat_stream("/proc/self/stat",ios_base::in);

   // dummy vars for leading entries in stat that we don't care about
   //
   string pid, comm, state, ppid, pgrp, session, tty_nr;
   string tpgid, flags, minflt, cminflt, majflt, cmajflt;
   string utime, stime, cutime, cstime, priority, nice;
   string O, itrealvalue, starttime;

   // the two fields we want
   //
   unsigned long vsize;
   long rss;

   stat_stream >> pid >> comm >> state >> ppid >> pgrp >> session >> tty_nr
               >> tpgid >> flags >> minflt >> cminflt >> majflt >> cmajflt
               >> utime >> stime >> cutime >> cstime >> priority >> nice
               >> O >> itrealvalue >> starttime >> vsize >> rss; // don't care about the rest

   stat_stream.close();

   long page_size_kb = sysconf(_SC_PAGE_SIZE) / 1024; // in case x86-64 is configured to use 2MB pages
   vm_usage     = vsize / 1024.0;
   resident_set = rss * page_size_kb;
}

void printMemoryUsage()
{
    malloc_trim(0);

    double vm, rss;
    process_mem_usage(vm, rss);
    std::cout << "VM: " << unsigned(vm*0.001) << "MB; RSS: " << unsigned(rss*0.001) << "MB" << std::endl;
}
#else
void printMemoryUsage() {}
#endif

using json = nlohmann::json;

enum class Mode
{
    CreateKeys = 0,
    Validate,
    Prove,
    ExportCircuit,
    ExportWitness,
    Server,
    Benchmark
};

namespace libsnark
{
static void from_json(const nlohmann::json& j, libsnark::Config& config)
{
    if (j.contains("num_threads"))
    {
        config.num_threads = j.at("num_threads").get<unsigned int>();
    }
    if (j.contains("smt"))
    {
        config.smt = j.at("smt").get<bool>();
    }
    if (j.contains("fft"))
    {
        config.fft = j.at("fft").get<std::string>();
    }
    if (j.contains("radixes"))
    {
        config.radixes = j.at("radixes").get<std::vector<unsigned int>>();
    }
    if (j.contains("swapAB"))
    {
        config.swapAB = j.at("swapAB").get<bool>();
    }
    if (j.contains("multi_exp_c"))
    {
        config.multi_exp_c = j.at("multi_exp_c").get<unsigned int>();
    }
    if (j.contains("multi_exp_prefetch_locality"))
    {
        config.multi_exp_prefetch_locality = j.at("multi_exp_prefetch_locality").get<unsigned int>();
    }
    if (j.contains("prefetch_stride"))
    {
        config.prefetch_stride = j.at("prefetch_stride").get<unsigned int>();
    }
    if (j.contains("multi_exp_look_ahead"))
    {
        config.multi_exp_look_ahead = j.at("multi_exp_look_ahead").get<unsigned int>();
    }
}
}

struct BenchmarkConfig
{
    unsigned int num_iterations;
    std::vector<unsigned int> num_threads;
    std::vector<bool> smt;
    std::vector<std::string> fft;
    std::vector<std::vector<unsigned int>> radixes;
    std::vector<bool> swapAB;
    std::vector<unsigned int> multi_exp_c;
    std::vector<unsigned int> multi_exp_prefetch_locality;   // 4 == no prefetching, [0, 3] prefetch locality
    std::vector<unsigned int> prefetch_stride;               // 4 * L1_CACHE_BYTES
    std::vector<unsigned int> multi_exp_look_ahead;
};

static void from_json(const nlohmann::json& j, BenchmarkConfig& config)
{
    config.num_iterations = j.at("num_iterations").get<unsigned int>();
    config.num_threads = j.at("num_threads").get<std::vector<unsigned int>>();
    config.smt = j.at("smt").get<std::vector<bool>>();
    config.fft = j.at("fft").get<std::vector<std::string>>();
    config.radixes = j.at("radixes").get<std::vector<std::vector<unsigned int>>>();
    config.swapAB = j.at("swapAB").get<std::vector<bool>>();
    config.multi_exp_c = j.at("multi_exp_c").get<std::vector<unsigned int>>();
    config.multi_exp_prefetch_locality = j.at("multi_exp_prefetch_locality").get<std::vector<unsigned int>>();
    config.prefetch_stride = j.at("prefetch_stride").get<std::vector<unsigned int>>();
    config.multi_exp_look_ahead = j.at("multi_exp_look_ahead").get<std::vector<unsigned int>>();
}

static inline auto now() -> decltype(std::chrono::high_resolution_clock::now()) {
    return std::chrono::high_resolution_clock::now();
}

template<typename T>
unsigned int elapsed_time_ms(const T& t1)
{
    auto t2 = std::chrono::high_resolution_clock::now();
    auto time_ms = std::chrono::duration_cast<std::chrono::milliseconds>(t2 - t1).count();
    return time_ms;
}

template<typename T>
void print_time(const T& t1, const char* str)
{
    printf("%s (%dms)\n", str, elapsed_time_ms(t1));
}

bool fileExists(const std::string& fileName)
{
    std::ifstream infile(fileName.c_str());
    return infile.good();
}

void initProverContextBuffers(ProverContextT& context)
{
    context.scratch_exponents.resize(std::max(context.constraint_system->num_variables() + 1, context.domain->m - 1));
    context.aA.resize(context.domain->m+1, FieldT::one());
    context.aB.resize(context.domain->m+1, FieldT::one());
    context.aH.resize(context.domain->m+1, FieldT::one());
}

bool generateKeyPair(ethsnarks::ProtoboardT& pb, std::string& baseFilename)
{
    std::string provingKeyFilename = baseFilename + "_pk.raw";
    std::string verificationKeyFilename = baseFilename + "_vk.json";
#ifdef GPU_PROVE
    std::string paramsFilename = baseFilename + "_params.raw";
#endif
    if (fileExists(provingKeyFilename.c_str()) && fileExists(verificationKeyFilename.c_str())
#ifdef GPU_PROVE
        && fileExists(paramsFilename.c_str())
#endif
    )
    {
        return true;
    }
#ifdef GPU_PROVE
    std::cout << "Generating keys and params..." << std::endl;
    int result = stub_genkeys_params_from_pb(pb, provingKeyFilename.c_str(), verificationKeyFilename.c_str(), paramsFilename.c_str());
#else
    std::cout << "Generating keys..." << std::endl;
    int result = stub_genkeys_from_pb(pb, provingKeyFilename.c_str(), verificationKeyFilename.c_str());
#endif
    return (result == 0);
}

json loadJSON(const std::string& filename)
{
    // Read the JSON file
    std::ifstream file(filename.c_str());
    if (!file.is_open())
    {
        std::cerr << "Cannot open json file: " << filename << std::endl;
        return json();
    }
    json input;
    file >> input;
    file.close();
    return input;
}

libsnark::Config loadConfig(const std::string& filename)
{
    return loadJSON(filename).get<libsnark::Config>();
}

void loadProvingKey(const std::string& pk_file, ethsnarks::ProvingKeyT& proving_key)
{
    std::cout << "Loading proving key " << pk_file << "..." << std::endl;
    auto begin = now();
    auto pk = ethsnarks::load_proving_key(pk_file.c_str());
    proving_key.alpha_g1 = std::move(pk.alpha_g1);
    proving_key.beta_g1 = std::move(pk.beta_g1);
    proving_key.beta_g2 = std::move(pk.beta_g2);
    proving_key.delta_g1 = std::move(pk.delta_g1);
    proving_key.delta_g2 = std::move(pk.delta_g2);
    proving_key.A_query = std::move(pk.A_query);
    proving_key.B_query = std::move(pk.B_query);
    proving_key.H_query = std::move(pk.H_query);
    proving_key.L_query = std::move(pk.L_query);
    print_time(begin, "Proving key loaded");
}

VerificationKeyT loadVerificationKey(const std::string& vk_file)
{
    std::cout << "Loading verification key " << vk_file << "..." << std::endl;
    return vk_from_json(loadJSON(vk_file));
}

std::string proveCircuit(ProverContextT& context, Loopring::Circuit* circuit)
{
    std::cout << "Generating proof..." << std::endl;
    auto begin = now();
    std::string jProof = ethsnarks::prove(context, circuit->getPb());
    unsigned int elapsed_ms = elapsed_time_ms(begin);
    elapsed_ms = elapsed_ms == 0 ? 1 : elapsed_ms;
    std::cout << "Proof generated in " << float(elapsed_ms) / 1000.0f << " seconds ("
        << (circuit->getPb().num_constraints() * 10) / (elapsed_ms / 100) << " constraints/second)" << std::endl;
    return jProof;
}

bool writeProof(const std::string& jProof, const std::string& proofFilename)
{
    std::ofstream fproof(proofFilename);
    if (!fproof.is_open())
    {
        std::cerr << "Cannot create proof file: " << proofFilename << std::endl;
        return false;
    }
    fproof << jProof;
    fproof.close();
    std::cout << "Proof written to: " << proofFilename << std::endl;
    return true;
}

Loopring::Circuit* newCircuit(Loopring::BlockType blockType, ethsnarks::ProtoboardT& outPb)
{
    switch(blockType)
    {
        case Loopring::BlockType::RingSettlement: return new Loopring::RingSettlementCircuit(outPb, "circuit");
        case Loopring::BlockType::Deposit: return new Loopring::DepositCircuit(outPb, "circuit");
        case Loopring::BlockType::OnchainWithdrawal: return new Loopring::OnchainWithdrawalCircuit(outPb, "circuit");
        case Loopring::BlockType::OffchainWithdrawal: return new Loopring::OffchainWithdrawalCircuit(outPb, "circuit");
        case Loopring::BlockType::InternalTransfer: return new Loopring::InternalTransferCircuit(outPb, "circuit");
        default:
        {
            std::cerr << "Cannot create circuit for unknown block type: " << int(blockType) << std::endl;
            return nullptr;
        }
    }
}

Loopring::Circuit* createCircuit(Loopring::BlockType blockType, unsigned int blockSize, bool onchainDataAvailability, ethsnarks::ProtoboardT& outPb)
{
    std::cout << "Creating circuit... " << std::endl;
    auto begin = now();
    Loopring::Circuit* circuit = newCircuit(blockType, outPb);
    circuit->generateConstraints(onchainDataAvailability, blockSize);
    circuit->printInfo();
    print_time(begin, "Circuit created");
    return circuit;
}

bool generateWitness(Loopring::Circuit* circuit, const json& input)
{
    std::cout << "Generating witness... " << std::endl;
    auto begin = now();
    if (!circuit->generateWitness(input))
    {
        std::cerr << "Could not generate witness!" << std::endl;
        return false;
    }
    print_time(begin, "Witness generated");
    return true;
}

bool validateCircuit(Loopring::Circuit* circuit)
{
    std::cout << "Validating block..."<< std::endl;
    auto begin = now();
    // Check if the inputs are valid for the circuit
    if (!circuit->getPb().is_satisfied())
    {
        std::cerr << "Block is not valid!" << std::endl;
        return false;
    }
    print_time(begin, "Block is valid");
    return true;
}

std::string getBaseName(Loopring::BlockType blockType)
{
    switch(blockType)
    {
        case Loopring::BlockType::RingSettlement: return "trade";
        case Loopring::BlockType::Deposit: return "deposit";
        case Loopring::BlockType::OnchainWithdrawal: return "withdraw_onchain";
        case Loopring::BlockType::OffchainWithdrawal: return "withdraw_offchain";
        case Loopring::BlockType::InternalTransfer: return "internal_transfer";
        default: return "unknown";
    }
}

std::string getProvingKeyFilename(const std::string& baseFilename)
{
    return baseFilename + "_pk.raw";
}

void runServer(Loopring::Circuit* circuit, const std::string& provingKeyFilename, const libsnark::Config& config, unsigned int port)
{
    using namespace httplib;

    struct ProverStatus
    {
        bool proving = false;
        std::string blockFilename;
        std::string proofFilename;
    };

    struct ProverStatusRAII
    {
        ProverStatus& proverStatus;
        ProverStatusRAII(ProverStatus& _proverStatus, const std::string& blockFilename, const std::string& proofFilename) : proverStatus(_proverStatus)
        {
            proverStatus.proving = true;
            proverStatus.blockFilename = blockFilename;
            proverStatus.proofFilename = proofFilename;
        }

        ~ProverStatusRAII()
        {
            proverStatus.proving = false;
        }
    };

    // Setup the context a single time
    ProverContextT context;
    loadProvingKey(provingKeyFilename, context.provingKey);
    context.constraint_system = &(circuit->getPb().constraint_system);
    context.config = config;
    context.domain = get_domain(circuit->getPb(), context.provingKey, config);
    initProverContextBuffers(context);

    // Prover status info
    ProverStatus proverStatus;
    // Lock for the prover
    std::mutex mtx;
    // Setup the server
    Server svr;
    // Called to prove blocks
    svr.Get("/prove", [&](const Request& req, Response& res) {
        const std::lock_guard<std::mutex> lock(mtx);

        // Parse the parameters
        std::string blockFilename = req.get_param_value("block_filename");
        std::string proofFilename = req.get_param_value("proof_filename");
        std::string strValidate = req.get_param_value("validate");
        bool validate = (strValidate.compare("true") == 0) ? true : false;
        if (blockFilename.length() == 0)
        {
            res.set_content("Error: block_filename missing!\n", "text/plain");
            return;
        }

        // Set the prover status for this session
        ProverStatusRAII statusRAII(proverStatus, blockFilename, proofFilename);

        // Prove the block
        json input = loadJSON(blockFilename);
        if (input == json())
        {
            res.set_content("Error: Failed to load block!\n", "text/plain");
            return;
        }

        // Some checks to see if this block is compatible with the loaded circuit
        int iBlockType = input["blockType"].get<int>();
        unsigned int blockSize = input["blockSize"].get<int>();
        if (Loopring::BlockType(iBlockType) != circuit->getBlockType() || blockSize != circuit->getBlockSize())
        {
            res.set_content("Error: Incompatible block requested! Use /info to check which blocks can be proven.\n", "text/plain");
            return;
        }

        if (!generateWitness(circuit, input))
        {
            res.set_content("Error: Failed to generate witness for block!\n", "text/plain");
            return;
        }
        if (validate)
        {
            if (!validateCircuit(circuit))
            {
                res.set_content("Error: Block is invalid!\n", "text/plain");
                return;
            }
        }
        std::string jProof = proveCircuit(context, circuit);
        if (jProof.length() == 0)
        {
            res.set_content("Error: Failed to prove block!\n", "text/plain");
            return;
        }
        if (proofFilename.length() != 0)
        {
            if(!writeProof(jProof, proofFilename))
            {
                res.set_content("Error: Failed to write proof!\n", "text/plain");
                return;
            }
        }
        // Return the proof
        res.set_content(jProof + "\n", "text/plain");
    });
    // Retuns the status of the server
    svr.Get("/status", [&](const Request& req, Response& res) {
        if (proverStatus.proving)
        {
            std::string status = std::string("Proving ") + proverStatus.blockFilename;
            res.set_content(status + "\n", "text/plain");
        }
        else
        {
            res.set_content("Idle\n", "text/plain");
        }
    });
    // Info of this prover server
    svr.Get("/info", [&](const Request& req, Response& res) {
        std::string info = std::string("BlockType: ") + std::to_string(int(circuit->getBlockType())) +
            std::string("; BlockSize: ") + std::to_string(circuit->getBlockSize()) + "\n";
        res.set_content(info, "text/plain");
    });
    // Stops the prover server
    svr.Get("/stop", [&](const Request& req, Response& res) {
        const std::lock_guard<std::mutex> lock(mtx);
        svr.stop();
    });
    // Default page contains help
    svr.Get("/", [&](const Request& req, Response& res) {
        std::string content;
        content += "Prover server:\n";
        content += "- Prove a block: /prove?block_filename=<block.json>&proof_filename=<proof.json>&validate=true (proof_filename and validate are optional)\n";
        content += "- Status of the server: /status (busy proving a block or not)\n";
        content += "- Info of the server: /info (which blocks can be proven)\n";
        content += "- Shut down the server: /stop (will first finish generating the proof if busy)\n";
        res.set_content(content, "text/plain");
    });

    std::cout << "Running server on 'localhost' on port " << port << std::endl;
    svr.listen("127.0.0.1", port);
}

bool runBenchmark(Loopring::Circuit* circuit, const std::string& provingKeyFilename)
{
    // Load the proving key a single time
    ProverContextT context;
    loadProvingKey(provingKeyFilename, context.provingKey);
    context.constraint_system = &(circuit->getPb().constraint_system);

    VerificationKeyT vk = loadVerificationKey(provingKeyFilename.substr(0, provingKeyFilename.length() - 6) + "vk.json");

    if (!validateCircuit(circuit))
    {
        return false;
    }

    // Get all configs to benchmark from the benchmark config
    BenchmarkConfig benchmarkConfig = loadJSON("benchmark.json").get<BenchmarkConfig>();

    // Create all configs
    std::vector<libsnark::Config> configs;
    for (auto num_threads : benchmarkConfig.num_threads) {
    for (auto smt : benchmarkConfig.smt) {
    for (auto prefetch_stride : benchmarkConfig.prefetch_stride) {
    for (auto swapAB : benchmarkConfig.swapAB) {
    for (auto fft : benchmarkConfig.fft) {
    for (auto radixes : benchmarkConfig.radixes) {
    for (auto multi_exp_c : benchmarkConfig.multi_exp_c) {
    for (auto multi_exp_prefetch_locality : benchmarkConfig.multi_exp_prefetch_locality) {
    for (auto multi_exp_look_ahead : benchmarkConfig.multi_exp_look_ahead) {
        libsnark::Config config;
        config.num_threads = num_threads;
        config.smt = smt;
        config.prefetch_stride = prefetch_stride;
        config.swapAB = swapAB;
        config.fft = fft;
        config.radixes = radixes;
        config.multi_exp_c = multi_exp_c;
        config.multi_exp_prefetch_locality = multi_exp_prefetch_locality;
        config.multi_exp_look_ahead = multi_exp_look_ahead;
        configs.push_back(config);
    }}}}}}}}}

    unsigned int num_iterations = benchmarkConfig.num_iterations;

    struct Result
    {
        libsnark::Config config;
        unsigned int duration_ms;

        static bool compareResult(Result a, Result b)
        {
            return (a.duration_ms < b.duration_ms);
        }
    };
    std::vector<Result> results;
    for (auto config : configs)
    {
        std::cout << "*****************************" << std::endl;
        std::cout << "Config: " << config << std::endl;
        std::cout << "*****************************" << std::endl;
#ifdef MULTICORE
        omp_set_num_threads(config.num_threads);
#endif

        context.config = config;
        context.domain = get_domain(circuit->getPb(), context.provingKey, config);
        initProverContextBuffers(context);

        unsigned int totalTime = 0;
        for (unsigned int l = 0; l < num_iterations; l++)
        {
            auto begin = now();
            std::string jProof = proveCircuit(context, circuit);
            totalTime += elapsed_time_ms(begin);
            if (jProof.length() == 0)
            {
                return false;
            }

            std::stringstream proof_stream;
            proof_stream << jProof;
            auto proof_pair = proof_from_json(proof_stream);

            if(!libsnark::r1cs_gg_ppzksnark_zok_verifier_strong_IC<ppT>(vk, proof_pair.first, proof_pair.second))
            {
                std::cerr << "Invalid proof!" << std::endl;
                return false;
            }
        }

        Result result;
        result.config = config;
        result.duration_ms = totalTime / num_iterations;
        results.push_back(result);
    }

    std::sort(results.begin(), results.end(), Result::compareResult);

    std::cout << "Benchmark results:" << std::endl;
    for (unsigned int i = 0; i < results.size(); i++)
    {
        const libsnark::Config& config = results[i].config;
        std::cout << i << ". " << config << " (" << results[i].duration_ms << "ms)" << std::endl;
    }

    return true;
}

int main (int argc, char **argv)
{
    ethsnarks::ppT::init_public_params();

    // Load in the config
    libsnark::Config config = loadConfig("config.json");
    std::cout << "Config: " << config << std::endl;

#ifdef MULTICORE
    // omp_set_nested is needed for gcc for some reason
    omp_set_nested(1);
    omp_set_max_active_levels(5);
    std::cout << "Num threads available: " << omp_get_max_threads() << std::endl;
    std::cout << "Num processors available: " << omp_get_num_procs() << std::endl;
#endif

    if (argc < 3)
    {
        std::cerr << "Usage: " << argv[0] << std::endl;
        std::cerr << "-validate <block.json>: Validates a block" << std::endl;
        std::cerr << "-prove <block.json> <out_proof.json>: Proves a block" << std::endl;
        std::cerr << "-createkeys <protoBlock.json>: Creates prover/verifier keys" << std::endl;
        std::cerr << "-verify <vk.json> <proof.json>: Verify a proof" << std::endl;
        std::cerr << "-exportcircuit <block.json> <circuit.json>: Exports the rc1s circuit to json (circom - not all fields)" << std::endl;
        std::cerr << "-exportwitness <block.json> <witness.json>: Exports the witness to json (circom)" << std::endl;
        std::cerr << "-createpk <block.json> <pk.json> <pk.raw>: Creates the proving key using a bellman pk" << std::endl;
        std::cerr << "-pk_alt2mcl <pk_alt.raw> <pk_mcl.raw>: Converts the proving key from the alt format to the mcl format" << std::endl;
        std::cerr << "-pk_mcl2nozk <pk_mlc.raw> <pk_nozk.raw>: Converts the proving key from the mcl format to the nozk format" << std::endl;
        std::cerr << "-server <block.json> <port>: Keeps the program running as an HTTP server to prove blocks on demand" << std::endl;
        std::cerr << "-benchmark <block.json>: Try out multiple prover options to find the fastest configuration on the system" << std::endl;
        return 1;
    }

    const char* proofFilename = NULL;
    Mode mode = Mode::Validate;
    std::string baseFilename = "keys/";
    if (strcmp(argv[1], "-validate") == 0)
    {
        mode = Mode::Validate;
        std::cout << "Validating " << argv[2] << "..." << std::endl;
    }
    else if (strcmp(argv[1], "-prove") == 0)
    {
        if (argc != 4)
        {
            std::cout << "Invalid number of arguments!"<< std::endl;
            return 1;
        }
        mode = Mode::Prove;
        proofFilename = argv[3];
        std::cout << "Proving " << argv[2] << "..." << std::endl;
    }
    else if (strcmp(argv[1], "-createkeys") == 0)
    {
        if (argc != 3)
        {
            std::cout << "Invalid number of arguments!"<< std::endl;
            return 1;
        }
        mode = Mode::CreateKeys;
        std::cout << "Creating keys for " << argv[2] << "..." << std::endl;
    }
    else if (strcmp(argv[1], "-verify") == 0)
    {
        if (argc != 4)
        {
            std::cout << "Invalid number of arguments!"<< std::endl;
            return 1;
        }
        std::cout << "Verify for " << argv[3] << " ..." << std::endl;
        if (stub_main_verify(argv[0], argc - 1, (const char **)(argv + 1)))
        {
            return 1;
        }
        std::cout << "Proof is valid" << std::endl;
        return 0;
    }
    else if (strcmp(argv[1], "-exportcircuit") == 0)
    {
        if (argc != 4)
        {
            std::cout << "Invalid number of arguments!"<< std::endl;
            return 1;
        }
        mode = Mode::ExportCircuit;
        std::cout << "Exporting circuit for " << argv[2] << "..." << std::endl;
    }
    else if (strcmp(argv[1], "-exportwitness") == 0)
    {
        if (argc != 4)
        {
            std::cout << "Invalid number of arguments!"<< std::endl;
            return 1;
        }
        mode = Mode::ExportWitness;
        std::cout << "Exporting witness for " << argv[2] << "..." << std::endl;
    }
    else if (strcmp(argv[1], "-createpk") == 0)
    {
        if (argc != 4)
        {
            std::cout << "Invalid number of arguments!"<< std::endl;
            return 1;
        }
        std::cout << "Converting pk from " << argv[2] << " to " << argv[3] << " ..." << std::endl;
        if (!pk_bellman2ethsnarks(argv[2], argv[3]))
        {
            return 1;
        }
        std::cout << "Successfully created pk " << argv[3] << "." << std::endl;
        return 0;
    }
    else if (strcmp(argv[1], "-pk_alt2mcl") == 0)
    {
        if (argc != 4)
        {
            std::cout << "Invalid number of arguments!"<< std::endl;
            return 1;
        }
        std::cout << "Converting pk from " << argv[2] << " to " << argv[3] << " ..." << std::endl;
        if (!pk_alt2mcl(argv[2], argv[3]))
        {
            std::cout << "Could not convert pk." << std::endl;
            return 1;
        }
        std::cout << "Successfully created pk " << argv[3] << "." << std::endl;
        return 0;
    }
    else if (strcmp(argv[1], "-pk_mcl2nozk") == 0)
    {
        if (argc != 4)
        {
            std::cout << "Invalid number of arguments!"<< std::endl;
            return 1;
        }
        std::cout << "Converting pk from " << argv[2] << " to " << argv[3] << " ..." << std::endl;
        if (!pk_mcl2nozk(argv[2], argv[3]))
        {
            std::cout << "Failed to convert!"<< std::endl;
            return 1;
        }
        std::cout << "Successfully created pk " << argv[3] << "." << std::endl;
        return 0;
    }
    else if (strcmp(argv[1], "-server") == 0)
    {
        if (argc != 4)
        {
            std::cout << "Invalid number of arguments!"<< std::endl;
            return 1;
        }
        mode = Mode::Server;
        std::cout << "Starting proving server for " << argv[2] << " on port " << argv[3] << "..." << std::endl;
    }
    else if (strcmp(argv[1], "-benchmark") == 0)
    {
        if (argc != 3)
        {
            std::cout << "Invalid number of arguments!"<< std::endl;
            return 1;
        }
        mode = Mode::Benchmark;
        std::cout << "Benchmarking " << argv[2] << "..." << std::endl;
    }
    else
    {
        std::cerr << "Unknown option: " << argv[1] << std::endl;
        return 1;
    }

    // Read the block file
    json input = loadJSON(argv[2]);
    if (input == json())
    {
        return 1;
    }

    // Read meta data
    int iBlockType = input["blockType"].get<int>();
    unsigned int blockSize = input["blockSize"].get<int>();
    bool onchainDataAvailability = input["onchainDataAvailability"].get<bool>();
    std::string strOnchainDataAvailability = onchainDataAvailability ? "_DA_" : "_";
    std::string postFix = strOnchainDataAvailability + std::to_string(blockSize);

    if (iBlockType >= int(Loopring::BlockType::COUNT))
    {
        std::cerr << "Invalid block type: " << iBlockType << std::endl;
        return 1;
    }
    Loopring::BlockType blockType = Loopring::BlockType(iBlockType);
    baseFilename += getBaseName(blockType) + postFix;
    std::string provingKeyFilename = getProvingKeyFilename(baseFilename);

    if (mode == Mode::Prove || mode == Mode::Server)
    {
        if (!fileExists(provingKeyFilename))
        {
            std::cerr << "Failed to find pk!" << std::endl;
            return 1;
        }
    }

    ethsnarks::ProtoboardT pb;
    Loopring::Circuit* circuit = createCircuit(blockType, blockSize, onchainDataAvailability, pb);
    if (config.swapAB)
    {
        pb.constraint_system.swap_AB_if_beneficial();
    }
    pb.constraint_system.constraints.shrink_to_fit();
    pb.values.shrink_to_fit();
    libsnark::ConstantStorage<FieldT>::getInstance().constants.shrink_to_fit();

    printMemoryUsage();

#if 0
    unsigned int totalCoeffs = 0;
    for (size_t i = 0; i < pb.constraint_system.constraints.size(); ++i)
    {
        totalCoeffs += pb.constraint_system.constraints[i]->getA().getTerms().size();
        totalCoeffs += pb.constraint_system.constraints[i]->getB().getTerms().size();
        totalCoeffs += pb.constraint_system.constraints[i]->getC().getTerms().size();
    }
    std::cout << "num coefficients: " << totalCoeffs << std::endl;
    std::cout << "num unique coefficients: " << libsnark::ConstantStorage<FieldT>::getInstance().constants.size() << std::endl;
#endif

    if (mode == Mode::Benchmark)
    {
        if (!generateWitness(circuit, input))
        {
            return 1;
        }
        runBenchmark(circuit, provingKeyFilename);
    }

#ifdef MULTICORE
    omp_set_num_threads(config.num_threads);
    std::cout << "Num threads used: " << omp_get_max_threads() << std::endl;
#endif

    if (mode == Mode::Server)
    {
        runServer(circuit, provingKeyFilename, config, std::stoi(argv[3]));
    }

    if (mode == Mode::Validate || mode == Mode::Prove)
    {
        if (!generateWitness(circuit, input))
        {
            return 1;
        }
    }

    if (mode == Mode::Validate || mode == Mode::Prove)
    {
        if (!validateCircuit(circuit))
        {
            return 1;
        }
    }

    if (mode == Mode::CreateKeys)
    {
        if (!generateKeyPair(pb, baseFilename))
        {
            std::cerr << "Failed to generate keys!" << std::endl;
            return 1;
        }
    }

    if (mode == Mode::Prove)
    {
#ifdef GPU_PROVE
        std::cout << "GPU Prove: Generate inputsFile." << std::endl;
        std::string inputsFilename = baseFilename + "_inputs.raw";
        auto begin = now();
        stub_write_input_from_pb(pb, provingKeyFilename.c_str(), inputsFilename.c_str());
        print_time(begin, "write input");
#else
        ProverContextT context;
        loadProvingKey(provingKeyFilename, context.provingKey);
        context.constraint_system = &pb.constraint_system;
        context.config = config;
        context.domain = get_domain(pb, context.provingKey, config);
        initProverContextBuffers(context);
        printMemoryUsage();
        std::string jProof = proveCircuit(context, circuit);
        if (jProof.length() == 0)
        {
            return 1;
        }
        if(!writeProof(jProof, proofFilename))
        {
            return 1;
        }
#endif
    }

    if (mode == Mode::ExportCircuit)
    {
        if (!r1cs2json(pb, argv[3]))
        {
            std::cerr << "Failed to export circuit!" << std::endl;
            return 1;
        }
    }

    if (mode == Mode::ExportWitness)
    {
        if (!witness2json(pb, argv[3]))
        {
            std::cerr << "Failed to export witness!" << std::endl;
            return 1;
        }
    }

    return 0;
}
