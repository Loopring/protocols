import csv


from collections import namedtuple
MyStruct = namedtuple("BlockStats", "gas_used num_noops num_deposits num_withdrawals num_transfers num_trades num_account_updates num_amm_updates num_signatures")

with open('block_stats.csv', newline='') as csvfile:
    csv_reader = csv.reader(csvfile, delimiter=',', quotechar='"')

    block_stats = []

    line_count = 0
    for row in csv_reader:
        if line_count == 0:
            print(f'Column names are {", ".join(row)}')
            line_count += 1
        else:
            line_count += 1

            block_stat = MyStruct(int(row[1]), int(row[2]), int(row[3]), int(row[4]), int(row[5]), int(row[6]), int(row[7]), int(row[8]), int(row[9]))
            block_stats.append(block_stat)
    print(f'Processed {line_count} lines.')

    best_total_error = 2**64
    best_total_gas_delta = 0

    best_noop_cost = 0
    best_deposit_cost = 0
    best_withdrawal_cost = 0
    best_transfer_cost = 0
    best_trade_cost = 0
    best_account_update_cost = 0
    best_amm_update_cost = 0
    best_signature_cost = 0

    '''
    # Used to roughly find good values
    for noop_cost in range(0, 2000, 200):
        print("**noop_cost**: " + str(noop_cost))
        for deposit_cost in range(-10000, 10000, 2000):
            print("**deposit_cost**: " + str(deposit_cost))
            for withdrawal_cost in range(30000, 60000, 5000):
                print("**withdrawal_cost**: " + str(withdrawal_cost))
                for transfer_cost in range(400, 2000, 200):
                    for trade_cost in range(400, 2000, 200):
                        for account_update_cost in range(5000, 20000, 2000):
                            for amm_update_cost in range(30000, 70000, 5000):
                                for signature_cost in range(1000, 10000, 2000):
    '''

    '''
    # Used to more accurately find the better values
    for noop_cost in range(800, 1300, 100):
        print("**noop_cost**: " + str(noop_cost))
        for deposit_cost in range(-2000, 2000, 1000):
            print("**deposit_cost**: " + str(deposit_cost))
            for withdrawal_cost in range(42000, 48000, 1000):
                print("**withdrawal_cost**: " + str(withdrawal_cost))
                for transfer_cost in range(1000, 1500, 100):
                    for trade_cost in range(1000, 1500, 100):
                        for account_update_cost in range(13000, 17000, 1000):
                            for amm_update_cost in range(40000, 50000, 1000):
                                for signature_cost in range(1000, 9000, 1000):
    '''

    # Used to find the best values
    for noop_cost in range(800, 1200, 50):
        print("**noop_cost**: " + str(noop_cost))
        for deposit_cost in range(-1000, 500, 500):
            print("**deposit_cost**: " + str(deposit_cost))
            for withdrawal_cost in range(45000, 50000, 500):
                print("**withdrawal_cost**: " + str(withdrawal_cost))
                for transfer_cost in range(1100, 1400, 25):
                    for trade_cost in range(1100, 1400, 25):
                        for account_update_cost in range(16000, 18500, 500):
                            for amm_update_cost in range(47000, 53000, 500):
                                for signature_cost in range(0, 500, 500):

                                    total_error = 0
                                    total_gas_delta = 0

                                    # Run over all blocks
                                    for stat in block_stats:
                                        prediction = noop_cost * stat.num_noops + \
                                            deposit_cost * stat.num_deposits + \
                                            withdrawal_cost * stat.num_withdrawals + \
                                            transfer_cost * stat.num_transfers + \
                                            trade_cost * stat.num_trades + \
                                            account_update_cost * stat.num_account_updates + \
                                            amm_update_cost * stat.num_amm_updates + \
                                            signature_cost * stat.num_signatures

                                        error = abs(prediction - stat.gas_used)
                                        # Extra penalty for predictions that are too low
                                        if prediction < stat.gas_used:
                                            error = error*1

                                        # accumulate error
                                        total_error = total_error + error

                                        # accumulate gas
                                        total_gas_delta = total_gas_delta + (prediction - stat.gas_used)


                                    # Check total error
                                    if total_error < best_total_error:
                                        best_total_error = total_error
                                        best_total_gas_delta = total_gas_delta
                                        best_noop_cost = noop_cost
                                        best_deposit_cost = deposit_cost
                                        best_withdrawal_cost = withdrawal_cost
                                        best_transfer_cost = transfer_cost
                                        best_trade_cost = trade_cost
                                        best_account_update_cost = account_update_cost
                                        best_amm_update_cost = amm_update_cost
                                        best_signature_cost = signature_cost

                                        print("best error updated: " + str(total_error))
                                        print("total gas delta: " + str(total_gas_delta))
                                        print("- noop_cost:           " + str(best_noop_cost))
                                        print("- deposit_cost:        " + str(best_deposit_cost))
                                        print("- withdrawal_cost:     " + str(best_withdrawal_cost))
                                        print("- transfer_cost:       " + str(best_transfer_cost))
                                        print("- trade_cost:          " + str(best_trade_cost))
                                        print("- account_update_cost: " + str(best_account_update_cost))
                                        print("- amm_update_cost:     " + str(best_amm_update_cost))
                                        print("- signature_cost:      " + str(best_signature_cost))



    print("Best total error: " + str(best_total_error))
    print("Total gas delta: " + str(best_total_gas_delta))
    print("- noop_cost:           " + str(best_noop_cost))
    print("- deposit_cost:        " + str(best_deposit_cost))
    print("- withdrawal_cost:     " + str(best_withdrawal_cost))
    print("- transfer_cost:       " + str(best_transfer_cost))
    print("- trade_cost:          " + str(best_trade_cost))
    print("- account_update_cost: " + str(best_account_update_cost))
    print("- amm_update_cost:     " + str(best_amm_update_cost))
    print("- signature_cost:      " + str(best_signature_cost))

