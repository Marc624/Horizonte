/* Núcleo financiero puro. Importes en EUR; tasas efectivas anuales en decimal. */
(function (root) {
  'use strict';
  const finite = (x, name) => { if (!Number.isFinite(x)) throw new Error(name + ': número no válido'); return x; };
  const nonnegative = (x, name) => { finite(x, name); if (x < 0) throw new Error(name + ': debe ser >= 0'); return x; };
  function realRate(nominal, inflation) {
    finite(nominal, 'Rentabilidad'); finite(inflation, 'Inflación');
    if (nominal <= -1 || inflation <= -1) throw new Error('Las tasas deben superar -100%');
    return (1 + nominal) / (1 + inflation) - 1;
  }
  function futureValue(initial, contribution, annual, months) {
    nonnegative(initial, 'Capital'); nonnegative(contribution, 'Aportación');
    finite(annual, 'Rentabilidad');
    if (annual <= -1 || !Number.isInteger(months) || months < 0 || months > 1200) throw new Error('Tasa o plazo no válido');
    const i = Math.expm1(Math.log1p(annual) / 12);
    if (Math.abs(i) < 1e-12) return initial + contribution * months;
    const growth = Math.exp(months * Math.log1p(i));
    return initial * growth + contribution * Math.expm1(months * Math.log1p(i)) / i;
  }
  function fire({initial, contribution, spending, withdrawal, nominal, inflation, age, retirementAge, horizon = 80}) {
    nonnegative(initial, 'Capital'); nonnegative(contribution, 'Aportación'); nonnegative(spending, 'Gasto');
    finite(withdrawal, 'Retirada'); finite(age, 'Edad'); finite(retirementAge, 'Edad de jubilación');
    if (spending <= 0 || withdrawal <= 0 || withdrawal > .2 || age < 0 || retirementAge < age || !Number.isInteger(horizon) || horizon < 1 || horizon > 100) throw new Error('Parámetros FIRE no válidos');
    const annual = realRate(nominal, inflation), i = Math.expm1(Math.log1p(annual) / 12);
    const target = spending * 12 / withdrawal;
    let balance = initial, reached = balance >= target ? 0 : null;
    const series = [{year:0, age, balance, paid:initial}], monthlySeries = [{year:0, age, balance, paid:initial}];
    for (let month = 1; month <= horizon * 12; month++) {
      balance = balance * (1 + i) + contribution;
      if (reached === null && balance >= target) reached = month;
      monthlySeries.push({year:month / 12, age:age + month / 12, balance, paid:initial + contribution * month});
      if (month % 12 === 0) series.push({year:month / 12, age:age + month / 12, balance, paid:initial + contribution * month});
    }
    const retirementMonths = Math.round((retirementAge - age) * 12);
    const atRetirement = retirementMonths <= 1200 ? futureValue(initial, contribution, annual, retirementMonths) : null;
    return {target, annual, reached, years: reached === null ? null : reached / 12, age: reached === null ? null : age + reached / 12, atRetirement, series, monthlySeries};
  }
  function compound({initial, contribution, nominal, inflation, years, purchase}) {
    nonnegative(purchase, 'Compra');
    if (!Number.isInteger(years) || years < 1 || years > 80) throw new Error('Plazo entre 1 y 80 años');
    realRate(nominal, inflation);
    const series = [];
    for (let year = 0; year <= years; year++) {
      const balance = futureValue(initial, contribution, nominal, year * 12);
      const paid = initial + contribution * year * 12;
      series.push({year, balance, paid, earnings:balance - paid, real:balance / Math.pow(1 + inflation, year)});
    }
    const opportunity = futureValue(purchase, 0, nominal, years * 12);
    return {series, opportunity, opportunityReal:opportunity / Math.pow(1 + inflation, years), forgoneEarnings:opportunity - purchase};
  }
  function dashboard(accounts, transactions, month) {
    let assets = 0, liabilities = 0, liquid = 0, investment = 0;
    accounts.forEach(a => {
      if (a.kind === 'liability') liabilities += a.balance;
      else { assets += a.balance; if (a.kind === 'liquid') liquid += a.balance; if (a.kind === 'investment') investment += a.balance; }
    });
    const rows = transactions.filter(t => t.date.slice(0, 7) === month);
    const income = rows.filter(t => t.kind === 'income').reduce((s,t) => s+t.amount, 0);
    const expenses = rows.filter(t => t.kind === 'expense').reduce((s,t) => s+t.amount, 0);
    const savings = income - expenses;
    return {assets, liabilities, liquid, investment, netWorth:assets-liabilities, debtRatio:assets === 0 ? null : liabilities/assets, income, expenses, savings, savingRate:income === 0 ? null : savings/income};
  }
  const monthKey = value => {
    if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new Error('Mes no válido');
    return value;
  };
  const text = (value, name, max = 120) => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error(name + ': texto no válido');
    return value.trim();
  };
  const categoryKey = value => value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es').replace(/\.+$/u, '').trim();
  function monthlyBudgets({month, budgets, transactions = []}) {
    monthKey(month);
    const budgetRows = Array.isArray(budgets) ? budgets :
      budgets && typeof budgets === 'object' ? Object.entries(budgets).map(([category, planned]) => ({category, planned})) : null;
    if (!budgetRows || !Array.isArray(transactions)) throw new Error('Presupuesto o movimientos no válidos');
    const planned = new Map();
    budgetRows.forEach(row => {
      const category = text(row.category, 'Categoría', 60);
      const amount = nonnegative(row.planned, 'Presupuesto');
      const key = categoryKey(category);
      if (!key) throw new Error('Categoría: texto no válido');
      if (planned.has(key)) throw new Error('No puede haber categorías repetidas, aunque cambien las mayúsculas');
      planned.set(key, {category, amount});
    });
    const actual = new Map();
    transactions.forEach(row => {
      if (!row || row.date?.slice(0, 7) !== month || row.kind !== 'expense') return;
      const category = text(row.category, 'Categoría', 60);
      const amount = nonnegative(row.amount, 'Gasto');
      const key = categoryKey(category);
      if (!key) throw new Error('Categoría: texto no válido');
      const current = actual.get(key);
      actual.set(key, {category: current?.category || category, amount: (current?.amount || 0) + amount});
    });
    const categories = new Set([...planned.keys(), ...actual.keys()]);
    const rows = [...categories].sort((a,b) => (planned.get(a)?.category || actual.get(a).category).localeCompare(planned.get(b)?.category || actual.get(b).category, 'es')).map(key => {
      const category = planned.get(key)?.category || actual.get(key).category;
      const budget = planned.get(key)?.amount || 0, spent = actual.get(key)?.amount || 0;
      const deviation = budget - spent;
      return {category, planned: budget, actual: spent, deviation, variance: deviation, remaining: budget - spent,
        utilization: budget === 0 ? (spent === 0 ? null : Infinity) : spent / budget,
        favorable: budget > 0 && deviation > 0,
        status: spent > budget ? 'over' : spent < budget ? 'under' : 'on-plan'};
    });
    const income = transactions.filter(t => t && t.date?.slice(0, 7) === month && t.kind === 'income')
      .reduce((sum, t) => sum + nonnegative(t.amount, 'Ingreso'), 0);
    const expenses = transactions.filter(t => t && t.date?.slice(0, 7) === month && t.kind === 'expense')
      .reduce((sum, t) => sum + nonnegative(t.amount, 'Gasto'), 0);
    const plannedExpenses = rows.reduce((sum, row) => sum + row.planned, 0);
    const totals = {planned: plannedExpenses, actual: expenses, deviation: plannedExpenses - expenses,
      variance: plannedExpenses - expenses, remaining: plannedExpenses - expenses, income,
      expenses, savings: income - expenses, savingRate: income === 0 ? null : (income - expenses) / income};
    return {month, categories: rows, totals, cashSummary: totals};
  }
  const validateRate = (value, name) => {
    finite(value, name);
    if (value <= -1) throw new Error(name + ': debe superar -100%');
    return value;
  };
  function retirementProjection({
    age, retirementAge, currentCapital, monthlyContribution, monthlyExpenses,
    pensionMonthly = 0, pensionStartAge = retirementAge, nominalReturn = .05,
    inflation = .02, withdrawalRate = .04, horizonYears = 30, decumulationReturn = nominalReturn
  }) {
    [age, retirementAge, pensionStartAge].forEach((v, i) => finite(v, ['Edad','Edad de jubilación','Edad de pensión'][i]));
    nonnegative(currentCapital, 'Capital actual'); nonnegative(monthlyContribution, 'Aportación mensual');
    nonnegative(monthlyExpenses, 'Gasto mensual'); nonnegative(pensionMonthly, 'Pensión mensual');
    validateRate(nominalReturn, 'Rentabilidad nominal'); validateRate(inflation, 'Inflación');
    validateRate(decumulationReturn, 'Rentabilidad de desacumulación');
    finite(withdrawalRate, 'Tasa de retirada'); finite(horizonYears, 'Horizonte');
    if (retirementAge < age || pensionStartAge < retirementAge || monthlyExpenses <= 0 ||
      withdrawalRate <= 0 || withdrawalRate > .2 || !Number.isInteger(horizonYears) ||
      horizonYears < 1 || horizonYears > 80) throw new Error('Parámetros de jubilación no válidos');
    const yearsToRetirement = retirementAge - age, monthsToRetirement = Math.round(yearsToRetirement * 12);
    const realReturn = realRate(nominalReturn, inflation);
    const monthlyReturn = Math.expm1(Math.log1p(realReturn) / 12);
    let balance = currentCapital;
    const accumulation = [{year: 0, age, balance}];
    for (let month = 1; month <= monthsToRetirement; month++) {
      balance = balance * (1 + monthlyReturn) + monthlyContribution;
      if (month % 12 === 0 || month === monthsToRetirement) accumulation.push({year: month / 12, age: age + month / 12, balance});
    }
    const pensionAtRetirement = pensionStartAge === retirementAge ? pensionMonthly : 0;
    const requiredCapital = Math.max(0, (monthlyExpenses - pensionAtRetirement) * 12 / withdrawalRate);
    const decumulationRealReturn = realRate(decumulationReturn, inflation);
    const scenarioRates = {cautious: Math.max(-.99, decumulationRealReturn - .02),
      central: decumulationRealReturn, optimistic: decumulationRealReturn + .02};
    const scenarios = Object.entries(scenarioRates).map(([name, rate]) => {
      const monthly = Math.expm1(Math.log1p(rate) / 12), points = [];
      let capital = balance;
      for (let month = 0; month <= horizonYears * 12; month++) {
        if (month % 12 === 0) points.push({year: month / 12, age: retirementAge + month / 12, balance: capital});
        if (month === horizonYears * 12) break;
        const ageAtMonth = retirementAge + month / 12;
        const pension = ageAtMonth + 1e-10 >= pensionStartAge ? pensionMonthly : 0;
        capital = capital * (1 + monthly) - Math.max(0, monthlyExpenses - pension);
      }
      return {name, annualReturn: rate, series: points, endingCapital: capital, depleted: capital < 0};
    });
    return {yearsToRetirement, realReturn, capitalAtRetirement: balance, pensionMonthly,
      pensionAtRetirement, monthlyExpenses, requiredCapital, gap: Math.max(0, requiredCapital - balance),
      accumulation, scenarios, educational: true};
  }
  function loanAmortization({
    principal, annualNominalRate = 0, termMonths, upfrontFee = 0, monthlyFee = 0,
    otherFees = 0, startDate = null
  }) {
    nonnegative(principal, 'Principal'); nonnegative(upfrontFee, 'Comisión inicial');
    nonnegative(monthlyFee, 'Comisión mensual'); nonnegative(otherFees, 'Otras comisiones');
    validateRate(annualNominalRate, 'TIN nominal');
    if (principal <= 0 || !Number.isInteger(termMonths) || termMonths < 1 || termMonths > 600)
      throw new Error('Parámetros del préstamo no válidos');
    if (startDate !== null && (typeof startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)))
      throw new Error('Fecha de inicio no válida');
    const monthlyRate = Math.expm1(Math.log1p(annualNominalRate) / 12);
    const payment = Math.abs(monthlyRate) < 1e-12 ? principal / termMonths :
      principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -termMonths));
    let balance = principal, totalInterest = 0;
    const table = [];
    for (let month = 1; month <= termMonths; month++) {
      const interest = balance * monthlyRate, principalPaid = Math.min(balance, payment - interest);
      const installment = principalPaid + interest;
      balance = Math.max(0, balance - principalPaid); totalInterest += interest;
      table.push({month, payment: installment + monthlyFee, principal: principalPaid, interest,
        fee: monthlyFee, balance});
    }
    const fees = upfrontFee + otherFees + monthlyFee * termMonths, totalPaid = payment * termMonths + fees;
    const cashFlows = [-principal + upfrontFee + otherFees];
    table.forEach(row => cashFlows.push(row.payment));
    const npv = rate => cashFlows.reduce((sum, cash, i) => sum + cash / Math.pow(1 + rate, i), 0);
    let low = -0.999999, high = 1;
    for (let i = 0; i < 100 && npv(high) > 0; i++) high = high * 2 + 1;
    for (let i = 0; i < 120; i++) { const mid = (low + high) / 2; if (npv(mid) > 0) low = mid; else high = mid; }
    const tae = Math.pow(1 + (low + high) / 2, 12) - 1;
    return {principal, annualNominalRate, monthlyRate, termMonths, payment, totalInterest,
      totalFees: fees, totalPaid, tae, table, startDate};
  }
  const INVESTMENT_OPTIONS = [
    {id:'deposit',name:'Cuenta remunerada o depósito',type:'Conservación',description:'Interés ofrecido durante unas condiciones y un plazo concretos. Comprueba si es fijo o variable, las comisiones y la protección de depósitos aplicable en tu país y entidad.'},
    {id:'treasury-bills',name:'Letras y deuda pública de corto plazo',type:'Renta fija directa',description:'Deuda soberana con vencimiento. El resultado depende del precio, plazo y emisor; vender antes del vencimiento puede implicar pérdidas y no existe el mismo riesgo en todos los países.'},
    {id:'money-market',name:'Fondo monetario',type:'Fondo de inversión',description:'Invierte en instrumentos de corto plazo. No es un depósito, el capital no está garantizado y su valor y liquidez pueden variar.'},
    {id:'bond-ladder',name:'Bonos individuales o escalera de vencimientos',type:'Renta fija directa',description:'Permite conocer vencimientos y pagos previstos del emisor. Existe riesgo de impago, inflación y pérdida si se vende antes del vencimiento.'},
    {id:'bond-fund',name:'Fondo de renta fija',type:'Fondo de inversión',description:'Diversifica bonos, pero su valor fluctúa con los tipos de interés y la calidad crediticia; normalmente no tiene una fecha en que garantice recuperar el capital.'},
    {id:'balanced-fund',name:'Fondo mixto o cartera diversificada',type:'Fondo de inversión',description:'Combina activos como acciones y bonos. La mezcla y el rebalanceo varían; puede perder valor y no garantiza una rentabilidad.'},
    {id:'global-index',name:'Fondo indexado o ETF global diversificado',type:'Fondo / vehículo cotizado',description:'Busca replicar un índice amplio con una cartera diversificada. Puede caer mucho y tardar años en recuperarse; compara índice, costes, fiscalidad y estructura.'},
    {id:'individual-stocks',name:'Acciones individuales',type:'Renta variable directa',description:'Participación en empresas con riesgo de pérdida significativa y concentración. Requiere analizar empresas; una acción no equivale a un fondo diversificado.'},
    {id:'pension-wrapper',name:'Plan o producto de pensiones',type:'Envoltorio de inversión',description:'Es una estructura con reglas de aportación, inversión, liquidez e impuestos que dependen del país; el resultado depende de los activos subyacentes y no necesariamente está garantizado.'},
    {id:'reit',name:'Fondos inmobiliarios cotizados o REIT',type:'Activo cotizado',description:'Exposición inmobiliaria a través de títulos; puede fluctuar con el mercado, tipos, deuda y situación del sector. No equivale a comprar una vivienda.'},
    {id:'commodities',name:'Materias primas y oro',type:'Activo / exposición temática',description:'Su precio puede ser muy volátil y no siempre genera intereses o dividendos. El producto usado puede añadir costes, derivados o riesgo de emisor.'},
    {id:'crypto',name:'Criptoactivos',type:'Alto riesgo',description:'Precios muy volátiles, riesgos de custodia, fraude, plataforma y regulación. Puedes perder gran parte o todo el dinero invertido.'},
    {id:'forex-cfd',name:'Forex, CFD y derivados apalancados',type:'Alto riesgo / especulación',description:'El apalancamiento puede multiplicar pérdidas rápidamente; no son una base prudente para financiar objetivos de jubilación ni equivalen a invertir en un fondo.'},
    {id:'active-trading',name:'Trading frecuente o intradía',type:'Estrategia especulativa',description:'Busca aprovechar movimientos de corto plazo; costes, errores y volatilidad pueden erosionar el capital. No hay rentabilidad asegurada ni el simulador puede validar una estrategia.'},
    {id:'broker',name:'Broker o plataforma',type:'Intermediario, no activo',description:'Es el canal para operar, no una inversión ni una fuente de rentabilidad. Revisa autorización en tu jurisdicción, custodia, comisiones, conflictos y productos ofrecidos.'}
  ];
  const GUIDE_VALUES = {
    horizon:['short','medium','long'],
    liquidity:['high','some','low'],
    lossTolerance:['none','small','substantial'],
    experience:['beginner','some','experienced'],
    goal:['preserve','income','growth'],
    emergencyFund:['ready','partial','none','unknown'],
    highInterestDebt:['yes','no','unknown']
  };
  function investmentGuide(profile) {
    if(!profile || typeof profile!=='object' ||
      Object.entries(GUIDE_VALUES).some(([key,allowed])=>!allowed.includes(profile[key])))
      throw new Error('Completa todas las respuestas de orientación');
    const shortTerm=profile.horizon==='short' || profile.liquidity==='high' || profile.lossTolerance==='none';
    let focusIds, compareIds;
    if(shortTerm) {
      focusIds=profile.goal==='income'?['deposit','treasury-bills']:['deposit','treasury-bills'];
      compareIds=['money-market'];
    } else if(profile.horizon==='medium') {
      focusIds=profile.goal==='income'?['treasury-bills','bond-ladder']:['deposit','treasury-bills'];
      compareIds=['money-market','bond-fund'];
      if(profile.lossTolerance==='substantial')compareIds.push('balanced-fund');
    } else if(profile.goal==='preserve') {
      focusIds=['deposit','treasury-bills'];
      compareIds=['money-market','bond-fund','balanced-fund'];
    } else if(profile.goal==='income') {
      focusIds=['treasury-bills','bond-ladder','bond-fund'];
      compareIds=['deposit','balanced-fund'];
    } else if(profile.lossTolerance==='small') {
      focusIds=['balanced-fund','bond-fund'];
      compareIds=['global-index'];
    } else {
      focusIds=['global-index','balanced-fund'];
      compareIds=['bond-fund'];
      if(profile.experience==='experienced')compareIds.push('individual-stocks','reit');
    }
    if(profile.goal==='growth' && profile.horizon==='long' && !shortTerm && profile.experience!=='beginner')
      compareIds.push('individual-stocks');
    if(profile.goal==='growth' && profile.horizon==='long' && !shortTerm)
      compareIds.push('pension-wrapper');
    const optionsById=new Map(INVESTMENT_OPTIONS.map(option=>[option.id,option]));
    const priorities=[];
    if(profile.emergencyFund==='none')priorities.push('Aún no tienes un fondo de emergencia: antes de invertir dinero que podrías necesitar, prioriza crear una reserva líquida para imprevistos.');
    if(profile.emergencyFund==='partial')priorities.push('Tu fondo de emergencia está incompleto: valora completar una reserva accesible antes de asumir riesgos con ese dinero.');
    if(profile.highInterestDebt==='yes')priorities.push('Indicas deuda de interés alto: compara su coste efectivo con cualquier rendimiento incierto y revisa si amortizarla es prioritario antes de invertir.');
    if(profile.emergencyFund==='unknown'||profile.highInterestDebt==='unknown')priorities.push('No indicaste fondo de emergencia o deuda de interés alto; revisa esos puntos, porque pueden cambiar qué dinero está disponible para invertir.');
    return {
      focus:focusIds.map(id=>({id,...optionsById.get(id)})),
      compare:[...new Set(compareIds)].filter(id=>!focusIds.includes(id)).map(id=>({id,...optionsById.get(id)})),
      highRisk:['crypto','forex-cfd','active-trading'].map(id=>optionsById.get(id)),
      intermediary:optionsById.get('broker'),
      priorities,
      context:shortTerm
        ? 'Por el plazo corto, la necesidad de liquidez o la poca tolerancia a pérdidas que indicaste, prioriza aprender sobre opciones de menor volatilidad. Ninguna está libre de riesgos ni garantiza el rendimiento.'
        : profile.horizon==='medium'
          ? 'Con un plazo intermedio, un fondo de renta variable puede caer justo cuando necesites el dinero. Compara vencimientos y riesgos antes de asumir volatilidad.'
          : 'Con un plazo largo y capacidad declarada para soportar fluctuaciones, puedes investigar fondos diversificados; un horizonte largo no elimina la posibilidad de pérdidas.',
      educational:true
    };
  }
  const api = {realRate, futureValue, fire, compound, dashboard,
    investmentGuide, INVESTMENT_OPTIONS,
    monthlyBudgets, monthlyBudget: monthlyBudgets, categoryBudgets: monthlyBudgets, monthlyCategoryBudget: monthlyBudgets,
    retirementProjection, retirementInvestmentProjection: retirementProjection, retirement: retirementProjection,
    loanAmortization, frenchLoan: loanAmortization, amortizationFrench: loanAmortization, loan: loanAmortization};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Fin = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
