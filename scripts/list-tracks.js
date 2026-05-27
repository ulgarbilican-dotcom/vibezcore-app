/* Wegwerp-script voor data-verificatie vóór de ID3-batch. Telt alle
   tracks in audio-library-data.ts en groepeert per series. Werkt
   correct met ge-escapede apostrofs in titels (bv. "The Warrior\'s
   Mind") door een proper regex met character-class. */
const fs = require('fs');
const src = fs.readFileSync('src/data/audio-library-data.ts', 'utf8');

// Match { title:'<X>', series:'<Y>', ... } waar X en Y string-literals zijn
// met geescapede chars toegestaan: backslash-iets OR niet-apostrof.
const re = /title:'((?:[^'\\]|\\.)*)',\s*series:'((?:[^'\\]|\\.)*)'/g;

const tracks = [];
let m;
while ((m = re.exec(src)) !== null) {
  const t = m[1].replace(/\\'/g, "'");
  const s = m[2].replace(/\\'/g, "'");
  tracks.push({ series: s, title: t });
}

console.log('TOTAL:', tracks.length);
console.log('');
console.log('PER-SERIES COUNT:');
const counts = {};
tracks.forEach(t => counts[t.series] = (counts[t.series] || 0) + 1);
Object.entries(counts)
  .sort((a,b) => b[1] - a[1])
  .forEach(([s,n]) => console.log('  ' + n.toString().padStart(3) + '  ' + s));

console.log('');
console.log('TRACKS MET APOSTROFS IN TITEL (vorige grep miste deze):');
tracks
  .filter(t => t.title.includes("'"))
  .forEach(t => console.log('  ' + t.series + ' :: ' + t.title));
