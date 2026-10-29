/* Moteur postflop « Coup » — calcul d'équité, lecture du board, règles de décision.
   Pas de DOM ici. Les règles citées (R1…R38) sont dans regles_postflop.md. */
const Engine=(()=>{
const RSTR='23456789TJQKA', SSTR='shdc';
const rankOf=c=>RSTR.indexOf(c[0].toUpperCase())+2, suitOf=c=>SSTR.indexOf(c[1].toLowerCase());
function parseCards(txt){ // "As Kh" -> [{r,s,id,txt}] ; throws on error
  const toks=(txt||'').trim().replace(/10/g,'T').split(/[\s,]+/).filter(Boolean); const out=[];
  for(const t of toks){ if(t.length!==2||rankOf(t)<2||suitOf(t)<0) throw new Error('Carte illisible : « '+t+' ». Exemple : As Kh (s pique, h cœur, d carreau, c trèfle).');
    const c={r:rankOf(t),s:suitOf(t)}; c.id=c.r*4+c.s; c.txt=RSTR[c.r-2]+SSTR[c.s]; if(out.some(o=>o.id===c.id)) throw new Error('Carte en double : '+c.txt); out.push(c); }
  return out;
}
const SUIT_SYM={s:'♠',h:'♥',d:'♦',c:'♣'};
const pretty=c=>RSTR[c.r-2]+SUIT_SYM[SSTR[c.s]];
const handLabel=(a,b)=>{ const hi=a.r>=b.r?a:b, lo=a.r>=b.r?b:a; return hi.r===lo.r?RSTR[hi.r-2]+RSTR[lo.r-2]:RSTR[hi.r-2]+RSTR[lo.r-2]+(hi.s===lo.s?'s':'o') };

/* ---------- Évaluateur 5 à 7 cartes ---------- */
function evaluate(cards){ // retourne un entier, plus grand = meilleur
  const cnt=new Array(15).fill(0), suits=[0,0,0,0], bySuit=[[],[],[],[]];
  for(const c of cards){ cnt[c.r]++; suits[c.s]++; bySuit[c.s].push(c.r); }
  let fs=-1; for(let s=0;s<4;s++) if(suits[s]>=5) fs=s;
  const straightTop=ranks=>{ // ranks: set of ranks present ; returns top rank of best straight or 0
    let run=0; for(let r=14;r>=1;r--){ const has=r===1?ranks[14]:ranks[r]; if(has){run++; if(run>=5) return r+4;} else run=0; } return 0; };
  if(fs>=0){ const pres=new Array(15).fill(0); bySuit[fs].forEach(r=>pres[r]=1); const st=straightTop(pres); if(st) return 8e9+st*1e6;
    const top=bySuit[fs].sort((a,b)=>b-a).slice(0,5); return 5e9+top.reduce((a,r,i)=>a+r*Math.pow(15,4-i),0); }
  const quads=[],trips=[],pairs=[],singles=[];
  for(let r=14;r>=2;r--){ if(cnt[r]===4) quads.push(r); else if(cnt[r]===3) trips.push(r); else if(cnt[r]===2) pairs.push(r); else if(cnt[r]===1) singles.push(r); }
  const kick=(arr,n)=>arr.slice(0,n).reduce((a,r,i)=>a+r*Math.pow(15,n-1-i),0);
  if(quads.length){ const k=[...trips,...pairs,...singles].sort((a,b)=>b-a)[0]; return 7e9+quads[0]*1e6+k; }
  if(trips.length&&(pairs.length||trips.length>1)){ const p=trips.length>1?trips[1]:pairs[0]; return 6e9+trips[0]*1e6+p; }
  const pres=cnt.map(x=>x>0?1:0); const st=straightTop(pres); if(st) return 4e9+st*1e6;
  if(trips.length){ return 3e9+trips[0]*1e6+kick(singles,2); }
  if(pairs.length>=2){ const k=[...pairs.slice(2),...singles].sort((a,b)=>b-a)[0]||0; return 2e9+pairs[0]*1e5+pairs[1]*1e3+k; }
  if(pairs.length===1){ return 1e9+pairs[0]*1e6+kick(singles,3); }
  return kick(singles,5);
}

/* ---------- Ranges en combinaisons ---------- */
const ALL_IDS=[]; for(let r=2;r<=14;r++) for(let s=0;s<4;s++) ALL_IDS.push(r*4+s);
function combosOf(label){ const hi=rankOf(label[0]+'x'), lo=rankOf(label[1]+'x'); const out=[];
  if(label.length===2){ for(let a=0;a<4;a++) for(let b=a+1;b<4;b++) out.push([hi*4+a,lo*4+b]); }
  else if(label[2]==='s'){ for(let s=0;s<4;s++) out.push([hi*4+s,lo*4+s]); }
  else { for(let a=0;a<4;a++) for(let b=0;b<4;b++) if(a!==b) out.push([hi*4+a,lo*4+b]); }
  return out; }
const cardFromId=id=>({r:Math.floor(id/4),s:id%4,id});
function buildRange(labels,weights){ // labels: array ; weights: optional {label:w} ; -> array of {a,b,w,label}
  const out=[]; (labels||[]).forEach(l=>{ const w=weights&&weights[l]!=null?weights[l]:1; combosOf(l).forEach(([a,b])=>out.push({a,b,w,label:l})); }); return out; }
function removeConflicts(range,ids){ const dead=new Set(ids); return range.filter(c=>!dead.has(c.a)&&!dead.has(c.b)); }
function totalWeight(range){ return range.reduce((s,c)=>s+c.w,0); }

/* ---------- Monte-Carlo ---------- */
let seed=12345; function rnd(){ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; }
function pickWeighted(range,tot){ let x=rnd()*tot; for(const c of range){ x-=c.w; if(x<=0) return c; } return range[range.length-1]; }
function equityHandVsRange(hero,board,range,n){ // hero: [id,id], board: ids ; range after removeConflicts
  n=n||4000; const need=5-board.length; const live=range; const tot=totalWeight(live); if(!live.length||tot<=0) return null;
  const dead=new Set([...hero,...board]); const deck=ALL_IDS.filter(id=>!dead.has(id));
  let win=0,tie=0;
  for(let i=0;i<n;i++){ const v=pickWeighted(live,tot); if(dead.has(v.a)||dead.has(v.b)) continue;
    const run=[]; const used=new Set([v.a,v.b]); while(run.length<need){ const id=deck[Math.floor(rnd()*deck.length)]; if(!used.has(id)){used.add(id); run.push(id);} }
    const b=[...board,...run].map(cardFromId);
    const eh=evaluate([...hero.map(cardFromId),...b]), ev=evaluate([cardFromId(v.a),cardFromId(v.b),...b]);
    if(eh>ev) win++; else if(eh===ev) tie++; }
  return (win+tie/2)/n;
}
function equityRangeVsRange(rA,board,rB,n){ n=n||6000; const tA=totalWeight(rA), tB=totalWeight(rB); if(!rA.length||!rB.length) return null;
  const need=5-board.length; const deadB=new Set(board); const deck=ALL_IDS.filter(id=>!deadB.has(id)); let win=0,tie=0,cnt=0;
  for(let i=0;i<n;i++){ const a=pickWeighted(rA,tA), b=pickWeighted(rB,tB); if(a.a===b.a||a.a===b.b||a.b===b.a||a.b===b.b) continue;
    const used=new Set([a.a,a.b,b.a,b.b,...board]); const run=[]; while(run.length<need){ const id=deck[Math.floor(rnd()*deck.length)]; if(!used.has(id)){used.add(id); run.push(id);} }
    const bb=[...board,...run].map(cardFromId); const ea=evaluate([cardFromId(a.a),cardFromId(a.b),...bb]), eb=evaluate([cardFromId(b.a),cardFromId(b.b),...bb]);
    cnt++; if(ea>eb) win++; else if(ea===eb) tie++; }
  return cnt?(win+tie/2)/cnt:null;
}
function showdownShare(hero,board,range){ // river : part de la range adverse battue (égalité = moitié)
  const b=board.map(cardFromId); const eh=evaluate([...hero.map(cardFromId),...b]); let w=0,tot=0;
  for(const c of range){ if(c.a===hero[0]||c.a===hero[1]||c.b===hero[0]||c.b===hero[1]) continue; const ev=evaluate([cardFromId(c.a),cardFromId(c.b),...b]); tot+=c.w; if(eh>ev) w+=c.w; else if(eh===ev) w+=c.w/2; }
  return tot?w/tot:null;
}

/* ---------- Classement d'une main sur un board (R17) ---------- */
// niveaux : 0 air, 1 overcartes/as haut, 2 paire faible, 3 paire moyenne, 4 top paire kicker faible, 5 top paire bon kicker / overpaire, 6 deux paires, 7 brelan, 8 quinte, 9 couleur, 10 full ou mieux
function classify(hand,board){ // hand,board : arrays of {r,s}
  const all=[...hand,...board]; const ev=evaluate(all); const cat=Math.floor(ev/1e9);
  const bRanks=board.map(c=>c.r), top=Math.max(...bRanks), bSorted=[...new Set(bRanks)].sort((a,b)=>b-a);
  const h1=hand[0].r,h2=hand[1].r, pocket=h1===h2;
  let level=0, name='rien';
  if(cat>=6){ level=10; name=cat===8?'quinte flush':cat===7?'carré':'full'; }
  else if(cat===5){ level=9; name='couleur'; }
  else if(cat===4){ level=8; name='quinte'; }
  else if(cat===3){ level=7; name=pocket?'brelan (set)':'brelan'; }
  else if(cat===2){ level=6; name='deux paires'; if(bRanks.filter((r,i)=>bRanks.indexOf(r)!==i).length&&!bRanks.includes(h1)&&!bRanks.includes(h2)){ level=3; name='paire + board pairé'; } }
  else if(cat===1){
    if(pocket){ if(h1>top){ level=5; name='overpaire'; } else if(h1>bSorted[bSorted.length-1]){ level=3; name='paire moyenne (pocket)'; } else { level=2; name='petite paire (pocket)'; } }
    else { const pr=bRanks.includes(h1)?h1:bRanks.includes(h2)?h2:null;
      if(pr===null){ level=2; name='paire sur le board'; }
      else { const kicker=pr===h1?h2:h1;
        if(pr===top){ if(kicker>=11){ level=5; name='top paire bon kicker'; } else { level=4; name='top paire kicker faible'; } }
        else if(pr===bSorted[1]){ level=3; name='deuxième paire'; }
        else { level=2; name='paire basse'; } } }
  }
  else { const over=[h1,h2].filter(r=>r>top).length; if(over===2){ level=1; name='deux overcartes'; } else if(h1===14||h2===14){ level=1; name='as haut'; } else { level=0; name='rien'; } }
  // tirages (flop/turn seulement)
  let fd=false,bdfd=false,oesd=false,gut=false,outs=0;
  if(board.length<5){
    const suits=[0,0,0,0]; all.forEach(c=>suits[c.s]++); const hs=hand.map(c=>c.s);
    for(let s=0;s<4;s++){ if(suits[s]>=4&&hs.includes(s)&&cat<5){ fd=true; } if(board.length===3&&suits[s]===3&&hs.includes(s)&&hand[0].s===hand[1].s) bdfd=true; }
    // quinte : compter les cartes qui complètent une quinte (outs), en excluant celles qui font déjà quinte
    if(cat<4){ const have=new Set(all.map(c=>c.r)); let straightOuts=0;
      for(let r=2;r<=14;r++){ if(have.has(r)) continue; const test=[...all,{r,s:9}]; const pres=new Array(15).fill(0); test.forEach(c=>pres[c.r]=1);
        let run=0,ok=false; for(let k=14;k>=1;k--){ const has=k===1?pres[14]:pres[k]; if(has){run++; if(run>=5){ok=true;break;}} else run=0; }
        if(ok) straightOuts++; }
      if(straightOuts>=2){ oesd=true; } else if(straightOuts===1){ gut=true; }
      outs+=straightOuts*4; }
    if(fd) outs+=9; if(fd&&(oesd||gut)) outs-=1;
  }
  const drawStrength=outs>=12?'combo':outs>=8?'fort':outs>=4?'faible':'aucun';
  return {level,name,cat,fd,bdfd,oesd,gut,outs,drawStrength,ev};
}

/* ---------- Texture du board (R10) ---------- */
function texture(board){ const rs=board.map(c=>c.r).sort((a,b)=>b-a); const suits=[0,0,0,0]; board.forEach(c=>suits[c.s]++); const maxS=Math.max(...suits);
  const paired=new Set(rs).size<rs.length; const high=rs[0]>=12; const low=rs[0]<=9;
  const span=rs[0]-rs[rs.length-1]; const gaps=[]; for(let i=0;i<rs.length-1;i++) gaps.push(rs[i]-rs[i+1]);
  const connected=gaps.filter(g=>g<=2).length>=Math.min(2,rs.length-1) && span<=4;
  const twoTone=board.length===3?maxS===2:maxS>=2; const mono=maxS>=3 && board.length===3; const flushPossible=maxS>=3;
  let wet=0; if(twoTone) wet+=1; if(mono||flushPossible) wet+=2; if(connected) wet+=2; else if(gaps.some(g=>g<=2)) wet+=1; if(low) wet+=1; if(paired) wet-=1;
  const kind=mono?'monotone':wet>=3?'dynamique':wet>=2?'moyen':'sec';
  return {paired,high,low,connected,twoTone,mono,flushPossible,wet,kind,top:rs[0]};
}
function turnKind(board){ // R11 : nature de la dernière carte
  const prev=board.slice(0,-1), c=board[board.length-1]; const t=texture(prev), t2=texture(board);
  const over=c.r>t.top; const pairs=prev.some(p=>p.r===c.r); const completesFlush=!t.flushPossible&&t2.flushPossible; const connects=!t.connected&&t2.connected;
  if(over&&c.r>=12) return {kind:'overcarte',txt:'une overcarte ('+pretty(c)+') qui renforce la range de l’ouvreur'};
  if(completesFlush) return {kind:'couleur',txt:'une carte qui complète la couleur, favorable au défenseur'};
  if(connects) return {kind:'quinte',txt:'une carte qui connecte le board, favorable au défenseur'};
  if(pairs) return {kind:'pair',txt:'une carte qui pair le board, neutre'};
  return {kind:'neutre',txt:'une carte basse sans rapport, neutre'};
}

/* ---------- Lecture des actions adverses (R23–R27) ---------- */
function narrow(range,board,action,ctx){ // action: 'bet'|'check'|'call'|'raise' ; ctx:{street,aggressor(bool: villain is PFR), size, profile, tex}
  const b=board.map(cardFromId); const prof=ctx.profile||{}; const out=[];
  for(const c of range){ const cl=classify([cardFromId(c.a),cardFromId(c.b)],b); let m=1; const strong=cl.outs>=8, weak=cl.outs>=4&&cl.outs<8, river=board.length===5;
    if(action==='bet'){
      if(ctx.street==='flop'&&ctx.aggressor){ const air=ctx.tex.kind==='sec'?0.45:ctx.tex.kind==='moyen'?0.3:0.12;
        m=cl.level>=4?1:cl.level===3?0.7:cl.level===2?0.4:strong?0.95:weak?0.6:cl.bdfd||cl.level===1?air:air*0.7; }
      else { m=cl.level>=5?1:cl.level===4?0.85:cl.level===3?0.4:cl.level===2?0.12:(!river&&strong)?0.85:(!river&&weak)?0.3:0.08;
        if(prof.aggro) m=Math.max(m,cl.level<=1?0.25:m); }
    } else if(action==='check'){ m=cl.level>=6?0.3:cl.level===5?0.55:1; if(prof.passive) m=cl.level>=5?0.8:1; }
    else if(action==='call'){ const s=ctx.size||0.5; m=cl.level>=4?1:cl.level===3?(s<0.5?0.9:0.6):cl.level===2?(s<0.5?0.5:0.2):(!river&&strong)?1:(!river&&weak)?(s<0.5?0.6:0.25):cl.level===1?0.08:0.04;
      if(prof.station) m=Math.max(m,cl.level>=2?0.7:0.2); }
    else if(action==='raise'){ m=cl.level>=6?1:cl.level===5?0.6:cl.level===4?0.2:(!river&&cl.outs>=12)?0.7:(!river&&strong)?0.3:0.03; if(prof.aggro) m=Math.max(m,cl.level>=4?0.6:(!river&&cl.outs>=4)?0.5:0.12); }
    if(m>0) out.push({...c,w:c.w*m}); }
  return out;
}

/* ---------- Décision (R12–R35) ---------- */
const pct=x=>Math.round(x*100)+' %';
function potOdds(bet,pot){ return bet/(pot+2*bet); }
function decide(st){
  /* st: {street, hero:[ids], board:[ids], heroRange, villRange, pot, eff (tapis effectif restant), heroIP, heroPFR, threebet, toCall (mise à payer, 0 si rien), lastBet, profile, tex}
     retourne {action,size,amount,reason,rules,conf,data} */
  const b=st.board.map(cardFromId), hero=st.hero.map(cardFromId); const cl=classify(hero,b); const tex=st.tex||texture(b);
  const vr=removeConflicts(st.villRange,[...st.hero,...st.board]); const hr=removeConflicts(st.heroRange,st.board);
  const river=st.street==='river';
  const eqH=river?showdownShare(st.hero,st.board,vr):equityHandVsRange(st.hero,st.board,vr,4000);
  const eqR=equityRangeVsRange(hr,st.board,vr,5000);
  const nutShare=r=>{ let s=0,t=0; for(const c of r){ t+=c.w; const l=classify([cardFromId(c.a),cardFromId(c.b)],b).level; if(l>=6) s+=c.w; } return t?s/t:0; };
  const nutH=nutShare(hr), nutV=nutShare(vr);
  const spr=st.pot>0?st.eff/st.pot:99; const prof=st.profile||{};
  const posAdj=st.heroIP?-0.05:0.05; // R6 : en position, seuils abaissés de 5 points
  const rangeAdv=eqR!=null&&eqR>=0.55, nutAdv=nutH>=nutV+0.05;
  const data={eqH,eqR,nutH,nutV,spr,cl,tex};
  const rules=[]; let reason='';
  const R=(...ids)=>ids.forEach(i=>{ if(!rules.includes(i)) rules.push(i); });
  const sizeTxt=s=>s>=1?'le pot':s>=0.75?'trois quarts du pot':s>=0.6?'deux tiers du pot':s>=0.5?'la moitié du pot':'un tiers du pot';
  const mkBet=(size,why,conf)=>{ const amount=Math.min(st.eff,Math.round(size*st.pot*10)/10); const allin=amount>=st.eff; return {action:allin?'all-in':'bet',size,amount,reason:why,rules,conf,data}; };
  const mk=(action,why,conf,extra)=>({action,size:0,amount:0,reason:why,rules,conf,data,...extra});
  const strongDraw=cl.outs>=8, comboDraw=cl.outs>=12;
  const eqTxt='Ta main a '+pct(eqH)+' d’équité contre sa range'+(river?' (part de sa range que tu bats)':'')+'.';
  const rangeTxt=(rangeAdv?'Ta range domine ce board ('+pct(eqR)+').':eqR<0.45?'Ce board favorise sa range ('+pct(eqR)+' pour toi).':'Les deux ranges sont proches sur ce board ('+pct(eqR)+' pour toi).');

  /* ----- Face à une mise ----- */
  if(st.toCall>0){
    const need=potOdds(st.toCall,st.pot);
    R('R1','R2','R20');
    const allinCall=st.toCall>=st.eff;
    if(!river){ const needAdj=need+posAdj+(cl.outs>=8&&(cl.fd||cl.oesd)?0:0.05); // marge R20, cotes implicites R22
      if(cl.level>=6 || (cl.level===5&&(st.lastBet<=0.5||spr<=3)) || (comboDraw&&spr>2&&!allinCall)){ R('R21'); if(spr<=3) R('R7');
        const raiseTo=Math.round(Math.min(st.eff,(st.pot+st.toCall*3))*10)/10; const allin=raiseTo>=st.eff*0.8;
        return mk(allin?'all-in':'raise',eqTxt+' '+(cl.level>=6?'Avec '+cl.name+' tu bats presque toute sa range de mise : relance pour la valeur, il paiera avec des mains moins bonnes.':cl.level===5?'Top paire ou overpaire face à une mise '+(st.lastBet<=0.5?'petite':'avec un SPR faible')+' : relance pour la valeur et pour protéger ta main.':'Tirage combiné à '+cl.outs+' outs : relance en semi-bluff, tu gagnes soit tout de suite, soit souvent à l’abattage.')+(spr<=3?' SPR '+spr.toFixed(1)+', tu es engagé (R7).':''),cl.level>=6?'haute':'moyenne',{amount:Math.min(st.eff,raiseTo)}); }
      if(eqH>=needAdj || (strongDraw&&eqH>=need-0.03&&spr>4)){ if(strongDraw) R('R22');
        return mk('call',eqTxt+' Il te faut '+pct(need)+' pour payer cette mise (cote du pot)'+(st.heroIP?', un peu moins en position':', un peu plus hors position')+'. '+(cl.level>=3?'Ta '+cl.name+' est devant assez souvent : paie et vois la suite.':strongDraw?'Ton tirage à '+cl.outs+' outs paie avec les cotes du pot'+(spr>4?' et les cotes implicites':'')+'.':'Tu as assez d’équité pour continuer.'),eqH>=needAdj+0.1?'haute':'moyenne'); }
      return mk('fold',eqTxt+' Il te faut '+pct(need)+' pour payer (cote du pot) et tu ne les as pas'+(cl.outs>=4?', même en comptant tes '+cl.outs+' outs':'')+'. Couche-toi, le pot ne justifie pas de continuer avec '+cl.name+'.',eqH<need-0.1?'haute':'moyenne');
    }
    // river : R34
    R('R31','R34'); const s=st.lastBet||0.5; let bluffShare=s/(1+2*s); if(prof.aggro) bluffShare+=0.12; if(prof.passive) bluffShare-=0.12; if(prof.foldy) bluffShare-=0.05; bluffShare=Math.max(0.05,Math.min(0.6,bluffShare));
    // range de mise supposée : ses meilleures mains (valeur) + bluffs = ses pires mains
    const scored=vr.map(c=>({c,ev:evaluate([cardFromId(c.a),cardFromId(c.b),...b])})).sort((x,y)=>y.ev-x.ev); const tot=totalWeight(vr);
    const valueW=tot*0.35, bluffW=valueW*bluffShare/(1-bluffShare); const eh=evaluate([...hero,...b]);
    let acc=0,beatV=0,valW=0; for(const x of scored){ if(acc>=valueW) break; const w=Math.min(x.c.w,valueW-acc); acc+=w; valW+=w; if(eh>x.ev) beatV+=w; else if(eh===x.ev) beatV+=w/2; }
    const eqBet=(beatV+bluffW)/(valW+bluffW);
    const txt='Face à cette mise, je suppose '+pct(bluffShare)+' de bluffs dans sa range de mise (R5'+(prof.aggro?', profil agressif':prof.passive?', profil passif':'')+'). Tu bats '+pct(eqBet)+' de cette range, il te faut '+pct(need)+'.';
    if(cl.level>=6&&!tex.flushPossible&&beatV/valW>0.7){ R('R21'); return mk('raise',txt+' Avec '+cl.name+' tu bats aussi la plupart de ses mains de valeur : relance.','moyenne',{amount:Math.min(st.eff,Math.round((st.pot+st.toCall*3)*10)/10)}); }
    if(eqBet>=need+0.02) return mk('call',txt+' Le call est rentable'+(eqBet<need+0.1?', de peu : spot serré':'')+'.',eqBet>=need+0.1?'haute':'basse');
    return mk('fold',txt+' Pas assez pour payer : couche-toi'+(eqBet>need-0.05?', spot serré, un profil qui bluffe plus changerait la décision':'')+'.',eqBet<need-0.08?'haute':'basse');
  }

  /* ----- Personne n'a misé (ou il a checké) ----- */
  if(river){ R('R31');
    const beats=eqH; let valThr=0.6, bluffThr=0.15; if(prof.station){ valThr=0.5; } if(prof.foldy){ valThr=0.65; }
    if(beats>=valThr){ R('R32'); const big=beats>=0.8; const size=big?0.75:0.5; if(prof.station&&big) return mkBet(1,eqTxt+' Il paie trop : mise le pot avec '+cl.name+', il te paiera avec bien pire.','haute');
      return mkBet(size,eqTxt+' Tu bats '+(big?'la grande majorité':'plus de la moitié')+' de ce qu’il peut encore avoir : mise '+sizeTxt(size)+' pour la valeur'+(big?', gros, il a assez de mains qui paient':', taille moyenne pour garder ses mains moyennes dans le coup')+'.',big?'haute':'moyenne'); }
    if(beats<bluffThr){ R('R33','R4'); // part de sa range faible
      let weakV=0,totV=0; for(const c of vr){ totV+=c.w; if(classify([cardFromId(c.a),cardFromId(c.b)],b).level<=2) weakV+=c.w; } const weak=totV?weakV/totV:0;
      const size=0.66; let thr=size/(1+size); if(prof.foldy) thr-=0.1; if(prof.station) thr+=0.3;
      if(weak>=thr&&!prof.station) return mkBet(size,eqTxt+' Aucune valeur de showdown, mais '+pct(weak)+' de sa range ne peut pas payer une mise de '+sizeTxt(size)+' (il faut '+pct(size/(1+size))+' de folds). Bluffe'+(cl.level===1?', ton as bloque en plus ses meilleures mains':'')+'.','basse');
      return mk('check',eqTxt+' Pas de valeur de showdown, mais seulement '+pct(weak)+' de sa range se couche face à une mise, trop peu pour bluffer'+(prof.station?' contre un joueur qui paie trop':'')+'. Abandonne le coup.','moyenne'); }
    R('R35'); return mk('check',eqTxt+' Trop faible pour une mise de valeur, trop forte pour bluffer : checke et va à l’abattage'+(st.heroIP?'.':', et évalue sa mise s’il mise.'),'moyenne');
  }
  // flop / turn
  const asAgg=st.heroPFR; const street=st.street;
  if(street==='turn'){ const tk=turnKind(b); data.turn=tk;
    if(cl.level>=5||(cl.level>=4&&spr<=3)){ R('R28'); if(spr<=3) R('R7'); const size=nutAdv||tex.kind!=='sec'?0.66:0.5; return mkBet(spr<=2.5?1:size,eqTxt+' La turn est '+tk.txt+'. Avec '+cl.name+' tu continues pour la valeur'+(spr<=2.5?' et tu t’engages, le SPR est faible':' : mise '+sizeTxt(size))+'.',eqH>=0.65?'haute':'moyenne'); }
    if(strongDraw){ R('R30'); if(spr>=2&&(rangeAdv||st.heroIP)) return mkBet(0.6,eqTxt+' Tirage à '+cl.outs+' outs sur une turn '+tk.kind+' : mise '+sizeTxt(0.6)+' en semi-bluff, tu gardes la fold equity et tu touches une fois sur trois.','moyenne');
      return mk('check',eqTxt+' Tirage à '+cl.outs+' outs mais peu de fold equity ici : checke, et paie selon la cote du pot s’il mise.','moyenne'); }
    if(cl.level>=3){ R('R28','R12'); if(tk.kind==='overcarte'&&asAgg&&rangeAdv) return mkBet(0.5,eqTxt+' La turn est '+tk.txt+' : ta '+cl.name+' peut encore miser '+sizeTxt(0.5)+' pour la valeur et la protection.','basse');
      return mk('check',eqTxt+' '+cl.name+' sur une turn '+tk.kind+' : valeur de showdown, mais seules de meilleures mains paieraient une mise. Checke pour contrôler le pot.','moyenne'); }
    if(asAgg&&(tk.kind==='overcarte')&&rangeAdv&&!prof.station){ R('R29','R4'); return mkBet(0.66,eqTxt+' '+rangeTxt+' La turn est '+tk.txt+' : deuxième barrel en bluff, il doit se coucher plus de '+pct(0.66/1.66)+' du temps et sa range est pleine de mains moyennes.','basse'); }
    R('R29'); return mk('check',eqTxt+' La turn est '+tk.txt+' et ta main n’a rien amélioré : abandonne, un deuxième barrel sans raison brûle des jetons.','moyenne');
  }
  // flop
  if(cl.level>=5){ R('R12','R18'); if(spr<=3) R('R7'); let size=0.33; if(nutAdv||tex.kind==='dynamique'||tex.kind==='moyen'){ size=0.66; R('R14'); } else R('R13'); if(tex.mono){ size=0.5; R('R15'); }
    return mkBet(spr<=2?1:size,eqTxt+' '+rangeTxt+' Avec '+cl.name+' mise '+sizeTxt(size)+' pour la valeur'+(size>=0.6?' : board dynamique ou avantage de nuts, fais payer les tirages':' : board sec, une petite mise suffit et garde ses mains faibles')+'.',eqH>=0.65?'haute':'moyenne'); }
  if(strongDraw){ R('R18','R12'); const size=tex.kind==='sec'?0.5:0.66; return mkBet(size,eqTxt+' Tirage à '+cl.outs+' outs ('+(cl.fd?'couleur':'')+(cl.fd&&cl.oesd?' + ':'')+(cl.oesd?'quinte ouverte':'')+') : mise '+sizeTxt(size)+' en semi-bluff. Deux façons de gagner : il se couche, ou tu touches.','moyenne'); }
  if(cl.level>=3){ R('R18','R12'); if(asAgg&&rangeAdv&&tex.kind==='sec'){ R('R13'); return mkBet(0.33,eqTxt+' '+rangeTxt+' Board sec : c-bet d’un tiers du pot avec '+cl.name+', pour la valeur fine et la protection, comme avec la majorité de ta range.','moyenne'); }
    if(!asAgg&&!st.heroIP===false&&cl.level>=4){ R('R19'); return mkBet(0.5,eqTxt+' Il a checké, sa range est plafonnée. Mise '+sizeTxt(0.5)+' avec '+cl.name+' pour la valeur.','moyenne'); }
    return mk('check',eqTxt+' '+cl.name+' : de la valeur de showdown, mais '+(tex.kind!=='sec'?'le board est dynamique':'tu n’as pas l’avantage de range')+'. Checke pour contrôler le pot, et paie une mise raisonnable.','moyenne'); }
  if(cl.level===2){ R('R12'); return mk('check',eqTxt+' Petite paire : main de showdown qui ne sera payée que par mieux. Checke'+(st.heroIP?' derrière':'')+'.','moyenne'); }
  // showdown faible, air
  if(asAgg&&rangeAdv&&tex.kind==='sec'&&!prof.station){ R('R13','R18','R4'); return mkBet(0.33,eqTxt+' '+rangeTxt+' Board sec qui touche peu sa range : c-bet d’un tiers du pot'+(cl.level===1?' avec tes overcartes':' en bluff')+', il doit se coucher seulement 25 % du temps pour que ce soit rentable.','moyenne'); }
  if(asAgg&&st.threebet&&!prof.station){ R('R16'); return mkBet(0.33,eqTxt+' Pot 3bet : ton avantage de range est net, c-bet d’un tiers du pot avec presque toute ta range.','moyenne'); }
  if(!asAgg&&eqR>=0.55&&tex.kind!=='sec'&&(cl.bdfd||cl.outs>=4)&&st.heroIP){ R('R19'); return mkBet(0.5,eqTxt+' Il a checké sur un board qui favorise ta range. Mise '+sizeTxt(0.5)+' avec ton tirage'+(cl.bdfd?' backdoor':'')+' pour prendre le pot.','basse'); }
  R('R12','R18'); return mk('check',eqTxt+' '+rangeTxt+' Ni valeur ni vrai tirage'+(tex.kind!=='sec'?', et le board touche sa range':'')+' : checke et abandonne face à une mise.','moyenne');
}

return {parseCards,pretty,handLabel,evaluate,buildRange,removeConflicts,totalWeight,equityHandVsRange,equityRangeVsRange,showdownShare,classify,texture,turnKind,narrow,decide,potOdds,cardFromId,RSTR,SSTR};
})();
