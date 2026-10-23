import {
  emptyState, month, shiftMonth, today,
  type State, type Account, type Category, type Tx, type Rule,
} from "./engine";

/** Deterministic, entirely fictional household. All monetary amounts are cents. */
export function createDemoHousehold(): State {
  const s = emptyState();
  const current = month();
  const start = shiftMonth(current, -11);
  const date = (m: string, day: number) => m + "-" + String(day).padStart(2, "0");
  const account = (
    id: string, name: string, group: Account["group"], opening: number,
    rate = 0, cap = 0, allocation = 0,
  ): Account => ({
    id, name, group, opening, date: date(start, 1),
    rate, cap, capType: "balance", contributed: opening,
    relay: "", allocation,
    taxRate: 0, taxMode: "none",
  });
  s.accounts = [
    account("courant-a", "Compte principal", "current", 170000),
    account("courant-b", "Compte secondaire", "current", 85000),
    account("livret-a", "Livret A", "wealth", 930000, 1.5, 2295000, 45),
    account("livret-projet", "Épargne de précaution", "wealth", 450000, 2, 0, 30),
    account("pea", "PEA", "wealth", 580000, 5.5, 15000000, 15),
    account("voyages", "Épargne voyages", "travel", 180000, 1.5, 0, 10),
  ];
  const categories: Array<[string,string,string,number]> = [
    ["logement","Logement","home",135000],
    ["courses","Courses","food",52000],
    ["restos","Restaurants","out",26000],
    ["transport","Transports","car",27000],
    ["sante","Santé","health",9000],
    ["loisirs","Loisirs","game",27000],
    ["abonnements","Abonnements","phone",9000],
    ["divers","Divers","other",18000],
  ];
  s.categories = categories.map(([id,name,icon,limit]):Category=>({
    id,name,icon,budgets:Object.fromEntries(
      Array.from({length:16},(_,i)=>[shiftMonth(start,i),limit])
    ),
  }));
  const rules: Array<[string,string,string,string,number,number]> = [
    ["loyer","Loyer","logement","courant-a",105000,5],
    ["energie","Énergie","logement","courant-a",18000,8],
    ["assurance","Assurances","logement","courant-b",12000,10],
    ["net","Internet et téléphone","abonnements","courant-b",6500,12],
  ];
  s.rules = rules.map(([id,name,category,accountId,amount,day]):Rule=>({
    id,name,category,account:accountId,amount,
    start:date(start,day),interval:1,count:0,kind:"fixed",
  }));
  const tx: Tx[] = [];
  const add=(id:string,type:Tx["type"],amount:number,m:string,day:number,description:string,accountId:string,category?:string,extra:Partial<Tx>={})=>{
    // Never seed transactions from the future on a partial current month.
    if(date(m,day)>today())return;
    tx.push({id,type,amount,date:date(m,day),description,account:accountId,...(category?{category}:{}),...extra});
  };
  for(let i=0;i<12;i++){
    const m=shiftMonth(start,i);
    const variation=(i%4)*1700;
    add("salary-1-"+m,"income",260000,m,2,"Salaire Camille","courant-a",undefined,{incomeType:"Salaire"});
    add("salary-2-"+m,"income",160000,m,3,"Salaire Alex","courant-b",undefined,{incomeType:"Salaire"});
    for(const [id,name,cat,acct,amount,day] of rules)
      add(id+"-"+m,"expense",amount,m,day,name,acct,cat,{fixed:true,dueKey:id+":"+date(m,day)});
    add("market-1-"+m,"expense",29500+variation,m,7,"Courses supermarché","courant-a","courses");
    add("market-2-"+m,"expense",16700+variation,m,18,"Marché et épicerie","courant-a","courses");
    add("fuel-"+m,"expense",13800,m,9,"Carburant","courant-b","transport");
    add("train-"+m,"expense",6700,m,17,"Transports en commun","courant-b","transport");
    add("dinner-"+m,"expense",9700+(i%3)*1300,m,13,"Restaurant","courant-a","restos");
    add("coffee-"+m,"expense",3600,m,19,"Café et sorties","courant-b","loisirs");
    add("sport-"+m,"expense",6200,m,15,"Sport et loisirs","courant-a","loisirs");
    add("pharmacy-"+m,"expense",3100,m,14,"Pharmacie","courant-b","sante");
    add("other-"+m,"expense",5700,m,16,"Achats du quotidien","courant-b","divers");
    add("save-1-"+m,"transfer",40000,m,20,"Épargne mensuelle","courant-a",undefined,{to:"livret-a",savingMonth:m});
    add("save-2-"+m,"transfer",25000,m,20,"Investissement mensuel","courant-a",undefined,{to:"pea",savingMonth:m});
    add("save-3-"+m,"transfer",15000,m,20,"Projet vacances","courant-b",undefined,{to:"voyages",savingMonth:m});
  }
  s.transactions=tx;
  s.income=420000;
  s.salaryDay=3;
  s.salaryBudget="current";
  s.incomeSources=[
    {id:"salaire-camille",name:"Salaire Camille",amount:260000,day:2,frequency:"monthly",receivedMonths:Array.from({length:12},(_,i)=>shiftMonth(start,i))},
    {id:"salaire-alex",name:"Salaire Alex",amount:160000,day:3,frequency:"monthly",receivedMonths:Array.from({length:12},(_,i)=>shiftMonth(start,i))},
  ];
  s.salaryReceivedMonths=Array.from({length:12},(_,i)=>shiftMonth(start,i));
  s.savingDoneMonths=Array.from({length:11},(_,i)=>shiftMonth(start,i));
  const tripStart=shiftMonth(current,2);
  const tripEnd=shiftMonth(current,3);
  s.trips=[
    {id:"italie",name:"Voyage en Italie",start:tripStart+"-09",end:tripStart+"-18",budget:240000,
      categories:[{id:"transport",name:"Transports",budget:75000},{id:"hotel",name:"Hébergement",budget:100000},{id:"repas",name:"Restaurants",budget:65000}]},
    {id:"weekend",name:"Week-end à Lyon",start:tripEnd+"-06",end:tripEnd+"-08",budget:55000,
      categories:[{id:"transport",name:"Transports",budget:14000},{id:"hotel",name:"Hébergement",budget:27000},{id:"repas",name:"Restaurants",budget:14000}]},
  ];
  s.projects=[
    {id:"projet-auto",name:"Nouvelle voiture",type:"other",date:shiftMonth(current,14)+"-01",
      amount:850000,account:"livret-projet",active:true,settled:false},
  ];
  return s;
}
