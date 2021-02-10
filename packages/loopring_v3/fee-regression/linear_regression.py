import pandas as pd
import math

global_fee_discount = 0.0;  # a discount for all kinds of fees
lrc_discount = 0.2;         # if LRC is used as fees (for transfers and trades)
protocol_fee = 0.2;         # only for transfers and trades
affiliate_reward = 0.2;     # only for trades

dataset = pd.read_csv('block_stats.csv')
dataset.head()

# select data

# All transactions...
X = dataset.iloc[:,2:].values
y = dataset.iloc[:,1].values

# apply global discount
for i in range(len(y)):
    y[i] *= (1.0 - global_fee_discount)

#print(X)
#print(y)

from sklearn.model_selection import train_test_split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size = 0.2, random_state = 0)

# Fitting the model
from sklearn.linear_model import LinearRegression
regressor = LinearRegression(positive=True)
regressor.fit(X_train, y_train)

# predicting the test set results
y_pred = regressor.predict(X_test)

#print(regressor.coef_)
#print(regressor.intercept_)

# distribute fixed cost over all transactions equally
offset = regressor.intercept_/386

'''
print("- noop_cost:           " + str(regressor.coef_[0] + offset))
print("- deposit_cost:        " + str(regressor.coef_[1] + offset))
print("- withdrawal_cost:     " + str(regressor.coef_[2] + offset))
print("- transfer_cost:       " + str(regressor.coef_[3] + offset))
print("- trade_cost:          " + str(regressor.coef_[4] + offset))
print("- account_update_cost: " + str(regressor.coef_[5] + offset))
print("- amm_update_cost:     " + str(regressor.coef_[6] + offset))
print("- signature_cost:      " + str(regressor.coef_[7] + offset))
'''

# raw costs
noop_cost = regressor.coef_[0] + offset
deposit_cost = regressor.coef_[1] + offset
withdrawal_cost = regressor.coef_[2] + offset
transfer_cost = regressor.coef_[3] + offset
trade_cost = regressor.coef_[4] + offset
account_update_cost = regressor.coef_[5] + offset
amm_update_cost = regressor.coef_[6] + offset
signature_cost = regressor.coef_[7] + offset


# Calculate the chance a transaction is a noop
noops = dataset.iloc[:,2].values
total_noops = 0
for e in noops:
    total_noops += e
p_noop = total_noops/len(noops)/386

# Calculate the chance a transaction is a deposit
deposits = dataset.iloc[:,3].values
total_deposits = 0
for e in deposits:
    total_deposits += e
p_deposit = total_deposits/len(deposits)/386

#print(p_noop)
#print(p_deposit)

# calculate the extra cost needed on all other transactions to pay for these transactions
extra_cost = noop_cost * p_noop + deposit_cost * p_deposit
#print(extra_cost)

# Distribute extra cost over all other transactions
withdrawal_cost += extra_cost
transfer_cost += extra_cost
trade_cost += extra_cost
account_update_cost += extra_cost
amm_update_cost += extra_cost
signature_cost += extra_cost


# AMM join/exit
amm_join_exit_cost = 2 * amm_update_cost + 3 * transfer_cost + 1 * signature_cost

# apply lrc discount and protocol fee to transfer fee
transfer_cost /= ((1 - lrc_discount) * (1 - protocol_fee))

# apply lrc discount, protocol fee and affiliate reward to trade fee
trade_cost /= ((1 - lrc_discount) * (1 - protocol_fee) * (1 - affiliate_reward))


def round(v):
    return math.ceil(v / 50) * 50

print("- withdrawal_cost:     " + str(round(withdrawal_cost)))
print("- transfer_cost:       " + str(round(transfer_cost)))
print("- trade_cost:          " + str(round(trade_cost)))
print("- account_update_cost: " + str(round(account_update_cost)))
print("- amm_join_exit_cost:  " + str(round(amm_join_exit_cost)))