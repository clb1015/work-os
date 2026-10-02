export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const message = params.error ? 'Email or password is incorrect.' : '';

  return (
    <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:'24px',background:'radial-gradient(circle at 50% -10%, rgba(45,212,191,.09), transparent 30%), #071019',color:'#f2f6fa'}}>
      <section style={{width:'100%',maxWidth:420,background:'linear-gradient(180deg,#0f1b26,#0b1620)',border:'1px solid #263847',borderRadius:12,padding:30,boxShadow:'0 24px 60px rgba(0,0,0,.4)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:28}}>
          <span style={{width:38,height:38,border:'1px solid #dbe6ee',borderRadius:3,display:'grid',placeItems:'center',color:'#fff',fontWeight:800}}>W</span>
          <div><strong style={{display:'block',fontSize:16}}>Work OS</strong><span style={{fontSize:11,color:'#728397'}}>Executive workspace</span></div>
        </div>
        <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.12em',color:'#718395',marginBottom:8}}>Private access</div>
        <h1 style={{fontSize:29,letterSpacing:'-.03em',margin:'0 0 8px'}}>Sign in</h1>
        <p style={{color:'#91a0af',lineHeight:1.5,margin:'0 0 22px',fontSize:13}}>Use your Work OS email and password.</p>
        <form action="/auth/signin" method="post" style={{display:'grid',gap:14}}>
          <label style={{display:'grid',gap:7,fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'#718395'}}>
            Email
            <input name="email" type="email" autoComplete="email" required style={{height:44,border:'1px solid #263847',background:'#0a151f',color:'#f2f6fa',borderRadius:7,padding:'0 12px',font:'inherit',fontSize:13}} />
          </label>
          <label style={{display:'grid',gap:7,fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'#718395'}}>
            Password
            <input name="password" type="password" autoComplete="current-password" required style={{height:44,border:'1px solid #263847',background:'#0a151f',color:'#f2f6fa',borderRadius:7,padding:'0 12px',font:'inherit',fontSize:13}} />
          </label>
          <button type="submit" style={{height:44,border:'1px solid #2dd4bf',borderRadius:7,background:'linear-gradient(180deg,#1aaea2,#138c85)',color:'#fff',fontWeight:700,cursor:'pointer',marginTop:4}}>
            Sign in
          </button>
        </form>
        {message && <p style={{margin:'16px 0 0',fontSize:12,lineHeight:1.5,color:'#ef7a81'}}>{message}</p>}
      </section>
    </main>
  );
}
