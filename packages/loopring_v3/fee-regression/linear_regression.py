import pandas as pd

dataset = pd.read_csv('block_stats.csv')
dataset.head()

# select data


# All transactions...
X = dataset.iloc[:,2:].values
# ...or skip noops and deposits
#X = dataset.iloc[:,4:].values

y = dataset.iloc[:,1].values

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


print("- noop_cost:           " + str(regressor.coef_[0] + offset))
print("- deposit_cost:        " + str(regressor.coef_[1] + offset))
print("- withdrawal_cost:     " + str(regressor.coef_[2] + offset))
print("- transfer_cost:       " + str(regressor.coef_[3] + offset))
print("- trade_cost:          " + str(regressor.coef_[4] + offset))
print("- account_update_cost: " + str(regressor.coef_[5] + offset))
print("- amm_update_cost:     " + str(regressor.coef_[6] + offset))
print("- signature_cost:      " + str(regressor.coef_[7] + offset))

'''
print("- withdrawal_cost:     " + str(regressor.coef_[0] + offset))
print("- transfer_cost:       " + str(regressor.coef_[1] + offset))
print("- trade_cost:          " + str(regressor.coef_[2] + offset))
print("- account_update_cost: " + str(regressor.coef_[3] + offset))
print("- amm_update_cost:     " + str(regressor.coef_[4] + offset))
print("- signature_cost:      " + str(regressor.coef_[5] + offset))
'''

global_fee_discount = 0; # a discount for all kinds of fees
lrc_discount = 0.2;      # if LRC is used as fees (for transfers and trades)
protocol_fee = 0.2;      # only for transfers and trades
affiliate_reward = 0.2;  # only for trades


# Read or calculated from data set
num_noop 			= 1
num_deposit 		= 2;
num_withdrawal 		= 3;
num_transfer 		= 4;
num_trade 			= 5;
num_amm_update 		= 6;
num_signature 		= 7;

# The total gas cost
total_cost = num_noop * cost_noop +
	num_deposit * cost_deposit +
	num_withdrawal * cost_withdrawal +
	num_transfer * cost_transfer +
	num_trade * cost_trade +
	num_amm_update * cost_amm_update +
	num_signature *c ost_signature


num_amm_join_exit = num_amm_update / 2
cost_amm_join_exit = cost_amm_update * 2 + cost_transfer * 3;

# Get the real transfer counts (AMM excluded)
num_transfer -= num_amm_join_exit * 3

# What if we only charge for these fore types of tx
chargable_cost =  num_withdrawal * cost_withdrawal +
	num_transfer * cost_transfer +
	num_trade * cost_trade +
	num_amm_join_exit * cost_amm_join_exit;


# We will suffer a loss if we don't apply this ratio
ratio = (1 - global_fee_discount) * total_cost / chargable_cost;

# Increase each cost by the ratio
cost_withdrawal *= ratio;
cost_transfer *= ratio;
cost_trade *= ratio;
cost_amm_join_exit *= ratio;


cost_transfer /= ((1 - lrc_discount) * (1 - protocol_fee))
cost_trade /= ((1 - lrc_discount) * (1 - protocol_fee) * (1 - affiliate_reward))



# print cost...
