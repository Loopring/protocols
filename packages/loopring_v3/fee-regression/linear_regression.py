import pandas as pd
import math

global_fee_discount = 0.0  # a discount for all kinds of fees
lrc_discount = 0.2         # if LRC is used as fees (for transfers and trades)
protocol_fee = 0.2         # only for transfers and trades
affiliate_reward = 0.2     # only for trades
transfer_cost_cap = 700    # caps transfer costs and moves any excesses to trades

block_size = 386

dataset = pd.read_csv('block_stats.csv')
dataset.head()

# select data

# All transactions...
X = dataset.iloc[:,2:].values
y = dataset.iloc[:,1].values

noops = dataset.iloc[:,2].values
deposits = dataset.iloc[:,3].values
withdrawals = dataset.iloc[:,4].values
transfers = dataset.iloc[:,5].values
trades = dataset.iloc[:,6].values
account_updates = dataset.iloc[:,7].values
amm_updates = dataset.iloc[:,8].values
signatures = dataset.iloc[:,9].values

# apply global discount
for i in range(len(y)):
    y[i] *= (1.0 - global_fee_discount)

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
offset = regressor.intercept_/block_size

# raw costs
noop_cost = regressor.coef_[0] + offset
deposit_cost = regressor.coef_[1] + offset
withdrawal_cost = regressor.coef_[2] + offset
transfer_cost = regressor.coef_[3] + offset
trade_cost = regressor.coef_[4] + offset
account_update_cost = regressor.coef_[5] + offset
amm_update_cost = regressor.coef_[6] + offset
signature_cost = regressor.coef_[7] + offset

# Calculcates probability for a transaction type
def p(v):
    total = 0
    for e in v:
        total += e
    return total/len(v)/block_size

# Move costs for noops and deposits to other transactions
# calculate the extra cost needed on all other transactions to pay for these transactions
extra_cost = noop_cost * p(noops) + deposit_cost * p(deposits)
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


# Apply transfer cap
# Calculate excess
excess = transfer_cost - transfer_cost_cap
if excess > 0:
    # get the transfers not part of an AMM join/exit
    transfers_no_amm = transfers - (amm_updates * 1.5)
    # Add the excess to trades with a transfer/trade ratio
    trade_cost += excess * (p(transfers_no_amm)/p(trades))
    # Set the cap
    transfer_cost = transfer_cost_cap


def round_(v):
    return math.ceil(v / 50) * 50

print("- withdrawal_cost:     " + str(round_(withdrawal_cost)))
print("- transfer_cost:       " + str(round_(transfer_cost)))
print("- trade_cost:          " + str(round_(trade_cost)))
print("- account_update_cost: " + str(round_(account_update_cost)))
print("- amm_join_exit_cost:  " + str(round_(amm_join_exit_cost)))