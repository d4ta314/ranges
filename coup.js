/* Onglet « Coup » : déroulé à la GTO Wizard. Hero choisit sa position, puis le coup se joue siège par siège
   (préflop UTG → BB, puis flop, turn, river). Recommandation + raison à chaque décision de hero. */
const Coup=(()=>{
const E=Engine; const SEATS=['UTG','UTG+1','LJ','HJ','CO','BTN','SB','BB']; const POSTFLOP=['SB','BB','UTG','UTG+1','LJ','HJ','CO','BTN'];
const S={}; let root;
const el=(tag,cls,html)=>{ const d=document.createElement(tag); if(cls) d.className=cls; if(html!=null) d.innerHTML=html; return d; };
const fmt=x=>(Math.round(x*10)/10).toString().replace('.',',');
const RV={}; 'AKQJT98765432'.split('').forEach((r,i)=>RV[r]=14-i);

/* ===== Sélecteur de cartes ===== */
function picker(n,label,onDone,initial){
  const w=el('div','pk'); const chosen=initial?initial.slice():[]; const used=new Set([...(S.hero||[]),...(S.board||[])]);
  const top=el('div','pk-top'); const chips=el('div','pk-chips'); const ok=el('button','cp-go',label);
  const grid=el('div','pk-grid');
  const draw=()=>{ chips.innerHTML=''; for(let i=0;i<n;i++){ const c=chosen[i]; const d=el('span','chip'+(c==null?' empty':((c%4===1||c%4===2)?' red':''))); d.textContent=c==null?'?':E.pretty(E.cardFromId(c)); if(c!=null){ d.onclick=()=>{ chosen.splice(i,1); draw(); }; } chips.appendChild(d); }
    ok.disabled=chosen.length!==n; grid.querySelectorAll('button').forEach(b=>{ const id=+b.dataset.id; b.disabled=used.has(id)||chosen.includes(id); }); };
  ['s','h','d','c'].forEach((s,si)=>{ 'AKQJT98765432'.split('').forEach(r=>{ const id=RV[r]*4+si; const b=el('button',(s==='h'||s==='d')?'red':'',r+'<small>'+{s:'♠',h:'♥',d:'♦',c:'♣'}[s]+'</small>'); b.dataset.id=id; b.onclick=()=>{ if(chosen.length<n){ chosen.push(id); draw(); } }; grid.appendChild(b); }); });
  ok.onclick=()=>onDone(chosen.slice());
  top.appendChild(chips); w.appendChild(top); w.appendChild(grid); w.appendChild(ok); draw(); return w;
}

/* ===== Ranges préflop ===== */
function vsKey(pos,opener){ const P=DATA.positions[pos]; const keys=Object.keys(P.threebet||{}); if(!keys.length) return null;
  const early=['UTG','UTG+1','LJ','HJ'].includes(opener);
  if(pos==='SB'||pos==='BB'){ if(opener==='SB') return keys.find(k=>k==='SB')||keys[0]; return keys.find(k=>k.startsWith(early?'Early':'Late'))||keys[0]; }
  if(keys.includes(opener)) return opener; if(opener==='HJ'&&keys.includes('HJ')) return 'HJ'; if(opener==='CO'&&keys.includes('CO')) return 'CO';
  return keys.find(k=>k.startsWith('LJ')||k.startsWith('UTG'))||keys[0]; }
const openCore=p=>DATA.positions[p].open.core, openOpt=p=>DATA.positions[p].open.opt||[];
function vsOpen(pos,opener){ const k=vsKey(pos,opener); if(!k) return null; return {key:k,...DATA.positions[pos].threebet[k]}; }
function callVs3bet(openerPos){ return openCore(openerPos).filter(h=>{ if(['AA','KK','AKs'].includes(h)) return false; if(h.length===2) return RV[h[0]]>=5; const hi=RV[h[0]],lo=RV[h[1]],s=h[2]==='s'; if(s) return hi===14||(hi>=10&&lo>=9)||(hi-lo<=1&&lo>=6)||(hi>=13&&lo>=9); return (hi===14&&lo>=12)||(hi===13&&lo>=12); }); }
const FOURBET=['AA','KK','AKs','AKo'];
function rangeOf(seat){ // range d'un siège encore dans le coup, d'après ses actions préflop
  const a=S.pre[seat]; if(!a||a.last==='fold') return null;
  if(a.role==='opener'&&a.last==='raise') return openCore(seat);
  if(a.role==='opener'&&a.last==='call') return callVs3bet(seat); // a payé un 3bet
  if(a.role==='3bet') return vsOpen(seat,S.opener)?[...vsOpen(seat,S.opener).value,...vsOpen(seat,S.opener).bluff]:null;
  if(a.role==='caller') return vsOpen(seat,S.opener)?vsOpen(seat,S.opener).call:null;
  if(a.role==='4bet') return FOURBET;
  if(a.role==='call4') return FOURBET.concat(['QQ','JJ','AQs']);
  return openCore(seat); }

/* ===== État préflop ===== */
function startHand(){ S.pre={}; SEATS.forEach(s=>S.pre[s]={contrib:s==='SB'?0.5:s==='BB'?1:0,last:null,role:null,acted:false}); S.pot=(S.ante?1:0)+1.5; S.curBet=1; S.opener=null; S.raises=0; S.lastRaiser=null; S.order=SEATS.slice(); S.ptr=0; S.stage='preflop'; S.log=[]; S.reco=null; S.done=false; advance(); }
function alive(){ return SEATS.filter(s=>S.pre[s].last!=='fold'); }
function needsAction(s){ const a=S.pre[s]; return a.last!=='fold'&&(!a.acted||a.contrib<S.curBet); }
function advance(){ // place ptr sur le prochain siège qui doit parler ; termine le préflop si personne
  for(let i=0;i<8;i++){ const s=S.order[S.ptr]; if(needsAction(s)){ if(s===S.heroPos) computePreReco(); return; } S.ptr=(S.ptr+1)%8; }
  endPreflop(); }
function seatAct(seat,action,amount){ const a=S.pre[seat]; a.acted=true; a.last=action;
  if(action==='fold'){ S.log.push({who:seat,txt:'fold'}); }
  else if(action==='call'){ const add=S.curBet-a.contrib; a.contrib=S.curBet; S.pot+=add; if(a.role==='3bet'&&S.raises>=3) a.role='call4'; else if(!a.role) a.role='caller'; S.log.push({who:seat,txt:'paie '+fmt(S.curBet)}); }
  else if(action==='raise'){ const to=amount; const add=to-a.contrib; a.contrib=to; S.pot+=add; S.raises++; S.curBet=to; S.lastRaiser=seat; SEATS.forEach(x=>{ if(x!==seat) S.pre[x].acted=S.pre[x].last==='fold'; });
    if(S.raises===1){ S.opener=seat; a.role='opener'; S.log.push({who:seat,txt:'ouvre à '+fmt(to)}); } else if(S.raises===2){ a.role='3bet'; S.log.push({who:seat,txt:'3bet à '+fmt(to)}); } else { a.role='4bet'; S.log.push({who:seat,txt:'4bet à '+fmt(to)}); } }
  S.ptr=(SEATS.indexOf(seat)+1)%8; S.reco=null; advance(); }
function raiseSize(seat){ if(S.raises===0) return S.open; const ip=SEATS.indexOf(seat)<6&&SEATS.indexOf(seat)>SEATS.indexOf(S.lastRaiser); const mult=S.raises===1?(ip?3:3.5):2.3; return Math.min(S.eff,Math.round(S.curBet*mult*2)/2); }
function endPreflop(){ const al=alive(); if(!S.raises){ S.done=true; S.endTxt=SEATS.some(x=>S.pre[x].last==='call')?'Pot limpé : le moteur ne gère pas encore les pots sans relance.':'Personne n’a relancé : la BB remporte les blindes.'; return; }
  if(!al.includes(S.heroPos)){ S.done=true; S.endTxt='Tu as passé. Le coup continue sans toi.'; return; }
  const opps=al.filter(s=>s!==S.heroPos);
  if(opps.length===0){ S.done=true; S.endTxt='Tout le monde a passé : tu remportes '+fmt(S.pot)+' bb.'; return; }
  if(opps.length>1){ S.stage='pickVill'; S.opps=opps; return; }
  setupPostflop(opps[0]); }
function setupPostflop(vill){ S.villPos=vill; const hr=rangeOf(S.heroPos), vr=rangeOf(vill); if(!hr||!vr){ S.done=true; S.endTxt='Pas de range dans le PDF pour ce scénario ('+S.heroPos+' '+S.pre[S.heroPos].role+' vs '+vill+' '+S.pre[vill].role+').'; return; }
  S.heroRange=E.buildRange(hr); S.villRange=E.buildRange(vr); S.pfr=S.lastRaiser===S.heroPos?'hero':'vill'; S.tb=S.raises>=2?'yes':'none';
  S.eff=S.eff-S.pre[S.heroPos].contrib; S.heroIP=POSTFLOP.indexOf(S.heroPos)>POSTFLOP.indexOf(vill); S.board=[]; S.street='flop'; S.stage='pickFlop'; S.rangeNote=S.heroPos+' ('+(hr.length)+' mains) contre '+vill+' ('+vr.length+' mains)'+(S.pre[S.heroPos].role==='opener'&&S.pre[S.heroPos].last==='call'||S.pre[vill].role==='opener'&&S.pre[vill].last==='call'?' · range « paie un 3bet » approximée':''); }

/* ===== Recommandation préflop ===== */
function computePreReco(){ const h=E.handLabel(E.cardFromId(S.hero[0]),E.cardFromId(S.hero[1])); const p=S.heroPos; let action,reason,rules=[],amount=0;
  const sc=typeof fscore==='function'?fscore(h):null; const thr=typeof THR!=='undefined'?THR[p]:null;
  if(S.raises===0){ // personne n'a ouvert
    if(p==='BB'){ action='check'; reason='Tout le monde a passé : tu prends les blindes.'; }
    else if(p==='SB'){ const P=DATA.positions.SB; if(P.open.core.includes(h)){ action='raise'; amount=raiseSize(p); reason='Blinde contre blinde : '+h+' est dans ta range de relance SB (tableau BVB Late Tight).'; } else if((P.limp||[]).includes(h)){ action='call'; amount=1; reason='Blinde contre blinde : '+h+' est dans ta range de limp SB (bleu du tableau BVB Late Tight).'; } else { action='fold'; reason=h+' n’est ni dans la range de relance ni dans la range de limp SB.'; } }
    else { const core=openCore(p).includes(h), opt=openOpt(p).includes(h); const ex=typeof explain==='function'?explain(h,p,'core'):'';
      if(core){ action='raise'; amount=raiseSize(p); reason=h+' est dans ta range d’open en '+p+'. '+ex+(sc!=null?' Formule : '+sc+' ≥ '+thr+'.':''); }
      else if(opt){ action='fold'; reason=h+' ne s’ouvre en '+p+' qu’entre 30 et 50bb de tapis'+(S.eff>=30&&S.eff<=50?' : avec '+fmt(S.eff)+' bb tu peux ouvrir.':' : avec '+fmt(S.eff)+' bb, fold.'); if(S.eff>=30&&S.eff<=50){ action='raise'; amount=raiseSize(p); } }
      else { action='fold'; reason=h+' n’est pas dans ta range d’open en '+p+'. '+ex+(sc!=null?' Formule : '+sc+' < '+thr+'.':''); } } }
  else if(S.raises===1&&S.opener!==p){ // face à une ouverture
    const t=vsOpen(p,S.opener); const callers=SEATS.filter(s=>S.pre[s].role==='caller'&&S.pre[s].last==='call');
    if(!t){ action='fold'; reason='Pas de tableau dans le PDF pour '+p+' face à une ouverture de '+S.opener+'.'; }
    else { const approx=t.key.includes('approx')?' (approximation : tableau HJ vs LJ)':''; const sq=callers.length?' Il y a déjà un joueur qui a payé : le PDF ne couvre pas le squeeze, on applique la range face à l’ouvreur.':'';
      if(t.value.includes(h)){ action='raise'; amount=raiseSize(p); reason=h+' est dans ta range de 3bet value face à '+S.opener+approx+'.'+sq; }
      else if(t.bluff.includes(h)){ action='raise'; amount=raiseSize(p); reason=h+' est dans ta range de 3bet bluff face à '+S.opener+approx+' : la marche juste sous ton call (règle de l’escalier).'+sq; }
      else if(t.call.includes(h)){ action='call'; amount=S.curBet; reason=h+' est dans ta range de call face à '+S.opener+approx+'.'+sq; }
      else { action='fold'; reason=h+' n’est ni dans ta range de 3bet ni dans ta range de call face à '+S.opener+approx+'.'; } } }
  else if(S.raises>=2&&S.lastRaiser!==p){ // face à un 3bet ou 4bet
    const my=S.pre[p].role;
    if(FOURBET.includes(h)){ action='raise'; amount=raiseSize(p); reason=h+' : tu relances pour la valeur (AA, KK, AK). Approximation : le PDF n’a pas de range de 4bet.'; }
    else if(my==='opener'&&S.raises===2&&callVs3bet(p).includes(h)){ action='call'; amount=S.curBet; reason=h+' fait partie du haut de ta range d’open : tu paies le 3bet. Approximation : le PDF n’a pas de range de défense contre 3bet.'; }
    else if(my==='3bet'&&S.raises===3&&['QQ','JJ','AQs'].includes(h)){ action='call'; amount=S.curBet; reason=h+' paie un 4bet avec un tapis de '+fmt(S.eff)+' bb. Approximation.'; }
    else { action='fold'; reason=h+' ne continue pas face à une '+(S.raises===2?'3bet':'4bet')+'. Approximation : seules les mains premium et le haut de la range d’open continuent.'; } }
  else { action='check'; reason='Rien à faire.'; }
  if(amount>=S.eff&&action==='raise'){ action='all-in'; amount=S.eff; }
  S.reco={action,amount,reason,rules,toCall:Math.max(0,S.curBet-S.pre[p].contrib)}; }

/* ===== Postflop (moteur) ===== */
function newStreet(){ S.streetBets={hero:0,vill:0}; S.lastBetFrac=0; S.turnOf=S.heroIP?'vill':'hero'; S.heroActed=false; S.villActed=false; S.reco=null; if(S.turnOf==='hero') computeReco(); }
function profileCtx(){ return {street:S.street,aggressor:S.pfr==='vill',profile:S.profile,tex:E.texture(S.board.map(E.cardFromId))}; }
function potBeforeBet(){ return S.pot-S.streetBets.hero-S.streetBets.vill; }
function computeReco(){ const toCall=Math.max(0,S.streetBets.vill-S.streetBets.hero);
  const st={street:S.street,hero:S.hero,board:S.board,heroRange:S.heroRange,villRange:S.villRange,pot:toCall>0?S.pot-toCall:S.pot,eff:S.eff-S.streetBets.hero,heroIP:S.heroIP,heroPFR:S.pfr==='hero',threebet:S.tb!=='none',toCall,lastBet:S.lastBetFrac,profile:S.profile};
  S.reco=E.decide(st); S.reco.toCall=toCall; }
function villAct(action,frac,amount){ const ctx=profileCtx(); ctx.size=frac||S.lastBetFrac; S.villActed=true;
  if(action==='fold'){ S.log.push({who:S.villPos,txt:'fold'}); S.done=true; S.endTxt='Il se couche, le pot est à toi ('+fmt(S.pot)+' bb).'; return; }
  if(action==='check'){ S.log.push({who:S.villPos,txt:'check'}); S.villRange=E.narrow(S.villRange,S.board,'check',ctx); if(!S.heroActed){ S.turnOf='hero'; computeReco(); } else endStreet(); return; }
  if(action==='call'){ const add=S.streetBets.hero-S.streetBets.vill; S.streetBets.vill+=add; S.pot+=add; S.log.push({who:S.villPos,txt:'paie '+fmt(add)}); S.villRange=E.narrow(S.villRange,S.board,'call',ctx); endStreet(); return; }
  let amt=amount!=null?amount:Math.round(frac*S.pot*10)/10; const total=Math.min(S.eff,action==='raise'?S.streetBets.hero+amt:amt); amt=total-(action==='raise'?S.streetBets.hero:0); const add=total-S.streetBets.vill; S.streetBets.vill=total; S.pot+=add; S.lastBetFrac=amt/Math.max(1,S.pot-add);
  S.log.push({who:S.villPos,txt:(action==='raise'?'relance à ':'mise ')+fmt(total)}); S.villRange=E.narrow(S.villRange,S.board,action==='raise'?'raise':'bet',ctx); S.turnOf='hero'; computeReco(); }
function heroAct(action,amount){ const ctx=profileCtx(); ctx.aggressor=S.pfr==='hero'; S.heroActed=true;
  if(action==='fold'){ S.log.push({who:'moi',txt:'fold'}); S.done=true; S.endTxt='Tu te couches. Il remporte '+fmt(S.pot)+' bb.'; return; }
  if(action==='check'){ S.log.push({who:'moi',txt:'check'}); S.heroRange=E.narrow(S.heroRange,S.board,'check',ctx); if(!S.villActed){ S.turnOf='vill'; S.reco=null; } else endStreet(); return; }
  if(action==='call'){ const add=S.streetBets.vill-S.streetBets.hero; S.streetBets.hero+=add; S.pot+=add; S.log.push({who:'moi',txt:'paie '+fmt(add)}); S.heroRange=E.narrow(S.heroRange,S.board,'call',ctx); endStreet(); return; }
  const isR=S.streetBets.vill>0; const total=Math.min(S.eff,isR?S.streetBets.hero+amount:amount); const amt=total-(isR?S.streetBets.hero:0); const add=total-S.streetBets.hero;
  S.streetBets.hero=total; S.pot+=add; S.lastBetFrac=amt/Math.max(1,S.pot-add); S.log.push({who:'moi',txt:(isR?'relance à ':'mise ')+fmt(total)}); S.heroRange=E.narrow(S.heroRange,S.board,isR?'raise':'bet',ctx); S.turnOf='vill'; S.reco=null; }
function endStreet(){ const spent=Math.max(S.streetBets.hero,S.streetBets.vill); S.eff-=spent;
  if(S.eff<=0.01){ S.done=true; S.endTxt='Tapis engagés : on retourne les cartes. '; showdownNote(); return; }
  if(S.street==='river'){ S.done=true; S.endTxt='Abattage. '; showdownNote(); return; }
  S.stage=S.street==='flop'?'pickTurn':'pickRiver'; S.reco=null; }
function showdownNote(){ const share=E.showdownShare(S.hero,S.board,E.removeConflicts(S.villRange,[...S.hero,...S.board])); if(S.board.length===5&&share!=null) S.endTxt+='Ta main bat '+Math.round(share*100)+' % de ce qu’il peut encore avoir.'; }

/* ===== Rendu ===== */
function render(){ root.innerHTML=''; const st=S.stage;
  if(st==='setup') return renderSetup(); if(st==='pickHand') return renderPick(2,'Valider ma main',ids=>{ S.hero=ids; startHand(); render(); },'Mes deux cartes');
  if(st==='pickFlop') return renderPick(3,'Analyser le flop',ids=>{ S.board=ids; S.stage='play'; newStreet(); render(); },'Le flop');
  if(st==='pickTurn') return renderPick(1,'Analyser la turn',ids=>{ S.board.push(ids[0]); S.street='turn'; S.stage='play'; newStreet(); render(); },'La turn');
  if(st==='pickRiver') return renderPick(1,'Analyser la river',ids=>{ S.board.push(ids[0]); S.street='river'; S.stage='play'; newStreet(); render(); },'La river');
  if(st==='preflop') return renderPreflop(); if(st==='pickVill') return renderPickVill(); return renderPlay(); }
function renderSetup(){ S.heroPos=S.heroPos||'CO'; S.eff=S.eff0||40; S.open=S.open||2.2; if(S.ante==null) S.ante=true; S.profile=S.profile||{};
  const f=el('div','cp-form');
  const pos=el('div','cp-seats'); pos.innerHTML='<span>Ma position</span>'; SEATS.forEach(s=>{ const b=el('button',null,s); b.setAttribute('aria-pressed',s===S.heroPos); b.onclick=()=>{ S.heroPos=s; pos.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x.textContent===s)); }; pos.appendChild(b); }); f.appendChild(pos);
  const n=(id,val,label,step)=>{ const w=el('label','fld'); w.innerHTML='<span>'+label+'</span>'; const i=el('input'); i.type='number'; i.id=id; i.value=val; i.step=step||1; i.inputMode='decimal'; w.appendChild(i); return w; };
  f.appendChild(n('cpEff',S.eff,'Tapis effectif (bb)')); f.appendChild(n('cpOpen',S.open,'Taille de l’open (bb)',0.1));
  const a=el('label','fld chk'); a.innerHTML='<input type="checkbox" id="cpAnte" '+(S.ante?'checked':'')+'><span>Ante BB (tournoi)</span>'; f.appendChild(a);
  const pr=el('div','cp-prof'); pr.innerHTML='<span>Profil de l’adversaire principal</span>';
  [['foldy','Se couche trop'],['station','Paie trop'],['aggro','Mise et relance trop']].forEach(([k,t])=>{ const b=el('button',null,t); b.type='button'; b.setAttribute('aria-pressed',!!S.profile[k]); b.onclick=()=>{ S.profile[k]=!S.profile[k]; b.setAttribute('aria-pressed',!!S.profile[k]); }; pr.appendChild(b); }); f.appendChild(pr);
  const go=el('button','cp-go','Choisir mes cartes'); go.onclick=()=>{ S.eff0=+document.getElementById('cpEff').value; S.eff=S.eff0; S.open=+document.getElementById('cpOpen').value; S.ante=document.getElementById('cpAnte').checked; S.hero=[]; S.board=[]; S.stage='pickHand'; render(); }; f.appendChild(go); root.appendChild(f); }
