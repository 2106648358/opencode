const fs = require('fs');
const c = fs.readFileSync('src/cli/ui.ts', 'utf8');
const idx = c.indexOf('wordmark');
const rest = c.slice(idx);
const lines = rest.split('\n').slice(1,5).map(l => {
  const m = l.match(/`([^`]*)`/);
  return m ? m[1] : '';
});

console.log('');
console.log('EzCode wordmark:');
console.log(lines.join('\n'));
console.log('');

// Characters (each row is 4 cells)
const chips = [
  { name: 'E', rows: [
    '\u2588\u2580\u2580\u2588',
    '\u2588\u2580\u2580\u2580',
    '\u2580\u2580\u2580\u2580',
  ]},
  { name: 'z', rows: [
    '\u2588\u2580\u2580\u2580',
    '  \u2580\u2580',
    '\u2580\u2580\u2580\u2580',
  ]},
  { name: 'C', rows: [
    '\u2588\u2580\u2580\u2580',
    '\u2588   ',
    '\u2580\u2580\u2580\u2580',
  ]},
  { name: 'o', rows: [
    '\u2588\u2580\u2580\u2588',
    '\u2588  \u2588',
    '\u2580\u2580\u2580\u2580',
  ]},
  { name: 'd', rows: [
    '\u2588\u2580\u2580\u2588',
    '\u2588  \u2588',
    '\u2580\u2580\u2580\u2580',
  ]},
  { name: 'e', rows: [
    '\u2588\u2580\u2580\u2588',
    '\u2588\u2580\u2580\u2580',
    '\u2580\u2580\u2580\u2580',
  ]},
];

for (const ch of chips) {
  console.log(ch.name + ':');
  for (const row of ch.rows) {
    console.log('  ' + row);
  }
  console.log('');
}
