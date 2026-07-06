(function(){
  'use strict';

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const byId = id => document.getElementById(id);

  function createEnemyHandUI(){
    if(byId('enemyHandUI')) return;

    const battlefield = document.querySelector('.battlefield');
    if(!battlefield) return;

    const section = document.createElement('section');
    section.className = 'enemy-hand-ui';
    section.id = 'enemyHandUI';
    section.setAttribute('aria-label','Enemy hand, energy, and health');

    section.innerHTML = `
      <aside class="enemy-energy-panel">
        <span>Enemy Energy</span>
        <strong><b id="enemyEnergy">1</b>/<b id="enemyMaxEnergy">1</b></strong>
        <small>Hand <b id="enemyHandCount">0</b></small>
      </aside>

      <section
        class="enemy-hand-panel hand-target-zone enemy-hand-target"
        id="enemyHandTarget"
        data-hand-owner="enemy"
        aria-label="Enemy hand target"
      >
        <div class="enemy-hand" id="enemyHand" aria-label="Enemy hand, face down"></div>
        <div class="hand-health-badge" aria-label="Enemy hand health">
          <div class="health-liquid" aria-hidden="true">
            <i class="health-wave health-wave-a"></i>
            <i class="health-wave health-wave-b"></i>
            <i class="health-shine"></i>
          </div>
          <span>Health</span>
          <strong id="enemyHandHp">25</strong>
        </div>
      </section>

      <div class="enemy-hand-spacer" aria-hidden="true"></div>
    `;

    battlefield.parentNode.insertBefore(section,battlefield);
  }

  function preparePlayerHandUI(){
    const panel = document.querySelector('.hand-panel');
    if(!panel) return;

    panel.id = 'playerHandTarget';
    panel.classList.add('hand-target-zone','player-hand-target');
    panel.dataset.handOwner = 'player';
    panel.setAttribute('aria-label','Player hand and health');

    if(!byId('playerHandHp')){
      const badge = document.createElement('div');
      badge.className = 'hand-health-badge';
      badge.setAttribute('aria-label','Player hand health');
      badge.innerHTML = `
        <div class="health-liquid" aria-hidden="true">
          <i class="health-wave health-wave-a"></i>
          <i class="health-wave health-wave-b"></i>
          <i class="health-shine"></i>
        </div>
        <span>Health</span>
        <strong id="playerHandHp">25</strong>
      `;
      panel.appendChild(badge);
    }
  }

  function shouldDockRailsToScreen(){
    return window.matchMedia?.('(orientation:portrait), (max-width:760px)')?.matches;
  }

  function railHost(){
    return shouldDockRailsToScreen()
      ? document.body
      : document.querySelector('.board');
  }

  function syncScreenEdgeRails(){
    const host = railHost();
    if(!host) return;

    const statusRail = byId('verticalStatusRail');
    const phaseRail = byId('phaseStatusRail');

    statusRail?.classList.toggle('screen-edge-rail',shouldDockRailsToScreen());
    phaseRail?.classList.toggle('screen-edge-rail',shouldDockRailsToScreen());

    if(statusRail && statusRail.parentElement !== host){
      host.appendChild(statusRail);
    }

    if(phaseRail && phaseRail.parentElement !== host){
      host.appendChild(phaseRail);
    }
  }

  function getVerticalStatusRail(){
    const host = railHost();
    if(!host) return null;

    let rail = byId('verticalStatusRail');

    if(!rail){
      rail = document.createElement('aside');
      rail.id = 'verticalStatusRail';
      rail.className = 'vertical-status-rail';
      rail.setAttribute(
        'aria-label',
        'Enemy health, enemy energy, end turn, player energy, and player health'
      );
      host.appendChild(rail);
    }

    syncScreenEdgeRails();
    return rail;
  }


  function getPhaseStatusRail(){
    const host = railHost();
    if(!host) return null;

    let rail = byId('phaseStatusRail');

    if(!rail){
      rail = document.createElement('aside');
      rail.id = 'phaseStatusRail';
      rail.className = 'phase-status-rail';
      rail.setAttribute('aria-label','Current game phase');
      host.appendChild(rail);
    }

    syncScreenEdgeRails();
    return rail;
  }

  function updateVerticalPhaseStyle(phaseBadge){
    if(!phaseBadge) return;

    const text = phaseBadge.textContent.trim().toLowerCase();
    const isEnemy = text.includes('enemy');

    phaseBadge.classList.toggle('enemy-phase',isEnemy);
    phaseBadge.classList.toggle('player-phase',!isEnemy);
  }

  function animateVerticalPhaseChange(phaseBadge,previousText){
    if(!phaseBadge) return;

    const newText = phaseBadge.textContent.trim();
    const oldText = (previousText || '').trim();

    updateVerticalPhaseStyle(phaseBadge);

    if(!oldText || oldText === newText){
      phaseBadge.style.opacity = '1';
      return;
    }

    const rail = phaseBadge.parentElement;
    if(!rail) return;

    const oldGhost = document.createElement('span');
    oldGhost.className = 'vertical-phase-ghost';
    oldGhost.textContent = oldText;

    const oldIsEnemy = oldText.toLowerCase().includes('enemy');
    oldGhost.classList.add(
      oldIsEnemy ? 'enemy-phase' : 'player-phase'
    );

    rail.appendChild(oldGhost);

    if(phaseBadge.__phaseFadeAnimation){
      phaseBadge.__phaseFadeAnimation.cancel();
    }

    if(oldGhost.__phaseFadeAnimation){
      oldGhost.__phaseFadeAnimation.cancel();
    }

    phaseBadge.__phaseFadeAnimation = phaseBadge.animate(
      [
        {
          opacity:0,
          transform:'translateY(8px)'
        },
        {
          opacity:1,
          transform:'translateY(0)'
        }
      ],
      {
        duration:420,
        easing:'cubic-bezier(.22,.78,.25,1)',
        fill:'both'
      }
    );

    oldGhost.__phaseFadeAnimation = oldGhost.animate(
      [
        {
          opacity:1,
          transform:'translateY(0)'
        },
        {
          opacity:0,
          transform:'translateY(-8px)'
        }
      ],
      {
        duration:360,
        easing:'cubic-bezier(.4,0,.6,1)',
        fill:'forwards'
      }
    );

    oldGhost.__phaseFadeAnimation.finished
      .catch(()=>{})
      .finally(()=>{
        oldGhost.remove();
      });
  }

  function movePhaseStatusToBoard(){
    const rail = getPhaseStatusRail();
    const phaseBadge = byId('phaseText');
    const actionStatus = byId('timerStatus');

    if(rail && phaseBadge && phaseBadge.parentElement !== rail){
      rail.appendChild(phaseBadge);
    }

    if(phaseBadge){
      phaseBadge.classList.remove('phase-badge-hidden');
      phaseBadge.classList.add('vertical-phase-badge');
      updateVerticalPhaseStyle(phaseBadge);

      if(!phaseBadge.__lastPhaseText){
        phaseBadge.__lastPhaseText = phaseBadge.textContent.trim();
      }

      if(!phaseBadge.__verticalPhaseObserver){
        phaseBadge.__verticalPhaseObserver = new MutationObserver(()=>{
          const previousText = phaseBadge.__lastPhaseText || '';
          const currentText = phaseBadge.textContent.trim();

          if(previousText !== currentText){
            animateVerticalPhaseChange(
              phaseBadge,
              previousText
            );
            phaseBadge.__lastPhaseText = currentText;
          }else{
            updateVerticalPhaseStyle(phaseBadge);
          }
        });

        phaseBadge.__verticalPhaseObserver.observe(
          phaseBadge,
          {
            childList:true,
            characterData:true,
            subtree:true
          }
        );
      }
    }

    if(actionStatus){
      actionStatus.hidden = true;
      actionStatus.setAttribute('aria-hidden','true');
    }
  }

  function moveEndTurnToBoard(){
    const rail = getVerticalStatusRail();
    const wrap = document.querySelector('.end-turn-wrap');

    if(rail && wrap && wrap.parentElement !== rail){
      rail.appendChild(wrap);
    }
  }

  function handTarget(owner){
    return byId(owner === 'enemy' ? 'enemyHandTarget' : 'playerHandTarget');
  }

  function renderEnemyHand(game,animateLast){
    const state = game?.state;
    const handElement = byId('enemyHand');
    if(!state || !handElement) return;

    const energyElement = byId('enemyEnergy');
    const maxEnergyElement = byId('enemyMaxEnergy');
    const countElement = byId('enemyHandCount');

    if(energyElement) energyElement.textContent = state.enemyEnergy;

    if(maxEnergyElement){
      const auraBonus = typeof game.arcaneEnergyBonus === 'function'
        ? game.arcaneEnergyBonus()
        : 0;
      maxEnergyElement.textContent = Math.min(10,state.enemyMaxEnergy + auraBonus);
    }

    if(countElement) countElement.textContent = state.enemyHand.length;

    handElement.innerHTML = state.enemyHand.map((card,index)=>{
      const isLast = animateLast && index === state.enemyHand.length - 1;
      return `
        <div
          class="enemy-hand-card${isLast ? ' new-card' : ''}"
          aria-label="Face-down enemy card ${index + 1}"
          data-enemy-card-index="${index}"
        ></div>
      `;
    }).join('');
  }

  function updateResponsiveHandSpacing(){
    const clamp = (min,value,max)=>Math.max(min,Math.min(max,value));

    const update = (container,selector)=>{
      if(!container) return;

      const cards = [...container.querySelectorAll(selector)];
      const count = cards.length;

      container.classList.remove('hand-spread-short');
      container.classList.toggle('hand-spread-empty',count <= 0);

      if(count <= 1){
        container.style.setProperty('--hand-card-gap','0px');
        container.classList.toggle('hand-spread-roomy',count === 1);
        container.classList.remove('hand-spread-tight');
        return;
      }

      const styles = getComputedStyle(container);
      const paddingLeft = parseFloat(styles.paddingLeft) || 0;
      const paddingRight = parseFloat(styles.paddingRight) || 0;
      const available = Math.max(
        0,
        container.clientWidth - paddingLeft - paddingRight
      );
      const cardWidth =
        cards[0]?.getBoundingClientRect?.().width ||
        parseFloat(getComputedStyle(cards[0]).width) ||
        116;
      const rawGap = (available - (count * cardWidth)) / (count - 1);
      const roomPerCard = Math.max(0,available - (count * cardWidth)) / count;
      const badgeSafeStep = 40;
      const minGap = badgeSafeStep - cardWidth;
      const gap = rawGap >= 0
        ? 0
        : clamp(minGap,rawGap,0);
      const roomy = roomPerCard >= cardWidth * .18;

      container.style.setProperty('--hand-card-gap',`${Math.round(gap)}px`);
      container.classList.toggle('hand-spread-roomy',roomy);
      container.classList.toggle('hand-spread-tight',!roomy && gap < -1);
    };

    update(byId('hand'),'.card');
    update(byId('enemyHand'),'.enemy-hand-card');
  }

  function renderHandHealth(game){
    if(!game?.state) return;

    const playerHp = byId('playerHandHp');
    const enemyHp = byId('enemyHandHp');

    const ensureHealthLiquid = badge=>{
      if(!badge || badge.querySelector('.health-liquid')) return;

      const liquid = document.createElement('div');
      liquid.className = 'health-liquid';
      liquid.setAttribute('aria-hidden','true');
      liquid.innerHTML = `
        <i class="health-wave health-wave-a"></i>
        <i class="health-wave health-wave-b"></i>
        <i class="health-shine"></i>
      `;
      badge.insertBefore(liquid,badge.firstChild);
    };

    const update = (element,value)=>{
      if(!element) return;

      const next = Math.max(0,value);
      const max = 25;
      const ratio = Math.max(0,Math.min(1,next / max));
      const badge = element.closest('.hand-health-badge');
      const previous = element.dataset.lastValue === undefined
        ? next
        : Number(element.dataset.lastValue);

      element.textContent = next;
      element.dataset.lastValue = String(next);

      if(badge){
        ensureHealthLiquid(badge);

        const state = ratio <= .28
          ? 'low'
          : ratio <= .55
            ? 'mid'
            : 'high';

        const palette = {
          high:['rgba(72,218,116,.78)','rgba(28,126,71,.82)','rgba(205,255,216,.98)'],
          mid:['rgba(255,190,76,.80)','rgba(176,103,26,.86)','rgba(255,237,176,.98)'],
          low:['rgba(255,75,88,.82)','rgba(142,23,37,.90)','rgba(255,214,219,.98)']
        }[state];

        badge.dataset.healthState = state;
        badge.style.setProperty('--health-level',`${Math.round(ratio * 100)}%`);
        badge.style.setProperty('--health-fill',palette[0]);
        badge.style.setProperty('--health-fill-dark',palette[1]);
        badge.style.setProperty('--health-text',palette[2]);
      }

      if(previous !== next){
        window.TCGFX?.popHealthNumber?.(element,next - previous);
      }
    };

    update(playerHp,game.state.playerHp);
    update(enemyHp,game.state.enemyHp);
  }

  function escapeHTML(value){
    return String(value ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
  }

  function spellAreaInfo(card){
    if(card?.category !== 'spell'){
      return {key:'target',icon:'◇',label:'TARGET',title:'Targeted spell'};
    }

    if(card.spellType === 'shared' || card.scope === 'column'){
      return {
        key:'shared',
        icon:'↕',
        label:'SHARED',
        title:'Shared column spell'
      };
    }

    if(card.scope === 'spell_slot' || card.effect === 'destroy_spell'){
      return {
        key:'spell-slot',
        icon:'✖',
        label:'SPELL',
        title:'Targets an existing spell'
      };
    }

    if(card.scope === 'row'){
      if(card.placementSide === 'enemy'){
        return {
          key:'enemy-row',
          icon:'⇥',
          label:'ENEMY',
          title:'Targets an enemy row'
        };
      }

      if(card.placementSide === 'either'){
        return {
          key:'any-row',
          icon:'⇄',
          label:'ANY ROW',
          title:'Targets either player row'
        };
      }

      return {
        key:'friendly-row',
        icon:'⇤',
        label:'YOUR ROW',
        title:'Targets your row'
      };
    }

    return {key:'target',icon:'◇',label:'TARGET',title:'Targeted spell'};
  }

  function spellTimingInfo(card){
    if(card?.spellType === 'trap'){
      return {key:'trap',icon:'⚠',label:'TRAP',title:'Hidden trap spell'};
    }

    if(card?.spellType === 'shared'){
      return {key:'field',icon:'∞',label:'FIELD',title:'Persistent shared field'};
    }

    if(card?.spellType === 'ongoing'){
      return {key:'ongoing',icon:'∞',label:'ONGOING',title:'Persistent row spell'};
    }

    return {key:'instant',icon:'⚡',label:'NOW',title:'Instant spell'};
  }

  function discardCollection(game,owner){
    if(!game?.state) return [];
    return owner === 'player'
      ? game.state.playerDiscard
      : game.state.enemyDiscard;
  }

  function discardMiniHTML(card){
    if(!card) return '';

    const type = card.category === 'creature'
      ? card.creatureType
      : card.spellType;

    return `
      <article class="discard-mini-card ${card.owner === 'enemy' ? 'enemy' : ''} ${card.category === 'spell' ? 'spell-card' : ''}">
        <div class="discard-mini-art">
          <img src="${escapeHTML(card.img)}" alt="${escapeHTML(card.name)}" onerror="this.style.display='none'">
        </div>
        <div class="discard-mini-name">${escapeHTML(card.name)}</div>
        <div class="discard-mini-type">${escapeHTML(type)}</div>
      </article>
    `;
  }

  function discardViewerCardHTML(game,card,index){
    const isCreature = card.category === 'creature';
      const type = isCreature ? card.creatureType : card.spellType;
      const statHTML = isCreature
        ? `
          <div class="discard-view-stats">
            <span class="atk">ATK ${game.effectiveAttack?.(card) ?? card.atk ?? 0}</span>
          <span class="hp">HP ${Math.max(0,card.hp ?? card.maxHp ?? 0)}</span>
          ${game.effectiveCounter?.(card) > 0 ? `<span class="counter">CTR ${game.effectiveCounter(card)}</span>` : ''}
        </div>
        `
        : `
          <div class="discard-view-stats">
          <span class="atk" title="${escapeHTML(spellAreaInfo(card).title)}">${escapeHTML(spellAreaInfo(card).icon)}</span>
          <span class="hp" title="${escapeHTML(spellTimingInfo(card).title)}">${escapeHTML(spellTimingInfo(card).icon)}</span>
        </div>
      `;

    return `
      <article class="discard-view-card ${card.owner === 'enemy' ? 'enemy' : ''} ${card.category === 'spell' ? 'spell-card' : ''}" data-card-id="${escapeHTML(card.id)}" data-owner="${escapeHTML(card.owner)}">
        ${index === 0 ? '<div class="discard-newest-badge">Latest</div>' : ''}
        <div class="discard-view-art">
          <img src="${escapeHTML(card.img)}" alt="${escapeHTML(card.name)}" onerror="this.style.display='none'">
        </div>
        <div class="discard-view-cost">${escapeHTML(card.cost)}</div>
        <div class="discard-view-body">
          <div class="discard-view-name">${escapeHTML(card.name)}</div>
          <div class="discard-view-type">${escapeHTML(type)}</div>
          <p>${escapeHTML(card.description || 'No card text.')}</p>
        </div>
        ${statHTML}
      </article>
    `;
  }

  function renderDiscardPiles(game){
    for(const owner of ['player','enemy']){
      const pile = byId(owner === 'player' ? 'playerDiscardPile' : 'enemyDiscardPile');
      const stack = pile?.querySelector('.pile-card');
      const discard = discardCollection(game,owner);
      const topCard = discard[discard.length - 1];

      if(!pile || !stack) continue;

      pile.classList.toggle('has-discard',discard.length > 0);
      pile.setAttribute('role','button');
      pile.setAttribute('tabindex','0');
      pile.setAttribute(
        'aria-label',
        `${owner === 'player' ? 'Player' : 'Enemy'} discard pile, ${discard.length} cards`
      );
      stack.innerHTML = topCard ? discardMiniHTML(topCard) : '';
    }
  }

  function ensureDiscardViewer(){
    let overlay = byId('discardViewer');
    if(overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'discardViewer';
    overlay.className = 'discard-viewer';
    overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML = `
      <section class="discard-viewer-dialog" role="dialog" aria-modal="true" aria-labelledby="discardViewerTitle">
        <header class="discard-viewer-header">
          <div>
            <span class="discard-viewer-eyebrow" id="discardViewerOwner">Discard</span>
            <h2 id="discardViewerTitle">Discard Pile</h2>
          </div>
          <strong id="discardViewerCount">0 cards</strong>
        </header>
        <div class="discard-viewer-empty" id="discardViewerEmpty">No cards in discard yet.</div>
        <div class="discard-viewer-scroll" id="discardViewerScroll" aria-label="Discard cards"></div>
      </section>
    `;

    document.body.appendChild(overlay);

    const close = ()=>closeDiscardViewer();
    let dragScroll = null;
    let suppressCloseClick = false;
    let momentumFrame = null;

    const scrollElement = byId('discardViewerScroll');

    const updateDiscardEdgeFade = ()=>{
      if(!scrollElement) return;

      const maxScroll = Math.max(
        0,
        scrollElement.scrollWidth - scrollElement.clientWidth
      );
      const firstCard = scrollElement.querySelector('.discard-view-card');
      const scrollerRect = scrollElement.getBoundingClientRect();
      const firstRect = firstCard?.getBoundingClientRect();
      const latestCardStillVisible = firstRect
        ? firstRect.right > scrollerRect.left + 4
        : scrollElement.scrollLeft <= 2;
      const atStart = scrollElement.scrollLeft <= 2 || latestCardStillVisible;
      const atEnd = scrollElement.scrollLeft >= maxScroll - 2;

      scrollElement.classList.toggle('is-at-start',atStart);
      scrollElement.classList.toggle('is-away-from-start',!atStart);
      scrollElement.classList.toggle('is-at-end',atEnd);
    };

    const stopMomentum = ()=>{
      if(momentumFrame){
        cancelAnimationFrame(momentumFrame);
        momentumFrame = null;
      }
    };

    const playDiscardSettle = (direction=1)=>{
      if(!scrollElement) return;

      scrollElement.classList.remove(
        'settle-left',
        'settle-right',
        'is-momentum'
      );
      void scrollElement.offsetWidth;
      scrollElement.classList.add(
        direction < 0 ? 'settle-left' : 'settle-right'
      );

      setTimeout(()=>{
        scrollElement.classList.remove(
          'settle-left',
          'settle-right'
        );
      },360);
    };

    const startMomentum = initialVelocity=>{
      stopMomentum();

      let velocity = Math.max(-44,Math.min(44,initialVelocity));
      let lastDirection = velocity < 0 ? -1 : 1;

      scrollElement.classList.add('is-momentum');

      const step = ()=>{
        if(!scrollElement) return;

        const maxScroll = Math.max(
          0,
          scrollElement.scrollWidth - scrollElement.clientWidth
        );

        if(Math.abs(velocity) < .26){
          momentumFrame = null;
          scrollElement.classList.remove('is-momentum');
          playDiscardSettle(lastDirection);
          return;
        }

        const before = scrollElement.scrollLeft;
        let next = before + velocity;

        if(next < 0){
          next = 0;
          velocity = Math.abs(velocity) * .18;
        }else if(next > maxScroll){
          next = maxScroll;
          velocity = -Math.abs(velocity) * .18;
        }else{
          velocity *= .94;
        }

        lastDirection = velocity < 0 ? -1 : 1;
      scrollElement.scrollLeft = next;
      updateDiscardEdgeFade();

        if(next === before && (next === 0 || next === maxScroll)){
          momentumFrame = null;
          scrollElement.classList.remove('is-momentum');
          playDiscardSettle(lastDirection);
          return;
        }

        momentumFrame = requestAnimationFrame(step);
      };

      momentumFrame = requestAnimationFrame(step);
    };

    scrollElement?.addEventListener('wheel',event=>{
      const scroll = event.currentTarget;
      if(Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

      event.preventDefault();
      scroll.scrollBy({
        left:event.deltaY,
        behavior:'smooth'
      });
    },{passive:false});

    scrollElement?.addEventListener('pointerdown',event=>{
      stopMomentum();
      dragScroll = {
        pointerId:event.pointerId,
        startX:event.clientX,
        startY:event.clientY,
        startLeft:scrollElement.scrollLeft,
        lastX:event.clientX,
        lastTime:performance.now(),
        velocity:0,
        moved:false
      };
      scrollElement.classList.add('is-dragging');
      scrollElement.setPointerCapture?.(event.pointerId);
    });

    scrollElement?.addEventListener('pointermove',event=>{
      if(!dragScroll || dragScroll.pointerId !== event.pointerId) return;

      const dx = event.clientX - dragScroll.startX;
      const dy = event.clientY - dragScroll.startY;

      if(Math.hypot(dx,dy) > 6){
        dragScroll.moved = true;
        event.preventDefault();
      }

      const now = performance.now();
      const dt = Math.max(8,now - dragScroll.lastTime);
      dragScroll.velocity = -((event.clientX - dragScroll.lastX) / dt) * 18;
      dragScroll.lastX = event.clientX;
      dragScroll.lastTime = now;

      scrollElement.scrollLeft = dragScroll.startLeft - dx;
      updateDiscardEdgeFade();
    });

    const endDrag = event=>{
      if(!dragScroll || dragScroll.pointerId !== event.pointerId) return;

      const moved = dragScroll.moved;
      const velocity = dragScroll.velocity;

      if(moved){
        suppressCloseClick = true;
        setTimeout(()=>{
          suppressCloseClick = false;
        },140);
      }

      dragScroll = null;
      scrollElement.classList.remove('is-dragging');

      if(event.type !== 'pointercancel' && moved){
        startMomentum(velocity);
      }else{
        playDiscardSettle(velocity < 0 ? -1 : 1);
      }
    };

    scrollElement?.addEventListener('pointerup',endDrag);
    scrollElement?.addEventListener('pointercancel',endDrag);
    scrollElement?.addEventListener('scroll',updateDiscardEdgeFade,{passive:true});

    overlay.addEventListener('click',()=>{
      if(suppressCloseClick) return;
      close();
    });

    document.addEventListener('keydown',event=>{
      if(event.key === 'Escape' && overlay.classList.contains('open')){
        close();
      }
    });

    document.addEventListener('contextmenu',event=>{
      event.preventDefault();
    });

    return overlay;
  }

  function openDiscardViewer(game,owner){
    const overlay = ensureDiscardViewer();
    window.TCGSFX?.play?.('discard_open');
    const cards = discardCollection(game,owner).slice().reverse();
    const label = owner === 'player' ? 'Player Discard' : 'Enemy Discard';
    const scroll = byId('discardViewerScroll');
    const empty = byId('discardViewerEmpty');

    byId('discardViewerOwner').textContent = label;
    byId('discardViewerTitle').textContent = label;
    byId('discardViewerCount').textContent = `${cards.length} card${cards.length === 1 ? '' : 's'}`;

    if(scroll){
      scroll.classList.toggle('is-short-list',cards.length > 0 && cards.length < 4);
      scroll.classList.toggle('is-overflow-list',cards.length > 4);
      scroll.innerHTML = cards
        .map((card,index)=>discardViewerCardHTML(game,card,index))
        .join('');
    }

    if(empty) empty.hidden = cards.length > 0;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden','false');
    document.body.classList.add('discard-viewer-open');

    if(scroll){
      requestAnimationFrame(()=>{
        scroll.scrollLeft = 0;
        scroll.classList.add('is-at-start');
        scroll.classList.remove('is-away-from-start');
        scroll.classList.toggle(
          'is-at-end',
          scroll.scrollWidth <= scroll.clientWidth + 2
        );
      });
    }
  }

  const activeSpellSlotClasses = [
    'spell-aura-active',
    'spell-aura-heal',
    'spell-aura-attack',
    'spell-aura-defense',
    'spell-aura-poison',
    'spell-aura-trap',
    'spell-aura-shared',
    'spell-aura-column',
    'spell-linked-active',
    'spell-linked-heal',
    'spell-linked-attack',
    'spell-linked-defense',
    'spell-linked-poison',
    'spell-linked-trap',
    'spell-linked-shared'
  ];

  function activeSpellAura(card){
    if(!card || card.category !== 'spell') return '';
    if(card.spellType === 'trap') return 'trap';

    const effect = String(card.effect || '');

    if(effect.includes('heal') || effect.includes('cleanse')){
      return 'heal';
    }

    if(
      effect.includes('turn_damage') ||
      effect.includes('poison') ||
      effect.includes('attack_down') ||
      effect.includes('counter_down')
    ){
      return 'poison';
    }

    if(
      effect.includes('attack') ||
      effect.includes('pierce') ||
      effect.includes('ranged') ||
      effect.includes('melee')
    ){
      return 'attack';
    }

    if(
      effect.includes('counter') ||
      effect.includes('shield') ||
      effect.includes('barrier') ||
      effect.includes('stats')
    ){
      return 'defense';
    }

    return card.spellType === 'shared' ? 'shared' : 'defense';
  }

  function activeSpellTargetRows(card,owner){
    if(card.targetSide === 'friendly'){
      return owner === 'player'
        ? ['playerFront','playerBack']
        : ['enemyFront','enemyBack'];
    }

    if(card.targetSide === 'enemy'){
      return owner === 'player'
        ? ['enemyFront','enemyBack']
        : ['playerFront','playerBack'];
    }

    return ['enemyBack','enemyFront','playerFront','playerBack'];
  }

  function activeSpellAffectedSlots(game,row,lane,card){
    if(!card || card.category !== 'spell') return [];

    if(card.scope === 'row'){
      const context = game.spellRowContext?.(row);
      if(!context?.creatureRow) return [];

      return [0,1,2]
        .map(index=>document.querySelector(
          `.slot[data-row="${context.creatureRow}"][data-lane="${index}"]`
        ))
        .filter(Boolean);
    }

    if(card.scope === 'column' || card.spellType === 'shared'){
      return activeSpellTargetRows(card,card.owner || 'player')
        .map(targetRow=>document.querySelector(
          `.slot[data-row="${targetRow}"][data-lane="${lane}"]`
        ))
        .filter(Boolean);
    }

    return [];
  }

  function decorateActiveSpellSlots(game){
    if(!game?.state) return;

    document.querySelectorAll('.slot').forEach(slot=>{
      slot.classList.remove(...activeSpellSlotClasses);
      delete slot.dataset.activeSpellAura;
    });

    for(const [slotKey,card] of Object.entries(game.state.board || {})){
      if(
        !card ||
        card.category !== 'spell' ||
        card.spellType === 'instant'
      ){
        continue;
      }

      const split = slotKey.lastIndexOf('_');
      const row = slotKey.slice(0,split);
      const lane = Number(slotKey.slice(split + 1));
      const sourceSlot = document.querySelector(
        `.slot[data-row="${row}"][data-lane="${lane}"]`
      );
      const aura = activeSpellAura(card);

      if(sourceSlot && aura){
        sourceSlot.classList.add(
          'spell-aura-active',
          `spell-aura-${aura}`
        );

        if(card.spellType === 'shared'){
          sourceSlot.classList.add('spell-aura-column');
        }

        sourceSlot.dataset.activeSpellAura = aura;
      }

      for(const slot of activeSpellAffectedSlots(game,row,lane,card)){
        slot.classList.add(
          'spell-linked-active',
          `spell-linked-${aura}`
        );
      }
    }
  }

  function closeDiscardViewer(){
    const overlay = byId('discardViewer');
    if(!overlay) return;
    window.TCGSFX?.play?.('discard_close');

    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden','true');
    document.body.classList.remove('discard-viewer-open');
  }

  async function animateDraw(deckElement,handElement,owner){
    if(!deckElement || !handElement) return;
    window.TCGSFX?.play?.('draw');

    const deckRect = deckElement.getBoundingClientRect();
    const handRect = handElement.getBoundingClientRect();
    const cardWidth = 116;
    const cardHeight = 150;

    const startX = deckRect.left + deckRect.width / 2;
    const startY = deckRect.top + deckRect.height / 2;
    const endX = handRect.left + handRect.width * .5;
    const endY = owner === 'player'
      ? handRect.top + cardHeight / 2
      : handRect.bottom - cardHeight / 2;

    const dx = endX - startX;
    const dy = endY - startY;
    const arc = owner === 'player' ? -96 : 72;

    const flyingCard = document.createElement('div');
    flyingCard.className = 'draw-card half-hand-draw';
    flyingCard.style.left = `${startX - cardWidth / 2}px`;
    flyingCard.style.top = `${startY - cardHeight / 2}px`;
    document.body.appendChild(flyingCard);

    const endRotation = owner === 'player' ? '0deg' : '180deg';

    const animation = flyingCard.animate([
      {
        transform:'translate(0,0) rotateY(180deg) rotate(-4deg) scale(.82)',
        offset:0
      },
      {
        transform:`translate(${dx * .38}px,${dy * .38 + arc}px) rotateY(125deg) rotate(8deg) scale(1.02)`,
        offset:.42
      },
      {
        transform:`translate(${dx * .75}px,${dy * .75 + arc * .25}px) rotateY(45deg) rotate(-5deg) scale(1.01)`,
        offset:.74
      },
      {
        transform:`translate(${dx}px,${dy}px) rotateY(${endRotation}) rotate(0deg) scale(1)`,
        offset:1
      }
    ],{
      duration:650,
      easing:'cubic-bezier(.2,.8,.2,1)',
      fill:'forwards'
    });

    await animation.finished.catch(()=>{});
    flyingCard.remove();
  }

  function sameTarget(a,b){
    if(!a || !b || a.kind !== b.kind || a.owner !== b.owner) return false;
    if(a.kind === 'card') return a.row === b.row && a.lane === b.lane;
    return true;
  }


  function centerStatusPanels(){
    const rail = getVerticalStatusRail();
    if(!rail) return;

    const enemyHp = byId('enemyHandHp')?.closest('.hand-health-badge');
    const enemyHand = byId('enemyHandTarget');
    const enemyEnergy = document.querySelector('.enemy-energy-panel');
    const endTurn = document.querySelector('.end-turn-wrap');
    const playerEnergy = document.querySelector('.energy-panel');
    const playerHp = byId('playerHandHp')?.closest('.hand-health-badge');
    const playerHand = byId('playerHandTarget');

    enemyHp?.classList.add('enemy-hp-status');
    enemyEnergy?.classList.add('enemy-energy-status');
    playerEnergy?.classList.add('player-energy-status');
    playerHp?.classList.add('player-hp-status');

    if(enemyHp && enemyHand && enemyHp.parentElement !== enemyHand){
      enemyHand.appendChild(enemyHp);
    }

    if(playerHp && playerHand && playerHp.parentElement !== playerHand){
      playerHand.appendChild(playerHp);
    }

    const orderedControls = [
      enemyEnergy,
      endTurn,
      playerEnergy
    ];

    for(const control of orderedControls){
      if(control && control.parentElement !== rail){
        rail.appendChild(control);
      }
    }
  }

  function findCardAnywhere(game,cardId){
    if(!game?.state || !cardId) return null;

    const state = game.state;
    const collections = [
      state.playerHand,
      state.enemyHand,
      state.playerDeck,
      state.enemyDeck,
      state.playerDiscard,
      state.enemyDiscard,
      Object.values(state.board || {})
    ];

    for(const collection of collections){
      const card = collection?.find?.(item=>item?.id === cardId);
      if(card) return card;
    }

    return null;
  }

  function cardCanBePlayedNow(game,card){
    if(
      !game?.state ||
      !card ||
      game.state.phase !== 'player' ||
      game.locked ||
      game.transitioning ||
      card.cost > game.state.playerEnergy
    ){
      return false;
    }

    const hasValidSlot = Array.from(document.querySelectorAll('.slot')).some(slot=>{
      const row = slot.dataset.row;
      const lane = Number(slot.dataset.lane);
      return game.canDrop(card,row,lane,'player');
    });

    if(!hasValidSlot) return false;

    if(card.category === 'spell' && card.spellType === 'instant'){
      return game.validSpellTargets(card).length > 0;
    }

    return true;
  }

  function decorateRenderedCards(game){
    document.querySelectorAll('.card[data-card-id]').forEach(cardElement=>{
      const card = findCardAnywhere(game,cardElement.dataset.cardId);
      if(!card) return;

      cardElement.classList.remove(
        'spell-trap',
        'spell-shared',
        'playable-now',
        'not-playable-now'
      );

      if(card.category === 'spell' && card.spellType === 'trap'){
        cardElement.classList.add('spell-trap');
      }

      if(card.category === 'spell' && card.spellType === 'shared'){
        cardElement.classList.add('spell-shared');
      }

      if(cardElement.classList.contains('hand-card')){
        cardElement.classList.add(
          cardCanBePlayedNow(game,card)
            ? 'playable-now'
            : 'not-playable-now'
        );
      }
    });
  }

  function installHandCombat(){
    createEnemyHandUI();
    preparePlayerHandUI();
    centerStatusPanels();
    moveEndTurnToBoard();
    movePhaseStatusToBoard();
    syncScreenEdgeRails();

    if(!window.__tcgScreenEdgeRailSyncInstalled){
      window.__tcgScreenEdgeRailSyncInstalled = true;
      window.addEventListener('resize',syncScreenEdgeRails,{passive:true});
      window.addEventListener('orientationchange',syncScreenEdgeRails,{passive:true});
    }

    const game = window.game;
    if(!game || game.__edgeHandCombatInstalled) return;
    game.__edgeHandCombatInstalled = true;
    game.updateHandSpacing = updateResponsiveHandSpacing;

    if(!window.__tcgResponsiveHandSpacingInstalled){
      window.__tcgResponsiveHandSpacingInstalled = true;
      const scheduleHandSpacing = ()=>{
        requestAnimationFrame(()=>window.game?.updateHandSpacing?.());
      };
      window.addEventListener('resize',scheduleHandSpacing,{passive:true});
      window.addEventListener('orientationchange',scheduleHandSpacing,{passive:true});
    }

    if(!window.__tcgContextMenuDisabled){
      window.__tcgContextMenuDisabled = true;
      document.addEventListener('contextmenu',event=>{
        event.preventDefault();
      },true);
    }

    game.handTargetElement = handTarget;

    game.markTarget = function(target){
      let element = null;

      if(target.kind === 'hand' || target.kind === 'hero'){
        element = handTarget(target.owner);
      }else{
        element = document.querySelector(
          `.slot[data-row="${target.row}"][data-lane="${target.lane}"]`
        );
      }

      if(!element) return;

      element.classList.add('target','valid-target');
      element.dataset.targetKind = target.kind === 'hero' ? 'hand' : target.kind;
      element.dataset.targetOwner = target.owner || '';
      element.dataset.targetRow = target.row || '';
      element.dataset.targetLane = target.lane ?? '';
    };

    game.targetFromElement = function(element){
      const handZone = element.closest?.('.hand-target-zone');
      if(handZone){
        return {
          kind:'hand',
          owner:handZone.dataset.handOwner
        };
      }

      if(element.classList?.contains('hero')){
        return {
          kind:'hand',
          owner:element.id === 'enemyHero' ? 'enemy' : 'player'
        };
      }

      const row = element.dataset.row;
      const lane = Number(element.dataset.lane);
      const card = this.at(row,lane);

      return {
        kind:'card',
        owner:card?.owner,
        row,
        lane,
        card
      };
    };

    game.validAttackTargets = function(attackerId){
      const location = this.locateCard(attackerId);
      if(!location) return [];

      const defender = location.card.owner === 'player' ? 'enemy' : 'player';
      const lane = location.lane;
      const frontRow = defender === 'enemy' ? 'enemyFront' : 'playerFront';
      const backRow = defender === 'enemy' ? 'enemyBack' : 'playerBack';
      const front = this.at(frontRow,lane);
      const back = this.at(backRow,lane);

      if(front){
        return [{kind:'card',owner:defender,row:frontRow,lane,card:front}];
      }

      if(back){
        return [{kind:'card',owner:defender,row:backRow,lane,card:back}];
      }

      return [{kind:'hand',owner:defender}];
    };

    game.beginAttack = function(attackerId){
      if(this.locked || this.state.phase !== 'player') return;

      const location = this.locateCard(attackerId);
      if(!location || !location.card.canAttack) return;
      if(!this.tutorialGuardAttack?.(location.card)) return;

      const targets = this.validAttackTargets(attackerId);
      if(!targets.length) return;

      this.state.selectedHand = null;

      /* Empty opposing lane: immediately hit the opposing hand. */
      if(targets.length === 1 && targets[0].kind === 'hand'){
        this.state.mode = null;
        this.render();
        void this.resolveAttack(location,targets[0]);
        return;
      }

      /* A defending creature exists: retain manual target confirmation. */
      this.state.mode = {type:'attack',attackerId};
      this.render();
    };

    game.resolvePlayerAttackTarget = async function(target){
      const mode = this.state.mode;
      if(!mode || mode.type !== 'attack' || this.locked) return;

      const isValid = this.validAttackTargets(mode.attackerId)
        .some(candidate=>sameTarget(candidate,target));

      if(!isValid) return;

      const attackerLocation = this.locateCard(mode.attackerId);
      this.state.mode = null;
      await this.resolveAttack(attackerLocation,target);
    };

    game.resolveAttack = async function(attackerLocation,target,after){
      if(!attackerLocation || !attackerLocation.card || !attackerLocation.card.canAttack){
        after?.();
        return;
      }

      this.locked = true;
      this.hideLine();

      const attacker = attackerLocation.card;

      if(target.kind === 'card'){
        const trapKilled = await this.triggerTrap(target.row,attackerLocation);
        if(trapKilled){
          this.locked = false;
          this.state.mode = null;
          this.render();
          after?.();
          return;
        }
      }

      const attackerElement = this.cardEl(attacker.id);
      const targetElement = target.kind === 'card'
        ? this.cardEl(target.card.id)
        : handTarget(target.owner);

      await window.TCGFX.flyCard(attackerElement,targetElement);
      attacker.canAttack = false;

      if(target.kind === 'hand' || target.kind === 'hero'){
        const damage = this.effectiveAttack(attacker);

        if(target.owner === 'enemy') this.state.enemyHp -= damage;
        else this.state.playerHp -= damage;

        this.updateBattleMusic?.();
        window.TCGFX.damage(targetElement,`-${damage}`);
        this.log(`${attacker.name} struck the ${target.owner === 'enemy' ? 'Enemy' : 'Player'} Hand for ${damage}.`);
      }else{
        const attackerDamage = this.effectiveAttack(attacker);
        const defenderDamage = this.effectiveAttack(target.card);

        window.TCGFX.calc(
          attackerElement,
          targetElement,
          `${attacker.name} ${attackerDamage} ⚔ ${target.card.name} ${defenderDamage}`
        );

        target.card.hp -= attackerDamage;
        attacker.hp -= defenderDamage;
        window.TCGFX.damage(targetElement,`-${attackerDamage}`);
        window.TCGFX.damage(attackerElement,`-${defenderDamage}`);
        this.log(`${attacker.name} attacked ${target.card.name}: ${attackerDamage} / ${defenderDamage}.`);

        await sleep(420);

        if(target.card.hp <= 0) this.destroyCreature(target.row,target.lane);
        if(attacker.hp <= 0) this.destroyCreature(attackerLocation.row,attackerLocation.lane);
      }

      this.locked = false;
      this.state.mode = null;
      this.render();
      this.checkGameOver();
      after?.();
    };

    game.validSpellTargets = function(card){
      const targets = [];
      const friendly = card.owner || 'player';
      const enemy = friendly === 'player' ? 'enemy' : 'player';

      if(card.effect === 'damage'){
        const rows = enemy === 'enemy'
          ? ['enemyFront','enemyBack']
          : ['playerFront','playerBack'];

        for(const row of rows){
          for(let lane = 0; lane < 3; lane++){
            const creature = this.at(row,lane);
            if(creature){
              targets.push({kind:'card',owner:enemy,row,lane,card:creature});
            }
          }
        }

        targets.push({kind:'hand',owner:enemy});
      }else if(card.effect === 'buff'){
        const rows = friendly === 'player'
          ? ['playerFront','playerBack']
          : ['enemyFront','enemyBack'];

        for(const row of rows){
          for(let lane = 0; lane < 3; lane++){
            const creature = this.at(row,lane);
            if(creature){
              targets.push({kind:'card',owner:friendly,row,lane,card:creature});
            }
          }
        }
      }

      return targets;
    };

    game.resolvePlayerSpellTarget = async function(target){
      const mode = this.state.mode;
      if(!mode || mode.type !== 'spell' || this.locked) return;

      const card = this.getCardInHand('player',mode.cardId);
      if(!card || card.cost > this.state.playerEnergy){
        this.cancelMode();
        return;
      }

      const isValid = this.validSpellTargets(card)
        .some(candidate=>sameTarget(candidate,target));

      if(!isValid) return;

      this.locked = true;

      const source = this.cardEl(card.id);
      const targetElement = target.kind === 'card'
        ? this.cardEl(target.card.id)
        : handTarget(target.owner);

      this.hideLine();

      if(card.effect === 'damage'){
        await window.TCGFX.fireBolt(source,targetElement);
      }else{
        await window.TCGFX.blessing(targetElement);
      }

      this.spendEnergy('player',card.cost);
      this.removeFromHand('player',card.id);
      this.discard(card);

      if(card.effect === 'damage'){
        if(target.kind === 'hand'){
          this.state.enemyHp -= card.value;
          this.updateBattleMusic?.();
          window.TCGFX.damage(targetElement,`-${card.value}`);
          this.log(`Fire Bolt dealt ${card.value} damage to the Enemy Hand.`);
        }else{
          target.card.hp -= card.value;
          window.TCGFX.damage(targetElement,`-${card.value}`);
          this.log(`Fire Bolt dealt ${card.value} damage to ${target.card.name}.`);
          if(target.card.hp <= 0) this.destroyCreature(target.row,target.lane);
        }
      }else{
        target.card.atkBonus += card.value;
        target.card.maxHp += card.value;
        target.card.hp += card.value;
        target.card.buffs.push('blessing');
        this.log(`Blessing gave ${target.card.name} +${card.value}/+${card.value}.`);
      }

      this.state.mode = null;
      this.state.selectedHand = null;
      this.locked = false;
      this.render();
      this.checkGameOver();
    };

    game.aiDamageTarget = function(){
      const candidates = [];

      for(const row of ['playerFront','playerBack']){
        for(let lane = 0; lane < 3; lane++){
          const creature = this.at(row,lane);
          if(creature){
            candidates.push({kind:'card',owner:'player',row,lane,card:creature});
          }
        }
      }

      candidates.sort((a,b)=>{
        const aScore = (a.card.hp <= 3 ? 100 : 0) + this.effectiveAttack(a.card);
        const bScore = (b.card.hp <= 3 ? 100 : 0) + this.effectiveAttack(b.card);
        return bScore - aScore;
      });

      return candidates[0] || {kind:'hand',owner:'player'};
    };

    game.aiCastInstant = async function(card){
      const target = card.effect === 'damage'
        ? this.aiDamageTarget()
        : this.aiBuffTarget();

      if(!target) return false;

      this.locked = true;

      const source = card.effect === 'damage'
        ? byId('enemySpellFront')
        : byId('enemySpellBack');

      const targetElement = target.kind === 'card'
        ? this.cardEl(target.card.id)
        : handTarget('player');

      if(card.effect === 'damage'){
        await window.TCGFX.fireBolt(source,targetElement);
      }else{
        await window.TCGFX.blessing(targetElement);
      }

      this.spendEnergy('enemy',card.cost);
      this.removeFromHand('enemy',card.id);
      this.discard(card);

      if(card.effect === 'damage'){
        if(target.kind === 'hand'){
          this.state.playerHp -= card.value;
          this.updateBattleMusic?.();
          window.TCGFX.damage(targetElement,`-${card.value}`);
          this.log(`Enemy Fire Bolt hit the Player Hand for ${card.value}.`);
        }else{
          target.card.hp -= card.value;
          window.TCGFX.damage(targetElement,`-${card.value}`);
          this.log(`Enemy Fire Bolt hit ${target.card.name} for ${card.value}.`);
          if(target.card.hp <= 0) this.destroyCreature(target.row,target.lane);
        }
      }else{
        target.card.atkBonus += card.value;
        target.card.maxHp += card.value;
        target.card.hp += card.value;
        target.card.buffs.push('blessing');
        this.log(`Enemy Blessing buffed ${target.card.name}.`);
      }

      this.locked = false;
      this.render();
      await sleep(350);
      return true;
    };

    game.aiAttackPhase = async function(){
      const attackers = [];

      for(const row of ['enemyFront','enemyBack']){
        for(let lane = 0; lane < 3; lane++){
          const creature = this.at(row,lane);
          if(creature?.canAttack) attackers.push({row,lane,card:creature});
        }
      }

      for(const attacker of attackers){
        const live = this.at(attacker.row,attacker.lane);
        if(!live || !live.canAttack) continue;

        const target = this.validAttackTargets(live.id)[0];
        if(!target) continue;

        this.state.mode = {type:'attack',attackerId:live.id};
        this.render();

        const targetElement = target.kind === 'card'
          ? document.querySelector(
              `.slot[data-row="${target.row}"][data-lane="${target.lane}"]`
            )
          : handTarget('player');

        this.showLineTo(targetElement);
        await sleep(700);
        this.state.mode = null;

        await this.resolveAttack(
          {row:attacker.row,lane:attacker.lane,card:live},
          target
        );

        await sleep(300);
        if(this.checkGameOver()) break;
      }
    };


    /* =====================================================
       POSITIONAL SPELL ENGINE
       - Private spell slots resolve horizontally by row.
       - Shared spell slots resolve vertically by column.
       - Traps trigger automatically from their row.
       ===================================================== */

    game.sideSpellRows = function(owner){
      return owner === 'player'
        ? ['playerSpellFront','playerSpellBack']
        : ['enemySpellFront','enemySpellBack'];
    };

    game.rowSpellContext = function(spellRow,owner){
      const front = spellRow.endsWith('Front');

      return {
        band:front ? 'front' : 'back',
        ownCreatureRow:owner === 'player'
          ? (front ? 'playerFront' : 'playerBack')
          : (front ? 'enemyFront' : 'enemyBack'),
        enemyCreatureRow:owner === 'player'
          ? (front ? 'enemyFront' : 'enemyBack')
          : (front ? 'playerFront' : 'playerBack')
      };
    };

    game.creaturesInRow = function(row){
      const targets = [];

      for(let lane = 0; lane < 3; lane++){
        const card = this.at(row,lane);
        if(card?.category === 'creature'){
          targets.push({
            kind:'card',
            owner:card.owner,
            row,
            lane,
            card
          });
        }
      }

      return targets;
    };

    game.creaturesInColumn = function(lane){
      const targets = [];

      for(const row of ['enemyBack','enemyFront','playerFront','playerBack']){
        const card = this.at(row,lane);
        if(card?.category === 'creature'){
          targets.push({
            kind:'card',
            owner:card.owner,
            row,
            lane,
            card
          });
        }
      }

      return targets;
    };

    game.rowSpellTargets = function(card,spellRow,owner){
      const context = this.rowSpellContext(spellRow,owner);

      if(card.targetSide === 'enemy'){
        return this.creaturesInRow(context.enemyCreatureRow);
      }

      if(card.targetSide === 'friendly'){
        return this.creaturesInRow(context.ownCreatureRow);
      }

      return [
        ...this.creaturesInRow(context.ownCreatureRow),
        ...this.creaturesInRow(context.enemyCreatureRow)
      ];
    };

    game.allowedRows = function(card,owner){
      if(card.category === 'creature'){
        if(owner === 'player'){
          return card.creatureType === 'melee'
            ? ['playerFront']
            : ['playerBack'];
        }

        return card.creatureType === 'melee'
          ? ['enemyFront']
          : ['enemyBack'];
      }

      if(card.spellType === 'shared'){
        return ['sharedSpell'];
      }

      return this.sideSpellRows(owner);
    };

    game.canDrop = function(card,row,lane,owner){
      if(
        this.state.phase !== owner ||
        card.cost > this.currentEnergy(owner) ||
        !this.allowedRows(card,owner).includes(row)
      ){
        return false;
      }

      if(card.category === 'creature'){
        return !this.at(row,lane);
      }

      if(card.spellType === 'shared' || card.spellType === 'trap'){
        return !this.at(row,lane);
      }

      if(card.spellType === 'instant' && card.scope === 'row'){
        return (
          !this.at(row,lane) &&
          this.rowSpellTargets(card,row,owner).length > 0
        );
      }

      return false;
    };

    game.validSpellTargets = function(card){
      if(
        card?.category !== 'spell' ||
        card.spellType !== 'instant' ||
        card.scope !== 'row'
      ){
        return [];
      }

      const owner = card.owner || 'player';
      const targets = [];

      for(const spellRow of this.sideSpellRows(owner)){
        if(this.at(spellRow,0)) continue;
        targets.push(...this.rowSpellTargets(card,spellRow,owner));
      }

      return targets;
    };

    game.beginSpellTarget = function(){
      /* Positional row spells resolve immediately from the chosen spell slot. */
    };

    game.resolvePlayerSpellTarget = async function(){
      /* Manual spell targeting is intentionally disabled. */
    };

    game.resolveRowSpell = async function(card,spellRow,owner,options={}){
      const targets = this.rowSpellTargets(card,spellRow,owner);
      if(!targets.length) return false;

      this.locked = true;
      this.hideLine();

      const source = this.cardEl(card.id) || byId(spellRow);

      if(card.effect === 'row_damage'){
        for(const target of targets){
          const targetElement = this.cardEl(target.card.id);
          if(targetElement){
            await window.TCGFX.fireBolt(source,targetElement);
          }

          target.card.hp -= card.value;
          if(targetElement){
            window.TCGFX.damage(targetElement,`-${card.value}`);
          }

          await sleep(90);
        }
      }

      if(card.effect === 'row_buff'){
        for(const target of targets){
          const targetElement = this.cardEl(target.card.id);
          if(targetElement){
            await window.TCGFX.blessing(targetElement);
          }

          target.card.atkBonus += card.value;
          target.card.maxHp += card.value;
          target.card.hp += card.value;
          target.card.buffs.push('row_blessing');

          await sleep(80);
        }
      }

      if(!options.costPaid){
        this.spendEnergy(owner,card.cost);
      }

      if(!options.removedFromHand){
        this.removeFromHand(owner,card.id);
      }

      if(this.at(spellRow,0)?.id === card.id){
        this.remove(spellRow,0);
      }

      this.discard(card);

      const context = this.rowSpellContext(spellRow,owner);
      const rowLabel = context.band === 'front'
        ? 'Baris Depan'
        : 'Baris Belakang';

      if(card.effect === 'row_damage'){
        this.log(`${card.name} memberikan ${card.value} damage kepada ${targets.length} creature pada ${rowLabel}.`);
      }else{
        this.log(`${card.name} memberikan +${card.value}/+${card.value} kepada ${targets.length} creature pada ${rowLabel}.`);
      }

      for(const target of targets){
        if(target.card.hp <= 0 && this.at(target.row,target.lane)?.id === target.card.id){
          this.destroyCreature(target.row,target.lane);
        }
      }

      this.state.mode = null;
      this.state.selectedHand = null;
      this.locked = false;
      this.render();
      this.checkGameOver();

      return true;
    };

    game.playCardToSlot = async function(cardId,row,lane,owner='player'){
      if(this.locked) return false;

      const card = this.getCardInHand(owner,cardId);
      if(!card || !this.canDrop(card,row,lane,owner)) return false;

      if(
        card.category === 'spell' &&
        card.spellType === 'instant' &&
        card.scope === 'row'
      ){
        return await this.resolveRowSpell(card,row,owner);
      }

      this.spendEnergy(owner,card.cost);
      this.removeFromHand(owner,card.id);
      card.canAttack = false;
      card.summonedTurn = this.state.turn;
      this.place(row,lane,card);
      this.state.selectedHand = null;

      const label = owner === 'player' ? 'Player' : 'Enemy';
      const scopeText = card.scope === 'column'
        ? ` pada kolom ${lane + 1}`
        : card.scope === 'row'
          ? ` pada ${row.endsWith('Front') ? 'Baris Depan' : 'Baris Belakang'}`
          : '';

      this.log(`${label} memainkan ${card.name}${scopeText}.`);
      this.render();

      const element = this.cardEl(card.id);
      if(element){
        element.animate([
          {transform:'translateY(18px) scale(.72)',opacity:.2},
          {transform:'translateY(-5px) scale(1.08)',opacity:1,offset:.72},
          {transform:'translateY(0) scale(1)',opacity:1}
        ],{
          duration:430,
          easing:'ease-out'
        });
      }

      await sleep(260);
      return true;
    };

    game.effectiveAttack = function(card){
      if(!card || card.category !== 'creature') return 0;

      let value = card.atk + (card.atkBonus || 0);
      const location = this.locateCard(card.id);

      if(location){
        const shared = this.at('sharedSpell',location.lane);

        if(
          shared?.effect === 'column_ranged_attack' &&
          ['ranged','flyer'].includes(card.creatureType)
        ){
          value += shared.value;
        }

        if(
          shared?.effect === 'column_melee_attack' &&
          card.creatureType === 'melee'
        ){
          value += shared.value;
        }
      }

      return Math.max(0,value);
    };

    game.arcaneEnergyBonus = function(){
      /* Arcane Well is now a vertical creature-healing effect, not Energy. */
      return 0;
    };

    game.applyColumnTurnStartEffects = function(){
      let totalHealed = 0;

      for(let lane = 0; lane < 3; lane++){
        const shared = this.at('sharedSpell',lane);
        if(shared?.effect !== 'column_turn_heal') continue;

        for(const target of this.creaturesInColumn(lane)){
          const before = target.card.hp;
          target.card.hp = Math.min(
            target.card.maxHp,
            target.card.hp + shared.value
          );

          const healed = target.card.hp - before;
          if(healed > 0){
            totalHealed += healed;
            const element = this.cardEl(target.card.id);
            if(element){
              window.TCGFX.damage(element,`+${healed}`);
            }
          }
        }
      }

      if(totalHealed > 0){
        this.log(`Arcane Well memulihkan total ${totalHealed} Health pada kolom aktif.`);
      }
    };

    game.triggerTrap = async function(defenderRow,attackerLocation){
      const spellRowByCreatureRow = {
        playerFront:'playerSpellFront',
        playerBack:'playerSpellBack',
        enemyFront:'enemySpellFront',
        enemyBack:'enemySpellBack'
      };

      const spellRow = spellRowByCreatureRow[defenderRow];
      if(!spellRow) return false;

      const trap = this.at(spellRow,0);
      if(
        !trap ||
        trap.spellType !== 'trap' ||
        trap.scope !== 'row' ||
        trap.effect !== 'row_trap'
      ){
        return false;
      }

      const trapElement = this.cardEl(trap.id);
      if(trapElement){
        await window.TCGFX.trapReveal(trapElement);
      }

      const attacker = this.at(attackerLocation.row,attackerLocation.lane);
      if(!attacker) return true;

      attacker.hp -= trap.value;

      const attackerElement = this.cardEl(attacker.id);
      if(attackerElement){
        window.TCGFX.damage(attackerElement,`-${trap.value}`);
      }

      const rowLabel = defenderRow.endsWith('Front')
        ? 'Baris Depan'
        : 'Baris Belakang';

      this.log(`Trap Rune pada ${rowLabel} aktif dan memberikan ${trap.value} damage kepada ${attacker.name}.`);

      this.discard(this.remove(spellRow,0));
      this.render();
      await sleep(350);

      if(attacker.hp <= 0){
        this.destroyCreature(attackerLocation.row,attackerLocation.lane);
        this.render();
        return true;
      }

      return false;
    };

    game.aiBestRowSpellSlot = function(card){
      const owner = 'enemy';
      const rows = this.sideSpellRows(owner);
      let best = null;

      for(const row of rows){
        if(!this.canDrop(card,row,0,owner)) continue;

        const targets = this.rowSpellTargets(card,row,owner);
        let score = targets.length * 10;

        if(card.effect === 'row_damage'){
          score += targets.reduce((sum,target)=>{
            return sum +
              (target.card.hp <= card.value ? 30 : 0) +
              this.effectiveAttack(target.card);
          },0);
        }

        if(card.effect === 'row_buff'){
          score += targets.reduce((sum,target)=>{
            return sum + this.effectiveAttack(target.card) + target.card.hp;
          },0);
        }

        if(!best || score > best.score){
          best = {row,lane:0,score};
        }
      }

      return best;
    };

    game.aiBestTrapSlot = function(card){
      let best = null;

      for(const row of this.sideSpellRows('enemy')){
        if(!this.canDrop(card,row,0,'enemy')) continue;

        const context = this.rowSpellContext(row,'enemy');
        const allies = this.creaturesInRow(context.ownCreatureRow);
        const enemies = this.creaturesInRow(context.enemyCreatureRow);
        const score = allies.length * 12 + enemies.length * 5;

        if(!best || score > best.score){
          best = {row,lane:0,score};
        }
      }

      return best;
    };

    game.aiBestSharedLane = function(card){
      let best = null;

      for(let lane = 0; lane < 3; lane++){
        if(!this.canDrop(card,'sharedSpell',lane,'enemy')) continue;

        const creatures = this.creaturesInColumn(lane);
        let score = creatures.length;

        if(card.effect === 'column_ranged_attack'){
          score += creatures.filter(target=>
            target.owner === 'enemy' &&
            ['ranged','flyer'].includes(target.card.creatureType)
          ).length * 20;
        }

        if(card.effect === 'column_melee_attack'){
          score += creatures.filter(target=>
            target.owner === 'enemy' &&
            target.card.creatureType === 'melee'
          ).length * 20;
        }

        if(card.effect === 'column_turn_heal'){
          score += creatures.filter(target=>
            target.owner === 'enemy' &&
            target.card.hp < target.card.maxHp
          ).length * 20;
        }

        if(!best || score > best.score){
          best = {row:'sharedSpell',lane,score};
        }
      }

      return best;
    };

    game.chooseAiPlay = function(){
      const playable = this.state.enemyHand
        .filter(card=>card.cost <= this.state.enemyEnergy);

      if(!playable.length) return null;

      for(const card of playable.filter(card=>
        card.category === 'spell' &&
        card.spellType === 'instant' &&
        card.scope === 'row'
      )){
        const slot = this.aiBestRowSpellSlot(card);
        if(slot) return {card,...slot};
      }

      for(const card of playable.filter(card=>
        card.category === 'spell' &&
        card.spellType === 'trap'
      )){
        const slot = this.aiBestTrapSlot(card);
        if(slot) return {card,...slot};
      }

      for(const card of playable.filter(card=>
        card.category === 'spell' &&
        card.spellType === 'shared'
      )){
        const slot = this.aiBestSharedLane(card);
        if(slot) return {card,...slot};
      }

      const creatures = playable
        .filter(card=>card.category === 'creature')
        .sort((a,b)=>b.cost - a.cost);

      for(const card of creatures){
        for(const row of this.allowedRows(card,'enemy')){
          for(let lane = 0; lane < 3; lane++){
            if(this.canDrop(card,row,lane,'enemy')){
              return {card,row,lane};
            }
          }
        }
      }

      return null;
    };

    game.aiPlay = async function(choice){
      return await this.playCardToSlot(
        choice.card.id,
        choice.row,
        choice.lane,
        'enemy'
      );
    };

    game.aiCastInstant = async function(card){
      const slot = this.aiBestRowSpellSlot(card);
      if(!slot) return false;

      return await this.playCardToSlot(
        card.id,
        slot.row,
        slot.lane,
        'enemy'
      );
    };

    game.startPlayerTurn = async function(){
      if(this.checkGameOver()) return;

      this.transitioning = true;
      this.state.phase = 'player';
      this.state.turn += 1;
      this.state.playerMaxEnergy = Math.min(
        10,
        this.state.playerMaxEnergy + 1
      );
      this.state.playerEnergy = this.state.playerMaxEnergy;

      for(const card of Object.values(this.state.board)){
        if(card.owner === 'player' && card.category === 'creature'){
          card.canAttack = true;
        }
      }

      this.applyColumnTurnStartEffects();
      this.banner('Player Phase');
      this.render();
      await this.drawAnimated('player');

      this.transitioning = false;
      this.startTimer();
      this.render();
      this.log('Giliran Player dimulai.');
    };

    game.startEnemyTurn = async function(){
      if(this.checkGameOver()) return;

      this.state.enemyMaxEnergy = Math.min(
        10,
        this.state.enemyMaxEnergy + 1
      );
      this.state.enemyEnergy = this.state.enemyMaxEnergy;

      for(const card of Object.values(this.state.board)){
        if(card.owner === 'enemy' && card.category === 'creature'){
          card.canAttack = true;
        }
      }

      this.applyColumnTurnStartEffects();
      this.render();
      await this.drawAnimated('enemy');
      await this.aiMainPhase();
      await this.aiAttackPhase();

      this.transitioning = false;

      if(!this.checkGameOver()){
        await this.startPlayerTurn();
      }
    };



    /* =====================================================
       SPELL DURATION + DISPEL ENGINE
       ===================================================== */

    game.allSpellRows = function(){
      return [
        'enemySpellBack',
        'enemySpellFront',
        'sharedSpell',
        'playerSpellFront',
        'playerSpellBack'
      ];
    };

    game.isPersistentSpell = function(card){
      return Boolean(
        card &&
        card.category === 'spell' &&
        (
          card.duration === 'persistent' ||
          card.duration === 'triggered' ||
          card.spellType === 'shared' ||
          card.spellType === 'trap' ||
          card.spellType === 'ongoing'
        )
      );
    };

    game.spellRemovalTargets = function(owner){
      const targets = [];

      for(const row of this.allSpellRows()){
        const lanes = row === 'sharedSpell' ? [0,1,2] : [0];

        for(const lane of lanes){
          const card = this.at(row,lane);

          if(
            this.isPersistentSpell(card) &&
            card.owner !== owner
          ){
            targets.push({
              kind:'spell',
              owner:card.owner,
              row,
              lane,
              card
            });
          }
        }
      }

      return targets;
    };

    game.allowedRows = function(card,owner){
      if(card.category === 'creature'){
        if(owner === 'player'){
          return card.creatureType === 'melee'
            ? ['playerFront']
            : ['playerBack'];
        }

        return card.creatureType === 'melee'
          ? ['enemyFront']
          : ['enemyBack'];
      }

      if(card.effect === 'destroy_spell'){
        return this.allSpellRows();
      }

      if(card.spellType === 'shared'){
        return ['sharedSpell'];
      }

      return this.sideSpellRows(owner);
    };

    game.canDrop = function(card,row,lane,owner){
      if(
        this.state.phase !== owner ||
        card.cost > this.currentEnergy(owner) ||
        !this.allowedRows(card,owner).includes(row)
      ){
        return false;
      }

      if(card.category === 'creature'){
        return !this.at(row,lane);
      }

      if(card.effect === 'destroy_spell'){
        const target = this.at(row,lane);

        return Boolean(
          target &&
          target.owner !== owner &&
          this.isPersistentSpell(target)
        );
      }

      if(
        card.spellType === 'shared' ||
        card.spellType === 'trap' ||
        card.spellType === 'ongoing'
      ){
        return !this.at(row,lane);
      }

      if(
        card.spellType === 'instant' &&
        card.scope === 'row'
      ){
        return (
          !this.at(row,lane) &&
          this.rowSpellTargets(card,row,owner).length > 0
        );
      }

      return false;
    };

    game.validSpellTargets = function(card){
      if(
        card?.category !== 'spell' ||
        card.spellType !== 'instant'
      ){
        return [];
      }

      const owner = card.owner || 'player';

      if(card.effect === 'destroy_spell'){
        return this.spellRemovalTargets(owner);
      }

      if(card.scope !== 'row'){
        return [];
      }

      const targets = [];

      for(const spellRow of this.sideSpellRows(owner)){
        if(this.at(spellRow,0)) continue;
        targets.push(...this.rowSpellTargets(card,spellRow,owner));
      }

      return targets;
    };

    game.applyPhaseBuff = function(target,card,owner){
      target.card.atkBonus += card.value;
      target.card.maxHp += card.value;
      target.card.hp += card.value;

      if(!Array.isArray(target.card.phaseBuffs)){
        target.card.phaseBuffs = [];
      }

      target.card.phaseBuffs.push({
        sourceId:card.id,
        sourceName:card.name,
        owner,
        atk:card.value,
        hp:card.value
      });
    };

    game.clearPhaseBuffs = function(owner){
      let cleared = 0;

      for(const card of Object.values(this.state.board)){
        if(
          card?.category !== 'creature' ||
          !Array.isArray(card.phaseBuffs) ||
          !card.phaseBuffs.length
        ){
          continue;
        }

        const expiring = card.phaseBuffs.filter(buff=>buff.owner === owner);
        if(!expiring.length) continue;

        const attackReduction = expiring.reduce(
          (sum,buff)=>sum + (buff.atk || 0),
          0
        );

        const healthReduction = expiring.reduce(
          (sum,buff)=>sum + (buff.hp || 0),
          0
        );

        card.atkBonus = Math.max(
          0,
          (card.atkBonus || 0) - attackReduction
        );

        card.maxHp = Math.max(
          1,
          (card.maxHp || 1) - healthReduction
        );

        card.hp = Math.min(card.hp,card.maxHp);

        card.phaseBuffs = card.phaseBuffs.filter(
          buff=>buff.owner !== owner
        );

        cleared += expiring.length;
      }

      if(cleared > 0){
        this.log(`Efek sementara fase ${owner === 'player' ? 'Player' : 'Enemy'} telah berakhir.`);
      }
    };

    game.resolveRowSpell = async function(card,spellRow,owner,options={}){
      const targets = this.rowSpellTargets(card,spellRow,owner);
      if(!targets.length) return false;

      this.locked = true;
      this.hideLine();

      const source = this.cardEl(card.id) || byId(spellRow);

      if(card.effect === 'row_damage'){
        for(const target of targets){
          const targetElement = this.cardEl(target.card.id);

          if(targetElement){
            await window.TCGFX.fireBolt(source,targetElement);
          }

          target.card.hp -= card.value;

          if(targetElement){
            window.TCGFX.damage(targetElement,`-${card.value}`);
          }

          await sleep(90);
        }
      }

      if(card.effect === 'row_phase_buff'){
        for(const target of targets){
          const targetElement = this.cardEl(target.card.id);

          if(targetElement){
            await window.TCGFX.blessing(targetElement);
          }

          this.applyPhaseBuff(target,card,owner);
          await sleep(80);
        }
      }

      if(!options.costPaid){
        this.spendEnergy(owner,card.cost);
      }

      if(!options.removedFromHand){
        this.removeFromHand(owner,card.id);
      }

      if(this.at(spellRow,0)?.id === card.id){
        this.remove(spellRow,0);
      }

      this.discard(card);

      const context = this.rowSpellContext(spellRow,owner);
      const rowLabel = context.band === 'front'
        ? 'Baris Depan'
        : 'Baris Belakang';

      if(card.effect === 'row_damage'){
        this.log(`${card.name} memberikan ${card.value} damage kepada ${targets.length} creature pada ${rowLabel}, lalu masuk ke Discard.`);
      }else{
        this.log(`${card.name} memberi +${card.value}/+${card.value} kepada ${targets.length} creature pada ${rowLabel} sampai fase berakhir.`);
      }

      for(const target of targets){
        if(
          target.card.hp <= 0 &&
          this.at(target.row,target.lane)?.id === target.card.id
        ){
          this.destroyCreature(target.row,target.lane);
        }
      }

      this.state.mode = null;
      this.state.selectedHand = null;
      this.locked = false;
      this.render();
      this.checkGameOver();

      return true;
    };

    game.resolveDispel = async function(card,row,lane,owner){
      const target = this.at(row,lane);

      if(
        !target ||
        target.owner === owner ||
        !this.isPersistentSpell(target)
      ){
        return false;
      }

      this.locked = true;
      this.hideLine();

      const targetElement = this.cardEl(target.id);

      if(targetElement){
        window.TCGFX.damage(targetElement,'DISPEL');

        const animation = targetElement.animate([
          {
            transform:'scale(1)',
            filter:'brightness(1) saturate(1)',
            opacity:1
          },
          {
            transform:'scale(1.08)',
            filter:'brightness(2.1) saturate(.1)',
            opacity:1,
            offset:.45
          },
          {
            transform:'scale(.72)',
            filter:'brightness(2.6) saturate(0)',
            opacity:0
          }
        ],{
          duration:440,
          easing:'ease-in',
          fill:'forwards'
        });

        await animation.finished.catch(()=>{});
      }else{
        await sleep(220);
      }

      this.spendEnergy(owner,card.cost);
      this.removeFromHand(owner,card.id);
      this.discard(card);

      const removedSpell = this.remove(row,lane);
      this.discard(removedSpell);

      this.log(`${owner === 'player' ? 'Player' : 'Enemy'} menggunakan Dispel dan menghancurkan ${removedSpell.name}.`);

      this.state.mode = null;
      this.state.selectedHand = null;
      this.locked = false;
      this.render();

      return true;
    };

    game.playCardToSlot = async function(cardId,row,lane,owner='player'){
      if(this.locked) return false;

      const card = this.getCardInHand(owner,cardId);
      if(!card || !this.canDrop(card,row,lane,owner)){window.TCGSFX?.play?.('invalid');return false}
      if(!this.tutorialGuardPlayCard?.(card,row,lane,owner)) return false;

      if(card.effect === 'destroy_spell'){
        window.TCGSFX?.play?.('play_spell');
        const ok = await this.resolveDispel(card,row,lane,owner);
        if(ok) this.tutorialAfterPlayCard?.(card,row,lane,owner);
        return ok;
      }

      if(
        card.category === 'spell' &&
        card.spellType === 'instant' &&
        card.scope === 'row'
      ){
        if(!this.rowSpellTargets(card,row,owner).length){
          window.TCGSFX?.play?.('invalid');
          return false;
        }

        window.TCGSFX?.play?.('play_spell');
        this.spendEnergy(owner,card.cost);
        this.removeFromHand(owner,card.id);
        this.place(row,lane,card);
        this.state.selectedHand = null;
        this.render();
        await sleep(120);

        const ok = await this.resolveRowSpell(
          card,
          row,
          owner,
          {costPaid:true,removedFromHand:true}
        );

        if(ok) this.tutorialAfterPlayCard?.(card,row,lane,owner);
        return ok;
      }

      this.spendEnergy(owner,card.cost);
      this.removeFromHand(owner,card.id);
      card.canAttack = false;
      card.summonedTurn = this.state.turn;
      this.place(row,lane,card);
      this.state.selectedHand = null;

      const label = owner === 'player' ? 'Player' : 'Enemy';
      const durationLabel = card.duration === 'persistent'
        ? ' dan tetap aktif di board'
        : card.duration === 'triggered'
          ? ' dan menunggu pemicu'
          : '';

      const scopeText = card.scope === 'column'
        ? ` pada kolom ${lane + 1}`
        : card.scope === 'row'
          ? ` pada ${row.endsWith('Front') ? 'Baris Depan' : 'Baris Belakang'}`
          : '';

      this.log(`${label} memainkan ${card.name}${scopeText}${durationLabel}.`);
      this.render();

      const element = this.cardEl(card.id);

      if(element){
        element.animate([
          {transform:'translateY(18px) scale(.72)',opacity:.2},
          {transform:'translateY(-5px) scale(1.08)',opacity:1,offset:.72},
          {transform:'translateY(0) scale(1)',opacity:1}
        ],{
          duration:430,
          easing:'ease-out'
        });
      }

      await sleep(260);
      this.tutorialAfterPlayCard?.(card,row,lane,owner);
      return true;
    };

    game.aiBestDispelTarget = function(){
      const candidates = this.spellRemovalTargets('enemy');

      if(!candidates.length) return null;

      candidates.sort((a,b)=>{
        const score = target=>{
          let value = 0;

          if(target.card.spellType === 'shared') value += 40;
          if(target.card.spellType === 'trap') value += 28;
          if(target.card.duration === 'persistent') value += 20;
          if(target.card.effect === 'column_turn_heal') value += 10;

          return value;
        };

        return score(b) - score(a);
      });

      const best = candidates[0];

      return {
        row:best.row,
        lane:best.lane,
        score:100
      };
    };

    game.chooseAiPlay = function(){
      const playable = this.state.enemyHand
        .filter(card=>card.cost <= this.state.enemyEnergy);

      if(!playable.length) return null;

      for(const card of playable.filter(card=>
        card.effect === 'destroy_spell'
      )){
        const slot = this.aiBestDispelTarget();
        if(slot) return {card,...slot};
      }

      for(const card of playable.filter(card=>
        card.category === 'spell' &&
        card.spellType === 'instant' &&
        card.scope === 'row'
      )){
        const slot = this.aiBestRowSpellSlot(card);
        if(slot) return {card,...slot};
      }

      for(const card of playable.filter(card=>
        card.category === 'spell' &&
        card.spellType === 'trap'
      )){
        const slot = this.aiBestTrapSlot(card);
        if(slot) return {card,...slot};
      }

      for(const card of playable.filter(card=>
        card.category === 'spell' &&
        card.spellType === 'shared'
      )){
        const slot = this.aiBestSharedLane(card);
        if(slot) return {card,...slot};
      }

      const creatures = playable
        .filter(card=>card.category === 'creature')
        .sort((a,b)=>b.cost - a.cost);

      for(const card of creatures){
        for(const row of this.allowedRows(card,'enemy')){
          for(let lane = 0; lane < 3; lane++){
            if(this.canDrop(card,row,lane,'enemy')){
              return {card,row,lane};
            }
          }
        }
      }

      return null;
    };

    game.startPlayerTurn = async function(){
      if(this.checkGameOver()) return;

      this.clearPhaseBuffs('enemy');
      this.transitioning = true;
      this.state.phase = 'player';
      this.state.turn += 1;
      this.state.playerMaxEnergy = Math.min(
        10,
        this.state.playerMaxEnergy + 1
      );
      this.state.playerEnergy = this.state.playerMaxEnergy;

      for(const card of Object.values(this.state.board)){
        if(card.owner === 'player' && card.category === 'creature'){
          card.canAttack = true;
        }
      }

      this.applyColumnTurnStartEffects();
      this.banner('Player Phase');
      this.render();
      await this.drawAnimated('player');

      this.transitioning = false;
      this.startTimer();
      this.render();
      this.log('Giliran Player dimulai.');
    };

    game.startEnemyTurn = async function(){
      if(this.checkGameOver()) return;

      this.clearPhaseBuffs('player');
      this.state.enemyMaxEnergy = Math.min(
        10,
        this.state.enemyMaxEnergy + 1
      );
      this.state.enemyEnergy = this.state.enemyMaxEnergy;

      for(const card of Object.values(this.state.board)){
        if(card.owner === 'enemy' && card.category === 'creature'){
          card.canAttack = true;
        }
      }

      this.applyColumnTurnStartEffects();
      this.render();
      await this.drawAnimated('enemy');
      await this.aiMainPhase();
      await this.aiAttackPhase();

      this.transitioning = false;

      if(!this.checkGameOver()){
        await this.startPlayerTurn();
      }
    };



    /* =====================================================
       CROSS-ROW SPELL PLACEMENT
       A row spell affects the creature row aligned with the
       physical spell slot where it is placed.
       ===================================================== */

    game.opponentOf = function(owner){
      return owner === 'player' ? 'enemy' : 'player';
    };

    game.opponentSpellRows = function(owner){
      return this.sideSpellRows(this.opponentOf(owner));
    };

    game.rowPlacementRows = function(card,owner){
      if(card.placementSide === 'enemy'){
        return this.opponentSpellRows(owner);
      }

      if(card.placementSide === 'either'){
        return [
          ...this.sideSpellRows(owner),
          ...this.opponentSpellRows(owner)
        ];
      }

      return this.sideSpellRows(owner);
    };

    game.spellRowContext = function(spellRow){
      const contexts = {
        playerSpellFront:{
          band:'front',
          rowOwner:'player',
          creatureRow:'playerFront'
        },
        playerSpellBack:{
          band:'back',
          rowOwner:'player',
          creatureRow:'playerBack'
        },
        enemySpellFront:{
          band:'front',
          rowOwner:'enemy',
          creatureRow:'enemyFront'
        },
        enemySpellBack:{
          band:'back',
          rowOwner:'enemy',
          creatureRow:'enemyBack'
        }
      };

      return contexts[spellRow] || null;
    };

    game.rowSpellContext = function(spellRow){
      const context = this.spellRowContext(spellRow);

      if(!context){
        return {
          band:'front',
          rowOwner:null,
          creatureRow:null,
          ownCreatureRow:null,
          enemyCreatureRow:null
        };
      }

      return {
        ...context,
        ownCreatureRow:context.creatureRow,
        enemyCreatureRow:context.creatureRow
      };
    };

    game.rowSpellTargets = function(card,spellRow){
      const context = this.spellRowContext(spellRow);
      if(!context) return [];
      return this.creaturesInRow(context.creatureRow);
    };

    game.creatureRowToSpellRow = function(creatureRow){
      const map = {
        playerFront:'playerSpellFront',
        playerBack:'playerSpellBack',
        enemyFront:'enemySpellFront',
        enemyBack:'enemySpellBack'
      };

      return map[creatureRow] || null;
    };

    game.allowedRows = function(card,owner){
      if(card.category === 'creature'){
        if(owner === 'player'){
          return card.creatureType === 'melee'
            ? ['playerFront']
            : ['playerBack'];
        }

        return card.creatureType === 'melee'
          ? ['enemyFront']
          : ['enemyBack'];
      }

      if(card.effect === 'destroy_spell'){
        return this.allSpellRows();
      }

      if(card.spellType === 'shared'){
        return ['sharedSpell'];
      }

      if(card.scope === 'row'){
        return this.rowPlacementRows(card,owner);
      }

      return [];
    };

    game.canDrop = function(card,row,lane,owner){
      if(
        this.state.phase !== owner ||
        card.cost > this.currentEnergy(owner) ||
        !this.allowedRows(card,owner).includes(row)
      ){
        return false;
      }

      if(card.category === 'creature'){
        return !this.at(row,lane);
      }

      if(card.effect === 'destroy_spell'){
        const target = this.at(row,lane);

        return Boolean(
          target &&
          target.owner !== owner &&
          this.isPersistentSpell(target)
        );
      }

      if(
        card.spellType === 'shared' ||
        card.spellType === 'trap' ||
        card.spellType === 'ongoing'
      ){
        return !this.at(row,lane);
      }

      if(
        card.spellType === 'instant' &&
        card.scope === 'row'
      ){
        return (
          !this.at(row,lane) &&
          this.rowSpellTargets(card,row,owner).length > 0
        );
      }

      return false;
    };

    game.validSpellTargets = function(card){
      if(
        card?.category !== 'spell' ||
        card.spellType !== 'instant'
      ){
        return [];
      }

      const owner = card.owner || 'player';

      if(card.effect === 'destroy_spell'){
        return this.spellRemovalTargets(owner);
      }

      if(card.scope !== 'row'){
        return [];
      }

      const targets = [];

      for(const spellRow of this.allowedRows(card,owner)){
        if(this.at(spellRow,0)) continue;
        targets.push(...this.rowSpellTargets(card,spellRow,owner));
      }

      return targets;
    };

    game.effectiveAttack = function(card){
      if(!card || card.category !== 'creature') return 0;

      let value = card.atk + (card.atkBonus || 0);
      const location = this.locateCard(card.id);

      if(location){
        const shared = this.at('sharedSpell',location.lane);

        if(
          shared?.effect === 'column_ranged_attack' &&
          ['ranged','flyer'].includes(card.creatureType)
        ){
          value += shared.value;
        }

        if(
          shared?.effect === 'column_melee_attack' &&
          card.creatureType === 'melee'
        ){
          value += shared.value;
        }

        const rowSpellName = this.creatureRowToSpellRow(location.row);
        const rowSpell = rowSpellName
          ? this.at(rowSpellName,0)
          : null;

        if(
          rowSpell?.effect === 'row_attack_down' &&
          rowSpell.owner !== card.owner
        ){
          value -= rowSpell.value;
        }
      }

      return Math.max(0,value);
    };

    game.aiBestRowSpellSlot = function(card){
      const owner = 'enemy';
      let best = null;

      for(const row of this.allowedRows(card,owner)){
        if(!this.canDrop(card,row,0,owner)) continue;

        const targets = this.rowSpellTargets(card,row,owner);
        let score = targets.length * 10;

        if(card.effect === 'row_damage'){
          score += targets.reduce((sum,target)=>{
            return sum +
              (target.card.hp <= card.value ? 30 : 0) +
              this.effectiveAttack(target.card);
          },0);
        }

        if(card.effect === 'row_phase_buff'){
          score += targets.reduce((sum,target)=>{
            return sum +
              this.effectiveAttack(target.card) +
              target.card.hp;
          },0);
        }

        if(!best || score > best.score){
          best = {row,lane:0,score};
        }
      }

      return best;
    };

    game.aiBestTrapSlot = function(card){
      let best = null;

      for(const row of this.allowedRows(card,'enemy')){
        if(!this.canDrop(card,row,0,'enemy')) continue;

        const targets = this.rowSpellTargets(card,row,'enemy');
        const score = targets.length * 15;

        if(!best || score > best.score){
          best = {row,lane:0,score};
        }
      }

      return best;
    };

    game.aiBestOngoingRowSlot = function(card){
      let best = null;

      for(const row of this.allowedRows(card,'enemy')){
        if(!this.canDrop(card,row,0,'enemy')) continue;

        const targets = this.rowSpellTargets(card,row,'enemy');
        const score = targets.reduce((sum,target)=>{
          return sum +
            this.effectiveAttack(target.card) * 3 +
            target.card.hp +
            8;
        },0);

        if(!best || score > best.score){
          best = {row,lane:0,score};
        }
      }

      return best;
    };

    game.chooseAiPlay = function(){
      const playable = this.state.enemyHand
        .filter(card=>card.cost <= this.state.enemyEnergy);

      if(!playable.length) return null;

      for(const card of playable.filter(card=>
        card.effect === 'destroy_spell'
      )){
        const slot = this.aiBestDispelTarget();
        if(slot) return {card,...slot};
      }

      for(const card of playable.filter(card=>
        card.category === 'spell' &&
        card.spellType === 'instant' &&
        card.scope === 'row'
      )){
        const slot = this.aiBestRowSpellSlot(card);
        if(slot) return {card,...slot};
      }

      for(const card of playable.filter(card=>
        card.category === 'spell' &&
        card.spellType === 'ongoing' &&
        card.scope === 'row'
      )){
        const slot = this.aiBestOngoingRowSlot(card);
        if(slot) return {card,...slot};
      }

      for(const card of playable.filter(card=>
        card.category === 'spell' &&
        card.spellType === 'trap'
      )){
        const slot = this.aiBestTrapSlot(card);
        if(slot) return {card,...slot};
      }

      for(const card of playable.filter(card=>
        card.category === 'spell' &&
        card.spellType === 'shared'
      )){
        const slot = this.aiBestSharedLane(card);
        if(slot) return {card,...slot};
      }

      const creatures = playable
        .filter(card=>card.category === 'creature')
        .sort((a,b)=>b.cost - a.cost);

      for(const card of creatures){
        for(const row of this.allowedRows(card,'enemy')){
          for(let lane = 0; lane < 3; lane++){
            if(this.canDrop(card,row,lane,'enemy')){
              return {card,row,lane};
            }
          }
        }
      }

      return null;
    };



    /* =====================================================
       70-CARD ENGINE + CASUAL COUNTER SYSTEM
       ===================================================== */

    game.MAX_HAND_HP = 25;

    game.healHand = function(owner,amount){
      const key = owner === 'player' ? 'playerHp' : 'enemyHp';
      const before = this.state[key];
      this.state[key] = Math.min(this.MAX_HAND_HP,before + Math.max(0,amount));
      this.updateBattleMusic?.();
      return this.state[key] - before;
    };

    game.boardIndicatorHTML = function(card){
      if(card?.category !== 'creature') return '';

      const icons = [];
      const shield = card.shieldCharges || 0;
      const pierce = this.effectivePierce?.(card) ?? ((card.pierce || 0) + (card.pierceBonus || 0));
      const furyActive =
        card.fury &&
        card.hp <= Math.ceil((card.maxHp || card.hp || 1) / 2);

      if(card.quick) icons.push({key:'quick',icon:'⚡'});
      if(shield > 0) icons.push({key:'shield',icon:'🛡',value:shield});
      if(card.venom) icons.push({key:'poison',icon:'☠',value:card.venom > 1 ? card.venom : null});
      if(card.poison > 0) icons.push({key:'poisoned',icon:'☠',value:card.poison});
      if(card.stealth) icons.push({key:'stealth',icon:'◐'});
      if(card.rebirth && !card.rebirthUsed) icons.push({key:'rebirth',icon:'↺'});
      if(card.regen) icons.push({key:'regen',icon:'✚',value:card.regen > 1 ? card.regen : null});
      if(pierce > 0) icons.push({key:'pierce',icon:'◆',value:pierce > 1 ? pierce : null});
      if(card.lifesteal) icons.push({key:'lifesteal',icon:'♥',value:card.lifesteal > 1 ? card.lifesteal : null});
      if(card.splash) icons.push({key:'splash',icon:'✹',value:card.splash > 1 ? card.splash : null});
      if(card.execute) icons.push({key:'execute',icon:'×'});
      if(card.sniper) icons.push({key:'sniper',icon:'◎'});
      if(furyActive) icons.push({key:'fury',icon:'▲'});

      if(!icons.length) return '';

      return `
        <div class="board-passive-icons" aria-hidden="true">
          ${icons.map(item=>`
            <span class="board-passive-chip passive-${item.key}">
              <b>${item.icon}</b>${item.value ? `<em>${item.value}</em>` : ''}
            </span>
          `).join('')}
        </div>
      `;
    };

    game.cardHTML = function(card,extra=''){
      const enemy = card.owner === 'enemy' ? 'enemy' : '';
      const spellClass = card.category === 'spell' ? 'spell-card' : '';
      const statusClass =
        card.category === 'creature' && (card.shieldCharges || 0) > 0
          ? 'has-board-shield'
          : '';
      const faceDown =
        card.spellType === 'trap' &&
        card.owner === 'enemy'
          ? 'face-down'
          : '';

      const selected =
        this.state.selectedHand === card.id
          ? 'hand-selected'
          : '';

      const art = `
        <div class="art">
          <img
            src="${card.img}"
            alt="${card.name}"
            onerror="this.style.display='none'"
          >
        </div>
      `;

      let stats = '';

      if(card.category === 'creature'){
        const attack = this.effectiveAttack(card);
        const counter = this.effectiveCounter(card);
        const health = Math.max(0,card.hp);
        const attackDelta = this.statDelta(card,'attack',attack);
        const healthDelta = this.statDelta(card,'health',card.maxHp ?? health);
        const counterDelta = this.statDelta(card,'counter',counter);

        stats = `
          <div class="stats">
            <span class="atk${this.statModClass(attackDelta)}" title="${escapeHTML(this.statTitle('Attack',attackDelta))}">⚔ ${attack}</span>
            <span class="hp${this.statModClass(healthDelta)}" title="${escapeHTML(this.statTitle('Health',healthDelta))}">♥ ${health}</span>
            ${counter > 0 || counterDelta !== 0 ? `<span class="counter${this.statModClass(counterDelta)}" title="${escapeHTML(this.statTitle('Counter',counterDelta))}">↩ ${counter}</span>` : ''}
          </div>
        `;
      }else{
        const area = spellAreaInfo(card);
        const timing = spellTimingInfo(card);

        stats = `
          <div class="stats">
            <span class="atk spell-badge spell-${area.key}" title="${escapeHTML(area.title)}">
              <b>${escapeHTML(area.icon)}</b>
            </span>
            <span class="hp spell-badge spell-${timing.key}" title="${escapeHTML(timing.title)}">
              <b>${escapeHTML(timing.icon)}</b>
            </span>
            ${typeof card.turnsLeft === 'number' ? `<span class="duration">⏳ ${card.turnsLeft}</span>` : ''}
          </div>
        `;
      }

      return `
        <article
          class="card ${enemy} ${spellClass} ${statusClass} ${faceDown} ${selected} ${extra}"
          data-card-id="${card.id}"
          data-owner="${card.owner}"
        >
          <div class="cost">${card.cost}</div>
          ${art}
          ${this.boardIndicatorHTML(card)}
          <div class="card-info">
            <div class="name">${card.name}</div>
            <div class="type">
              ${card.category === 'creature' ? card.creatureType : card.spellType}
            </div>
          </div>
          ${stats}
        </article>
      `;
    };

    game.creatureRowToSpellRow = function(creatureRow){
      const map = {
        playerFront:'playerSpellFront',
        playerBack:'playerSpellBack',
        enemyFront:'enemySpellFront',
        enemyBack:'enemySpellBack'
      };

      return map[creatureRow] || null;
    };

    game.spellRowContext = function(spellRow){
      const map = {
        playerSpellFront:{
          band:'front',
          rowOwner:'player',
          creatureRow:'playerFront'
        },
        playerSpellBack:{
          band:'back',
          rowOwner:'player',
          creatureRow:'playerBack'
        },
        enemySpellFront:{
          band:'front',
          rowOwner:'enemy',
          creatureRow:'enemyFront'
        },
        enemySpellBack:{
          band:'back',
          rowOwner:'enemy',
          creatureRow:'enemyBack'
        }
      };

      return map[spellRow] || null;
    };

    game.opponentOf = function(owner){
      return owner === 'player' ? 'enemy' : 'player';
    };

    game.opponentSpellRows = function(owner){
      return this.sideSpellRows(this.opponentOf(owner));
    };

    game.rowPlacementRows = function(card,owner){
      if(card.placementSide === 'enemy'){
        return this.opponentSpellRows(owner);
      }

      if(card.placementSide === 'either'){
        return [
          ...this.sideSpellRows(owner),
          ...this.opponentSpellRows(owner)
        ];
      }

      return this.sideSpellRows(owner);
    };

    game.allowedRows = function(card,owner){
      if(card.category === 'creature'){
        if(card.creatureType === 'flyer'){
          return owner === 'player'
            ? ['playerFront','playerBack']
            : ['enemyFront','enemyBack'];
        }

        if(owner === 'player'){
          return card.creatureType === 'melee'
            ? ['playerFront']
            : ['playerBack'];
        }

        return card.creatureType === 'melee'
          ? ['enemyFront']
          : ['enemyBack'];
      }

      if(card.effect === 'destroy_spell'){
        return this.allSpellRows();
      }

      if(card.scope === 'column'){
        return ['sharedSpell'];
      }

      if(card.scope === 'row'){
        return this.rowPlacementRows(card,owner);
      }

      return [];
    };

    game.rowSpellTargets = function(card,spellRow){
      const context = this.spellRowContext(spellRow);
      if(!context) return [];
      return this.creaturesInRow(context.creatureRow);
    };

    game.columnSpellTargets = function(card,lane,owner){
      const rows = card.targetSide === 'enemy'
        ? (
            owner === 'player'
              ? ['enemyFront','enemyBack']
              : ['playerFront','playerBack']
          )
        : card.targetSide === 'friendly'
          ? (
              owner === 'player'
                ? ['playerFront','playerBack']
                : ['enemyFront','enemyBack']
            )
          : ['enemyBack','enemyFront','playerFront','playerBack'];

      const targets = [];

      for(const row of rows){
        const creature = this.at(row,lane);

        if(creature?.category === 'creature'){
          targets.push({
            kind:'card',
            owner:creature.owner,
            row,
            lane,
            card:creature
          });
        }
      }

      return targets;
    };

    game.isPersistentSpell = function(card){
      return Boolean(
        card &&
        card.category === 'spell' &&
        (
          card.duration === 'persistent' ||
          card.duration === 'triggered' ||
          card.spellType === 'ongoing' ||
          card.spellType === 'shared' ||
          card.spellType === 'trap'
        )
      );
    };

    game.canDrop = function(card,row,lane,owner){
      if(
        this.state.phase !== owner ||
        card.cost > this.currentEnergy(owner) ||
        !this.allowedRows(card,owner).includes(row)
      ){
        return false;
      }

      if(card.category === 'creature'){
        return !this.at(row,lane);
      }

      if(card.effect === 'destroy_spell'){
        const target = this.at(row,lane);

        return Boolean(
          target &&
          target.owner !== owner &&
          this.isPersistentSpell(target)
        );
      }

      if(
        card.spellType === 'trap' ||
        card.spellType === 'ongoing' ||
        card.spellType === 'shared'
      ){
        const occupant = this.at(row,lane);
        if(!occupant) return true;
        if(occupant.category !== 'spell') return false;
        if(card.spellType === 'shared') return occupant.owner === owner;
        return occupant.owner === owner;
      }

      if(card.spellType === 'instant' && card.scope === 'row'){
        return (
          !this.at(row,lane) &&
          this.rowSpellTargets(card,row,owner).length > 0
        );
      }

      if(card.spellType === 'instant' && card.scope === 'column'){
        return (
          !this.at(row,lane) &&
          this.columnSpellTargets(card,lane,owner).length > 0
        );
      }

      return false;
    };

    game.validSpellTargets = function(card){
      if(
        card?.category !== 'spell' ||
        card.spellType !== 'instant'
      ){
        return [];
      }

      const owner = card.owner || 'player';

      if(card.effect === 'destroy_spell'){
        return this.spellRemovalTargets(owner);
      }

      if(card.scope === 'row'){
        const result = [];

        for(const row of this.allowedRows(card,owner)){
          if(this.at(row,0)) continue;
          result.push(...this.rowSpellTargets(card,row,owner));
        }

        return result;
      }

      if(card.scope === 'column'){
        const result = [];

        for(let lane=0;lane<3;lane++){
          if(this.at('sharedSpell',lane)) continue;
          result.push(...this.columnSpellTargets(card,lane,owner));
        }

        return result;
      }

      return [];
    };

    game.effectiveAttack = function(card){
      if(!card || card.category !== 'creature') return 0;

      let value = card.atk + (card.atkBonus || 0);

      if(
        card.fury &&
        card.hp <= Math.ceil(card.maxHp / 2)
      ){
        value += card.fury;
      }

      const location = this.locateCard(card.id);

      if(location){
        const shared = this.at('sharedSpell',location.lane);

        if(
          shared?.effect === 'column_ranged_attack' &&
          ['ranged','flyer'].includes(card.creatureType)
        ){
          value += shared.value;
        }

        if(
          shared?.effect === 'column_melee_attack' &&
          card.creatureType === 'melee'
        ){
          value += shared.value;
        }

        const spellRow = this.creatureRowToSpellRow(location.row);
        const rowSpell = spellRow ? this.at(spellRow,0) : null;

        if(
          rowSpell?.effect === 'row_attack_down' &&
          rowSpell.owner !== card.owner
        ){
          value -= rowSpell.value;
        }
      }

      return Math.max(0,value);
    };

    game.effectiveCounter = function(card){
      if(!card || card.category !== 'creature') return 0;

      let value = (card.counter || 0) + (card.counterBonus || 0);
      const location = this.locateCard(card.id);

      if(location){
        const shared = this.at('sharedSpell',location.lane);

        if(shared?.effect === 'column_counter'){
          value += shared.value;
        }

        const spellRow = this.creatureRowToSpellRow(location.row);
        const rowSpell = spellRow ? this.at(spellRow,0) : null;

        if(
          rowSpell?.effect === 'row_counter_up' &&
          rowSpell.owner === card.owner
        ){
          value += rowSpell.value;
        }

        if(
          rowSpell?.effect === 'row_counter_down' &&
          rowSpell.owner !== card.owner
        ){
          value -= rowSpell.value;
        }
      }

      return Math.max(0,value);
    };

    game.effectivePierce = function(card){
      if(!card || card.category !== 'creature') return 0;
      return Math.max(0,(card.pierce || 0) + (card.pierceBonus || 0));
    };

    game.baseCardStat = function(card,stat){
      const definition = window.CARD_DEFS?.find?.(item=>item.key === card?.key);

      if(stat === 'attack') return definition?.atk ?? card?.atk ?? 0;
      if(stat === 'counter') return definition?.counter ?? card?.counter ?? 0;
      if(stat === 'health') return definition?.hp ?? card?.maxHp ?? card?.hp ?? 0;
      return 0;
    };

    game.statDelta = function(card,stat,currentValue){
      if(!card || card.category !== 'creature') return 0;
      return currentValue - this.baseCardStat(card,stat);
    };

    game.statModClass = function(delta){
      if(delta > 0) return ' stat-modified stat-buffed';
      if(delta < 0) return ' stat-modified stat-debuffed';
      return '';
    };

    game.statTitle = function(label,delta){
      if(delta > 0) return `${label} dipengaruhi efek +${delta}`;
      if(delta < 0) return `${label} dipengaruhi efek ${delta}`;
      return label;
    };

    game.applyCreatureDamage = function(card,amount,options={}){
      let damage = Math.max(0,amount);

      if(
        !options.bypassShield &&
        damage > 0 &&
        (card.shieldCharges || 0) > 0
      ){
        card.shieldCharges -= 1;
        return {
          damage:0,
          shielded:true
        };
      }

      card.hp -= damage;

      return {
        damage,
        shielded:false
      };
    };

    game.healCreature = function(card,amount){
      const before = card.hp;
      card.hp = Math.min(card.maxHp,card.hp + Math.max(0,amount));
      return card.hp - before;
    };

    game.applyPhaseBuff = function(target,card,owner,buff){
      target.card.atkBonus += buff.atk || 0;
      target.card.maxHp += buff.hp || 0;
      target.card.hp += buff.hp || 0;
      target.card.counterBonus += buff.counter || 0;
      target.card.pierceBonus += buff.pierce || 0;

      if(buff.shield){
        target.card.shieldCharges = (target.card.shieldCharges || 0) + buff.shield;
      }

      if(!Array.isArray(target.card.phaseBuffs)){
        target.card.phaseBuffs = [];
      }

      target.card.phaseBuffs.push({
        sourceId:card.id,
        sourceName:card.name,
        owner,
        ...buff
      });
    };

    game.clearPhaseBuffs = function(owner){
      let cleared = 0;

      for(const card of Object.values(this.state.board)){
        if(
          card?.category !== 'creature' ||
          !Array.isArray(card.phaseBuffs) ||
          !card.phaseBuffs.length
        ){
          continue;
        }

        const expiring = card.phaseBuffs.filter(buff=>buff.owner === owner);
        if(!expiring.length) continue;

        for(const buff of expiring){
          card.atkBonus = (card.atkBonus || 0) - (buff.atk || 0);

          if(buff.shield){
            card.shieldCharges = Math.max(
              0,
              (card.shieldCharges || 0) - buff.shield
            );
          }

          card.counterBonus = (card.counterBonus || 0) - (buff.counter || 0);

          card.pierceBonus = Math.max(
            0,
            (card.pierceBonus || 0) - (buff.pierce || 0)
          );

          if(buff.hp){
            card.maxHp = Math.max(1,card.maxHp - buff.hp);
            card.hp = Math.min(card.hp,card.maxHp);
          }

          cleared += 1;
        }

        card.phaseBuffs = card.phaseBuffs.filter(
          buff=>buff.owner !== owner
        );
      }

      if(cleared > 0){
        this.log(`Efek sementara ${owner === 'player' ? 'Player' : 'Enemy'} berakhir.`);
      }
    };

    game.resolveRowSpell = async function(card,spellRow,owner,options={}){
      const targets = this.rowSpellTargets(card,spellRow,owner);
      if(!targets.length) return false;

      this.locked = true;
      this.hideLine();

      const source = this.cardEl(card.id) || byId(spellRow);

      for(const target of targets){
        const element = this.cardEl(target.card.id);

        if(card.effect === 'row_damage'){
          if(element){
            await window.TCGFX.fireBolt(source,element);
          }

          const result = this.applyCreatureDamage(
            target.card,
            card.value,
            {combat:false}
          );

          if(element){
            window.TCGFX.damage(
              element,
              result.shielded ? 'SHIELD' : `-${result.damage}`
            );
          }
        }

        if(card.effect === 'row_heal'){
          const healed = this.healCreature(target.card,card.value);

          if(element && healed > 0){
            window.TCGFX.damage(element,`+${healed}`);
          }
        }

        if(card.effect === 'row_cleanse_heal'){
          target.card.poison = 0;
          const healed = this.healCreature(target.card,card.value);

          if(element){
            window.TCGFX.damage(
              element,
              healed > 0 ? `+${healed}` : 'CLEAN'
            );
          }
        }

        if(card.effect === 'row_phase_stats'){
          if(element){
            await window.TCGFX.blessing(element);
          }

          this.applyPhaseBuff(
            target,
            card,
            owner,
            {atk:card.value,hp:card.value}
          );
        }

        if(card.effect === 'row_phase_attack'){
          if(element){
            await window.TCGFX.blessing(element);
          }

          this.applyPhaseBuff(
            target,
            card,
            owner,
            {atk:card.value}
          );
        }

        if(card.effect === 'row_phase_shield'){
          this.applyPhaseBuff(
            target,
            card,
            owner,
            {shield:card.value}
          );

          if(element){
            window.TCGFX.damage(element,`SHIELD +${card.value}`);
          }
        }

        if(card.effect === 'row_phase_counter'){
          this.applyPhaseBuff(
            target,
            card,
            owner,
            {counter:card.value}
          );

          if(element){
            window.TCGFX.damage(element,`COUNTER +${card.value}`);
          }
        }

        if(card.effect === 'row_phase_pierce'){
          this.applyPhaseBuff(
            target,
            card,
            owner,
            {pierce:card.value}
          );

          if(element){
            window.TCGFX.damage(element,`PIERCE +${card.value}`);
          }
        }

        await sleep(70);
      }

      if(!options.costPaid){
        this.spendEnergy(owner,card.cost);
      }

      if(!options.removedFromHand){
        this.removeFromHand(owner,card.id);
      }

      if(this.at(spellRow,0)?.id === card.id){
        this.remove(spellRow,0);
      }

      this.discard(card);

      for(const target of targets){
        if(
          target.card.hp <= 0 &&
          this.at(target.row,target.lane)?.id === target.card.id
        ){
          this.destroyCreature(target.row,target.lane);
        }
      }

      const context = this.spellRowContext(spellRow);
      const rowLabel = context?.band === 'front'
        ? 'Baris Depan'
        : 'Baris Belakang';

      this.log(`${card.name} aktif pada ${rowLabel}, lalu masuk ke Discard.`);

      this.state.mode = null;
      this.state.selectedHand = null;
      this.locked = false;
      this.render();
      this.checkGameOver();

      return true;
    };

    game.resolveColumnSpell = async function(card,lane,owner,options={}){
      const targets = this.columnSpellTargets(card,lane,owner);
      if(!targets.length) return false;

      this.locked = true;
      this.hideLine();

      const source = this.cardEl(card.id) ||
        document.querySelector(
          `.slot[data-row="sharedSpell"][data-lane="${lane}"]`
        );

      for(const target of targets){
        const element = this.cardEl(target.card.id);

        if(element){
          await window.TCGFX.fireBolt(source,element);
        }

        const result = this.applyCreatureDamage(
          target.card,
          card.value,
          {combat:false}
        );

        if(element){
          window.TCGFX.damage(
            element,
            result.shielded ? 'SHIELD' : `-${result.damage}`
          );
        }

        await sleep(70);
      }

      if(!options.costPaid){
        this.spendEnergy(owner,card.cost);
      }

      if(!options.removedFromHand){
        this.removeFromHand(owner,card.id);
      }

      if(this.at('sharedSpell',lane)?.id === card.id){
        this.remove('sharedSpell',lane);
      }

      this.discard(card);

      for(const target of targets){
        if(
          target.card.hp <= 0 &&
          this.at(target.row,target.lane)?.id === target.card.id
        ){
          this.destroyCreature(target.row,target.lane);
        }
      }

      this.log(`${card.name} menghantam kolom ${lane + 1}, lalu masuk ke Discard.`);

      this.state.mode = null;
      this.state.selectedHand = null;
      this.locked = false;
      this.render();
      this.checkGameOver();

      return true;
    };

    const seventyCardBasePlay = game.playCardToSlot.bind(game);

    game.playCardToSlot = async function(cardId,row,lane,owner='player'){
      if(this.locked) return false;

      const card = this.getCardInHand(owner,cardId);
      if(!card || !this.canDrop(card,row,lane,owner)){window.TCGSFX?.play?.('invalid');return false}
      if(!this.tutorialGuardPlayCard?.(card,row,lane,owner)) return false;

      if(card.effect === 'destroy_spell'){
        window.TCGSFX?.play?.('play_spell');
        const ok = await this.resolveDispel(card,row,lane,owner);
        if(ok) this.tutorialAfterPlayCard?.(card,row,lane,owner);
        return ok;
      }

      if(
        card.category === 'spell' &&
        card.spellType === 'instant' &&
        card.scope === 'row'
      ){
        if(!this.rowSpellTargets(card,row,owner).length){
          window.TCGSFX?.play?.('invalid');
          return false;
        }

        window.TCGSFX?.play?.('play_spell');
        this.spendEnergy(owner,card.cost);
        this.removeFromHand(owner,card.id);
        this.place(row,lane,card);
        this.state.selectedHand = null;
        this.render();
        await sleep(120);

        const ok = await this.resolveRowSpell(
          card,
          row,
          owner,
          {costPaid:true,removedFromHand:true}
        );

        if(ok) this.tutorialAfterPlayCard?.(card,row,lane,owner);
        return ok;
      }

      if(
        card.category === 'spell' &&
        card.spellType === 'instant' &&
        card.scope === 'column'
      ){
        if(!this.columnSpellTargets(card,lane,owner).length){
          window.TCGSFX?.play?.('invalid');
          return false;
        }

        window.TCGSFX?.play?.('play_spell');
        this.spendEnergy(owner,card.cost);
        this.removeFromHand(owner,card.id);
        this.place(row,lane,card);
        this.state.selectedHand = null;
        this.render();
        await sleep(120);

        const ok = await this.resolveColumnSpell(
          card,
          lane,
          owner,
          {costPaid:true,removedFromHand:true}
        );

        if(ok) this.tutorialAfterPlayCard?.(card,row,lane,owner);
        return ok;
      }

      window.TCGSFX?.play?.(card.category === 'spell' ? 'play_spell' : 'play_card');
      this.spendEnergy(owner,card.cost);
      this.removeFromHand(owner,card.id);
      card.canAttack = false;
      card.summonedTurn = this.state.turn;

      if(card.category === 'spell'){
        const occupant = this.at(row,lane);
        if(occupant && occupant.id !== card.id){
          this.remove(row,lane);
          this.discard(occupant);
          this.log(`${occupant.name} digantikan oleh ${card.name}.`);
        }

        if(card.durationTurns){
          card.turnsLeft = card.durationTurns;
        }
      }

      this.place(row,lane,card);
      this.state.selectedHand = null;

      if(card.category === 'creature'){
        card.shieldCharges = card.shield || 0;
        card.canAttack = Boolean(card.quick);

        if(card.rowHealOnSummon){
          for(const target of this.creaturesInRow(row)){
            if(target.card.owner !== owner) continue;
            const healed = this.healCreature(
              target.card,
              card.rowHealOnSummon
            );

            const element = this.cardEl(target.card.id);
            if(element && healed > 0){
              window.TCGFX.damage(element,`+${healed}`);
            }
          }
        }

        if(card.handHealOnSummon){
          const healed = this.healHand(owner,card.handHealOnSummon);
          const target = handTarget(owner);

          if(target && healed > 0){
            window.TCGFX.damage(target,`+${healed}`);
          }
        }
      }

      const label = owner === 'player' ? 'Player' : 'Enemy';
      this.log(`${label} memainkan ${card.name}.`);
      this.render();

      const element = this.cardEl(card.id);

      if(element){
        element.animate([
          {transform:'translateY(18px) scale(.72)',opacity:.2},
          {transform:'translateY(-5px) scale(1.08)',opacity:1,offset:.72},
          {transform:'translateY(0) scale(1)',opacity:1}
        ],{
          duration:430,
          easing:'ease-out'
        });
      }

      await sleep(260);
      this.tutorialAfterPlayCard?.(card,row,lane,owner);
      return true;
    };

    const originalDestroyCreature70 =
      game.destroyCreature.bind(game);

    game.destroyCreature = function(row,lane){
      const card = this.at(row,lane);

      if(
        card?.rebirth &&
        !card.rebirthUsed
      ){
        card.rebirthUsed = true;
        card.hp = 1;
        card.canAttack = false;
        card.shieldCharges = 0;

        const element = this.cardEl(card.id);

        if(element){
          window.TCGFX.damage(element,'REBIRTH');
        }

        this.log(`${card.name} kembali melalui Rebirth dengan 1 Health.`);
        return card;
      }

      return originalDestroyCreature70(row,lane);
    };

    game.validAttackTargets = function(attackerId){
      const location = this.locateCard(attackerId);
      if(!location) return [];

      const attacker = location.card;
      const defender =
        attacker.owner === 'player'
          ? 'enemy'
          : 'player';

      const lane = location.lane;
      const frontRow =
        defender === 'enemy'
          ? 'enemyFront'
          : 'playerFront';

      const backRow =
        defender === 'enemy'
          ? 'enemyBack'
          : 'playerBack';

      const front = this.at(frontRow,lane);
      const back = this.at(backRow,lane);

      if(
        attacker.creatureType === 'ranged' ||
        attacker.creatureType === 'flyer'
      ){
        const targets = [];

        if(front){
          targets.push({
            kind:'card',
            owner:defender,
            row:frontRow,
            lane,
            card:front
          });
        }

        if(
          back &&
          !(back.stealth && front)
        ){
          targets.push({
            kind:'card',
            owner:defender,
            row:backRow,
            lane,
            card:back
          });
        }

        if(targets.length) return targets;
        return [{kind:'hand',owner:defender}];
      }

      if(front){
        return [{
          kind:'card',
          owner:defender,
          row:frontRow,
          lane,
          card:front
        }];
      }

      if(back){
        return [{
          kind:'card',
          owner:defender,
          row:backRow,
          lane,
          card:back
        }];
      }

      return [{kind:'hand',owner:defender}];
    };

    game.triggerTrap = async function(defenderRow,attackerLocation){
      const spellRow = this.creatureRowToSpellRow(defenderRow);
      if(!spellRow) return false;

      const trap = this.at(spellRow,0);

      if(
        !trap ||
        trap.spellType !== 'trap' ||
        trap.owner !== this.at(defenderRow,attackerLocation.lane)?.owner
      ){
        return false;
      }

      const trapElement = this.cardEl(trap.id);

      if(trapElement){
        await window.TCGFX.trapReveal(trapElement);
      }

      const defender = this.at(defenderRow,attackerLocation.lane);
      const attacker = this.at(attackerLocation.row,attackerLocation.lane);

      if(trap.effect === 'row_trap_damage' && attacker){
        const result = this.applyCreatureDamage(
          attacker,
          trap.value,
          {combat:false}
        );

        const attackerElement = this.cardEl(attacker.id);

        if(attackerElement){
          window.TCGFX.damage(
            attackerElement,
            result.shielded ? 'SHIELD' : `-${result.damage}`
          );
        }
      }

      if(trap.effect === 'row_trap_barrier' && defender){
        defender.shieldCharges =
          (defender.shieldCharges || 0) + trap.value;

        const defenderElement = this.cardEl(defender.id);

        if(defenderElement){
          window.TCGFX.damage(
            defenderElement,
            `SHIELD +${trap.value}`
          );
        }
      }

      this.discard(this.remove(spellRow,0));
      this.render();
      await sleep(280);

      if(attacker && attacker.hp <= 0){
        this.destroyCreature(attackerLocation.row,attackerLocation.lane);
        this.render();
        return true;
      }

      return false;
    };

    game.resolveAttack = async function(attackerLocation,target,after){
      if(
        !attackerLocation ||
        !attackerLocation.card ||
        !attackerLocation.card.canAttack
      ){
        after?.();
        return;
      }

      this.locked = true;
      this.hideLine();

      const attacker = attackerLocation.card;

      if(target.kind === 'card'){
        const trapKilled = await this.triggerTrap(
          target.row,
          attackerLocation
        );

        if(trapKilled){
          this.locked = false;
          this.state.mode = null;
          this.render();
          after?.();
          return;
        }
      }

      const attackerElement = this.cardEl(attacker.id);
      const targetElement =
        target.kind === 'card'
          ? this.cardEl(target.card.id)
          : handTarget(target.owner);

      let returnToSource = true;

      if(target.kind === 'card'){
        const defender = target.card;
        let predictedAttack = this.effectiveAttack(attacker);

        if(
          attacker.execute &&
          defender.hp < defender.maxHp
        ){
          predictedAttack += attacker.execute;
        }

        if(
          attacker.sniper &&
          target.row.endsWith('Back')
        ){
          predictedAttack += attacker.sniper;
        }

        const defenderWillSurvive =
          (defender.shieldCharges || 0) > 0 ||
          defender.hp - Math.max(0,predictedAttack) > 0;

        const predictedCounter = defenderWillSurvive
          ? this.effectiveCounter(defender)
          : 0;

        returnToSource =
          predictedCounter <= 0 ||
          (attacker.shieldCharges || 0) > 0 ||
          attacker.hp - predictedCounter > 0;
      }

      await window.TCGFX.flyCard(
        attackerElement,
        targetElement,
        {returnToSource}
      );

      attacker.canAttack = false;
      attacker.movedThisPhase = true;

      if(target.kind === 'hand' || target.kind === 'hero'){
        const baseDamage = this.effectiveAttack(attacker);
        const quickRushPenalty =
          attacker.quick && attacker.summonedTurn === this.state.turn
            ? 1
            : 0;
        const damage = Math.max(1,baseDamage - quickRushPenalty);

        if(target.owner === 'enemy'){
          this.state.enemyHp -= damage;
        }else{
          this.state.playerHp -= damage;
        }

        this.updateBattleMusic?.();

        window.TCGFX.damage(targetElement,`-${damage}`);

        if(attacker.lifesteal){
          const healed = this.healHand(
            attacker.owner,
            Math.min(damage,attacker.lifesteal)
          );

          const ownHand = handTarget(attacker.owner);

          if(ownHand && healed > 0){
            window.TCGFX.damage(ownHand,`+${healed}`);
          }
        }

        this.log(
          `${attacker.name} menyerang Hand dan memberi ${damage} damage.` +
          `${quickRushPenalty ? ' Quick rush mengurangi damage langsung sebesar 1.' : ''}`
        );
      }else{
        const defender = target.card;
        const defenderHpBefore = defender.hp;

        let rawAttack = this.effectiveAttack(attacker);

        if(
          attacker.execute &&
          defender.hp < defender.maxHp
        ){
          rawAttack += attacker.execute;
        }

        if(
          attacker.sniper &&
          target.row.endsWith('Back')
        ){
          rawAttack += attacker.sniper;
        }

        const attackResult = this.applyCreatureDamage(
          defender,
          rawAttack,
          {combat:true}
        );

        const defenderSurvived = defender.hp > 0;
        let counterDamage = 0;
        let counterResult = {
          damage:0,
          shielded:false
        };

        if(defenderSurvived){
          counterDamage = this.effectiveCounter(defender);

          if(counterDamage > 0){
            counterResult = this.applyCreatureDamage(
              attacker,
              counterDamage,
              {combat:true}
            );
          }
        }

        window.TCGFX.calc(
          attackerElement,
          targetElement,
          `${attacker.name} ${rawAttack} ⚔ ${defender.name} ↩ ${counterDamage}`
        );

        window.TCGFX.damage(
          targetElement,
          attackResult.shielded
            ? 'SHIELD'
            : `-${attackResult.damage}`
        );

        if(counterDamage > 0){
          window.TCGFX.damage(
            attackerElement,
            counterResult.shielded
              ? 'SHIELD'
              : `-${counterResult.damage}`
          );
        }

        if(
          attacker.venom &&
          defender.hp > 0 &&
          attackResult.damage > 0
        ){
          defender.poison =
            (defender.poison || 0) + attacker.venom;

          window.TCGFX.damage(
            targetElement,
            `POISON ${defender.poison}`
          );
        }

        if(attacker.lifesteal && attackResult.damage > 0){
          const healed = this.healHand(
            attacker.owner,
            Math.min(
              attackResult.damage,
              attacker.lifesteal
            )
          );

          const ownHand = handTarget(attacker.owner);

          if(ownHand && healed > 0){
            window.TCGFX.damage(ownHand,`+${healed}`);
          }
        }

        const activePierce = this.effectivePierce(attacker);

        if(
          activePierce > 0 &&
          defender.hp <= 0
        ){
          const excess = Math.max(
            0,
            attackResult.damage - defenderHpBefore
          );

          const pierceDamage = Math.min(
            excess,
            activePierce
          );

          if(pierceDamage > 0){
            const handKey =
              defender.owner === 'enemy'
                ? 'enemyHp'
                : 'playerHp';

            this.state[handKey] -= pierceDamage;
            this.updateBattleMusic?.();

            const enemyHand = handTarget(defender.owner);

            if(enemyHand){
              window.TCGFX.damage(
                enemyHand,
                `-${pierceDamage}`
              );
            }
          }
        }

        if(attacker.splash && attackResult.damage > 0){
          for(const adjacentLane of [
            target.lane - 1,
            target.lane + 1
          ]){
            if(adjacentLane < 0 || adjacentLane > 2) continue;

            const splashTarget = this.at(
              target.row,
              adjacentLane
            );

            if(
              !splashTarget ||
              splashTarget.owner !== defender.owner
            ){
              continue;
            }

            const result = this.applyCreatureDamage(
              splashTarget,
              attacker.splash,
              {combat:true}
            );

            const splashElement = this.cardEl(
              splashTarget.id
            );

            if(splashElement){
              window.TCGFX.damage(
                splashElement,
                result.shielded
                  ? 'SHIELD'
                  : `-${result.damage}`
              );
            }
          }
        }

        this.log(
          `${attacker.name} memberi ${attackResult.damage} damage. ` +
          `${counterDamage > 0 ? `${defender.name} membalas ${counterResult.damage}.` : 'Tidak ada Counter.'}`
        );

        await sleep(420);

        for(const row of [
          'enemyBack',
          'enemyFront',
          'playerFront',
          'playerBack'
        ]){
          for(let lane=0;lane<3;lane++){
            const card = this.at(row,lane);

            if(card?.category === 'creature' && card.hp <= 0){
              this.destroyCreature(row,lane);
            }
          }
        }
      }

      this.locked = false;
      this.state.mode = null;
      this.render();
      this.tutorialAfterAttack?.(attacker,target);
      this.checkGameOver();
      after?.();
    };

    game.applyStartOfTurnEffects = async function(owner){
      const rows = owner === 'player'
        ? ['playerFront','playerBack']
        : ['enemyFront','enemyBack'];

      const resolveDeath = (row,lane,card)=>{
        if(!card || card.hp > 0) return card;

        this.destroyCreature(row,lane);

        const current = this.at(row,lane);

        /*
          Rebirth keeps the same card in the same slot with 1 HP.
          A normal death removes the card, so later healing effects
          in this same start-of-turn sequence must not affect it.
        */
        if(
          current &&
          current.id === card.id &&
          current.hp > 0
        ){
          return current;
        }

        return null;
      };

      for(const row of rows){
        const spellRow = this.creatureRowToSpellRow(row);
        const rowSpell = spellRow ? this.at(spellRow,0) : null;

        for(let lane=0;lane<3;lane++){
          let card = this.at(row,lane);

          if(!card || card.category !== 'creature'){
            continue;
          }

          let element = this.cardEl(card.id);

          if(card.poison > 0){
            const result = this.applyCreatureDamage(
              card,
              card.poison,
              {
                combat:false,
                bypassShield:true
              }
            );

            if(element){
              window.TCGFX.damage(
                element,
                `POISON -${result.damage}`
              );
            }

            card.poison = Math.max(0,card.poison - 1);
            card = resolveDeath(row,lane,card);

            if(!card){
              continue;
            }

            element = this.cardEl(card.id);
          }

          if(card.regen && card.hp > 0){
            const healed = this.healCreature(
              card,
              card.regen
            );

            if(element && healed > 0){
              window.TCGFX.damage(
                element,
                `REGEN +${healed}`
              );
            }
          }

          if(
            rowSpell?.effect === 'row_turn_damage' &&
            rowSpell.owner !== owner
          ){
            const result = this.applyCreatureDamage(
              card,
              rowSpell.value,
              {combat:false}
            );

            if(element){
              window.TCGFX.damage(
                element,
                result.shielded
                  ? 'SHIELD'
                  : `-${result.damage}`
              );
            }

            card = resolveDeath(row,lane,card);

            if(!card){
              continue;
            }

            element = this.cardEl(card.id);
          }

          const shared = this.at('sharedSpell',lane);

          if(shared?.effect === 'column_turn_heal'){
            const healed = this.healCreature(
              card,
              shared.value
            );

            if(element && healed > 0){
              window.TCGFX.damage(
                element,
                `+${healed}`
              );
            }
          }

          if(shared?.effect === 'column_turn_damage'){
            const result = this.applyCreatureDamage(
              card,
              shared.value,
              {combat:false}
            );

            if(element){
              window.TCGFX.damage(
                element,
                result.shielded
                  ? 'SHIELD'
                  : `-${result.damage}`
              );
            }

            resolveDeath(row,lane,card);
          }
        }
      }

      await sleep(180);
    };

    game.tickSpellDurations = function(owner=null){
      const expired = [];

      for(const [slotKey,card] of Object.entries(this.state.board)){
        if(
          card?.category === 'spell' &&
          typeof card.turnsLeft === 'number' &&
          (!owner || card.owner === owner)
        ){
          card.turnsLeft -= 1;
          if(card.turnsLeft <= 0) expired.push(slotKey);
        }
      }

      for(const slotKey of expired){
        const cut = slotKey.lastIndexOf('_');
        const row = slotKey.slice(0,cut);
        const lane = Number(slotKey.slice(cut + 1));
        const card = this.remove(row,lane);

        if(card){
          this.discard(card);
          this.log(`${card.name} habis masa berlakunya dan dibuang.`);
        }
      }
    };

    game.startPlayerTurn = async function(){
      if(this.checkGameOver()) return;

      this.clearPhaseBuffs('enemy');
      this.transitioning = true;
      this.state.phase = 'player';
      const openingResponse = !!this.state.playerOpeningResponseTurn;

      if(!openingResponse){
        this.state.turn += 1;
        this.state.playerMaxEnergy = Math.min(
          10,
          this.state.playerMaxEnergy + 1
        );
      }

      const openingBonus = this.state.playerOpeningEnergyBonus || 0;
      this.state.playerEnergy =
        Math.min(
          10,
          this.state.playerMaxEnergy +
          (this.arcaneEnergyBonus?.() || 0) +
          openingBonus
        );
      this.state.playerOpeningResponseTurn = false;
      this.state.playerOpeningEnergyBonus = 0;

      for(const card of Object.values(this.state.board)){
        if(
          card.owner === 'player' &&
          card.category === 'creature'
        ){
          card.canAttack = true;
          card.movedThisPhase = false;
        }
      }

      await this.applyStartOfTurnEffects('player');
      this.tickSpellDurations('player');

      this.banner('Player Phase');
      this.render();

      if(this.state.playerSkipOpeningDraw){
        this.state.playerSkipOpeningDraw = false;
      }else{
        await this.drawAnimated('player');
      }

      this.transitioning = false;
      this.startTimer();
      this.render();
      this.log(
        openingBonus
          ? 'Giliran Player dimulai dengan +1 Energy sementara.'
          : 'Giliran Player dimulai.'
      );
    };

    game.startEnemyTurn = async function(){
      if(this.checkGameOver()) return;

      this.clearPhaseBuffs('player');
      const opening = !!this.state.enemyOpeningTurn;
      this.state.enemyOpeningTurn = false;
      this.state.enemyMaxEnergy = Math.min(
        10,
        this.state.enemyMaxEnergy + (opening ? 0 : 1)
      );
      this.state.enemyEnergy =
        this.state.enemyMaxEnergy;

      for(const card of Object.values(this.state.board)){
        if(
          card.owner === 'enemy' &&
          card.category === 'creature'
        ){
          card.canAttack = true;
        }
      }

      await this.applyStartOfTurnEffects('enemy');
      this.tickSpellDurations('enemy');

      this.render();

      if(this.state.enemySkipOpeningDraw){
        this.state.enemySkipOpeningDraw = false;
      }else{
        await this.drawAnimated('enemy');
      }

      await this.aiMainPhase();
      await this.aiAttackPhase();

      this.transitioning = false;

      if(!this.checkGameOver()){
        await this.startPlayerTurn();
      }
    };

    game.aiBestRowSpellSlot = function(card){
      let best = null;

      for(const row of this.allowedRows(card,'enemy')){
        if(!this.canDrop(card,row,0,'enemy')) continue;

        const targets = this.rowSpellTargets(
          card,
          row,
          'enemy'
        );

        let score = targets.length * 8;

        if(card.effect === 'row_damage'){
          score += targets.reduce((sum,target)=>{
            return sum +
              (target.card.hp <= card.value ? 35 : 0) +
              this.effectiveAttack(target.card);
          },0);
        }

        if(card.effect === 'row_heal'){
          score += targets.reduce((sum,target)=>{
            return sum +
              Math.max(
                0,
                target.card.maxHp - target.card.hp
              ) * 4;
          },0);
        }

        if(card.effect === 'row_cleanse_heal'){
          score += targets.reduce((sum,target)=>{
            return sum +
              (target.card.poison || 0) * 12 +
              Math.max(
                0,
                target.card.maxHp - target.card.hp
              ) * 2;
          },0);
        }

        if(
          card.effect.startsWith('row_phase_')
        ){
          score += targets.reduce((sum,target)=>{
            return sum +
              this.effectiveAttack(target.card) +
              target.card.hp;
          },0);
        }

        if(card.effect === 'row_attack_down'){
          score += targets.reduce(
            (sum,target)=>
              sum + this.effectiveAttack(target.card) * 4,
            0
          );
        }

        if(card.effect === 'row_counter_down'){
          score += targets.reduce(
            (sum,target)=>
              sum + this.effectiveCounter(target.card) * 10,
            0
          );
        }

        if(card.effect === 'row_counter_up'){
          score += targets.reduce(
            (sum,target)=>
              sum + Math.max(1,target.card.hp) * 6,
            0
          );
        }

        if(card.effect === 'row_turn_damage'){
          score += targets.length * 18;
        }

        if(!best || score > best.score){
          best = {row,lane:0,score};
        }
      }

      return best;
    };

    game.aiBestSharedLane = function(card){
      let best = null;

      for(let lane=0;lane<3;lane++){
        if(!this.canDrop(card,'sharedSpell',lane,'enemy')) continue;

        const friendly = this.columnSpellTargets(
          {...card,targetSide:'friendly'},
          lane,
          'enemy'
        );

        const enemy = this.columnSpellTargets(
          {...card,targetSide:'enemy'},
          lane,
          'enemy'
        );

        let score = 1;

        if(card.effect === 'column_damage'){
          score += enemy.reduce((sum,target)=>{
            return sum +
              (target.card.hp <= card.value ? 30 : 0) +
              this.effectiveAttack(target.card);
          },0);
        }

        if(card.effect === 'column_ranged_attack'){
          score += friendly.filter(
            target=>['ranged','flyer'].includes(target.card.creatureType)
          ).length * 20;
        }

        if(card.effect === 'column_melee_attack'){
          score += friendly.filter(
            target=>target.card.creatureType === 'melee'
          ).length * 20;
        }

        if(card.effect === 'column_turn_heal'){
          score += friendly.reduce((sum,target)=>{
            return sum +
              Math.max(
                0,
                target.card.maxHp - target.card.hp
              ) * 5;
          },0);
        }

        if(card.effect === 'column_counter'){
          score += friendly.length * 15;
        }

        if(card.effect === 'column_turn_damage'){
          score += enemy.length * 14 - friendly.length * 8;
        }

        if(!best || score > best.score){
          best = {
            row:'sharedSpell',
            lane,
            score
          };
        }
      }

      return best;
    };

    game.chooseAiPlay = function(){
      const playable = this.state.enemyHand.filter(
        card=>card.cost <= this.state.enemyEnergy
      );

      if(!playable.length) return null;

      for(const card of playable.filter(
        card=>card.effect === 'destroy_spell'
      )){
        const slot = this.aiBestDispelTarget();
        if(slot) return {card,...slot};
      }

      for(const card of playable.filter(
        card=>
          card.category === 'spell' &&
          card.spellType === 'instant' &&
          card.scope === 'row'
      )){
        const slot = this.aiBestRowSpellSlot(card);
        if(slot) return {card,...slot};
      }

      for(const card of playable.filter(
        card=>
          card.category === 'spell' &&
          card.spellType === 'ongoing' &&
          card.scope === 'row'
      )){
        const slot = this.aiBestRowSpellSlot(card);
        if(slot) return {card,...slot};
      }

      for(const card of playable.filter(
        card=>
          card.category === 'spell' &&
          card.spellType === 'trap'
      )){
        const slot = this.aiBestTrapSlot(card);
        if(slot) return {card,...slot};
      }

      for(const card of playable.filter(
        card=>
          card.category === 'spell' &&
          card.scope === 'column'
      )){
        const slot = this.aiBestSharedLane(card);
        if(slot) return {card,...slot};
      }

      const creatures = playable
        .filter(card=>card.category === 'creature')
        .sort((a,b)=>b.cost - a.cost);

      for(const card of creatures){
        for(const row of this.allowedRows(card,'enemy')){
          for(let lane=0;lane<3;lane++){
            if(this.canDrop(card,row,lane,'enemy')){
              return {card,row,lane};
            }
          }
        }
      }

      return null;
    };

    game.aiAttackPhase = async function(){
      const attackers = [];

      for(const row of ['enemyFront','enemyBack']){
        for(let lane=0;lane<3;lane++){
          const creature = this.at(row,lane);

          if(creature?.canAttack){
            attackers.push({
              row,
              lane,
              card:creature
            });
          }
        }
      }

      for(const attacker of attackers){
        const live = this.at(attacker.row,attacker.lane);
        if(!live || !live.canAttack) continue;

        const targets = this.validAttackTargets(live.id);
        if(!targets.length) continue;

        const target = [...targets].sort((a,b)=>{
          const score = candidate=>{
            if(candidate.kind === 'hand') return 12;

            let value = 0;

            if(candidate.card.hp <= this.effectiveAttack(live)){
              value += 40;
            }

            value += this.effectiveAttack(candidate.card) * 3;
            value -= candidate.card.hp;

            if(candidate.row.endsWith('Back')){
              value += 4;
            }

            return value;
          };

          return score(b) - score(a);
        })[0];

        this.state.mode = {
          type:'attack',
          attackerId:live.id
        };

        this.render();

        const targetElement =
          target.kind === 'card'
            ? document.querySelector(
                `.slot[data-row="${target.row}"][data-lane="${target.lane}"]`
              )
            : handTarget('player');

        this.showLineTo(targetElement);
        await sleep(620);
        this.state.mode = null;

        await this.resolveAttack(
          {
            row:attacker.row,
            lane:attacker.lane,
            card:live
          },
          target
        );

        await sleep(260);
        if(this.checkGameOver()) break;
      }
    };



    /* =====================================================
       SPELL DRAG AREA PREVIEW
       - Row spells preview the complete horizontal creature row.
       - Column spells preview the affected vertical lane.
       ===================================================== */

    game.clearSpellEffectPreview = function(){
      document.querySelectorAll(
        '.spell-effect-preview,' +
        '.spell-preview-anchor'
      ).forEach(element=>{
        element.classList.remove(
          'spell-effect-preview',
          'spell-preview-friendly',
          'spell-preview-enemy',
          'spell-preview-both',
          'spell-preview-anchor'
        );
        delete element.dataset.spellPreview;
      });

      document.querySelector('.board')
        ?.classList.remove('spell-preview-active');
    };

    game.spellPreviewTone = function(card){
      if(card.targetSide === 'friendly'){
        return 'friendly';
      }

      if(card.targetSide === 'enemy'){
        return 'enemy';
      }

      return 'both';
    };

    game.getSpellEffectPreviewSlots = function(card,hoveredSlot){
      if(
        !card ||
        card.category !== 'spell' ||
        !hoveredSlot
      ){
        return [];
      }

      const previewSlots = [];

      if(card.scope === 'row'){
        const context = this.spellRowContext?.(
          hoveredSlot.dataset.row
        );

        if(!context?.creatureRow){
          return [];
        }

        for(let lane = 0; lane < 3; lane++){
          const slot = document.querySelector(
            `.slot[data-row="${context.creatureRow}"]` +
            `[data-lane="${lane}"]`
          );

          if(slot){
            previewSlots.push(slot);
          }
        }

        return previewSlots;
      }

      if(card.scope === 'column'){
        const lane = Number(hoveredSlot.dataset.lane);
        if(!Number.isInteger(lane)) return [];

        const owner = card.owner || 'player';
        const friendlyRows = owner === 'player'
          ? ['playerFront','playerBack']
          : ['enemyFront','enemyBack'];

        const enemyRows = owner === 'player'
          ? ['enemyFront','enemyBack']
          : ['playerFront','playerBack'];

        let affectedRows;

        if(card.targetSide === 'friendly'){
          affectedRows = friendlyRows;
        }else if(card.targetSide === 'enemy'){
          affectedRows = enemyRows;
        }else{
          affectedRows = [
            'enemyBack',
            'enemyFront',
            'playerFront',
            'playerBack'
          ];
        }

        for(const row of affectedRows){
          const slot = document.querySelector(
            `.slot[data-row="${row}"]` +
            `[data-lane="${lane}"]`
          );

          if(slot){
            previewSlots.push(slot);
          }
        }

        return previewSlots;
      }

      return [];
    };

    game.showSpellEffectPreview = function(card,hoveredSlot){
      this.clearSpellEffectPreview();

      if(
        !card ||
        card.category !== 'spell' ||
        !hoveredSlot?.classList.contains('drop-valid')
      ){
        return;
      }

      const previewSlots = this.getSpellEffectPreviewSlots(
        card,
        hoveredSlot
      );

      if(!previewSlots.length){
        return;
      }

      const tone = this.spellPreviewTone(card);

      hoveredSlot.classList.add('spell-preview-anchor');

      for(const slot of previewSlots){
        slot.classList.add(
          'spell-effect-preview',
          `spell-preview-${tone}`
        );

        slot.dataset.spellPreview = tone;
      }

      document.querySelector('.board')
        ?.classList.add('spell-preview-active');
    };

    game.onDragMove = event=>{
      if(!game.drag) return;
      event.preventDefault();

      if(
        Math.abs(event.clientX - game.drag.startX) > 5 ||
        Math.abs(event.clientY - game.drag.startY) > 5
      ){
        game.drag.moved = true;
      }

      game.moveGhost(event.clientX,event.clientY);

      document.querySelectorAll('.drop-hover')
        .forEach(element=>{
          element.classList.remove('drop-hover');
        });

      const hit = game.pointerSlotAt
        ? game.pointerSlotAt(event.clientX,event.clientY)
        : document
          .elementFromPoint(event.clientX,event.clientY)
          ?.closest('.slot');

      if(hit?.classList.contains('drop-valid')){
        hit.classList.add('drop-hover');

        game.showSpellEffectPreview(
          game.drag.card,
          hit
        );
      }else{
        game.clearSpellEffectPreview();
      }
    };

    const cleanDragBeforeSpellPreview =
      game.cleanDrag.bind(game);

    game.cleanDrag = function(render=false){
      this.clearSpellEffectPreview();
      return cleanDragBeforeSpellPreview(render);
    };


    const originalRender = game.render.bind(game);

    game.render = function(){
      originalRender();
      renderEnemyHand(this,false);
      renderHandHealth(this);
      renderDiscardPiles(this);
      decorateRenderedCards(this);
      decorateActiveSpellSlots(this);
      updateResponsiveHandSpacing();
      this.updateTutorialUI?.();
    };

    game.drawAnimated = async function(owner){
      const deck = owner === 'player'
        ? this.state.playerDeck
        : this.state.enemyDeck;

      const hand = owner === 'player'
        ? this.state.playerHand
        : this.state.enemyHand;

      if(!deck.length || hand.length >= 8) return false;

      const deckElement = byId(
        owner === 'player' ? 'playerDeckPile' : 'enemyDeckPile'
      );

      const handElement = owner === 'player'
        ? byId('playerHandTarget')
        : byId('enemyHandTarget');

      await animateDraw(deckElement,handElement,owner);
      hand.push(deck.shift());
      this.render();

      if(owner === 'player'){
        const lastCard = byId('hand')?.lastElementChild;

        if(lastCard){
          lastCard.animate([
            {transform:'translateY(24px) scale(.9)',opacity:.3},
            {transform:'translateY(-12px) scale(1.045)',opacity:1,offset:.72},
            {transform:'translateY(0) scale(1)',opacity:1}
          ],{
            duration:390,
            easing:'ease-out'
          });
        }
      }else{
        renderEnemyHand(this,true);
        await sleep(390);
      }

      return true;
    };

    const enemyHandTarget = handTarget('enemy');
    enemyHandTarget?.addEventListener('click',event=>{
      if(!game.state?.mode || game.locked || !enemyHandTarget.classList.contains('valid-target')) return;

      event.preventDefault();
      event.stopPropagation();

      const target = {kind:'hand',owner:'enemy'};

      if(game.state.mode.type === 'attack'){
        void game.resolvePlayerAttackTarget(target);
      }else if(game.state.mode.type === 'spell'){
        void game.resolvePlayerSpellTarget(target);
      }
    });

    for(const [pileId,owner] of [
      ['playerDiscardPile','player'],
      ['enemyDiscardPile','enemy']
    ]){
      const pile = byId(pileId);
      if(!pile) continue;

      pile.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        openDiscardViewer(game,owner);
      });

      pile.addEventListener('keydown',event=>{
        if(event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openDiscardViewer(game,owner);
      });
    }

    document.addEventListener('mouseover',event=>{
      if(
        game.drag ||
        game.locked ||
        game.transitioning ||
        game.state?.phase !== 'player' ||
        game.state?.mode
      ){
        return;
      }

      const cardElement = event.target.closest?.('.card.can-attack[data-owner="player"]');
      if(!cardElement || cardElement.contains(event.relatedTarget)) return;

      const targets = game.validAttackTargets(cardElement.dataset.cardId);
      const target = targets.length === 1 ? targets[0] : null;

      if(target?.kind !== 'hand' || target.owner !== 'enemy') return;

      const enemyHand = handTarget('enemy');
      const line = byId('targetLine');

      if(!enemyHand || !line) return;

      line.setAttribute(
        'd',
        game.linePath(
          window.TCGFX.center(cardElement),
          window.TCGFX.center(enemyHand)
        )
      );
      line.classList.add('show');
      enemyHand.classList.add('attack-hover-target');
      game.__directHandPreviewCardId = cardElement.dataset.cardId;
    });

    document.addEventListener('mouseout',event=>{
      if(game.state?.mode) return;

      const cardElement = event.target.closest?.('.card.can-attack[data-owner="player"]');
      if(!cardElement || cardElement.contains(event.relatedTarget)) return;
      if(game.__directHandPreviewCardId !== cardElement.dataset.cardId) return;

      game.__directHandPreviewCardId = null;
      game.hideLine();
    });

    game.render();
  }

  window.addEventListener('DOMContentLoaded',installHandCombat);
})();