function renderPick(n,label,cb,title){ root.appendChild(headBox()); const f=el('div','cp-form'); f.appendChild(el('div','cp-title',title)); f.appendChild(picker(n,label,cb)); root.appendChild(f); root.appendChild(restartBtn()); }
function headBox(){ const h=el('div','cp-head'); const hero=(S.hero||[]).map(E.cardFromId), b=(S.board||[]).map(E.cardFromId);
  h.innerHTML='<div class="cp-cards"><span class="lbl">Moi · '+S.heroPos+'</span>'+hero.map(cardChip).join('')+(b.length?'<span class="lbl">Board</span>'+b.map(cardChip).join(''):'')+'</div>'+
    '<div class="cp-pot">Pot <b>'+fmt(S.pot||0)+'</b> bb · tapis <b>'+fmt(S.stage==='preflop'?S.eff-S.pre[S.heroPos].contrib:(S.eff||0)-Math.max((S.streetBets||{hero:0}).hero,(S.streetBets||{vill:0}).vill))+'</b> bb'+(S.villPos?' · vs '+S.villPos+(S.heroIP?' (IP)':' (OOP)'):'')+(S.street&&S.stage==='play'?' · '+S.street:'')+'</div>'+
    (S.log&&S.log.length?'<div class="cp-log">'+S.log.map(l=>'<span class="'+(l.who==='moi'?'hero':'')+'">'+l.who+' '+l.txt+'</span>').join(' · ')+'</div>':'');
  return h; }
