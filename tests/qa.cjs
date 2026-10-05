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
const logic=load('lib/work-logic.ts');
const owner='ea11b45a-21d5-4c5b-a2ec-6a252ba982f7';
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const item=(extra={})=>({id,title:'QA item',status:'Active',type:'Project',priority:'Now',impact:'Medium',effort:'Moderate',area:'Technology',nextAction:'Next',...extra});
test('Due Soon covers seven calendar days and excludes distant, overdue, closed and invalid dates',()=>{
  const now=new Date('2026-10-04T12:00:00');
  const data=['2026-10-04','2026-10-11','2026-10-12','2026-10-03','bad'].map(targetDate=>item({targetDate}));
  data.push(item({targetDate:'2026-10-06',status:'Done'}),item({targetDate:'2026-10-06',status:'Archived'}));
  assert.equal(logic.commandMetrics(data,now)['Due Soon'],2);
});
test('Attention excludes completed and archived work, includes review and blank actions',()=>{
  assert.equal(logic.needsAttention(item({status:'Done',lastActivityDays:200})),false);
  assert.equal(logic.needsAttention(item({status:'Archived',lastActivityDays:200})),false);
  assert.equal(logic.needsAttention(item({status:'Review'})),true);
  assert.equal(logic.needsAttention(item({nextAction:'   '})),true);
  assert.equal(logic.needsAttention(item({type:'Idea',status:'Inbox',ideaStage:'Park',lastActivityDays:200})),false);
});
test('Incoming directed relationships are rendered from the selected item perspective',()=>{
  assert.equal(logic.relationshipLabel('blocks',false),'blocked by');
  assert.equal(logic.relationshipLabel('blocked_by',false),'blocks');
  assert.equal(logic.relationshipLabel('parent',false),'child of');
  assert.equal(logic.relationshipLabel('derived_from',false),'source of');
});
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
        return Promise.resolve({data:one?(rows[0]??null):structuredClone(rows),error:null}).then(resolve,reject);
      }catch(e){return Promise.reject(e).then(resolve,reject);}
    }};return q;
  }};return {client,tables};
}
function api(db,user={id:owner}){return load('app/api/work-items/route.ts',{'@/lib/auth':{getAuthed:async()=>({supabase:db.client,user})},'@/lib/work-logic':logic,'@/lib/work-read-server':load('lib/work-read-server.ts')});}
const post=(a,body,origin='https://work-os-gray.vercel.app')=>a.POST(new Request('https://work-os-gray.vercel.app/api/work-items',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)}));
test('Anonymous access is denied and cross-origin mutation is rejected',async()=>{
  const db=database();assert.equal((await api(db,null).GET()).status,401);
  assert.equal((await post(api(db),{op:'updateItem',itemId:id,patch:{status:'Done'}},'https://evil.example')).status,403);
  assert.equal(db.tables.work_items[0].status,'Active');
});
test('Failed details query returns an error rather than empty details',async()=>{
  const db=database({},(t,o)=>t==='work_item_tags'&&o==='select');
  assert.equal((await post(api(db),{op:'details',itemId:id})).status,500);
});
test('Invalid IDs and nonexistent work items cannot create phantom mutation success',async()=>{
  const a=api(database());
  assert.equal((await post(a,{op:'updateItem',itemId:'bad',patch:{status:'Done'}})).status,400);
  assert.equal((await post(a,{op:'updateItem',itemId:other,patch:{status:'Done'}})).status,404);
});
test('Updates protect owner fields and set/clear completion timestamps on the server',async()=>{
  const db=database(),a=api(db);
  assert.equal((await post(a,{op:'updateItem',itemId:id,patch:{status:'Done',user_id:'attacker',id:other}})).status,200);
  assert.equal(db.tables.work_items[0].id,id);assert.ok(db.tables.work_items[0].completed_at);
  assert.equal((await post(a,{op:'updateItem',itemId:id,patch:{status:'Active'}})).status,200);
  assert.equal(db.tables.work_items[0].completed_at,null);
  assert.equal(db.tables.activity_history.length,2);
});
test('Invalid dates, statuses and blank titles are rejected',async()=>{
  const a=api(database());
  for(const patch of [{target_date:'2026-02-30'},{status:'bogus'},{title:'  '}]) assert.equal((await post(a,{op:'updateItem',itemId:id,patch})).status,400);
});
test('Capture keeps supplied notes, repeated request ID is idempotent and title matches require override',async()=>{
  const db=database(),a=api(db),body={op:'createItem',row:{id:other,title:'Captured idea',notes:'Full original capture',type:'Idea'}};
  assert.equal((await post(a,body)).status,200);assert.equal((await post(a,body)).status,200);
  assert.equal(db.tables.work_items.length,2);assert.equal(db.tables.work_items[1].notes,'Full original capture');
  assert.equal(db.tables.activity_history.length,1);
  const different={...body,row:{...body.row,id:'33333333-3333-4333-8333-333333333333',title:'  captured   IDEA  '}};
  assert.equal((await post(a,different)).status,409);
  assert.equal((await post(a,{...different,allowDuplicate:true})).status,200);
});
test('Delete failures are reported and do not create successful activity entries',async()=>{
  for(const [table,op,fields] of [['work_item_tags','removeTag',{tagId:other}],['work_item_sources','removeSource',{sourceId:other}]]){
    const db=database({},(t,o)=>t===table&&o==='delete');
    assert.equal((await post(api(db),{op,itemId:id,...fields})).status,500);
    assert.equal(db.tables.activity_history.length,0);
  }
});
test('Unlinked primary source cannot clear the existing primary; repeating Add does not demote it',async()=>{
  const db=database({sources_of_truth:[{id:other,user_id:owner,name:'Source',source_type:'url',location:null}],work_item_sources:[{work_item_id:id,source_id:other,is_primary:true}]}),a=api(db);
  assert.equal((await post(a,{op:'setPrimarySource',itemId:id,sourceId:id})).status,404);
  assert.equal(db.tables.work_item_sources[0].is_primary,true);
  assert.equal((await post(a,{op:'addSource',itemId:id,name:'Source',sourceType:'url',location:''})).status,200);
  assert.equal(db.tables.work_item_sources[0].is_primary,true);
});
test('Source removal uses stored primary state, even if the client sends a stale flag',async()=>{
  const db=database({work_item_sources:[{work_item_id:id,source_id:other,is_primary:true},{work_item_id:id,source_id:id,is_primary:false}]}),a=api(db);
  const result=await post(a,{op:'removeSource',itemId:id,sourceId:other,wasPrimary:false});
  assert.equal(result.status,200);assert.equal((await result.json()).replacementSourceId,id);assert.equal(db.tables.work_item_sources[0].is_primary,true);
});
test('Activity failure is an explicit warning after a saved mutation, so clients do not roll back a committed change',async()=>{
  const db=database({},(t,o)=>t==='activity_history'&&o==='insert'),result=await post(api(db),{op:'updateItem',itemId:id,patch:{title:'Saved'}});
  assert.equal(result.status,200);assert.equal(db.tables.work_items[0].title,'Saved');assert.match((await result.json()).warning,/saved/);
});
test('Each supported relationship type can be linked idempotently and unlinked; self-links and invalid types are rejected',async()=>{
  const db=database({work_items:[item(),item({id:other,title:'Other'})]}),a=api(db);
  for(const relationshipType of ['related','blocks','blocked_by','parent','duplicates','derived_from']){
    const body={op:'addRelationship',itemId:id,targetId:other,relationshipType};
    assert.equal((await post(a,body)).status,200);
    assert.equal((await post(a,body)).status,200);
    assert.equal(db.tables.work_item_relationships.filter(r=>r.relationship_type===relationshipType).length,1);
  }
  assert.equal(db.tables.activity_history.length,6);
  assert.equal((await post(a,{op:'addRelationship',itemId:id,targetId:id,relationshipType:'related'})).status,400);
  assert.equal((await post(a,{op:'addRelationship',itemId:id,targetId:other,relationshipType:'bogus'})).status,400);
  const edge=db.tables.work_item_relationships[0];
  assert.equal((await post(a,{op:'removeRelationship',itemId:id,edgeId:edge.id})).status,200);
  assert.equal(db.tables.work_item_relationships.length,5);
});
test('Proxy preserves refreshed cookies on redirects and returns JSON 401 for expired or unauthorized API sessions',async()=>{
  const {NextRequest}=require('next/server');
  async function run(claims,error,path){
    const proxy=load('lib/supabase/proxy.ts',{'../config':{ALLOWED_USER_ID:owner},'@supabase/ssr':{createServerClient:(_url,_key,options)=>({auth:{getClaims:async()=>{options.cookies.setAll([{name:'qa-refreshed-session',value:'refreshed',options:{path:'/'}}]);return {data:{claims},error};}}})}});
    return proxy.updateSession(new NextRequest('https://work-os-gray.vercel.app'+path));
  }
  const redirect=await run({sub:owner},null,'/login');
  assert.equal(redirect.status,307);assert.equal(redirect.headers.get('location'),'https://work-os-gray.vercel.app/');
  assert.equal(redirect.cookies.get('qa-refreshed-session').value,'refreshed');assert.match(redirect.headers.get('cache-control'),/no-store/);
  const expired=await run(null,{message:'expired'},'/api/work-items');
  assert.equal(expired.status,401);assert.match((await expired.json()).error,/session expired/);
  assert.equal((await run({sub:other},null,'/api/work-items')).status,401);
  assert.equal((await run(null,{message:'expired'},'/')).headers.get('location'),'https://work-os-gray.vercel.app/login');
});
