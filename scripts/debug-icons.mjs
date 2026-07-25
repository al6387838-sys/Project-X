import { icons } from 'lucide';

console.log('Total icons:', Object.keys(icons).length);
console.log('First 5 keys:', Object.keys(icons).slice(0, 5));

// Check Activity
const act = icons['Activity'];
console.log('\nActivity:', JSON.stringify(act).substring(0, 300));
console.log('\nActivity.icon:', act?.icon);
console.log('\nActivity icon[0]:', act?.icon?.[0]);
console.log('\nActivity icon[1]:', act?.icon?.[1]?.substring(0, 100));
