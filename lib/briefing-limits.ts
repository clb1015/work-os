// A single-owner pilot guard. This is per server instance, not a global billing cap.
// Review billing controls before enabling AI; this is not a global spend limit.
const usage=new Map<string,{window:number;count:number;active:boolean;last:number}>();
export function claimBriefingRequest(owner:string,now=Date.now()):(()=>void)|null{
  let state=usage.get(owner);
  if(!state||now-state.window>=3600000){state={window:now,count:0,active:false,last:0};usage.set(owner,state);}
  if(state.active||state.count>=10||(state.last&&now-state.last<30000))return null;
  state.active=true;state.count++;state.last=now;
  return ()=>{state!.active=false;};
}
