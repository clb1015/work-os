export default async function ViewportCheck({searchParams}:{searchParams:Promise<{width?:string}>}){
  const params=await searchParams;
  const requested=Number(params.width??375);
  const width=[320,375,430,768,1280].includes(requested)?requested:375;
  return <main style={{padding:12}}><h1>Work OS viewport verification</h1><p>The frame below renders the authenticated app at {width} CSS pixels.</p><form><label>Viewport width <select name="width" defaultValue={width}>{[320,375,430,768,1280].map(w=><option key={w} value={w}>{w}</option>)}</select></label> <button type="submit">Apply width</button></form><iframe title="Work OS viewport" src="/" width={width} height={850} style={{display:'block',marginTop:12,border:'1px solid #778899'}}/></main>;
}
