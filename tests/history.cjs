const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
function load(file,mocks={}){
  const full=path.resolve(file),m=new Module(full,module);
  m.filename=full;m.paths=Module._nodeModulePaths(path.dirname(full));
  mocks={'server-only':{},...mocks};
  const original=m.require.bind(m);
  m.require=name=>name in mocks?mocks[name]:original(name);
  m._compile(ts.transpileModule(fs.readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,full);
  return m.exports;
}
function database(seed={},failure){
  const tables={work_items:[item()],work_item_tags:[],work_item_sources:[],work_item_relationships:[],tags:[],sources_of_truth:[],activity_history:[],...structuredClone(seed)};
  let sequence=10;
  const generatedId=()=>String(sequence++).padStart(8,'0')+'-0000-4000-8000-000000000000';
  const client={from(table){
    let operation='select',payload,filters=[],one=false,optional=false,project='*',opts={};
    const q={select(columns='*'){project=columns;return q;},eq(key,value){filters.push(r=>r[key]===value);return q;},in(key,values){filters.push(r=>values.includes(r[key]));return q;},or(){return q;},order(){return q;},limit(){return q;},single(){one=true;return q;},maybeSingle(){one=true;optional=true;return q;},insert(row){operation='insert';payload=row;return q;},update(row){operation='update';payload=row;return q;},delete(){operation='delete';return q;},upsert(row,options={}){operation='upsert';payload=row;opts=options;return q;},then(resolve,reject){
      try {
        if(failure?.(table,operation)) return Promise.resolve({data:null,error:{message:'Injected database failure'}}).then(resolve,reject);
        let rows=tables[table].filter(r=>filters.every(f=>f(r)));
        if(operation==='insert'){if(table==='work_items'&&tables[table].some(r=>r.id===payload.id))return Promise.resolve({data:null,error:{code:'23505',message:'duplicate'}}).then(resolve,reject);rows=[{id:payload.id??generatedId(),...payload}];tables[table].push(...rows);}
        if(operation==='update') rows.forEach(r=>Object.assign(r,payload));
        if(operation==='delete') tables[table]=tables[table].filter(r=>!rows.includes(r));
        if(operation==='upsert'){
          const keys=opts.onConflict?.split(',')??['id'];
          const existing=tables[table].find(r=>keys.every(k=>r[k]===payload[k]));
          if(existing){if(opts.ignoreDuplicates)rows=[];else{Object.assign(existing,payload);rows=[existing];}}
          else{rows=[{id:payload.id??generatedId(),...payload}];tables[table].push(...rows);}
        }
        if(one&&rows.length!==1&&!optional)return Promise.resolve({data:null,error:{message:'Expected one row'}}).then(resolve,reject);
        return Promise.resolve({data:one?structuredClone(rows[0]??null):structuredClone(rows),error:null}).then(resolve,reject);
      }catch(e){return Promise.reject(e).then(resolve,reject);}
    }};return q;
  }};return {client,tables};
}
const history=load('lib/project-history.ts');
const owner='owner',id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const draft={title:'Work OS',source:'Chat handoff',date:'2026-10-06',summary:'Completed PR3. Do not rebuild. Next: import history.'};
const item=(extra={})=>({id,user_id:owner,title:'Work OS',status:'Active',next_action:'Current verified action',notes:'Keep notes',updated_at:'2026-10-07T00:00:00Z',metadata:{legacyId:'legacy',custom:'keep'},...extra});
function api(db,user={id:owner}){return load('app/api/history-import/route.ts',{'@/lib/auth':{getAuthed:async()=>({supabase:db.client,user})},'@/lib/project-history':history});}
const post=(a,body,origin='https://work-os-gray.vercel.app')=>a.POST(new Request('https://work-os-gray.vercel.app/api/history-import',{method:'POST',headers:{Origin:origin},body:JSON.stringify(body)}));
const save={op:'save',itemId:id,importId:other,draft,reviewed:true};
test('History validation rejects missing provenance, invalid dates and oversized content',()=>{
 for(const bad of [{...draft,source:''},{...draft,date:'2026-02-30'},{...draft,summary:'x'.repeat(30001)},{...draft,title:[]},{...draft,source:'https://user:password@example.com'}])assert.throws(()=>history.validateHistory(bad));
 assert.deepEqual(history.validateHistory(draft),draft);
});
test('Title matching prefers exact match and includes archived records without creating anything',()=>{
 const matches=history.matchHistory(draft,[{id,title:'WORK OS',status:'Archived'},{id:other,title:'Unrelated',status:'Active'}]);
 assert.equal(matches.length,1);assert.equal(matches[0].id,id);
});
test('History API denies foreign origins, expired sessions and other owners',async()=>{
 const db=database({work_items:[item({user_id:'someone-else'})]});
 assert.equal((await post(api(db),save,'https://evil.example')).status,403);
 assert.equal((await post(api(db,null),save)).status,401);
 assert.equal((await post(api(db),save)).status,404);
 assert.equal(db.tables.work_items[0].metadata.projectHistory,undefined);
});
test('Preview is read only and saving requires explicit review',async()=>{
 const db=database(),before=structuredClone(db.tables),a=api(db);
 assert.equal((await post(a,{op:'preview',draft})).status,200);
 assert.deepEqual(db.tables,before);
 assert.equal((await post(a,{...save,reviewed:false})).status,400);
 assert.deepEqual(db.tables,before);
});
test('Save preserves current fields and metadata; retry and repeated source content are idempotent',async()=>{
 const db=database(),a=api(db);
 assert.equal((await post(a,save)).status,200);
 assert.equal((await post(a,save)).status,200);
 assert.equal((await post(a,{...save,importId:'33333333-3333-4333-8333-333333333333'})).status,200);
 const record=db.tables.work_items[0];assert.equal(record.metadata.projectHistory.length,1);
 assert.equal(record.status,'Active');assert.equal(record.next_action,'Current verified action');assert.equal(record.notes,'Keep notes');assert.equal(record.metadata.custom,'keep');assert.equal(record.metadata.legacyId,'legacy');
 const r=await (await post(a,{op:'history',itemId:id})).json();assert.equal(r.entries.length,1);assert.match(r.brief,/Current verified action/);assert.match(r.brief,/historical claims/);assert.match(r.brief,/Do not rebuild/);
});
test('Database failures and stale compare-and-swap return errors without losing prior history',async()=>{
 const db=database({},(t,op)=>op==='update');
 assert.equal((await post(api(db),save)).status,500);assert.equal(db.tables.work_items[0].metadata.projectHistory,undefined);
 const stale=database();const from=stale.client.from;stale.client.from=function(t){const q=from(t),update=q.update;q.update=function(row){stale.tables.work_items[0].updated_at='newer';return update(row);};return q;};
 assert.equal((await post(api(stale),save)).status,409);assert.equal(stale.tables.work_items[0].metadata.projectHistory,undefined);
});
