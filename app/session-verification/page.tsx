'use client';
import {useState} from 'react';
export default function SessionVerification(){
  const [result,setResult]=useState('Ready for preview session-refresh acceptance.');
  const [busy,setBusy]=useState(false);
  async function verify(){
    setBusy(true);
    try{
      const beforeResponse=await fetch('/api/session-verification',{cache:'no-store'});
      if(!beforeResponse.ok)throw Error(`Session read: ${beforeResponse.status}`);
      const before=await beforeResponse.json();
      const prepared=await fetch('/api/session-verification',{method:'POST'});
      if(!prepared.ok)throw Error(`Preparation: ${prepared.status}`);
      const afterResponse=await fetch('/api/session-verification',{cache:'no-store'});
      const after=await afterResponse.json();
      const inventory=await fetch('/api/work-items',{cache:'no-store'});
      const data=await inventory.json();
      setResult(JSON.stringify({before,after,refreshVerified:afterResponse.ok&&after.issuedAt>before.issuedAt,inventoryStatus:inventory.status,itemCount:data.items?.length??data.length??null},null,2));
    }catch(error){setResult(String(error));}finally{setBusy(false);}
  }
  return <main style={{padding:30}}><h1>Preview session refresh acceptance</h1><p>Forces stale local session-expiry metadata, then verifies real Supabase token renewal and authenticated reads. Does not test natural JWT expiry.</p><button disabled={busy} onClick={verify}>Verify session refresh</button><pre style={{whiteSpace:'pre-wrap'}}>{result}</pre></main>;
}
