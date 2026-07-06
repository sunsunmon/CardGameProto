(function(){
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  const center=(el)=>{
    if(!el) return {x:innerWidth/2,y:innerHeight/2};
    const r=el.getBoundingClientRect();
    return {x:r.left+r.width/2,y:r.top+r.height/2};
  };

  window.TCGFX={
    sleep,
    center,

    async drawCard(deckEl, handEl, owner){
      if(!deckEl) return;
      window.TCGSFX?.play?.('draw');
      const d=deckEl.getBoundingClientRect();
      const h=handEl?.getBoundingClientRect();
      const start={x:d.left+d.width/2,y:d.top+d.height/2};
      const end=owner==='player' && h
        ? {x:h.left+h.width*.52,y:h.top+42}
        : {x:start.x,y:start.y+65};
      const dx=end.x-start.x,dy=end.y-start.y;
      const el=document.createElement('div');
      el.className='draw-card';
      el.style.left=(start.x-43)+'px';
      el.style.top=(start.y-56)+'px';
      document.body.appendChild(el);
      const anim=el.animate([
        {transform:'translate(0,0) rotateY(180deg) rotate(-4deg) scale(.9)',offset:0},
        {transform:`translate(${dx*.35}px,${dy*.35-85}px) rotateY(120deg) rotate(8deg) scale(1.08)`,offset:.42},
        {transform:`translate(${dx*.72}px,${dy*.72-22}px) rotateY(35deg) rotate(-5deg) scale(1.04)`,offset:.72},
        {transform:`translate(${dx}px,${dy}px) rotateY(0deg) rotate(0deg) scale(.9)`,offset:1}
      ],{duration:620,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'});
      await anim.finished.catch(()=>{});
      el.remove();
    },

    shake(el,intensity=10,duration=320){
      if(!el) return;
      el.animate([
        {transform:'translate3d(0,0,0) rotate(0deg)',offset:0},
        {transform:`translate3d(${-intensity}px,${Math.round(intensity*.35)}px,0) rotate(-2deg)`,offset:.18},
        {transform:`translate3d(${intensity}px,${-Math.round(intensity*.45)}px,0) rotate(2deg)`,offset:.38},
        {transform:`translate3d(${-Math.round(intensity*.55)}px,${Math.round(intensity*.25)}px,0) rotate(-1.2deg)`,offset:.6},
        {transform:`translate3d(${Math.round(intensity*.35)}px,0,0) rotate(.8deg)`,offset:.78},
        {transform:'translate3d(0,0,0) rotate(0deg)',offset:1}
      ],{duration,easing:'cubic-bezier(.2,.8,.2,1)'});
    },

    screenShake(){
      const shell=document.querySelector('.board')||document.querySelector('.battlefield')||document.body;
      shell.animate([
        {transform:'translate3d(0,0,0)',offset:0},
        {transform:'translate3d(-16px,10px,0) rotate(-.5deg)',offset:.14},
        {transform:'translate3d(17px,-9px,0) rotate(.55deg)',offset:.3},
        {transform:'translate3d(-12px,7px,0) rotate(-.35deg)',offset:.48},
        {transform:'translate3d(8px,-5px,0) rotate(.25deg)',offset:.68},
        {transform:'translate3d(-4px,2px,0) rotate(-.12deg)',offset:.84},
        {transform:'translate3d(0,0,0)',offset:1}
      ],{
        duration:430,
        easing:'cubic-bezier(.2,.8,.2,1)',
        composite:'add'
      });
    },

    playerDamageOverlay(){
      const layer=document.createElement('div');
      layer.setAttribute('aria-hidden','true');
      Object.assign(layer.style,{
        position:'fixed',
        inset:'0',
        zIndex:'13000',
        pointerEvents:'none',
        background:'radial-gradient(circle at 50% 50%, rgba(255,0,0,.08), rgba(255,0,0,.28))',
        mixBlendMode:'screen',
        opacity:'0'
      });
      document.body.appendChild(layer);
      const anim=layer.animate([
        {opacity:0,offset:0},
        {opacity:1,offset:.16},
        {opacity:.72,offset:.38},
        {opacity:0,offset:1}
      ],{
        duration:520,
        easing:'ease-out'
      });
      anim.finished.finally(()=>layer.remove()).catch(()=>layer.remove());
    },

    popHealthNumber(el,delta=0){
      if(!el) return;
      const isDamage=delta<0;
      el.animate([
        {transform:'scale(1)',filter:'brightness(1)',offset:0},
        {transform:'scale(1.38)',filter:isDamage?'brightness(1.7) drop-shadow(0 0 10px rgba(255,64,64,.72))':'brightness(1.6) drop-shadow(0 0 10px rgba(102,255,166,.65))',offset:.38},
        {transform:'scale(.92)',filter:'brightness(1.08)',offset:.72},
        {transform:'scale(1)',filter:'brightness(1)',offset:1}
      ],{duration:460,easing:'cubic-bezier(.2,.8,.2,1)'});
    },

    burst(x,y){
      const el=document.createElement('div');
      el.className='collision-burst';
      el.style.left=(x-28)+'px';
      el.style.top=(y-28)+'px';
      document.getElementById('fx')?.appendChild(el);
      setTimeout(()=>el.remove(),420);
    },

    async flyCard(attackerEl,targetEl,options={}){
      if(!attackerEl||!targetEl) return;
      window.TCGSFX?.play?.('attack_start');
      const a=attackerEl.getBoundingClientRect();
      const t=targetEl.getBoundingClientRect();
      const clone=attackerEl.cloneNode(true);
      clone.classList.add('flying-card');
      clone.style.left=a.left+'px';clone.style.top=a.top+'px';clone.style.width=a.width+'px';clone.style.height=a.height+'px';
      document.body.appendChild(clone);
      attackerEl.style.opacity='.15';
      const source={x:a.left+a.width/2,y:a.top+a.height/2};
      const target={x:t.left+t.width/2,y:t.top+t.height/2};
      const fullDx=target.x-source.x;
      const fullDy=target.y-source.y;
      const distance=Math.max(1,Math.hypot(fullDx,fullDy));
      const ux=fullDx/distance;
      const uy=fullDy/distance;
      const contactGap=Math.max(26,Math.min(74,(Math.min(a.width,a.height)+Math.min(t.width,t.height))*.38));
      const hitX=fullDx-ux*contactGap;
      const hitY=fullDy-uy*contactGap;
      const lift=Math.max(42,Math.min(110,Math.abs(fullDx)*.09+Math.abs(fullDy)*.22+30));
      const rot=fullDx>=0?14:-14;
      const returnToSource=options.returnToSource!==false;
      const anim=clone.animate([
        {transform:'translate(0,0) rotate(0deg) scale(1)',offset:0},
        {transform:`translate(${hitX*.45}px,${hitY*.45-lift}px) rotate(${rot*.35}deg) scale(1.08)`,offset:.36},
        {transform:`translate(${hitX}px,${hitY}px) rotate(${rot}deg) scale(1.12)`,offset:.62},
        {transform:`translate(${hitX-ux*18}px,${hitY-uy*18}px) rotate(${-rot*.5}deg) scale(1.04)`,offset:.74},
        returnToSource
          ? {transform:'translate(0,0) rotate(0deg) scale(1)',offset:1}
          : {transform:`translate(${hitX-ux*8}px,${hitY-uy*8}px) rotate(${rot*.3}deg) scale(.82)`,opacity:0,offset:1}
      ],{duration:returnToSource?560:430,easing:'cubic-bezier(.18,.86,.22,1)',fill:'forwards'});
      await new Promise(resolve=>setTimeout(resolve,Math.round((returnToSource?560:430)*.62)));
      window.TCGSFX?.play?.('impact');
      this.burst(source.x+hitX,source.y+hitY);
      this.shake(targetEl,12,280);
      await anim.finished.catch(()=>{});
      targetEl.classList.add('impact-flash');
      setTimeout(()=>targetEl.classList.remove('impact-flash'),350);
      clone.remove();attackerEl.style.opacity='';
    },

    async fireBolt(fromEl,targetEl){
      window.TCGSFX?.play?.('fire');
      const a=center(fromEl),b=center(targetEl);
      const el=document.createElement('div');el.className='projectile';
      el.style.left=(a.x-15)+'px';el.style.top=(a.y-15)+'px';document.body.appendChild(el);
      const dx=b.x-a.x,dy=b.y-a.y;
      const anim=el.animate([
        {transform:'translate(0,0) scale(.7)',offset:0},
        {transform:`translate(${dx*.45}px,${dy*.45-55}px) scale(1.2)`,offset:.5},
        {transform:`translate(${dx}px,${dy}px) scale(.9)`,offset:1}
      ],{duration:520,easing:'cubic-bezier(.25,.8,.2,1)',fill:'forwards'});
      await anim.finished.catch(()=>{});el.remove();targetEl.classList.add('impact-flash');setTimeout(()=>targetEl.classList.remove('impact-flash'),350);
    },

    async blessing(targetEl){
      window.TCGSFX?.play?.('buff');
      const p=center(targetEl);const el=document.createElement('div');el.className='blessing-orb';
      el.style.left=(p.x-21)+'px';el.style.top=(p.y-21)+'px';document.body.appendChild(el);
      const anim=el.animate([
        {transform:'scale(.3) rotate(0deg)',opacity:0},
        {transform:'scale(1.5) rotate(180deg)',opacity:1,offset:.5},
        {transform:'scale(2.2) rotate(360deg)',opacity:0}
      ],{duration:650,easing:'ease-out',fill:'forwards'});
      await anim.finished.catch(()=>{});el.remove();targetEl.classList.add('impact-flash');setTimeout(()=>targetEl.classList.remove('impact-flash'),350);
    },

    async trapReveal(cardEl){
      if(!cardEl) return;
      window.TCGSFX?.play?.('trap_reveal');
      const clone=cardEl.cloneNode(true);const r=cardEl.getBoundingClientRect();clone.classList.add('trap-reveal');
      clone.classList.remove('face-down');clone.style.left=r.left+'px';clone.style.top=r.top+'px';clone.style.width=r.width+'px';clone.style.height=r.height+'px';document.body.appendChild(clone);
      const anim=clone.animate([
        {transform:'rotateY(180deg) scale(.8)',opacity:.4},
        {transform:'rotateY(0deg) scale(1.18)',opacity:1,offset:.55},
        {transform:'rotateY(0deg) scale(1)',opacity:1}
      ],{duration:650,easing:'ease-out',fill:'forwards'});
      await anim.finished.catch(()=>{});await sleep(250);clone.remove();
    },

    damage(targetEl,text,color='#ff7070'){
      if(!targetEl) return;const p=center(targetEl);const el=document.createElement('div');el.className=`damage-float ${String(text).startsWith('+')?'heal-float':''}`;el.textContent=text;el.style.color=color;el.style.left=(p.x-18)+'px';el.style.top=(p.y-22)+'px';document.getElementById('fx').appendChild(el);setTimeout(()=>el.remove(),930);
      const label=String(text);
      const handZone=targetEl.closest?.('.hand-target-zone')||(targetEl.classList?.contains('hand-target-zone')?targetEl:null);
      if(label.startsWith('+')) window.TCGSFX?.play?.('heal');
      else if(label.startsWith('-')) window.TCGSFX?.play?.(handZone?'hand_damage':'damage');
      else if(label.toUpperCase().includes('SHIELD')) window.TCGSFX?.play?.('shield');
      else if(label.toUpperCase().includes('POISON')) window.TCGSFX?.play?.('poison');
      else if(label.toUpperCase().includes('REBIRTH')) window.TCGSFX?.play?.('rebirth');
      if(String(text).startsWith('-')){
        if(handZone?.dataset?.handOwner==='player'){
          this.screenShake();
          this.playerDamageOverlay();
        }
        if(handZone?.dataset?.handOwner==='enemy') this.shake(handZone,13,360);
      }
    },

    calc(a,b,text){
      const p=center(a),q=center(b);const el=document.createElement('div');el.className='combat-calc';el.textContent=text;el.style.left=((p.x+q.x)/2-78)+'px';el.style.top=((p.y+q.y)/2-18)+'px';document.getElementById('fx').appendChild(el);setTimeout(()=>el.remove(),1000);
    }
  };
})();
