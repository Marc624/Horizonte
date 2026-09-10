'use strict';
const results = runFinanceTests(Fin);
document.getElementById('summary').textContent = `${results.filter(r => r.passed).length}/${results.length} pruebas correctas`;
const list = document.createElement('ol');
results.forEach(r => {
  const item = document.createElement('li');
  item.textContent = `${r.passed ? 'OK' : 'ERROR'}: ${r.name}${r.error ? ' - ' + r.error : ''}`;
  item.style.color = r.passed ? '#0f766e' : '#be123c';
  list.appendChild(item);
});
document.getElementById('results').appendChild(list);
