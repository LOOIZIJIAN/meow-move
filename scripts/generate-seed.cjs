// Public builds start with an empty journal and a generic exercise catalog.
const fs = require('node:fs');
const path = require('node:path');
const M = require('../app/src/main/assets/model.js');

const exercises = [
  ['杠铃卧推', '胸', 'total'],
  ['哑铃卧推', '胸', 'side'],
  ['上斜哑铃卧推', '胸', 'side'],
  ['蝴蝶机夹胸', '胸', 'recorded'],
  ['绳索夹胸', '胸', 'recorded'],
  ['俯卧撑', '胸', 'body'],
  ['高位下拉', '背', 'recorded'],
  ['俯身杠铃划船', '背', 'total'],
  ['坐姿划船', '背', 'recorded'],
  ['单臂哑铃划船', '背', 'side'],
  ['引体向上', '背', 'body'],
  ['杠铃深蹲', '腿', 'total'],
  ['腿举', '腿', 'recorded'],
  ['腿屈伸', '腿', 'recorded'],
  ['腿弯举', '腿', 'recorded'],
  ['保加利亚蹲', '腿', 'body'],
  ['哑铃肩推', '肩', 'side'],
  ['哑铃侧平举', '肩', 'side'],
  ['绳索面拉', '肩', 'recorded'],
  ['反向蝴蝶机', '肩', 'recorded'],
  ['杠铃弯举', '二头', 'total'],
  ['哑铃弯举', '二头', 'side'],
  ['锤式弯举', '二头', 'side'],
  ['绳索三头下压', '三头', 'recorded'],
  ['绳索过头臂屈伸', '三头', 'recorded'],
  ['双杠臂屈伸', '三头', 'body'],
  ['杠铃臀推', '臀', 'total'],
  ['臀桥', '臀', 'body'],
  ['站姿提踵', '小腿', 'recorded'],
  ['坐姿提踵', '小腿', 'recorded'],
  ['绳索卷腹', '核心', 'recorded'],
  ['悬垂举腿', '核心', 'body'],
];

const seed = M.blank();
seed.catalog = exercises.map(([name, muscle, defaultKind]) => ({
  id: M.exerciseId(name), name, muscle, defaultKind, archived: false,
}));
M.validate(seed);
const assets = path.join(__dirname, '../app/src/main/assets');
fs.writeFileSync(path.join(assets, 'seed.json'), JSON.stringify(seed, null, 2) + '\n');
fs.writeFileSync(path.join(assets, 'seed.js'), 'window.MeowSeed = ' + JSON.stringify(seed) + ';\n');
console.log(`Generated an empty journal with ${seed.catalog.length} generic exercises.`);
