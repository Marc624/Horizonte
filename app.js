(() => {
'use strict';
const $ = id => document.getElementById(id);
const supportedCurrencies=new Set(['EUR','USD','GBP','JPY','CNY','INR','CHF','CAD','AUD','BRL','MXN','KRW','SEK','NOK','DKK']);
const profileCurrency=()=>{try{const currency=JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}').currency;return supportedCurrencies.has(currency)?currency:'EUR';}catch(e){return 'EUR';}};
const money = n => n === null ? 'No definido' : new Intl.NumberFormat('es-ES',{style:'currency',currency:profileCurrency(),maximumFractionDigits:2,useGrouping:'always'}).format(n);
const pct = n => n === null ? 'No definido' : new Intl.NumberFormat('es-ES',{style:'percent',maximumFractionDigits:2,useGrouping:'always'}).format(n);
const decimal = n => new Intl.NumberFormat('es-ES',{maximumFractionDigits:1,useGrouping:'always'}).format(n);
const escape = x => String(x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localDate = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const KEY='horizonte-v1', PROFILE_KEY='horizonte-profile', labels={liquid:'Líquido',investment:'Inversión',other:'Otro activo',liability:'Pasivo',income:'Ingreso',expense:'Gasto',transfer:'Transferencia'};
const blank = () => ({version:2,accounts:[],transactions:[],fire:null,compound:null,
 budgets:[],retirement:null,loan:null,investmentGuide:null});
let state=blank(), chartInstances={}, storageBlocked=false;
const say = text => {$('message').textContent=text;};
const validDate = x => typeof x==='string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
const num = (v,min=0,max=1e9) => typeof v==='number' && Number.isFinite(v) && v>=min && v<=max;
function validState(s) {
  if (!s || s.version!==2 || !Array.isArray(s.accounts) || !Array.isArray(s.transactions) || !Array.isArray(s.budgets)) return false;
  const text=(x,max)=>typeof x==='string' && x.trim().length>0 && x.length<=max;
  if(!s.accounts.every(a=>text(a.id,100)&&text(a.name,80)&&['liquid','investment','other','liability'].includes(a.kind)&&num(a.balance)&&validDate(a.asOf)))return false;
  if(!s.transactions.every(t=>text(t.id,100)&&text(t.name,80)&&text(t.category,40)&&['income','expense','transfer'].includes(t.kind)&&num(t.amount,.01)&&validDate(t.date)))return false;
  if(new Set(s.accounts.map(a=>a.id)).size!==s.accounts.length || new Set(s.transactions.map(t=>t.id)).size!==s.transactions.length)return false;
  if(s.investmentGuide!==null) Fin.investmentGuide(s.investmentGuide);
  for(const k of ['fire','compound']) if(s[k]!==null && (typeof s[k]!=='object'||Array.isArray(s[k])||Object.values(s[k]).some(v=>!Number.isFinite(v))))return false;
  return true;
}
function migrateState(loaded) {
  if (!loaded) return loaded;
  if(loaded.version===2) {
    const investmentGuide=loaded.investmentGuide?Object.assign({
      emergencyFund:'unknown',highInterestDebt:'unknown'
    },loaded.investmentGuide):null;
    const migrated=Object.assign(blank(),loaded,{investmentGuide});
    delete migrated.answers;delete migrated.reviewStarted;delete migrated.lastDecision;
    return migrated;
  }
  if (loaded.version !== 1) return loaded;
  const migrated=Object.assign(blank(), loaded, {version:2, budgets:[], retirement:null, loan:null,investmentGuide:null});
  delete migrated.answers;delete migrated.reviewStarted;delete migrated.lastDecision;
  return migrated;
}
try {const raw=localStorage.getItem(KEY); if(raw){const loaded=migrateState(JSON.parse(raw)); if(!validState(loaded))throw Error('Datos inválidos');delete loaded.bank;delete loaded.credit;state=loaded;save();}}
catch(e){storageBlocked=true;say('No se han podido recuperar datos locales. No se sobrescribirán. Exporta lo visible si lo necesitas y usa Borrar datos para reiniciar.');$('storage-status').textContent='Guardado desactivado: revisa el almacenamiento';}
function save(){if(storageBlocked)return;try{localStorage.setItem(KEY,JSON.stringify(state));$('storage-status').textContent='Guardado en este navegador, sin cifrar';}catch(e){$('storage-status').textContent='No guardado: almacenamiento no disponible o lleno';say('Los cambios solo están en memoria. Exporta JSON antes de cerrar.');}}
function uuid(){return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;}
function values(form){return Object.fromEntries(new FormData(form));}
function numericForm(form){return Object.fromEntries(Object.entries(values(form)).map(([k,v])=>[k,Number(v)]));}
function fill(form,data){if(!data)return;Object.entries(data).forEach(([k,v])=>{const field=form.elements.namedItem(k);if(field && field.type!=='checkbox')field.value=v;});}
function resetAccount(){const f=$('account-form');f.reset();f.elements.namedItem('id').value='';f.elements.namedItem('asOf').value=localDate();}
function resetTransaction(){const f=$('transaction-form');f.reset();f.elements.namedItem('id').value='';f.elements.namedItem('date').value=localDate();}
function tile(title,value,note=''){return `<article class="card"><p class="muted">${escape(title)}</p><p class="metric">${escape(value)}</p><p class="muted">${escape(note)}</p></article>`;}
function table(head,rows){return `<table><thead><tr>${head.map(h=>`<th>${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${escape(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;}
function chart(id,type,chartLabels,datasets,yMax=null){
  if(chartInstances[id])chartInstances[id].destroy();
  if(typeof Chart==='undefined'){const c=$(id);if(!c.parentElement.querySelector('.fallback')){const p=document.createElement('p');p.className='fallback muted';p.textContent='Gráfico no disponible: comprueba la conexión. Todos los valores siguen disponibles en tarjetas y tablas.';c.parentElement.append(p);}return;}
  chartInstances[id]=new Chart($(id),{type,data:{labels:chartLabels,datasets},options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom'},tooltip:{callbacks:{title:items=>{if(id!=='fire-chart'||!items.length)return '';const age=Number(items[0].label),wholeYears=Math.floor(age),months=Math.round((age-wholeYears)*12);return months?`Edad ${wholeYears} años y ${months} meses`:`Edad ${wholeYears} años`;},label:c=>`${c.dataset.label}: ${money(c.parsed.y)}`}}},scales:{x:{title:{display:true,text:id==='cash-chart'?'Mes seleccionado':id==='fire-chart'?'Edad (curva mensual; tabla anual)':'Años desde hoy'},grid:id==='fire-chart'?{display:false}:{},ticks:id==='fire-chart'?{autoSkip:false,maxRotation:0,callback:(value,index)=>{const age=Number(chartLabels[index]),startAge=Number(chartLabels[0]);return Number.isInteger(age)&&(age-startAge)%5===0?age:'';}}:{}},y:{title:{display:true,text:id==='fire-chart'?'Moneda elegida · valores actuales':'Moneda elegida · valores nominales'},max:yMax||undefined,ticks:{stepSize:id==='fire-chart'?100000:undefined,callback:v=>new Intl.NumberFormat('es-ES',{notation:'compact',maximumFractionDigits:1}).format(v)},beginAtZero:true}}}});
}
function advancedValues(form, percentKeys = []) {
 const raw=values(form), data={};
 Object.entries(raw).forEach(([key,value])=>{data[key]=percentKeys.includes(key)?Number(value)/100:Number(value);});
 return data;
}
function renderBudgets(result) {
 const rows=result.categories.map(r=>[r.category,money(r.planned),money(r.actual),money(r.deviation),r.status==='over'?'Exceso · desfavorable':r.status==='under'?'Ahorro frente al plan · favorable':'En plan']);
 $('budget-results').innerHTML=tile('Ahorro del mes',money(result.totals.savings),`Ingresos ${money(result.totals.income)} · tasa ${pct(result.totals.savingRate)}`)+
 `<div class="table-wrap">${table(['Categoría','Plan','Real','Desviación','Estado'],rows)}</div>`+
 `<p class="muted">Total planificado ${money(result.totals.planned)} · real ${money(result.totals.actual)} · desviación ${money(result.totals.deviation)} (plan − real). Una desviación positiva significa ahorro frente al plan y es favorable; una negativa significa exceso. Las categorías con plan de 0 y gasto real aparecen como exceso no planificado.</p>`;
}
function addBudgetRow(data={}) {
 const row=document.createElement('div');
 row.className='form-grid budget-row';
 row.innerHTML=`<label>Categoría<input name="budgetCategory" maxlength="60" placeholder="Vivienda, alimentación..." value="${escape(data.category||'')}"></label><label>Importe planificado (moneda elegida)<input name="budgetPlanned" type="number" min="0" max="1000000000" step="0.01" value="${data.planned ?? 0}"></label><button type="button" class="secondary danger remove-budget-row">Quitar</button>`;
 $('budget-rows').append(row);
}
function renderRetirement(result) {
 const rows=result.scenarios.map(s=>[s.name,pct(s.annualReturn),money(s.endingCapital),s.depleted?'Capital agotado':'Capital restante']);
 const fireTarget=state.fire?state.fire.spending*12/(state.fire.withdrawal/100):null;
 const comparison=fireTarget===null?'Calcula FIRE para comparar ambas alternativas.':`FIRE sin pensión: ${money(fireTarget)} · Jubilación con pensión: ${money(result.requiredCapital)} · Diferencia: ${money(result.requiredCapital-fireTarget)}.`;
 $('retirement-results').innerHTML=`<div class="grid md:grid-cols-3 gap-4">${tile('Capital a jubilación',money(result.capitalAtRetirement),`En ${decimal(result.yearsToRetirement)} años`)}${tile('Capital requerido con pensión',money(result.requiredCapital),`Pensión: ${money(result.pensionAtRetirement)}/mes`)}${tile('Brecha',money(result.gap),'Aportaciones y retorno real')}</div><div class="table-wrap">${table(['Escenario','Rentabilidad real','Capital al final','Lectura'],rows)}</div><p class="notice">${comparison}</p><p class="muted">Escenarios deterministas educativos: no contemplan impuestos, inflación variable, longevidad, riesgo de secuencia ni reglas reales de pensión.</p>`;
}
function renderLoan(result, officialTae = null) {
 const rows=result.table.map(r=>[r.month,money(r.payment),money(r.principal),money(r.interest),money(r.fee),money(r.balance)]);
 $('loan-results').innerHTML=`<div class="grid md:grid-cols-3 gap-4">${tile('Cuota total mensual',money(result.payment+result.table[0].fee),'Incluye comisión mensual')}${tile('TIN',pct(result.annualNominalRate),'Tipo nominal usado en el cálculo')}${tile('TAE estimada',pct(result.tae),'Calculada con TIN y comisiones')}${tile('TAE del banco',officialTae===null?'No indicada':pct(officialTae),'Dato copiado de la oferta; no cambia la cuota')}${tile('Principal amortizado',money(result.principal),'Capital devuelto al final')}${tile('Intereses totales',money(result.totalInterest),'Antes de impuestos')}${tile('Comisiones totales',money(result.totalFees),`Total pagado: ${money(result.totalPaid)}`)}</div><p class="notice">Compara la TAE del banco con la estimada. La estimación solo considera los flujos introducidos y puede diferir de la contractual por seguros, impuestos, fechas exactas u otros costes. Para la cuota y la amortización se usa el TIN.</p><div class="table-wrap"><table><caption class="sr-only">Tabla de amortización francesa: pago total, principal, intereses, comisión y saldo pendiente</caption>${table(['Mes','Pago total','Principal','Interés','Comisión','Saldo pendiente'],rows).replace('<table>','').replace('</table>','')}</table></div><p class="muted">La cuota base es ${money(result.payment)} y la tabla muestra el pago total de cada periodo. La última cuota se ajusta al saldo residual.</p>`;
}
function renderDashboard(){
 const d=Fin.dashboard(state.accounts,state.transactions,$('month').value);
 $('kpis').innerHTML=[tile('Patrimonio neto',money(d.netWorth),'Activos menos deuda pendiente'),tile('Activos y pasivos',money(d.assets),`Deuda: ${money(d.liabilities)}`),tile('Endeudamiento',pct(d.debtRatio),'Pasivos / activos. Sin activos: no definido.'),tile('Liquidez',money(d.liquid),`Inversión: ${money(d.investment)}`),tile('Ingresos del mes',money(d.income)),tile('Gastos / pagos del mes',money(d.expenses)),tile('Capacidad de ahorro',money(d.savings),'Antes de transferencias internas'),tile('Tasa de ahorro',pct(d.savingRate),'Sin ingresos: no definida; puede ser negativa.')].join('');
 const actions=(kind,id)=>`<button class="secondary small" data-action="edit" data-kind="${kind}" data-id="${escape(id)}">Editar</button><button class="secondary danger small" data-action="delete" data-kind="${kind}" data-id="${escape(id)}">Eliminar</button>`;
 $('accounts').innerHTML=state.accounts.map(a=>`<tr><td>${escape(a.name)}<small>${escape(a.asOf)}</small></td><td>${labels[a.kind]}</td><td>${money(a.balance)}</td><td>${actions('accounts',a.id)}</td></tr>`).join('')||'<tr><td colspan="4">No hay saldos. Añade una cuenta, activo o deuda, o carga el ejemplo ficticio.</td></tr>';
 $('transactions').innerHTML=state.transactions.filter(t=>t.date.slice(0,7)===$('month').value).sort((a,b)=>b.date.localeCompare(a.date)).map(t=>`<tr><td>${escape(t.date)}<small>${escape(t.name)}</small></td><td>${labels[t.kind]}<small>${escape(t.category)}</small></td><td>${money(t.amount)}</td><td>${actions('transactions',t.id)}</td></tr>`).join('')||'<tr><td colspan="4">No hay movimientos en el mes seleccionado. Registra un ingreso, gasto o transferencia, o cambia el mes.</td></tr>';
 chart('cash-chart','bar',['Ingresos','Gastos','Ahorro'],[{label:'Flujo de caja',data:[d.income,d.expenses,d.savings],backgroundColor:['#0f766e','#f59e0b',d.savings<0?'#be123c':'#2563eb']}]);
}
function linkedBalanceInputs(){
 const d=Fin.dashboard(state.accounts,state.transactions,$('month').value);
 return {initial:d.investment,contribution:Math.max(0,d.savings),...(d.expenses>0?{spending:d.expenses}:{})};
}
function linkFireFromBalance(){
 if(state.fire || (state.accounts.length===0 && state.transactions.length===0))return false;
 const linked=linkedBalanceInputs();
 fill($('fire-form'),linked);
 return Object.keys(linked).length>0;
}
function calculateFire(p){
 if(p.retirementAge<p.age)throw Error('La edad de jubilación de referencia no puede ser menor que la edad actual.');
 if(!(p.cautious<=p.base && p.base<=p.optimistic))throw Error('Ordena rentabilidades: adversa <= central <= favorable.');
 const scenarios=[['Adverso','cautious','#b45309'],['Central','base','#0f766e'],['Favorable','optimistic','#2563eb']].map(([name,key,color])=>({name,color,...Fin.fire({...p,withdrawal:p.withdrawal/100,nominal:p[key]/100,inflation:p.inflation/100})}));
 const center=scenarios[1];
 $('fire-results').innerHTML=tile('Capital objetivo real',money(center.target),`Con un gasto anual de ${money(p.spending*12)}, equivale a retirar ${pct(p.withdrawal/100)} del capital durante el primer año. No es una rentabilidad.`)+`<div class="table-wrap">${table(['Escenario / tasa real','Tiempo / edad FIRE','Capital a tu edad objetivo'],scenarios.map(s=>[`${s.name} / ${pct(s.annual)}`,s.reached===null?'No alcanzado en 80 años':s.reached===0?`Objetivo ya cubierto / ${p.age} años`:`${Math.floor(s.reached/12)} años y ${s.reached%12} meses / edad ${Math.floor(s.age)} años y ${s.reached%12} meses`,`${money(s.atRetirement)} / ${pct(s.atRetirement/s.target)} del objetivo`]))}</div><p class="muted">La gráfica se centra en la fase de acumulación: cada escenario termina al alcanzar el objetivo o, si no lo alcanza, a los 90 años. La tabla conserva la proyección anual completa; no se simulan retiradas ni riesgo de secuencia.</p>`;
 const maxMonths=Math.max(0,Math.min(80*12,Math.floor((90-p.age)*12)));
 const scenarioEndMonths=scenarios.map(s=>s.reached!==null&&s.reached<=maxMonths?s.reached:maxMonths);
 const graphMonths=Math.max(...scenarioEndMonths);
 const graphPoints=graphMonths+1;
 const chartValues=scenarios.flatMap((s,index)=>s.monthlySeries.slice(0,scenarioEndMonths[index]+1).map(x=>x.balance));
 const chartMax=Math.ceil(Math.max(center.target,...chartValues)/100000)*100000||100000;
 const chartLabels=center.monthlySeries.slice(0,graphPoints).map(x=>x.age);
 const datasets=scenarios.map((s,index)=>({label:s.name,data:chartLabels.map((_,month)=>month<=scenarioEndMonths[index]?s.monthlySeries[month].balance:null),borderColor:s.color,backgroundColor:s.color,pointRadius:context=>context.dataIndex===s.reached?4:0,pointHoverRadius:5,borderWidth:2}));
 datasets.push({label:'Objetivo real',data:chartLabels.map(()=>center.target),borderColor:'#64748b',borderDash:[6,5],pointRadius:0,borderWidth:2});
 chart('fire-chart','line',chartLabels,datasets,chartMax);
 $('fire-table').innerHTML=table(['Edad','Adverso (moneda actual)','Central (moneda actual)','Favorable (moneda actual)','Objetivo'],center.series.map((x,i)=>[x.age,...scenarios.map(s=>money(s.series[i].balance)),money(center.target)]));
 return p;
}
function calculateCompound(p){
 const result=Fin.compound({...p,nominal:p.nominal/100,inflation:p.inflation/100}), last=result.series.at(-1);
 $('compound-results').innerHTML=[tile('Capital final nominal',money(last.balance),`Capital inicial y aportaciones: ${money(last.paid)}`),tile('Rendimientos nominales',money(last.earnings),'Pueden ser negativos; antes de impuestos.'),tile('Capital final en euros de hoy',money(last.real),'Capital final nominal descontado por inflación.'),tile('Compra hoy',money(p.purchase),'Importe del escenario alternativo.'),tile('Valor futuro de comprar hoy e invertir el importe',money(result.opportunity),`En euros de hoy: ${money(result.opportunityReal)}`),tile('Rendimiento potencial no obtenido',money(result.forgoneEarnings),'Comparación educativa, no pérdida contable.')].join('');
 chart('compound-chart','line',result.series.map(x=>x.year),[{label:'Capital aportado',data:result.series.map(x=>x.paid),borderColor:'#64748b',backgroundColor:'#64748b',pointRadius:0},{label:'Capital acumulado',data:result.series.map(x=>x.balance),borderColor:'#0f766e',backgroundColor:'#0f766e',pointRadius:0}]);
 $('compound-table').innerHTML=table(['Año','Aportado nominal','Rendimientos nominales','Total nominal','Total real'],result.series.map(x=>[x.year,money(x.paid),money(x.earnings),money(x.balance),money(x.real)]));return p;
}
const advice={loss:'Define por escrito motivos de venta y revisa la tesis, no solo el precio de compra. Señal alta: espera local de 48 horas.',confirmation:'Busca una fuente independiente y escribe qué evidencia te haría cambiar de opinión. Señal moderada o alta: argumento contrario obligatorio.',confidence:'Registra predicciones y errores. Señal alta: el laboratorio limita la posición al 10% del total declarado.'};
$('investment-catalog').innerHTML=Fin.INVESTMENT_OPTIONS.map(option=>`<article class="card"><h3>${escape(option.name)}</h3><p class="eyebrow">${escape(option.type)}</p><p>${escape(option.description)}</p></article>`).join('');
$('month').value=localDate().slice(0,7);resetAccount();resetTransaction();
fill($('fire-form'),state.fire);fill($('compound-form'),state.compound);
const advancedMonth=localDate().slice(0,7);$('budget-form').elements.namedItem('month').value=advancedMonth;
if(state.budgets.length)state.budgets.forEach(addBudgetRow);else addBudgetRow();
if(state.retirement){const retirementFormData=Object.assign({},state.retirement,{nominalReturn:state.retirement.nominalReturn*100,inflation:state.retirement.inflation*100,withdrawalRate:state.retirement.withdrawalRate*100});fill($('retirement-form'),retirementFormData);}
if(state.loan)fill($('loan-form'),Object.assign({},state.loan,{annualNominalRate:state.loan.annualNominalRate*100,officialTae:state.loan.officialTae===null||state.loan.officialTae===undefined?'':state.loan.officialTae*100}));
if(state.investmentGuide)fill($('investment-guide-form'),state.investmentGuide);
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('main > section').forEach(s=>{s.hidden=b.dataset.page==='fire'? !['fire','retirement'].includes(s.id):s.id!==b.dataset.page;});if(b.dataset.page==='fire' && linkFireFromBalance())say('Capital invertido, ahorro y gasto enlazados desde Mi balance. Recalcula FIRE para ver los resultados.');document.querySelectorAll('[data-page]').forEach(x=>{if(x===b)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current');});requestAnimationFrame(()=>Object.values(chartInstances).forEach(c=>c.resize()));$('main').focus();}));
$('month').addEventListener('change',()=>{if($('month').validity.valid)renderDashboard();});
$('cancel-account').onclick=resetAccount;$('cancel-transaction').onclick=resetTransaction;
for(const [id,collection] of [['account-form','accounts'],['transaction-form','transactions']]){
 $(id).addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget;if(!f.reportValidity())return;const row=values(f);row.name=row.name.trim();if(row.category)row.category=row.category.trim();if(!row.name || ('category' in row && !row.category)){say('Escribe un concepto y una categoría no vacíos.');return;}const amountKey=collection==='accounts'?'balance':'amount';row[amountKey]=Number(row[amountKey]);row.id=row.id||uuid();const index=state[collection].findIndex(x=>x.id===row.id);if(index<0)state[collection].push(row);else state[collection][index]=row;save();collection==='accounts'?resetAccount():resetTransaction();renderDashboard();say('Registro guardado. Los saldos y los movimientos son independientes; vuelve a traer los datos a FIRE si procede.');});
}
$('dashboard').addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;const collection=b.dataset.kind,row=state[collection].find(x=>x.id===b.dataset.id);if(!row)return;if(b.dataset.action==='edit'){const f=$(collection==='accounts'?'account-form':'transaction-form');fill(f,row);f.elements.namedItem('name').focus();}else if(confirm('¿Eliminar este registro?')){state[collection]=state[collection].filter(x=>x.id!==row.id);collection==='accounts'?resetAccount():resetTransaction();save();renderDashboard();}});
for(const [id,key,fn] of [['fire-form','fire',calculateFire],['compound-form','compound',calculateCompound]]){
 $(id).addEventListener('submit',e=>{e.preventDefault();if(!e.currentTarget.reportValidity())return;try{state[key]=fn(numericForm(e.currentTarget));save();say('Simulación actualizada. Los resultados corresponden a los parámetros guardados.');}catch(err){say(err.message);}});
 $(id).addEventListener('input',()=>say('Parámetros modificados: pulsa Recalcular o Simular. Los resultados visibles corresponden al último cálculo.'));
}
$('sync-fire').onclick=()=>{const d=Fin.dashboard(state.accounts,state.transactions,$('month').value);fill($('fire-form'),linkedBalanceInputs());say(`Se han copiado inversión y ahorro del mes ${$('month').value}. ${d.savings<0?'Existe déficit: aportación fijada a cero; revisa tu presupuesto. ':''}${d.expenses===0?'No hay gastos: se conserva el gasto objetivo anterior. ':''}Revisa si ese mes es representativo y pulsa Recalcular.`);};
$('sync-retirement').onclick=()=>{const fire=values($('fire-form'));fill($('retirement-form'),{age:fire.age,retirementAge:fire.retirementAge,currentCapital:fire.initial,monthlyContribution:fire.contribution,monthlyExpenses:fire.spending,nominalReturn:fire.base,inflation:fire.inflation,withdrawalRate:fire.withdrawal});say('Se han copiado los supuestos FIRE a jubilación. Añade o revisa la pensión y pulsa Proyectar jubilación.');};
$('add-budget-row').onclick=()=>addBudgetRow();
$('budget-rows').addEventListener('click',e=>{
 const button=e.target.closest('.remove-budget-row');
 if(!button)return;
 const rows=$('budget-rows').querySelectorAll('.budget-row');
 if(rows.length===1){rows[0].querySelector('[name="budgetCategory"]').value='';rows[0].querySelector('[name="budgetPlanned"]').value='0';return;}
 button.closest('.budget-row').remove();
});
$('investment-guide-form').addEventListener('submit',e=>{
 e.preventDefault();if(!e.currentTarget.reportValidity())return;
 try{
  const profile=values(e.currentTarget),guide=Fin.investmentGuide(profile);
  state.investmentGuide=profile;
  const cards=items=>items.map(option=>`<article class="card"><h4>${escape(option.name)}</h4><p class="eyebrow">${escape(option.type)}</p><p>${escape(option.description)}</p></article>`).join('');
  $('investment-guide-results').innerHTML=`<article class="notice">${guide.priorities.length?`<h3>Antes de buscar rentabilidad, te recomendamos revisar:</h3><ul class="mt-3">${guide.priorities.map(priority=>`<li>${escape(priority)}</li>`).join('')}</ul><h3 class="mt-5">Para el dinero que sí puedas invertir, según tus respuestas te recomendamos buscar opciones de rentabilidad en:</h3>`:'<h3>Según tus respuestas, te recomendamos buscar opciones de rentabilidad en:</h3>'}<div class="grid md:grid-cols-2 gap-4 mt-4">${cards(guide.focus)}</div><p class="mt-4">${escape(guide.context)}</p></article><h3 class="mt-6">También puedes comparar</h3><div class="grid md:grid-cols-2 gap-4">${cards(guide.compare)}</div><h3 class="mt-6">No las uses como base para tus objetivos</h3><div class="grid md:grid-cols-3 gap-4">${cards(guide.highRisk)}</div><p class="muted mt-4"><strong>${escape(guide.intermediary.name)}:</strong> ${escape(guide.intermediary.description)}</p><p class="muted">Esto no evalúa tu situación completa ni recomienda un producto concreto. Comprueba riesgo, costes, liquidez, fiscalidad y regulación local; puedes perder capital. No hay rentabilidad garantizada en las opciones de mercado.</p>`;
  save();say('Orientación educativa calculada según tus respuestas.');
 }catch(err){say(err.message);}
});
function runAdvancedForm(id, handler) {
 $(id).addEventListener('submit',e=>{
   e.preventDefault(); if(!e.currentTarget.reportValidity())return;
   try { handler(e.currentTarget); save(); say('Cálculo actualizado. Revisa los supuestos y la advertencia educativa.'); }
   catch(err){say(err.message);}
 });
}
runAdvancedForm('budget-form', form=>{
 const raw=values(form), budgets=[];
 [...form.querySelectorAll('.budget-row')].forEach(row=>{
   const category=row.elements?.namedItem('budgetCategory')?.value.trim() || row.querySelector('[name="budgetCategory"]').value.trim();
   const planned=Number(row.querySelector('[name="budgetPlanned"]').value);
   if(category)budgets.push({category,planned});
 });
 const result=Fin.monthlyBudgets({month:raw.month,budgets,transactions:state.transactions});
 state.budgets=budgets;renderBudgets(result);
});
runAdvancedForm('retirement-form', form=>{
 const data=advancedValues(form,['nominalReturn','inflation','withdrawalRate']);
 const result=Fin.retirementProjection(data);state.retirement=data;renderRetirement(result);
});
runAdvancedForm('loan-form', form=>{
 const raw=values(form),data=Object.fromEntries(Object.entries(raw).map(([key,value])=>[key,key==='startDate'?(value||null):key==='officialTae'?(value===''?null:Number(value)/100):Number(value)]));
 data.annualNominalRate/=100;
 const result=Fin.loanAmortization(data);state.loan=data;renderLoan(result,data.officialTae);
});
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='horizonte-datos.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say('Exportación generada. Contiene datos financieros y respuestas sin cifrar; guárdala de forma privada.');};
$('demo').onclick=()=>{
 if(!confirm('El ejemplo sustituirá los datos actuales de la aplicación. ¿Continuar?'))return;
 const date=localDate();state=blank();state.accounts=[{id:uuid(),name:'Fondo de emergencia',kind:'liquid',balance:5000,asOf:date},{id:uuid(),name:'Cartera diversificada ficticia',kind:'investment',balance:30000,asOf:date},{id:uuid(),name:'Participación en vivienda',kind:'other',balance:100000,asOf:date},{id:uuid(),name:'Préstamo pendiente',kind:'liability',balance:20000,asOf:date}];state.transactions=[['income','Nómina','Trabajo',2500],['expense','Vivienda y suministros','Vivienda',1000],['expense','Supermercado','Alimentación',300],['expense','Ocio','Ocio',200],['transfer','Aportación a inversión','Inversión',500]].map(([kind,name,category,amount])=>({id:uuid(),date,kind,name,category,amount}));
 $('month').value=date.slice(0,7);$('fire-form').reset();$('compound-form').reset();$('investment-guide-form').reset();$('investment-guide-results').innerHTML='';resetAccount();resetTransaction();state.investmentGuide=null;state.fire=calculateFire(numericForm($('fire-form')));state.compound=calculateCompound(numericForm($('compound-form')));save();renderDashboard();say('Ejemplo ficticio cargado. FIRE comienza con supuestos ilustrativos: usa Traer inversión y flujo para vincularlo al mes.');
};
$('clear').onclick=()=>{if(confirm('¿Borrar todos los datos de Horizonte de este navegador? No se borran archivos exportados.')){try{localStorage.removeItem(KEY);localStorage.removeItem(PROFILE_KEY);location.reload();}catch(e){say('No se pudo borrar el almacenamiento. Usa los ajustes de datos del sitio en tu navegador.');}}};
renderDashboard();
if(state.investmentGuide)$('investment-guide-form').requestSubmit();
const welcome=$('welcome');
const lockWelcome=locked=>{welcome.hidden=!locked;document.body.classList.toggle('welcome-open',locked);};
let startApp=()=>{lockWelcome(false);window.scrollTo(0,0);requestAnimationFrame(()=>window.scrollTo(0,0));$('main').focus({preventScroll:true});};
$('edit-profile').onclick=()=>{lockWelcome(true);$('welcome-name').focus({preventScroll:true});};
$('start-app').onclick=startApp;
$('load-welcome-demo').onclick=()=>{if(!$('welcome-name').reportValidity())return;$('demo').click();startApp();};
const defaultWelcomeHeading='Entiende tu dinero. Explora tu futuro.';
const savedName=(()=>{try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}').name||'';}catch(e){return '';}})();
const savedCurrency=(()=>{try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}').currency||'EUR';}catch(e){return 'EUR';}})();
if($('welcome-currency'))$('welcome-currency').value=savedCurrency;
const updateWelcomeName=()=>{const name=$('welcome-name').value.trim(),currency=$('welcome-currency').value;if(!name){$('welcome-heading').textContent=defaultWelcomeHeading;$('user-greeting').textContent='';try{localStorage.removeItem(PROFILE_KEY);}catch(e){}return false;}try{localStorage.setItem(PROFILE_KEY,JSON.stringify({name,currency}));}catch(e){}$('welcome-heading').textContent=`Entiende tu dinero, ${name}. Explora tu futuro.`;$('user-greeting').textContent=`Hola, ${name}`;return true;};
if(savedName){$('welcome-name').value=savedName;updateWelcomeName();}
const persistName=updateWelcomeName;
$('welcome-name').addEventListener('input',persistName);
$('welcome-currency').addEventListener('change',()=>{if(updateWelcomeName())location.reload();});
const originalStart=startApp;
startApp=()=>{if(!persistName()||!$('welcome-name').reportValidity())return;originalStart();say('');};
 $('start-app').onclick=startApp;
lockWelcome(true);
try {
 if(state.budgets.length) renderBudgets(Fin.monthlyBudgets({month:advancedMonth,budgets:state.budgets,transactions:state.transactions}));
 if(state.retirement) renderRetirement(Fin.retirementProjection(state.retirement));
 if(state.loan) renderLoan(Fin.loanAmortization(state.loan),state.loan.officialTae??null);
} catch(e) { say('Algunos resultados ampliados guardados ya no son válidos: '+e.message); }
try{if($('fire-form').checkValidity())calculateFire(numericForm($('fire-form')));else say('Los parámetros FIRE guardados no son válidos. Corrige los campos.');if($('compound-form').checkValidity())calculateCompound(numericForm($('compound-form')));}catch(e){say('Revisa los parámetros guardados: '+e.message);}
})();
