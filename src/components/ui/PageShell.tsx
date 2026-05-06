// ─── PageShell.tsx ─── Composant partagé par toutes les pages ────────────────
// Gère : loading skeleton, erreur, état vide — élimine le boilerplate répété

import { ReactNode } from 'react';

const F = "'Plus Jakarta Sans', sans-serif";
const VERT = '#0D2818';

export function Spinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:60 }}>
      <div style={{
        width:36, height:36, borderRadius:'50%',
        border:'3px solid #E5E7EB', borderTopColor:VERT,
        animation:'spin 0.7s linear infinite',
      }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export function ErrorBox({ msg, onRetry }: { msg: string; onRetry?: () => void }) {
  return (
    <div style={{ padding:'20px', background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:12, fontFamily:F, display:'flex', gap:12, alignItems:'flex-start' }}>
      <span style={{ fontSize:20 }}>⚠️</span>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#DC2626', marginBottom:4 }}>Erreur de chargement</div>
        <div style={{ fontSize:12, color:'#B91C1C' }}>{msg}</div>
        {onRetry && (
          <button onClick={onRetry} style={{ marginTop:10, padding:'6px 14px', background:'#DC2626', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontFamily:F, fontSize:12, fontWeight:600 }}>
            Réessayer
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ icon='📭', title='Aucune donnée', desc='' }: { icon?:string; title?:string; desc?:string }) {
  return (
    <div style={{ textAlign:'center', padding:'48px 24px', fontFamily:F }}>
      <div style={{ fontSize:48, marginBottom:12, opacity:.35 }}>{icon}</div>
      <div style={{ fontSize:16, fontWeight:600, color:'#374151', marginBottom:6 }}>{title}</div>
      {desc && <div style={{ fontSize:13, color:'#9CA3AF' }}>{desc}</div>}
    </div>
  );
}

export function Card({ children, style }: { children:ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E5E7EB', padding:'20px 24px', ...style }}>
      {children}
    </div>
  );
}

export function Badge({ label, color='gray' }: { label:string; color?:'green'|'amber'|'red'|'blue'|'gray' }) {
  const map = {
    green: { bg:'#D1FAE5', c:'#065F46' },
    amber: { bg:'#FEF3C7', c:'#92400E' },
    red:   { bg:'#FEE2E2', c:'#991B1B' },
    blue:  { bg:'#DBEAFE', c:'#1E40AF' },
    gray:  { bg:'#F3F4F6', c:'#374151' },
  };
  const s = map[color];
  return (
    <span style={{ display:'inline-block', background:s.bg, color:s.c, fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99, fontFamily:F, letterSpacing:'.04em', textTransform:'uppercase' as any }}>
      {label}
    </span>
  );
}

export function StatCard({ label, value, color='#0D2818', sub='' }: { label:string; value:string|number; color?:string; sub?:string }) {
  return (
    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #E5E7EB', padding:'16px 20px', flex:1, minWidth:140 }}>
      <div style={{ fontFamily:F, fontSize:11, fontWeight:600, color:'#6B7280', textTransform:'uppercase' as any, letterSpacing:'.06em', marginBottom:6 }}>{label}</div>
      <div style={{ fontFamily:F, fontSize:28, fontWeight:700, color, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontFamily:F, fontSize:11, color:'#9CA3AF', marginTop:4 }}>{sub}</div>}
    </div>
  );
}

export function SectionTitle({ children }: { children:ReactNode }) {
  return (
    <div style={{ fontFamily:F, fontSize:13, fontWeight:700, color:VERT, marginBottom:12, paddingBottom:8, borderBottom:'2px solid #E5E7EB' }}>
      {children}
    </div>
  );
}

export function Btn({ children, onClick, variant='primary', size='md', disabled=false, style }: {
  children:ReactNode; onClick?:()=>void; variant?:'primary'|'secondary'|'danger'|'ghost';
  size?:'sm'|'md'; disabled?:boolean; style?:React.CSSProperties;
}) {
  const vs = {
    primary:   { bg:VERT,      c:'#fff',    border:VERT },
    secondary: { bg:'#F3F4F6', c:'#374151', border:'#E5E7EB' },
    danger:    { bg:'#EF4444', c:'#fff',    border:'#EF4444' },
    ghost:     { bg:'transparent', c:VERT,  border:'#D1FAE5' },
  };
  const ss = { sm:{ fontSize:11, padding:'5px 12px' }, md:{ fontSize:13, padding:'9px 18px' } };
  const v = vs[variant]; const s = ss[size];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background:disabled?'#9CA3AF':v.bg, color:disabled?'#fff':v.c,
      border:`1.5px solid ${disabled?'#9CA3AF':v.border}`,
      borderRadius:10, cursor:disabled?'not-allowed':'pointer',
      fontFamily:F, fontWeight:600, transition:'all .15s', ...s, ...style,
    }}>
      {children}
    </button>
  );
}
