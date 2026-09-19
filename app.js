(() => {
'use strict';
const $ = id => document.getElementById(id);
const profileCurrency=()=>{try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}').currency||'EUR';}catch(e){return 'EUR';}};
const money = n => n === null ? 'No definido' : new Intl.NumberFormat('es-ES',{style:'currency',currency:profileCurrency(),maximumFractionDigits:2,useGrouping:'always'}).format(n);
const pct = n => n === null ? 'No definido' : new Intl.NumberFormat('es-ES',{style:'percent',maximumFractionDigits:2,useGrouping:'always'}).format(n);
const decimal = n => new Intl.NumberFormat('es-ES',{maximumFractionDigits:1,useGrouping:'always'}).format(n);
const escape = x => String(x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localDate = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const KEY='horizonte-v1', WELCOME_KEY='horizonte-welcome-dismissed', PROFILE_KEY='horizonte-profile', labels={liquid:'Líquido',investment:'Inversión',other:'Otro activo',liability:'Pasivo',income:'Ingreso',expense:'Gasto',transfer:'Transferencia'};
const names={loss:'Aversión a la pérdida',confirmation:'Sesgo de confirmación',confidence:'Exceso de confianza'};
const blank = () => ({version:2,accounts:[],transactions:[],fire:null,compound:null,answers:null,reviewStarted:null,lastDecision:null,
 budgets:[],retirement:null,loan:null,bank:null,credit:null});
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
  if(s.answers!==null) Fin.biases(s.answers);
  if(s.reviewStarted!==null && !num(s.reviewStarted,0,1e15))return false;
  for(const k of ['fire','compound']) if(s[k]!==null && (typeof s[k]!=='object'||Array.isArray(s[k])||Object.values(s[k]).some(v=>!Number.isFinite(v))))return false;
  return true;
}
function migrateState(loaded) {
  if (!loaded || loaded.version !== 1) return loaded;
  return Object.assign(blank(), loaded, {version:2, budgets:[], retirement:null, loan:null, bank:null, credit:null});
}
try {const raw=localStorage.getItem(KEY); if(raw){const loaded=migrateState(JSON.parse(raw)); if(!validState(loaded))throw Error('Datos inválidos');state=loaded;save();}}
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
function chart(id,type,chartLabels,datasets){
  if(chartInstances[id])chartInstances[id].destroy();
  if(typeof Chart==='undefined'){const c=$(id);if(!c.parentElement.querySelector('.fallback')){const p=document.createElement('p');p.className='fallback muted';p.textContent='Gráfico no disponible: comprueba la conexión. Todos los valores siguen disponibles en tarjetas y tablas.';c.parentElement.append(p);}return;}
  chartInstances[id]=new Chart($(id),{type,data:{labels:chartLabels,datasets},options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${money(c.parsed.y)}`}}},scales:{x:{title:{display:true,text:id==='cash-chart'?'Mes seleccionado':'Años desde hoy'}},y:{title:{display:true,text:id==='fire-chart'?'EUR actuales':'EUR nominales'},ticks:{callback:v=>new Intl.NumberFormat('es-ES',{notation:'compact',maximumFractionDigits:1}).format(v)},beginAtZero:true}}}});
}
function advancedValues(form, percentKeys = []) {
 const raw=values(form), data={};
 Object.entries(raw).forEach(([key,value])=>{data[key]=percentKeys.includes(key)?Number(value)/100:Number(value);});
 return data;
}
function renderBudgets(result) {
 const rows=result.categories.map(r=>[r.category,money(r.planned),money(r.actual),money(r.deviation),r.status==='over'?'Exceso':r.status==='under'?'Por debajo':'En plan']);
 $('budget-results').innerHTML=tile('Ahorro del mes',money(result.totals.savings),`Ingresos ${money(result.totals.income)} · tasa ${pct(result.totals.savingRate)}`)+
 `<div class="table-wrap">${table(['Categoría','Plan','Real','Desviación','Estado'],rows)}</div>`+
 `<p class="muted">Total planificado ${money(result.totals.planned)} · real ${money(result.totals.actual)} · desviación ${money(result.totals.deviation)}. Las categorías con plan de 0 € y gasto real aparecen como exceso no planificado.</p>`;
}
function addBudgetRow(data={}) {
 const row=document.createElement('div');
 row.className='form-grid budget-row';
 row.innerHTML=`<label>Categoría<input name="budgetCategory" maxlength="60" placeholder="Vivienda, alimentación..." value="${escape(data.category||'')}"></label><label>Importe planificado (€)<input name="budgetPlanned" type="number" min="0" max="1000000000" step="0.01" value="${data.planned ?? 0}"></label><button type="button" class="secondary danger remove-budget-row">Quitar</button>`;
 $('budget-rows').append(row);
}
function renderRetirement(result) {
 const rows=result.scenarios.map(s=>[s.name,pct(s.annualReturn),money(s.endingCapital),s.depleted?'Capital agotado':'Capital restante']);
 const fireTarget=state.fire?state.fire.spending*12/(state.fire.withdrawal/100):null;
 const comparison=fireTarget===null?'Calcula FIRE para comparar ambas alternativas.':`FIRE sin pensión: ${money(fireTarget)} · Jubilación con pensión: ${money(result.requiredCapital)} · Diferencia: ${money(result.requiredCapital-fireTarget)}.`;
 $('retirement-results').innerHTML=`<div class="grid md:grid-cols-3 gap-4">${tile('Capital a jubilación',money(result.capitalAtRetirement),`En ${decimal(result.yearsToRetirement)} años`)}${tile('Capital requerido con pensión',money(result.requiredCapital),`Pensión: ${money(result.pensionAtRetirement)}/mes`)}${tile('Brecha',money(result.gap),'Aportaciones y retorno real')}</div><div class="table-wrap">${table(['Escenario','Rentabilidad real','Capital al final','Lectura'],rows)}</div><p class="notice">${comparison}</p><p class="muted">Escenarios deterministas educativos: no contemplan impuestos, inflación variable, longevidad, riesgo de secuencia ni reglas reales de pensión.</p>`;
}
function renderLoan(result) {
 const rows=result.table.map(r=>[r.month,money(r.payment),money(r.principal),money(r.interest),money(r.fee),money(r.balance)]);
 $('loan-results').innerHTML=`<div class="grid md:grid-cols-3 gap-4">${tile('Cuota total mensual',money(result.payment+result.table[0].fee),'Incluye comisión mensual')}${tile('TIN',pct(result.annualNominalRate),'Tipo nominal usado en el cálculo')}${tile('TAE estimada',pct(result.tae),'Incluye las comisiones declaradas')}${tile('Principal amortizado',money(result.principal),'Capital devuelto al final')}${tile('Intereses totales',money(result.totalInterest),'Antes de impuestos')}${tile('Comisiones totales',money(result.totalFees),`Total pagado: ${money(result.totalPaid)}`)}</div><p class="notice">La TAE mostrada es una estimación educativa basada en los flujos introducidos. Puede diferir de la TAE contractual por impuestos, seguros, fechas exactas u otros costes.</p><div class="table-wrap"><table><caption class="sr-only">Tabla de amortización francesa: pago total, principal, intereses, comisión y saldo pendiente</caption>${table(['Mes','Pago total','Principal','Interés','Comisión','Saldo pendiente'],rows).replace('<table>','').replace('</table>','')}</table></div><p class="muted">La cuota base es ${money(result.payment)} y la tabla muestra el pago total de cada periodo. La última cuota se ajusta al saldo residual.</p>`;
}
function renderBank(result) {
 const labels={cet1:'CET1',tier1:'Tier 1',tier2:'Tier 2',totalCapital:'Capital total',leverage:'Apalancamiento',depositToAssets:'Depósitos / activos',lcr:'LCR',nsfr:'NSFR'};
 const rows=Object.entries(result.ratios).map(([key,value])=>[labels[key]||key.toUpperCase(),pct(value),pct(result.thresholds[key] ?? 0),value >= (result.thresholds[key] ?? 0)?'OK':'Alerta']);
 $('bank-results').innerHTML=tile('Estado prudencial',result.sound?'Sin alertas configuradas':'Revisar alertas',result.warnings.join(' · ')||'Todos los umbrales configurados se cumplen.')+`<div class="table-wrap">${table(['Ratio','Valor','Umbral','Estado'],rows)}</div>`;
}
function renderCredit(result) {
 const rows=result.components.map(c=>[c.label,pct(c.value/100),pct(c.weight),c.reason]);
 $('credit-results').innerHTML=`<div class="grid md:grid-cols-3 gap-4">${tile('Puntuación',decimal(result.score)+'/100','Cálculo ponderado y explicable')}${tile('Banda didáctica',result.rating,'No es un rating regulatorio')}${tile('Lectura',result.decision,'Revisión humana necesaria')}</div><div class="table-wrap">${table(['Componente','Puntuación','Peso','Explicación'],rows)}</div><p class="muted">Ratios: DSCR ${decimal(result.ratios.dscr)} · margen EBITDA ${pct(result.ratios.ebitdaMargin)} · margen neto ${pct(result.ratios.netMargin)} · deuda/ingresos tras préstamo ${pct(result.ratios.debtAfterLoanToRevenue)} · liquidez corriente ${decimal(result.ratios.currentRatio)}.</p><p class="notice">La puntuación resume reglas didácticas y no sustituye estados financieros, garantías, flujo de caja, contexto sectorial ni revisión humana.</p>`;
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
 $('fire-results').innerHTML=tile('Capital objetivo real',money(center.target),`Gasto anual ${money(p.spending*12)} / retirada ${pct(p.withdrawal/100)}. Retirada no equivale a rentabilidad.`)+`<div class="table-wrap">${table(['Escenario / tasa real','Tiempo / edad FIRE','Capital a tu edad objetivo'],scenarios.map(s=>[`${s.name} / ${pct(s.annual)}`,s.reached===null?'No alcanzado en 80 años':s.reached===0?`Objetivo ya cubierto / ${p.age} años`:`${Math.floor(s.reached/12)} años y ${s.reached%12} meses / edad ${Math.floor(s.age)} años y ${s.reached%12} meses`,`${money(s.atRetirement)} / ${pct(s.atRetirement/s.target)} del objetivo`]))}</div><p class="muted">La fecha FIRE es el primer cruce matemático del objetivo. El gráfico mantiene aportaciones después de alcanzarlo para comparar escenarios; no simula la fase de retirada ni riesgo de secuencia.</p>`;
 const datasets=scenarios.map(s=>({label:s.name,data:s.series.map(x=>x.balance),borderColor:s.color,backgroundColor:s.color,pointRadius:0,borderWidth:2}));
 datasets.push({label:'Objetivo real',data:center.series.map(()=>center.target),borderColor:'#64748b',borderDash:[6,5],pointRadius:0,borderWidth:2});
 chart('fire-chart','line',center.series.map(x=>x.year),datasets);
 $('fire-table').innerHTML=table(['Año','Adverso (€ actuales)','Central (€ actuales)','Favorable (€ actuales)','Objetivo'],center.series.map((x,i)=>[x.year,...scenarios.map(s=>money(s.series[i].balance)),money(center.target)]));
 return p;
}
function calculateCompound(p){
 const result=Fin.compound({...p,nominal:p.nominal/100,inflation:p.inflation/100}), last=result.series.at(-1);
 $('compound-results').innerHTML=[tile('Capital final nominal',money(last.balance),`Capital inicial y aportaciones: ${money(last.paid)}`),tile('Rendimientos nominales',money(last.earnings),'Pueden ser negativos; antes de impuestos.'),tile('Capital final en euros de hoy',money(last.real),'Capital final nominal descontado por inflación.'),tile('Compra hoy',money(p.purchase),'Importe del escenario alternativo.'),tile('Valor futuro de comprar hoy e invertir el importe',money(result.opportunity),`En euros de hoy: ${money(result.opportunityReal)}`),tile('Rendimiento potencial no obtenido',money(result.forgoneEarnings),'Comparación educativa, no pérdida contable.')].join('');
 chart('compound-chart','line',result.series.map(x=>x.year),[{label:'Capital aportado',data:result.series.map(x=>x.paid),borderColor:'#64748b',backgroundColor:'#64748b',pointRadius:0},{label:'Capital acumulado',data:result.series.map(x=>x.balance),borderColor:'#0f766e',backgroundColor:'#0f766e',pointRadius:0}]);
 $('compound-table').innerHTML=table(['Año','Aportado nominal','Rendimientos nominales','Total nominal','Total real'],result.series.map(x=>[x.year,money(x.paid),money(x.earnings),money(x.balance),money(x.real)]));return p;
}
const advice={loss:'Define por escrito motivos de venta y revisa la tesis, no solo el precio de compra. Señal alta: espera local de 48 horas.',confirmation:'Busca una fuente independiente y escribe qué evidencia te haría cambiar de opinión. Señal moderada o alta: argumento contrario obligatorio.',confidence:'Registra predicciones y errores. Señal alta: el laboratorio limita la posición al 10% del total declarado.'};
function renderBias(){
 $('bias-results').innerHTML=state.answers?Fin.biases(state.answers).map(b=>tile(names[b.group],`${decimal(b.score)} / 100`,`${b.level}. ${advice[b.group]}`)).join(''):'<p class="muted">Completa el test para activar reglas personalizadas de autorreflexión.</p>';
 $('review-clock').textContent=state.reviewStarted?`Revisión iniciada: ${new Date(state.reviewStarted).toLocaleString('es-ES')}. Espera hasta: ${new Date(state.reviewStarted+48*3600000).toLocaleString('es-ES')}.`:'No se ha iniciado ninguna espera.';
}
function renderConcentration(){
 const portfolio=Number($('decision-form').elements.namedItem('portfolio').value), position=Number($('decision-form').elements.namedItem('position').value);
 $('concentration-preview').textContent=portfolio>0&&position>=0?`Esta posición representa el ${pct(position/portfolio)} de tu cartera.`:'Introduce un valor total de cartera positivo para calcular la concentración.';
}
$('questions').innerHTML=Fin.QUESTIONS.map((q,i)=>`<label class="question" for="q${i}">${i+1}. ${escape(q.text)}<select id="q${i}" name="q${i}" required><option value="">Elige una frecuencia</option><option value="1">1 - Nunca actuaría así</option><option value="2">2 - Rara vez actuaría así</option><option value="3">3 - A veces actuaría así</option><option value="4">4 - A menudo actuaría así</option><option value="5">5 - Casi siempre actuaría así</option></select></label>`).join('');
$('questions').addEventListener('change',e=>{const selected=[...$('questions').querySelectorAll('select')].filter(x=>x.value).length;$('question-progress').textContent=`Escena ${Math.min(selected+1,9)} de 9 · ${selected} respondidas`;});
$('month').value=localDate().slice(0,7);resetAccount();resetTransaction();
fill($('fire-form'),state.fire);fill($('compound-form'),state.compound);
const advancedMonth=localDate().slice(0,7);$('budget-form').elements.namedItem('month').value=advancedMonth;
if(state.budgets.length)state.budgets.forEach(addBudgetRow);else addBudgetRow();
if(state.retirement){const retirementFormData=Object.assign({},state.retirement,{nominalReturn:state.retirement.nominalReturn*100,inflation:state.retirement.inflation*100,withdrawalRate:state.retirement.withdrawalRate*100});fill($('retirement-form'),retirementFormData);}
if(state.loan)fill($('loan-form'),Object.assign({},state.loan,{annualNominalRate:state.loan.annualNominalRate*100}));
if(state.bank){fill($('bank-form'),state.bank);if(state.bank.thresholds){$('bank-form').elements.namedItem('thresholdCet1').value=(state.bank.thresholds.cet1||.045)*100;$('bank-form').elements.namedItem('thresholdTier1').value=(state.bank.thresholds.tier1||.06)*100;$('bank-form').elements.namedItem('thresholdTotalCapital').value=(state.bank.thresholds.totalCapital||.08)*100;$('bank-form').elements.namedItem('thresholdLeverage').value=(state.bank.thresholds.leverage||.03)*100;$('bank-form').elements.namedItem('thresholdLcr').value=(state.bank.thresholds.lcr||1)*100;$('bank-form').elements.namedItem('thresholdNsfr').value=(state.bank.thresholds.nsfr||1)*100;}}
if(state.credit)fill($('credit-form'),state.credit);
if(state.answers)state.answers.forEach((a,i)=>{$(`q${i}`).value=a;});
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
$('bias-form').addEventListener('submit',e=>{e.preventDefault();try{const answers=Fin.QUESTIONS.map((_,i)=>Number($(`q${i}`).value));Fin.biases(answers);state.answers=answers;state.lastDecision=null;$('decision-result').textContent='Nuevo perfil guardado: vuelve a comprobar el plan.';save();renderBias();say('Reglas actualizadas con el cuestionario.');}catch(err){say(err.message);}});
$('bias-form').addEventListener('input',()=>{state.answers=null;state.lastDecision=null;save();renderBias();$('decision-result').textContent='Test modificado: evalúalo de nuevo antes de comprobar un plan.';});
$('start-review').onclick=()=>{state.reviewStarted=Date.now();state.lastDecision=null;save();renderBias();$('decision-result').textContent='Espera iniciada. Vuelve a comprobar el plan al finalizar.';};
$('decision-form').addEventListener('input',()=>{state.lastDecision=null;$('decision-result').textContent='Plan modificado: comprobación pendiente.';save();});
$('decision-form').addEventListener('input',renderConcentration);
$('decision-form').addEventListener('submit',e=>{
 e.preventDefault();if(!e.currentTarget.reportValidity())return;if(!state.answers){$('decision-result').textContent='Completa y evalúa el test primero.';return;}
 const v=values(e.currentTarget),portfolio=Number(v.portfolio),position=Number(v.position);
 if(position>portfolio){$('decision-result').textContent='La posición no puede superar el total declarado.';return;}
 const scores=Object.fromEntries(Fin.biases(state.answers).map(b=>[b.group,b.score])),blocked=[];
 if(scores.loss>=65 && (state.reviewStarted===null || Date.now()-state.reviewStarted<48*3600000))blocked.push('Completar la espera de 48 horas.');
 if(scores.confirmation>=35 && v.counter.trim().length<40)blocked.push('Escribir un argumento contrario de al menos 40 caracteres; su calidad requiere revisión humana.');
 const concentration=position/portfolio;
 if(scores.confidence>=65 && concentration>.1+1e-12)blocked.push(`Reducir concentración didáctica: actual ${pct(concentration)}, máximo 10%.`);
 const text=blocked.length?'Plan pendiente: '+blocked.join(' '):'Lista de comprobación completada. Esto no acredita idoneidad ni recomienda ejecutar la inversión.';
 state.lastDecision={at:Date.now(),portfolio,position,counter:v.counter,risk:true,concentration,blocked};save();$('decision-result').textContent=text;
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
 const raw=values(form),data=Object.fromEntries(Object.entries(raw).map(([key,value])=>[key,key==='startDate'?(value||null):Number(value)]));
 data.annualNominalRate/=100;
 const result=Fin.loanAmortization(data);state.loan=data;renderLoan(result);
});
runAdvancedForm('bank-form', form=>{
 const data=advancedValues(form,[]);data.thresholds={cet1:data.thresholdCet1/100,tier1:data.thresholdTier1/100,totalCapital:data.thresholdTotalCapital/100,leverage:data.thresholdLeverage/100,lcr:data.thresholdLcr/100,nsfr:data.thresholdNsfr/100};
 delete data.thresholdCet1;delete data.thresholdTier1;delete data.thresholdTotalCapital;delete data.thresholdLeverage;delete data.thresholdLcr;delete data.thresholdNsfr;
 const result=Fin.bankRatios(data);state.bank=data;renderBank(result);
});
runAdvancedForm('credit-form', form=>{
 const data=advancedValues(form),result=Fin.businessCreditScore(data);state.credit=data;renderCredit(result);
});
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='horizonte-datos.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say('Exportación generada. Contiene datos financieros y respuestas sin cifrar; guárdala de forma privada.');};
$('demo').onclick=()=>{
 if(!confirm('El ejemplo sustituirá los datos actuales de la aplicación. ¿Continuar?'))return;
 const date=localDate();state=blank();state.accounts=[{id:uuid(),name:'Fondo de emergencia',kind:'liquid',balance:5000,asOf:date},{id:uuid(),name:'Cartera diversificada ficticia',kind:'investment',balance:30000,asOf:date},{id:uuid(),name:'Participación en vivienda',kind:'other',balance:100000,asOf:date},{id:uuid(),name:'Préstamo pendiente',kind:'liability',balance:20000,asOf:date}];state.transactions=[['income','Nómina','Trabajo',2500],['expense','Vivienda y suministros','Vivienda',1000],['expense','Supermercado','Alimentación',300],['expense','Ocio','Ocio',200],['transfer','Aportación a inversión','Inversión',500]].map(([kind,name,category,amount])=>({id:uuid(),date,kind,name,category,amount}));
 $('month').value=date.slice(0,7);$('fire-form').reset();$('compound-form').reset();$('bias-form').reset();$('decision-form').reset();resetAccount();resetTransaction();$('decision-result').textContent='';state.fire=calculateFire(numericForm($('fire-form')));state.compound=calculateCompound(numericForm($('compound-form')));renderBias();save();renderDashboard();say('Ejemplo ficticio cargado. FIRE comienza con supuestos ilustrativos: usa Traer inversión y flujo para vincularlo al mes.');
};
$('clear').onclick=()=>{if(confirm('¿Borrar todos los datos de Horizonte de este navegador? No se borran archivos exportados.')){try{localStorage.removeItem(KEY);localStorage.removeItem(PROFILE_KEY);localStorage.removeItem(WELCOME_KEY);location.reload();}catch(e){say('No se pudo borrar el almacenamiento. Usa los ajustes de datos del sitio en tu navegador.');}}};
renderDashboard();renderBias();
renderConcentration();
const welcome=$('welcome'); let startApp=()=>{welcome.hidden=true;try{if($('skip-welcome').checked)localStorage.setItem(WELCOME_KEY,'1');}catch(e){}$('main').focus({preventScroll:true});};
$('edit-profile').onclick=()=>{welcome.hidden=false;$('welcome-name').focus({preventScroll:true});};
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
try{if(localStorage.getItem(WELCOME_KEY)==='1')welcome.hidden=true;}catch(e){}
try {
 if(state.budgets.length) renderBudgets(Fin.monthlyBudgets({month:advancedMonth,budgets:state.budgets,transactions:state.transactions}));
 if(state.retirement) renderRetirement(Fin.retirementProjection(state.retirement));
 if(state.loan) renderLoan(Fin.loanAmortization(state.loan));
 if(state.bank) renderBank(Fin.bankRatios(state.bank));
 if(state.credit) renderCredit(Fin.businessCreditScore(state.credit));
} catch(e) { say('Algunos resultados ampliados guardados ya no son válidos: '+e.message); }
try{if($('fire-form').checkValidity())calculateFire(numericForm($('fire-form')));else say('Los parámetros FIRE guardados no son válidos. Corrige los campos.');if($('compound-form').checkValidity())calculateCompound(numericForm($('compound-form')));}catch(e){say('Revisa los parámetros guardados: '+e.message);}
})();
