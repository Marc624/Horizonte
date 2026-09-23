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
    const series = [{year:0, balance, paid:initial}];
    for (let month = 1; month <= horizon * 12; month++) {
      balance = balance * (1 + i) + contribution;
      if (reached === null && balance >= target) reached = month;
      if (month % 12 === 0) series.push({year:month / 12, balance, paid:initial + contribution * month});
    }
    const retirementMonths = Math.round((retirementAge - age) * 12);
    const atRetirement = retirementMonths <= 1200 ? futureValue(initial, contribution, annual, retirementMonths) : null;
    return {target, annual, reached, years: reached === null ? null : reached / 12, age: reached === null ? null : age + reached / 12, atRetirement, series};
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
  function bankRatios({
    cet1, tier1, tier2, riskWeightedAssets, totalAssets = 0, deposits = 0,
    highQualityLiquidAssets = 0, netCashOutflows30d = 0,
    availableStableFunding = 0, requiredStableFunding = 0, thresholds = {}
  }) {
    [cet1, tier1, tier2, riskWeightedAssets, totalAssets, deposits, highQualityLiquidAssets,
      netCashOutflows30d, availableStableFunding, requiredStableFunding].forEach((v, i) =>
      nonnegative(v, ['CET1','Tier 1','Tier 2','APR','Activos','Depósitos','HQLA','Salidas netas','ASF','RSF'][i]));
    if (riskWeightedAssets <= 0 || totalAssets <= 0 || netCashOutflows30d <= 0 || requiredStableFunding <= 0)
      throw new Error('Denominadores bancarios deben ser positivos');
    if (tier1 < cet1) throw new Error('Tier 1 debe incluir al menos CET1');
    const t = Object.assign({cet1: .045, tier1: .06, totalCapital: .08, leverage: .03, lcr: 1, nsfr: 1}, thresholds);
    Object.values(t).forEach(value => { finite(value, 'Umbral'); if (value < 0) throw new Error('Umbral no válido'); });
    const ratios = {cet1: cet1 / riskWeightedAssets, tier1: tier1 / riskWeightedAssets,
      tier2: tier2 / riskWeightedAssets, totalCapital: (tier1 + tier2) / riskWeightedAssets,
      leverage: tier1 / totalAssets, depositToAssets: deposits / totalAssets, lcr: highQualityLiquidAssets / netCashOutflows30d,
      nsfr: availableStableFunding / requiredStableFunding};
    const checks = [['cet1','CET1'],['tier1','Tier 1'],['totalCapital','Capital total'],['leverage','Apalancamiento'],['lcr','LCR'],['nsfr','NSFR']];
    if (Object.prototype.hasOwnProperty.call(t, 'depositToAssets'))
      checks.push(['depositToAssets','Depósitos / activos']);
    const warnings = checks.filter(([key]) => ratios[key] < (t[key] ?? 0))
      .map(([, label]) => `${label} por debajo del umbral`);
    return {ratios, thresholds: t, warnings, sound: warnings.length === 0, deposits};
  }
  function businessCreditScore({
    revenue, ebitda, netIncome, totalDebt, annualDebtService, currentAssets,
    currentLiabilities, yearsInBusiness, latePayments = 0, industryRisk = 0, requestedLoan = 0
  }) {
    nonnegative(revenue, 'Ingresos'); finite(ebitda, 'EBITDA'); finite(netIncome, 'Beneficio neto');
    [totalDebt, annualDebtService, currentAssets, currentLiabilities, yearsInBusiness,
      latePayments, industryRisk, requestedLoan].forEach((v, i) => nonnegative(v,
      ['Deuda','Servicio deuda','Activo corriente','Pasivo corriente','Antigüedad',
        'Impagos','Riesgo sectorial','Préstamo'][i]));
    if (revenue <= 0 || currentLiabilities <= 0 || annualDebtService <= 0 ||
      industryRisk > 100 || latePayments > 100) throw new Error('Datos de crédito no válidos');
    const ratios = {ebitdaMargin: ebitda / revenue, netMargin: netIncome / revenue,
      debtToRevenue: totalDebt / revenue, dscr: ebitda / annualDebtService,
      currentRatio: currentAssets / currentLiabilities,
      debtAfterLoanToRevenue: (totalDebt + requestedLoan) / revenue};
    const components = [
      {key:'dscr', label:'Cobertura del servicio de deuda', value:Math.max(0, Math.min(100, ratios.dscr / 2 * 100)), weight:.35, reason:ratios.dscr >= 1.5 ? 'cobertura sólida' : 'cobertura ajustada'},
      {key:'leverage', label:'Endeudamiento sobre ingresos', value:Math.max(0, 100 - ratios.debtAfterLoanToRevenue * 100), weight:.25, reason:ratios.debtAfterLoanToRevenue <= 2 ? 'apalancamiento moderado' : 'apalancamiento elevado'},
      {key:'liquidity', label:'Liquidez corriente', value:Math.min(100, ratios.currentRatio / 2 * 100), weight:.2, reason:ratios.currentRatio >= 1.2 ? 'liquidez suficiente' : 'liquidez limitada'},
      {key:'history', label:'Historial y sector', value:Math.max(0, Math.min(100, 100 - latePayments * 2 - industryRisk + Math.min(yearsInBusiness, 10) * 2)), weight:.2, reason:latePayments === 0 && industryRisk < 30 && yearsInBusiness >= 3 ? 'historial y trayectoria favorables' : 'revisar historial, trayectoria o sector'}
    ];
    const score = components.reduce((sum, component) => sum + component.value * component.weight, 0);
    const rating = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : 'D';
    return {score, rating, ratios, components, decision: score >= 60 ? 'Revisar favorablemente' : 'Revisar con cautela',
      explanations: components.map(c => `${c.label}: ${c.reason}`), educational: true};
  }
  const QUESTIONS = [
    {group:'loss', text:'Tu inversión cae un 25% y la mantienes solo para no reconocer la pérdida, aunque la razón original para comprar ya no sea válida.', reverse:false},
    {group:'loss', text:'Después de una caída temporal del mercado, abandonarías tu plan sin revisar antes sus fundamentos.', reverse:false},
    {group:'loss', text:'Si una revisión objetiva demuestra que tu decisión inicial era incorrecta, aceptarías la pérdida y cambiarías de plan.', reverse:true},
    {group:'confirmation', text:'Antes de invertir, buscarías sobre todo opiniones y noticias que confirmen la opción que ya te gusta.', reverse:false},
    {group:'confirmation', text:'Al revisar una inversión, restarías importancia a los datos que contradicen tu hipótesis.', reverse:false},
    {group:'confirmation', text:'Antes de invertir, buscarías activamente un argumento sólido que explique por qué podrías estar equivocado.', reverse:true},
    {group:'confidence', text:'Crees que podrías anticipar los movimientos del mercado mejor que la mayoría de las personas.', reverse:false},
    {group:'confidence', text:'Después de varias ganancias, aumentarías mucho tu exposición sin volver a revisar el riesgo total.', reverse:false},
    {group:'confidence', text:'Antes de decidir, escribirías qué podría salir mal y qué evidencia demostraría que estás equivocado.', reverse:true}
  ];
  function biases(answers) {
    if (!Array.isArray(answers) || answers.length !== QUESTIONS.length || answers.some(a => !Number.isInteger(a) || a < 1 || a > 5)) throw new Error('Responde las nueve preguntas');
    return ['loss','confirmation','confidence'].map(group => {
      const values = QUESTIONS.map((q,k) => ({q,a:answers[k]})).filter(x => x.q.group === group).map(x => x.q.reverse ? 6-x.a : x.a);
      const score = (values.reduce((a,b)=>a+b,0) / values.length - 1) * 25;
      return {group, score, level:score >= 65 ? 'Alta' : score >= 35 ? 'Moderada' : 'Baja'};
    });
  }
  const api = {realRate, futureValue, fire, compound, dashboard, biases, QUESTIONS,
    monthlyBudgets, monthlyBudget: monthlyBudgets, categoryBudgets: monthlyBudgets, monthlyCategoryBudget: monthlyBudgets,
    retirementProjection, retirementInvestmentProjection: retirementProjection, retirement: retirementProjection,
    loanAmortization, frenchLoan: loanAmortization, amortizationFrench: loanAmortization, loan: loanAmortization,
    bankRatios, capitalRatios: bankRatios, bankSolvency: bankRatios, businessCreditScore,
    businessCreditScoring: businessCreditScore, creditScoring: businessCreditScore, creditScore: businessCreditScore};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Fin = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
