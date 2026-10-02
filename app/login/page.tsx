export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const message = params.error ? 'Email or password is incorrect.' : '';

  return (
    <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:'24px',background:'#f4f5f7'}}>
      <section style={{width:'100%',maxWidth:420,background:'#fff',border:'1px solid #dfe3e8',borderRadius:16,padding:28,boxShadow:'0 12px 40px rgba(15,23,42,.08)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
          <span style={{width:38,height:38,borderRadius:10,display:'grid',placeItems:'center',background:'#111827',color:'#fff',fontWeight:800}}>W</span>
          <div><strong style={{display:'block'}}>Work OS</strong><span style={{fontSize:13,color:'#64748b'}}>Private workspace</span></div>
        </div>
        <h1 style={{fontSize:28,margin:'0 0 8px'}}>Sign in</h1>
        <p style={{color:'#64748b',lineHeight:1.5,margin:'0 0 20px'}}>Use your Work OS email and password.</p>
        <form action="/auth/signin" method="post" style={{display:'grid',gap:12}}>
          <label style={{display:'grid',gap:6,fontSize:13,fontWeight:700}}>
            Email
            <input name="email" type="email" autoComplete="email" required style={{height:44,border:'1px solid #cbd5e1',borderRadius:8,padding:'0 12px',font:'inherit'}} />
          </label>
          <label style={{display:'grid',gap:6,fontSize:13,fontWeight:700}}>
            Password
            <input name="password" type="password" autoComplete="current-password" required style={{height:44,border:'1px solid #cbd5e1',borderRadius:8,padding:'0 12px',font:'inherit'}} />
          </label>
          <button type="submit" style={{height:44,border:0,borderRadius:8,background:'#111827',color:'#fff',fontWeight:700,cursor:'pointer'}}>
            Sign in
          </button>
        </form>
        {message && <p style={{margin:'16px 0 0',fontSize:13,lineHeight:1.5,color:'#b91c1c'}}>{message}</p>}
      </section>
    </main>
  );
}
