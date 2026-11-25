// Single-writer synthetic lab. Only completed batches replace the local journal.
// The adapter passes all of the fixture, including late arrivals, through replay.
const fs=require('node:fs');
const path=require('node:path');
const {replay}=require('./replay.cjs');
function processBatch(file, messages, items, day) {
  const prior=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):[];
  const combined=[...prior,...messages];
  // Validate all messages, including those beyond the requested report date.
  replay(combined,items,'9999-12-31');
  const unique=[...new Map(combined.map(message=>[message.id,message])).values()];
  const result=replay(unique,items,day);
  const dir=fs.mkdtempSync(path.join(path.dirname(file),'.batch-'));
  try {
    const staged=path.join(dir,'journal.json');
    fs.writeFileSync(staged,JSON.stringify(unique));
    fs.renameSync(staged,file);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
  return result;
}
module.exports={processBatch};
