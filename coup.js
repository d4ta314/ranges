/* Onglet « Coup » : suivi d'une main contre un adversaire, recommandation à chaque décision. */
const Coup=(()=>{
const E=Engine; const POS8=['SB','BB','UTG','UTG+1','LJ','HJ','CO','BTN']; // ordre de parole postflop
const S={}; let root;
const el=(tag,cls,html)=>{ const d=document.createElement(tag); if(cls) d.className=cls; if(html!=null) d.innerHTML=html; return d; };
const fmt=x=>(Math.round(x*10)/10).toString().replace('.',',');

/* ----- Ranges préflop selon le scénario ----- */
function vsKey(pos,opener){ // clé du tableau "threebet" de pos face à opener
  const P=DATA.positions[pos]; const keys=Object.keys(P.threebet||{}); if(!keys.length) return null;
  const early=['UTG','UTG+1','LJ','HJ'].includes(opener);
  if(pos==='SB'||pos==='BB'){ if(opener==='SB') return keys.find(k=>k==='SB')||keys[0]; return keys.find(k=>k.startsWith(early?'Early':'Late'))||keys[0]; }
  if(keys.includes(opener)) return opener;
  if(opener==='HJ'&&keys.includes('HJ')) return 'HJ'; if(opener==='CO'&&keys.includes('CO')) return 'CO';
  return keys.find(k=>k.startsWith('LJ')||k.startsWith('UTG'))||keys[0];
}
function openRange(pos){ const P=DATA.positions[pos]; return P.open.core.length?P.open.core:null; }
function callRange(pos,opener){ const k=vsKey(pos,opener); if(!k) return null; return DATA.positions[pos].threebet[k].call; }
function threebetRange(pos,opener){ const k=vsKey(pos,opener); if(!k) return null; const t=DATA.positions[pos].threebet[k]; return [...t.value,...t.bluff]; }
function callVs3betRange(openerPos){ // approximation : l'ouvreur paie un 3bet avec le haut de sa range, sans AA/KK/AKs (4bet)
  const o=openRange(openerPos)||[]; const RV={}; 'AKQJT98765432'.split('').forEach((r,i)=>RV[r]=14-i);
  return o.filter(h=>{ if(['AA','KK','AKs'].includes(h)) return false; if(h.length===2) return RV[h[0]]>=5;
    const hi=RV[h[0]],lo=RV[h[1]],s=h[2]==='s'; if(s){ return hi===14||(hi>=10&&lo>=9)||(hi-lo<=1&&lo>=6)||(hi>=13&&lo>=9); } return (hi===14&&lo>=12)||(hi===13&&lo>=12); });
}
function scenarioRanges(){ const {heroPos,villPos,pfr,tb}=S;
  const opener=pfr==='hero'?heroPos:villPos, caller=pfr==='hero'?villPos:heroPos;
  let openerR, callerR, note='';
  if(tb==='none'){ openerR=openRange(opener); callerR=callRange(caller,opener); note='Ranges : '+opener+' ouvre ('+(openerR||[]).length+' mains), '+caller+' paie ('+(callerR||[]).length+' mains).'; }
  else { // le "caller" a 3bet, l'ouvreur a payé
    openerR=callVs3betRange(opener); callerR=threebetRange(caller,opener); note='Pot 3bet : '+caller+' 3bet ('+(callerR||[]).length+' mains), '+opener+' paie (approximation : haut de sa range d’open sans AA, KK, AKs).'; }
  const heroR=pfr==='hero'?openerR:callerR, villR=pfr==='hero'?callerR:openerR;
  return {heroR,villR,note};
}
function preflopPot(){ const {heroPos,villPos,pfr,tb,open,three,ante}=S; const blinds=p=>p==='SB'?0.5:p==='BB'?1:0;
  const inHand=[heroPos,villPos]; let dead=0; if(!inHand.includes('SB')) dead+=0.5; if(!inHand.includes('BB')) dead+=1; if(ante) dead+=1;
  const per=tb==='none'?open:three; return {pot:2*per+dead, invested:per}; }

/* ----- Rendu ----- */
function render(){ root.innerHTML=''; if(S.stage==='setup') renderSetup(); else if(S.stage==='cards') renderCards(); else renderPlay(); }
function sel(id,opts,val,label){ const w=el('label','fld'); w.innerHTML='<span>'+label+'</span>'; const s=el('select'); s.id=id; opts.forEach(o=>{ const [v,t]=Array.isArray(o)?o:[o,o]; const op=new Option(t,v); s.add(op); }); s.value=val; w.appendChild(s); return w; }
function num(id,val,label,step){ const w=el('label','fld'); w.innerHTML='<span>'+label+'</span>'; const i=el('input'); i.type='number'; i.id=id; i.value=val; i.step=step||1; i.inputMode='decimal'; w.appendChild(i); return w; }
function renderSetup(){
  S.heroPos=S.heroPos||'CO'; S.villPos=S.villPos||'BB'; S.pfr=S.pfr||'hero'; S.tb=S.tb||'none'; S.eff=S.eff||40; S.open=S.open||2.2; S.three=S.three||7; if(S.ante==null) S.ante=true; S.profile=S.profile||{};
  const f=el('div','cp-form');
  f.appendChild(sel('cpHero',POS8,S.heroPos,'Ma position')); f.appendChild(sel('cpVill',POS8,S.villPos,'Sa position'));
  f.appendChild(sel('cpPfr',[['hero','Moi'],['vill','Lui']],S.pfr,'Qui a ouvert'));
  f.appendChild(sel('cpTb',[['none','Pas de 3bet, il a payé / j’ai payé'],['yes','L’autre a 3bet, l’ouvreur a payé']],S.tb,'3bet préflop'));
  f.appendChild(num('cpEff',S.eff,'Tapis effectif (bb)')); f.appendChild(num('cpOpen',S.open,'Taille de l’open (bb)',0.1)); f.appendChild(num('cpThree',S.three,'Taille du 3bet (bb)',0.5));
  const a=el('label','fld chk'); a.innerHTML='<input type="checkbox" id="cpAnte" '+(S.ante?'checked':'')+'><span>Ante BB (tournoi)</span>'; f.appendChild(a);
  const pr=el('div','cp-prof'); pr.innerHTML='<span>Profil adverse</span>';
  [['foldy','Se couche trop'],['station','Paie trop'],['aggro','Mise et relance trop']].forEach(([k,t])=>{ const b=el('button',null,t); b.type='button'; b.setAttribute('aria-pressed',!!S.profile[k]); b.onclick=()=>{ S.profile[k]=!S.profile[k]; b.setAttribute('aria-pressed',!!S.profile[k]); }; pr.appendChild(b); });
  f.appendChild(pr);
  const go=el('button','cp-go','Continuer vers le flop'); go.onclick=()=>{ S.heroPos=document.getElementById('cpHero').value; S.villPos=document.getElementById('cpVill').value; S.pfr=document.getElementById('cpPfr').value; S.tb=document.getElementById('cpTb').value; S.eff=+document.getElementById('cpEff').value; S.open=+document.getElementById('cpOpen').value; S.three=+document.getElementById('cpThree').value; S.ante=document.getElementById('cpAnte').checked;
    if(S.heroPos===S.villPos){ alertBox('Choisis deux positions différentes.'); return; }
    const opener=S.pfr==='hero'?S.heroPos:S.villPos; if(opener==='BB'){ alertBox('La BB ne peut pas ouvrir : si tout le monde a passé, le coup est fini. Choisis un autre ouvreur.'); return; }
    const {heroR,villR,note}=scenarioRanges(); if(!heroR||!villR){ alertBox('Pas de range dans le PDF pour ce scénario ('+note+').'); return; }
    S.stage='cards'; S.err=''; render(); };
  f.appendChild(go); root.appendChild(f);
}
function alertBox(msg){ S.err=msg; const e=root.querySelector('.cp-err')||root.appendChild(el('div','cp-err')); e.textContent=msg; }
function renderCards(){
  const {note}=scenarioRanges(); const f=el('div','cp-form');
  f.appendChild(el('p','cp-note',note+' Cartes : A K Q J T 9…2 suivi de s (pique), h (cœur), d (carreau), c (trèfle).'));
  const h=el('label','fld'); h.innerHTML='<span>Mes cartes</span><input id="cpHand" placeholder="As Kh" value="'+(S.handTxt||'')+'" autocapitalize="characters" autocomplete="off">'; f.appendChild(h);
  const b=el('label','fld'); b.innerHTML='<span>Flop</span><input id="cpFlop" placeholder="Qd 7c 2s" value="'+(S.flopTxt||'')+'" autocapitalize="characters" autocomplete="off">'; f.appendChild(b);
  const go=el('button','cp-go','Analyser le flop'); go.onclick=()=>{ try{ S.handTxt=document.getElementById('cpHand').value; S.flopTxt=document.getElementById('cpFlop').value; const hand=E.parseCards(S.handTxt), flop=E.parseCards(S.flopTxt); if(hand.length!==2) throw new Error('Il faut exactement deux cartes en main.'); if(flop.length!==3) throw new Error('Le flop a trois cartes.'); const all=[...hand,...flop]; if(new Set(all.map(c=>c.id)).size!==5) throw new Error('Une carte apparaît deux fois.'); startPlay(hand,flop); }catch(e){ alertBox(e.message); } };
  f.appendChild(go); const back=el('button','cp-back','← Modifier la situation'); back.onclick=()=>{S.stage='setup'; render()}; f.appendChild(back); root.appendChild(f);
}
function startPlay(hand,flop){
  const {heroR,villR}=scenarioRanges(); const {pot,invested}=preflopPot();
  S.hero=hand.map(c=>c.id); S.board=flop.map(c=>c.id); S.street='flop'; S.pot=pot; S.eff=S.eff-invested; S.heroIP=POS8.indexOf(S.heroPos)>POS8.indexOf(S.villPos);
  S.heroRange=E.buildRange(heroR); S.villRange=E.buildRange(villR); S.log=[]; S.stage='play'; S.done=false; S.reco=null;
  newStreet(); render();
}
function newStreet(){ S.streetBets={hero:0,vill:0}; S.lastBetFrac=0; S.turnOf=S.heroIP?'vill':'hero'; S.heroActed=false; S.villActed=false; S.reco=null; if(S.turnOf==='hero') computeReco(); }
function profileCtx(){ return {street:S.street,aggressor:S.pfr==='vill',profile:S.profile,tex:E.texture(S.board.map(E.cardFromId))}; }
function potBeforeBet(){ return S.pot-S.streetBets.hero-S.streetBets.vill; }
function computeReco(){
  const toCall=Math.max(0,S.streetBets.vill-S.streetBets.hero); const potNow=S.pot;
  const st={street:S.street,hero:S.hero,board:S.board,heroRange:S.heroRange,villRange:S.villRange,pot:toCall>0?potNow-toCall:potNow,eff:S.eff-S.streetBets.hero,heroIP:S.heroIP,heroPFR:S.pfr==='hero',threebet:S.tb!=='none',toCall,lastBet:S.lastBetFrac,profile:S.profile};
  S.reco=E.decide(st); S.reco.toCall=toCall;
}
function villAct(action,frac,amount){ // action: check|bet|call|raise|fold ; frac: fraction du pot ; amount: bb
  const ctx=profileCtx(); ctx.size=frac||S.lastBetFrac;
  if(action==='fold'){ S.log.push({who:'vill',txt:'Il se couche'}); S.done=true; S.endTxt='Il se couche, le pot est à toi ('+fmt(S.pot)+' bb).'; return; }
  S.villActed=true;
  if(action==='check'){ S.log.push({who:'vill',txt:'Il checke'}); S.villRange=E.narrow(S.villRange,S.board,'check',ctx); if(!S.heroActed){ S.turnOf='hero'; computeReco(); } else endStreet(); return; }
  if(action==='call'){ const add=S.streetBets.hero-S.streetBets.vill; S.streetBets.vill+=add; S.pot+=add; S.log.push({who:'vill',txt:'Il paie '+fmt(add)+' bb'}); S.villRange=E.narrow(S.villRange,S.board,'call',ctx); endStreet(); return; }
  if(action==='bet'||action==='raise'){ let amt=amount!=null?amount:Math.round(frac*S.pot*10)/10; const total=Math.min(S.eff,action==='raise'?S.streetBets.hero+amt:amt); amt=total-(action==='raise'?S.streetBets.hero:0); const add=total-S.streetBets.vill; S.streetBets.vill=total; S.pot+=add; S.lastBetFrac=amt/Math.max(1,S.pot-add);
    S.log.push({who:'vill',txt:(action==='raise'?'Il relance à ':'Il mise ')+fmt(total)+' bb'}); S.villRange=E.narrow(S.villRange,S.board,action==='raise'?'raise':'bet',ctx); S.turnOf='hero'; computeReco(); return; }
}
function heroAct(action,amount){
  const ctx=profileCtx(); ctx.aggressor=S.pfr==='hero'; S.heroActed=true;
  if(action==='fold'){ S.log.push({who:'hero',txt:'Je me couche'}); S.done=true; S.endTxt='Tu te couches. Il remporte '+fmt(S.pot)+' bb.'; return; }
  if(action==='check'){ S.log.push({who:'hero',txt:'Je checke'}); S.heroRange=E.narrow(S.heroRange,S.board,'check',ctx); if(!S.villActed){ S.turnOf='vill'; S.reco=null; } else endStreet(); return; }
  if(action==='call'){ const add=S.streetBets.vill-S.streetBets.hero; S.streetBets.hero+=add; S.pot+=add; S.log.push({who:'hero',txt:'Je paie '+fmt(add)+' bb'}); S.heroRange=E.narrow(S.heroRange,S.board,'call',ctx); endStreet(); return; }
  // bet / raise / all-in
  const isR=S.streetBets.vill>0; const total=Math.min(S.eff,isR?S.streetBets.hero+amount:amount); const amt=total-(isR?S.streetBets.hero:0); const add=total-S.streetBets.hero; const isRaise=isR;
  S.streetBets.hero=total; S.pot+=add; S.lastBetFrac=amt/Math.max(1,S.pot-add); S.log.push({who:'hero',txt:(isRaise?'Je relance à ':'Je mise ')+fmt(total)+' bb'}); S.heroRange=E.narrow(S.heroRange,S.board,isRaise?'raise':'bet',ctx); S.turnOf='vill'; S.reco=null;
}
function endStreet(){
  const spent=Math.max(S.streetBets.hero,S.streetBets.vill); S.eff-=spent;
  if(S.eff<=0.01){ S.done=true; S.endTxt='Tapis engagés : on retourne les cartes. '; showdownNote(); return; }
  if(S.street==='river'){ S.done=true; S.endTxt='Abattage. '; showdownNote(); return; }
  S.awaitCard=true; S.reco=null;
}
function showdownNote(){ const share=E.showdownShare(S.hero,S.board,E.removeConflicts(S.villRange,[...S.hero,...S.board])); if(S.board.length===5&&share!=null) S.endTxt+='Ta main bat '+Math.round(share*100)+' % de ce qu’il peut encore avoir.'; }
function addCard(txt){ const c=E.parseCards(txt); if(c.length!==1) throw new Error('Une seule carte.'); if([...S.hero,...S.board].includes(c[0].id)) throw new Error('Cette carte est déjà sortie.'); S.board.push(c[0].id); S.street=S.board.length===4?'turn':'river'; S.awaitCard=false; newStreet(); }

function renderPlay(){
  const b=S.board.map(E.cardFromId), h=S.hero.map(E.cardFromId);
  const head=el('div','cp-head'); head.innerHTML='<div class="cp-cards"><span class="lbl">Main</span>'+h.map(cardChip).join('')+'<span class="lbl">Board</span>'+b.map(cardChip).join('')+'</div>'+
    '<div class="cp-pot">Pot <b>'+fmt(S.pot)+'</b> bb · tapis <b>'+fmt(S.eff-Math.max(S.streetBets.hero,S.streetBets.vill))+'</b> bb · SPR <b>'+fmt(potBeforeBet()>0?(S.eff)/potBeforeBet():0)+'</b> · '+S.heroPos+(S.heroIP?' (IP)':' (OOP)')+' vs '+S.villPos+' · '+S.street+'</div>';
  root.appendChild(head);
  if(S.log.length){ const lg=el('div','cp-log'); lg.innerHTML=S.log.map(l=>'<span class="'+l.who+'">'+l.txt+'</span>').join(' · '); root.appendChild(lg); }
  if(S.done){ root.appendChild(el('div','cp-end',S.endTxt)); root.appendChild(restartBtn()); return; }
  if(S.awaitCard){ const f=el('div','cp-form'); const lab=S.board.length===3?'Turn':'River'; f.innerHTML='<label class="fld"><span>Carte de '+lab.toLowerCase()+'</span><input id="cpCard" placeholder="9h" autocapitalize="characters" autocomplete="off"></label>';
    const go=el('button','cp-go','Analyser la '+lab.toLowerCase()); go.onclick=()=>{ try{ addCard(document.getElementById('cpCard').value); render(); }catch(e){ alertBox(e.message); } }; f.appendChild(go); root.appendChild(f); root.appendChild(restartBtn()); return; }
  if(S.turnOf==='vill'){ root.appendChild(villButtons()); root.appendChild(restartBtn()); return; }
  // hero's turn : recommendation
  const r=S.reco; const d=r.data; const card=el('div','cp-reco');
  const actTxt=r.action==='bet'?'MISE '+fmt(r.amount)+' bb':r.action==='raise'?'RELANCE à '+fmt(r.amount)+' bb':r.action==='all-in'?'ALL-IN ('+fmt(r.amount)+' bb)':r.action==='call'?'PAIE '+fmt(r.toCall)+' bb':r.action==='check'?'CHECK':'FOLD';
  card.innerHTML='<div class="cp-act '+r.action+'">'+actTxt+'</div><div class="cp-why">'+r.reason+'</div><div class="cp-meta">'+d.cl.name+(d.cl.outs?' · '+d.cl.outs+' outs':'')+' · board '+d.tex.kind+' · équité main '+Math.round(d.eqH*100)+' % · range '+Math.round(d.eqR*100)+' % · confiance '+r.conf+' · '+r.rules.join(' ')+'</div>';
  root.appendChild(card);
  const acts=el('div','cp-acts'); acts.appendChild(el('span','lbl','Ce que je fais :'));
  const toCall=r.toCall; const addBtn=(t,fn,primary)=>{ const btn=el('button',primary?'primary':'',t); btn.onclick=()=>{ fn(); render(); }; acts.appendChild(btn); };
  if(toCall>0){ addBtn('Fold',()=>heroAct('fold'),r.action==='fold'); addBtn('Paie '+fmt(toCall),()=>heroAct('call'),r.action==='call');
    const rs=r.action==='raise'||r.action==='all-in'?r.amount:Math.min(S.eff-S.streetBets.hero,Math.round((S.pot+toCall*2)*10)/10); addBtn('Relance à '+fmt(S.streetBets.hero+rs),()=>heroAct('raise',rs),r.action==='raise'||r.action==='all-in'); }
  else { addBtn('Check',()=>heroAct('check'),r.action==='check'); [0.33,0.5,0.66,1].forEach(f=>{ const a=Math.min(S.eff,Math.round(f*S.pot*10)/10); addBtn('Mise '+fmt(a)+' ('+Math.round(f*100)+'%)',()=>heroAct('bet',a),(r.action==='bet'&&Math.abs(a-r.amount)<0.05)); }); addBtn('All-in '+fmt(S.eff),()=>heroAct('bet',S.eff),r.action==='all-in'); }
  root.appendChild(acts); root.appendChild(restartBtn());
}
function villButtons(){ const w=el('div','cp-acts'); w.appendChild(el('span','lbl','Il fait :'));
  const add=(t,fn)=>{ const b=el('button','',t); b.onclick=()=>{ fn(); render(); }; w.appendChild(b); };
  if(S.streetBets.hero>S.streetBets.vill){ add('Fold',()=>villAct('fold')); add('Paie',()=>villAct('call')); [2.5,3.5].forEach(m=>{ const amt=Math.min(S.eff,Math.round(S.streetBets.hero*m*10)/10); add('Relance à '+fmt(amt),()=>villAct('raise',null,amt-S.streetBets.hero)); }); add('All-in',()=>villAct('raise',null,S.eff-S.streetBets.hero)); }
  else { add('Check',()=>villAct('check')); [0.33,0.5,0.66,1].forEach(f=>add('Mise '+Math.round(f*100)+'% ('+fmt(Math.min(S.eff,Math.round(f*S.pot*10)/10))+')',()=>villAct('bet',f))); add('All-in',()=>villAct('bet',null,S.eff)); }
  return w; }
function restartBtn(){ const b=el('button','cp-back','↺ Nouveau coup'); b.onclick=()=>{ S.stage='setup'; render(); }; return b; }
function cardChip(c){ const s=E.SSTR[c.s]; return '<span class="chip '+(s==='h'||s==='d'?'red':'')+'">'+E.pretty(c)+'</span>'; }
function init(container){ root=container; S.stage='setup'; render(); }
return {init,render,S};
})();
