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
  const QUESTIONS = [
    {group:'loss', text:'Mantendría una inversión solo para evitar reconocer una pérdida, aunque su tesis haya dejado de ser válida.', reverse:false},
    {group:'loss', text:'Una pérdida temporal me llevaría a abandonar mi plan sin revisar sus fundamentos.', reverse:false},
    {group:'loss', text:'Puedo aceptar una pérdida cuando una revisión objetiva indica que mi decisión inicial era incorrecta.', reverse:true},
    {group:'confirmation', text:'Busco principalmente opiniones que apoyen la inversión que ya quiero realizar.', reverse:false},
    {group:'confirmation', text:'Resto importancia a los datos que contradicen mi hipótesis de inversión.', reverse:false},
    {group:'confirmation', text:'Antes de invertir, busco activamente argumentos sólidos en contra.', reverse:true},
    {group:'confidence', text:'Confío en que puedo anticipar los movimientos del mercado mejor que la mayoría.', reverse:false},
    {group:'confidence', text:'Tras varias ganancias, aumentaría mucho mi exposición sin revisar el riesgo.', reverse:false},
    {group:'confidence', text:'Antes de decidir, considero explícitamente la posibilidad de estar equivocado.', reverse:true}
  ];
  function biases(answers) {
    if (!Array.isArray(answers) || answers.length !== QUESTIONS.length || answers.some(a => !Number.isInteger(a) || a < 1 || a > 5)) throw new Error('Responde las nueve preguntas');
    return ['loss','confirmation','confidence'].map(group => {
      const values = QUESTIONS.map((q,k) => ({q,a:answers[k]})).filter(x => x.q.group === group).map(x => x.q.reverse ? 6-x.a : x.a);
      const score = (values.reduce((a,b)=>a+b,0) / values.length - 1) * 25;
      return {group, score, level:score >= 65 ? 'Alta' : score >= 35 ? 'Moderada' : 'Baja'};
    });
  }
  const api = {realRate, futureValue, fire, compound, dashboard, biases, QUESTIONS};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Fin = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
