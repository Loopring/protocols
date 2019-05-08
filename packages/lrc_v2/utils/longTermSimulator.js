
let total = 115322522587138686426174365;
let deposited = 65144894075138676487887251;
let remainingBonus =  total - deposited;

function simulate(withdrawalBase) {
  const bonus = remainingBonus * Math.pow(withdrawalBase / deposited, 1.0625);
  total = total - withdrawalBase - bonus;
  deposited = deposited - withdrawalBase;
  remainingBonus = total - deposited;
  const percentage = bonus * 100 / withdrawalBase;
  console.log("total:", total, "; bonus:", bonus, "; percentage:", percentage  + "%");
  return bonus;
}

const withdrawalAmout = Math.floor(deposited / 6000);
for (let i = 0; i < 6000; i ++) {
  simulate(withdrawalAmout);
}