function renderPreflop(){ root.appendChild(headBox());
  if(S.done){ root.appendChild(el('div','cp-end',S.endTxt)); root.appendChild(restartBtn()); return; }
  const seat=S.order[S.ptr]; const a=S.pre[seat]; const toCall=S.curBet-a.contrib;
  const seats=el('div','cp-seatrow'); SEATS.forEach(s=>{ const d=el('span','seat'+(S.pre[s].last==='fold'?' off':'')+(s===seat?' now':'')+(s===S.heroPos?' me':''),s); seats.appendChild(d); }); root.appendChild(seats);
  if(seat===S.heroPos){ const r=S.reco; const card=el('div','cp-reco');
    const actTxt=r.action==='raise'?(S.raises===0?'OPEN à ':S.raises===1?'3BET à ':'4BET à ')+fmt(r.amount)+' bb':r.action==='all-in'?'ALL-IN ('+fmt(r.amount)+' bb)':r.action==='call'?(S.raises===0?'LIMP':'PAIE '+fmt(r.toCall)+' bb'):r.action==='check'?'CHECK':'FOLD';
    card.innerHTML='<div class="cp-act '+r.action+'">'+actTxt+'</div><div class="cp-why">'+r.reason+'</div>'; root.appendChild(card);
    const acts=el('div','cp-acts'); acts.appendChild(el('span','lbl','Ce que je fais :'));
    const add=(t,fn,primary)=>{ const b=el('button',primary?'primary':'',t); b.onclick=()=>{ fn(); render(); }; acts.appendChild(b); };
    add('Fold',()=>seatAct(seat,'fold'),r.action==='fold');
    if(S.raises>0) add('Paie '+fmt(toCall),()=>seatAct(seat,'call'),r.action==='call'); else if(seat==='SB') add('Limp',()=>seatAct(seat,'call'),r.action==='call');
    if(seat==='BB'&&toCall===0) add('Check',()=>seatAct(seat,'call'),r.action==='check');
    const rs=raiseSize(seat); add((S.raises===0?'Open ':S.raises===1?'3bet ':'4bet ')+fmt(rs),()=>seatAct(seat,'raise',rs),r.action==='raise'); add('All-in '+fmt(S.eff),()=>seatAct(seat,'raise',S.eff),r.action==='all-in');
    root.appendChild(acts); }
  else { const acts=el('div','cp-acts'); acts.appendChild(el('span','lbl',seat+' fait :'));
    const add=(t,fn)=>{ const b=el('button','',t); b.onclick=()=>{ fn(); render(); }; acts.appendChild(b); };
    add('Fold',()=>seatAct(seat,'fold')); if(S.raises>0) add('Paie '+fmt(toCall),()=>seatAct(seat,'call')); else if(seat==='SB') add('Limp',()=>seatAct(seat,'call')); if(seat==='BB'&&toCall===0) add('Check',()=>seatAct(seat,'call'));
    const rs=raiseSize(seat); add((S.raises===0?'Open ':S.raises===1?'3bet ':'4bet ')+fmt(rs),()=>seatAct(seat,'raise',rs)); add('All-in',()=>seatAct(seat,'raise',S.eff)); root.appendChild(acts); }
  root.appendChild(restartBtn()); }
