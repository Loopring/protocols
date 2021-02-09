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