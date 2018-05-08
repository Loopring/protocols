/**
 * @description Returns precise result of arg1 divides arg2
 * @param arg1 number
 * @param arg2 number
 * @returns {number}
 */
export function accDiv(arg1,arg2){
  if(!arg1 || !arg2) return 0
  let t1=0,t2=0,r1,r2;
  try{t1=arg1.toString().split(".")[1].length}catch(e){}
  try{t2=arg2.toString().split(".")[1].length}catch(e){}
  r1=Number(arg1.toString().replace(".",""));
  r2=Number(arg2.toString().replace(".",""));
  return (r1/r2)*Math.pow(10,t2-t1);
}

/**
 * @description Returns precise result of  multiply arg1 by arg2
 * @param arg1 number
 * @param arg2 number
 * @returns {number}
 */
export function accMul(arg1,arg2){
  if(!arg1 || !arg2) return 0
  let m=0,s1=arg1.toString(),s2=arg2.toString();
  try{m+=s1.split(".")[1].length}catch(e){}
  try{m+=s2.split(".")[1].length}catch(e){}
  return Number(s1.replace(".",""))*Number(s2.replace(".",""))/Math.pow(10,m)
}

/**
 * @description Returns precise result of arg1 plus arg2
 * @param arg1 number
 * @param arg2 number
 * @returns {number}
 */
export function accAdd(arg1,arg2){
  if(!arg1 || !arg2) return 0;
  let r1,r2,m;
  try{r1=arg1.toString().split(".")[1].length}catch(e){r1=0}
  try{r2=arg2.toString().split(".")[1].length}catch(e){r2=0}
  m=Math.pow(10,Math.max(r1,r2));
  return (arg1*m+arg2*m)/m
}

/**
 * @description Returns precise result of arg1 minus arg2
 * @param arg1 number
 * @param arg2 number
 * @returns {number}
 */
export function accSub(arg1,arg2){
  if(!arg1 || !arg2) return 0;
  let r1,r2,m,n;
  try{r1=arg1.toString().split(".")[1].length}catch(e){r1=0}
  try{r2=arg2.toString().split(".")[1].length}catch(e){r2=0}
  m=Math.pow(10,Math.max(r1,r2));
  n=(r1>=r2)?r1:r2;
  return Number(((arg1*m-arg2*m)/m).toFixed(n));
}