function renderPickVill(){ root.appendChild(headBox()); const f=el('div','cp-form'); f.appendChild(el('p','cp-note','Plusieurs adversaires vont au flop. Le moteur n’en suit qu’un : choisis lequel (de préférence le relanceur). Les recommandations seront moins fiables en multiway : moins de bluffs, plus de valeur.'));
  S.opps.forEach(o=>{ const b=el('button','cp-go',o+' ('+S.pre[o].role+')'); b.onclick=()=>{ setupPostflop(o); render(); }; f.appendChild(b); }); root.appendChild(f); root.appendChild(restartBtn()); }
function renderPlay(){ root.appendChild(headBox());
  if(S.done){ root.appendChild(el('div','cp-end',S.endTxt)); root.appendChild(restartBtn()); return; }
  if(S.turnOf==='vill'){ root.appendChild(villButtons()); root.appendChild(restartBtn()); return; }
  const r=S.reco; const d=r.data; const card=el('div','cp-reco');
  const actTxt=r.action==='bet'?'MISE '+fmt(r.amount)+' bb':r.action==='raise'?'RELANCE à '+fmt(r.amount)+' bb':r.action==='all-in'?'ALL-IN ('+fmt(r.amount)+' bb)':r.action==='call'?'PAIE '+fmt(r.toCall)+' bb':r.action==='check'?'CHECK':'FOLD';
  card.innerHTML='<div class="cp-act '+r.action+'">'+actTxt+'</div><div class="cp-why">'+r.reason+'</div><div class="cp-meta">'+d.cl.name+(d.cl.outs?' · '+d.cl.outs+' outs':'')+' · board '+d.tex.kind+' · équité main '+Math.round(d.eqH*100)+' % · range '+Math.round(d.eqR*100)+' % · SPR '+fmt(d.spr)+' · confiance '+r.conf+' · '+r.rules.join(' ')+(S.rangeNote?'<br>'+S.rangeNote:'')+'</div>';
  root.appendChild(card);
  const acts=el('div','cp-acts'); acts.appendChild(el('span','lbl','Ce que je fais :'));
  const toCall=r.toCall; const addBtn=(t,fn,primary)=>{ const btn=el('button',primary?'primary':'',t); btn.onclick=()=>{ fn(); render(); }; acts.appendChild(btn); };
  if(toCall>0){ addBtn('Fold',()=>heroAct('fold'),r.action==='fold'); addBtn('Paie '+fmt(toCall),()=>heroAct('call'),r.action==='call');
    const rs=r.action==='raise'||r.action==='all-in'?r.amount:Math.min(S.eff-S.streetBets.hero,Math.round((S.pot+toCall*2)*10)/10); addBtn('Relance à '+fmt(S.streetBets.hero+rs),()=>heroAct('raise',rs),r.action==='raise'||r.action==='all-in'); }
  else { addBtn('Check',()=>heroAct('check'),r.action==='check'); [0.33,0.5,0.66,1].forEach(f=>{ const a=Math.min(S.eff,Math.round(f*S.pot*10)/10); addBtn('Mise '+fmt(a)+' ('+Math.round(f*100)+'%)',()=>heroAct('bet',a),(r.action==='bet'&&Math.abs(a-r.amount)<0.05)); }); addBtn('All-in '+fmt(S.eff),()=>heroAct('bet',S.eff),r.action==='all-in'); }
  root.appendChild(acts); root.appendChild(restartBtn()); }
function villButtons(){ const w=el('div','cp-acts'); w.appendChild(el('span','lbl',S.villPos+' fait :'));
  const add=(t,fn)=>{ const b=el('button','',t); b.onclick=()=>{ fn(); render(); }; w.appendChild(b); };
  if(S.streetBets.hero>S.streetBets.vill){ add('Fold',()=>villAct('fold')); add('Paie',()=>villAct('call')); [2.5,3.5].forEach(m=>{ const amt=Math.min(S.eff,Math.round(S.streetBets.hero*m*10)/10); add('Relance à '+fmt(amt),()=>villAct('raise',null,amt-S.streetBets.hero)); }); add('All-in',()=>villAct('raise',null,S.eff-S.streetBets.hero)); }
  else { add('Check',()=>villAct('check')); [0.33,0.5,0.66,1].forEach(f=>add('Mise '+Math.round(f*100)+'% ('+fmt(Math.min(S.eff,Math.round(f*S.pot*10)/10))+')',()=>villAct('bet',f))); add('All-in',()=>villAct('bet',null,S.eff)); }
  return w; }
function restartBtn(){ const b=el('button','cp-back','↺ Nouveau coup'); b.onclick=()=>{ S.stage='setup'; S.villPos=null; S.log=[]; S.pot=0; render(); }; return b; }
function cardChip(c){ const s=E.SSTR[c.s]; return '<span class="chip '+(s==='h'||s==='d'?'red':'')+'">'+E.pretty(c)+'</span>'; }
function init(container){ root=container; S.stage='setup'; render(); }
return {init,render,S};
})();
