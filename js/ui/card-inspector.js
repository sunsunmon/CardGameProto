(function(){
  'use strict';

  const HOLD_DURATION = 560;
  const MOVE_TOLERANCE = 9;
  const INSPECTABLE_SELECTOR =
    '#hand .hand-card[data-card-id], .board .card[data-card-id], .battlefield .card[data-card-id], .discard-view-card[data-card-id], .collection-card[data-card-key], .deck-card-pick[data-card-key], .deck-build-card[data-card-key]';

  let overlay = null;
  let holdTimer = null;
  let holdCardEl = null;
  let holdStartX = 0;
  let holdStartY = 0;
  let suppressClickUntil = 0;
  let currentCard = null;
  let currentContext = [];
  let currentIndex = -1;
  let swipePointerId = null;
  let swipeStartX = 0;
  let swipeStartY = 0;

  function escapeHTML(value){
    return String(value ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  function inspectableCardFromEvent(event){
    const element = event.target.closest?.(INSPECTABLE_SELECTOR);
    if(!element || element.classList.contains('face-down')) return null;
    return element;
  }

  function findCard(cardId){
    const state = window.game?.state;
    if(!state || !cardId) return null;

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

  function findCardDef(cardKey){
    if(!cardKey) return null;
    return window.CARD_DEFS?.find?.(item=>item.key === cardKey) || null;
  }

  function cardIdentity(card){
    return card?.id || card?.key || '';
  }

  function visibleCollectionContext(){
    const keys = [
      ...document.querySelectorAll(
        '#collectionGrid .collection-card[data-card-key]'
      )
    ].map(element=>element.dataset.cardKey);

    return keys
      .map(key=>findCardDef(key))
      .filter(Boolean);
  }

  function visibleDeckBuilderContext(cardEl){
    const root = cardEl?.closest?.('#deckBuilderOverlay');
    if(!root) return [];

    const selector = cardEl.closest('#deckCurrentList')
      ? '#deckCurrentList .deck-build-card[data-card-key]'
      : '#deckCardPool .deck-card-pick[data-card-key]';

    const keys = [...root.querySelectorAll(selector)]
      .map(element=>element.dataset.cardKey);

    return keys
      .map(key=>findCardDef(key))
      .filter(Boolean);
  }

  function defaultContext(card){
    if(card?.id){
      const state = window.game?.state;
      const cards = [
        ...(state?.playerHand || []),
        ...(state?.enemyHand || []),
        ...Object.values(state?.board || {}).filter(Boolean),
        ...(state?.playerDiscard || []),
        ...(state?.enemyDiscard || [])
      ];

      return cards.length ? cards : [card];
    }

    return (window.CARD_DEFS || []).filter(Boolean);
  }

  function buildContext(card,cardEl,options={}){
    if(Array.isArray(options.cards) && options.cards.length){
      currentContext = options.cards.filter(Boolean);
    }else if(cardEl?.closest?.('#collectionOverlay')){
      currentContext = visibleCollectionContext();
    }else if(cardEl?.closest?.('#deckBuilderOverlay')){
      currentContext = visibleDeckBuilderContext(cardEl);
    }else{
      currentContext = defaultContext(card);
    }

    const identity = cardIdentity(card);
    currentIndex = currentContext.findIndex(
      item=>cardIdentity(item) === identity || item?.key === card?.key
    );

    if(currentIndex < 0 && currentContext.length){
      currentIndex = 0;
    }
  }

  function effectiveAttack(card){
    if(card?.category !== 'creature') return 0;

    if(!card.id){
      return Math.max(0,card.atk || 0);
    }

    if(typeof window.game?.effectiveAttack === 'function'){
      return window.game.effectiveAttack(card);
    }

    return Math.max(0,(card.atk || 0) + (card.atkBonus || 0));
  }


  function effectiveCounter(card){
    if(card?.category !== 'creature') return 0;

    if(!card.id){
      return Math.max(0,card.counter || 0);
    }

    if(typeof window.game?.effectiveCounter === 'function'){
      return window.game.effectiveCounter(card);
    }

    return Math.max(
      0,
      (card.counter || 0) + (card.counterBonus || 0)
    );
  }

  function baseCardDef(card){
    return window.CARD_DEFS?.find?.(item=>item.key === card?.key) || null;
  }

  function signedValue(value){
    if(!value) return '';
    return `${value > 0 ? '+' : ''}${value}`;
  }

  function statParts(card,stat,currentValue){
    const def = baseCardDef(card);
    let base = 0;

    if(stat === 'attack'){
      base = def?.atk ?? card.atk ?? 0;
    }else if(stat === 'counter'){
      base = def?.counter ?? card.counter ?? 0;
    }else{
      base = def?.hp ?? Math.max(
        0,
        (card.maxHp ?? card.hp ?? 0) -
          (Array.isArray(card.phaseBuffs)
            ? card.phaseBuffs.reduce((sum,buff)=>sum + (buff.hp || 0),0)
            : 0)
      );
    }

    return {
      base:Math.max(0,base),
      bonus:currentValue - base
    };
  }

  function statBadgeHTML(icon,parts,title){
    const bonus = signedValue(parts.bonus);
    const modClass = parts.bonus > 0
      ? ' stat-modified stat-buffed'
      : parts.bonus < 0
        ? ' stat-modified stat-debuffed'
        : '';

    return `
      <div class="inspect-stat ${escapeHTML(title.toLowerCase())}${modClass}" title="${escapeHTML(title)}">
        <span>${escapeHTML(icon)} ${escapeHTML(parts.base)}</span>
        ${bonus ? `<em class="${parts.bonus > 0 ? 'positive' : 'negative'}">${escapeHTML(bonus)}</em>` : ''}
      </div>
    `;
  }

  function statText(icon,parts){
    const bonus = signedValue(parts.bonus);
    return `${icon} ${parts.base}${bonus ? ` ${bonus}` : ''}`;
  }

  function abilityList(card){
    if(card?.category !== 'creature'){
      return [];
    }

    const abilities = [];

    if(card.quick) abilities.push('Quick');
    if(card.pierce) abilities.push(`Pierce ${card.pierce}`);
    if(card.lifesteal) abilities.push(`Lifesteal ${card.lifesteal}`);
    if(card.shield) abilities.push(`Shield ${card.shield}`);
    if(card.regen) abilities.push(`Regeneration ${card.regen}`);
    if(card.venom) abilities.push(`Poison ${card.venom}`);
    if(card.splash) abilities.push(`Splash ${card.splash}`);
    if(card.execute) abilities.push(`Execute ${card.execute}`);
    if(card.sniper) abilities.push(`Sniper ${card.sniper}`);
    if(card.fury) abilities.push(`Fury ${card.fury}`);
    if(card.rebirth) abilities.push('Rebirth');
    if(card.stealth) abilities.push('Stealth');
    if(card.rowHealOnSummon){
      abilities.push(`Heal Row ${card.rowHealOnSummon}`);
    }
    if(card.handHealOnSummon){
      abilities.push(`Heal Hand ${card.handHealOnSummon}`);
    }

    return abilities;
  }

  function spellAreaInfo(card){
    if(card?.category !== 'spell'){
      return {key:'target',icon:'◇',label:'Target',value:null};
    }

    if(card.spellType === 'shared' || card.scope === 'column'){
      return {key:'shared',icon:'↕',label:'Shared Column',value:null};
    }

    if(card.scope === 'spell_slot' || card.effect === 'destroy_spell'){
      return {key:'spell-slot',icon:'✖',label:'Spell Target',value:null};
    }

    if(card.scope === 'row'){
      if(card.placementSide === 'enemy'){
        return {key:'enemy-row',icon:'⇥',label:'Enemy Row',value:null};
      }

      if(card.placementSide === 'either'){
        return {key:'any-row',icon:'⇄',label:'Any Row',value:null};
      }

      return {key:'friendly-row',icon:'⇤',label:'Your Row',value:null};
    }

    return {key:'target',icon:'◇',label:'Target',value:null};
  }

  function spellTimingInfo(card){
    if(card?.spellType === 'trap'){
      return {key:'trap',icon:'⚠',label:'Trap',value:null};
    }

    if(card?.spellType === 'shared'){
      return {key:'field',icon:'∞',label:'Field',value:null};
    }

    if(card?.spellType === 'ongoing'){
      return {key:'ongoing',icon:'∞',label:'Ongoing',value:null};
    }

    return {key:'instant',icon:'⚡',label:'Instant',value:null};
  }

  function spellIconItems(card){
    if(card?.category !== 'spell') return [];
    return [spellAreaInfo(card),spellTimingInfo(card)];
  }

  function abilityIconItems(card){
    if(card?.category === 'spell') return spellIconItems(card);
    if(card?.category !== 'creature') return [];

    const items = [];
    const shield = card.shieldCharges ?? card.shield ?? 0;
    const pierce = (card.pierce || 0) + (card.pierceBonus || 0);
    const furyActive =
      card.fury &&
      card.hp <= Math.ceil((card.maxHp || card.hp || 1) / 2);

    if(card.quick) items.push({key:'quick',icon:'⚡',label:'Quick',value:null});
    if(shield > 0) items.push({key:'shield',icon:'🛡',label:'Shield',value:shield});
    if(card.venom) items.push({key:'poison',icon:'☠',label:'Poison',value:card.venom});
    if(card.poison > 0) items.push({key:'poisoned',icon:'☠',label:'Poisoned',value:card.poison});
    if(card.stealth) items.push({key:'stealth',icon:'◐',label:'Stealth',value:null});
    if(card.rebirth) items.push({key:'rebirth',icon:'↺',label:card.rebirthUsed ? 'Rebirth Used' : 'Rebirth',value:null});
    if(card.regen) items.push({key:'regen',icon:'✚',label:'Regeneration',value:card.regen});
    if(pierce > 0) items.push({key:'pierce',icon:'◆',label:'Pierce',value:pierce});
    if(card.lifesteal) items.push({key:'lifesteal',icon:'♥',label:'Lifesteal',value:card.lifesteal});
    if(card.splash) items.push({key:'splash',icon:'✹',label:'Splash',value:card.splash});
    if(card.execute) items.push({key:'execute',icon:'×',label:'Execute',value:card.execute});
    if(card.sniper) items.push({key:'sniper',icon:'◎',label:'Sniper',value:card.sniper});
    if(card.fury) items.push({key:'fury',icon:'▲',label:furyActive ? 'Fury Active' : 'Fury',value:card.fury});
    if(card.rowHealOnSummon) items.push({key:'heal-row',icon:'✚',label:'Heal Row on Summon',value:card.rowHealOnSummon});
    if(card.handHealOnSummon) items.push({key:'heal-hand',icon:'✚',label:'Heal Hand on Summon',value:card.handHealOnSummon});

    return items;
  }

  function abilityIconHTML(items,className){
    if(!items.length) return '';
    const spellKeys = new Set(['target','shared','spell-slot','enemy-row','any-row','friendly-row','trap','field','ongoing','instant']);

    return `
      <div class="${className}">
        ${items.map(item=>`
          <span class="inspect-passive-chip passive-${escapeHTML(item.key)}" title="${escapeHTML(item.label)}">
            <b>${escapeHTML(item.icon)}</b>
            ${item.value ? `<em>${escapeHTML(item.value)}</em>` : ''}
            ${className === 'inspect-ability-grid' && !spellKeys.has(item.key) ? `<strong>${escapeHTML(item.label)}</strong>` : ''}
          </span>
        `).join('')}
      </div>
    `;
  }

  function generatedRule(card){
    if(card.description) return card.description;

    if(card.category === 'creature'){
      const row = card.creatureType === 'melee'
        ? 'Baris Depan'
        : 'Baris Belakang';

      return `Tempatkan creature ini di ${row}. Creature akan siap menyerang mulai giliran berikutnya.`;
    }

    if(card.effect === 'damage'){
      return `Pilih satu target musuh dan berikan ${card.value || 0} damage.`;
    }

    if(card.effect === 'buff'){
      return `Pilih satu creature milikmu. Creature tersebut mendapatkan +${card.value || 0} Attack dan +${card.value || 0} Health.`;
    }

    if(card.effect === 'trap_damage'){
      return `Saat terpicu, berikan ${card.value || 0} damage kepada creature yang menyerang.`;
    }

    return 'Deskripsi lengkap untuk kartu ini belum tersedia.';
  }

  function typeText(card){
    if(card.category === 'creature'){
      if(card.creatureType === 'melee') return 'Creature Jarak Dekat';
      if(card.creatureType === 'ranged') return 'Creature Jarak Jauh';
      return 'Creature Flyer';
    }

    if(card.spellType === 'instant') return 'Spell Instan';
    if(card.spellType === 'trap') return 'Spell Perangkap';
    if(card.spellType === 'ongoing') return 'Spell Berkelanjutan';
    if(card.spellType === 'shared') return 'Shared Spell';
    return 'Kartu Spell';
  }

  function locationText(card){
    if(card.category === 'creature'){
      return card.creatureType === 'melee'
        ? 'Baris Depan'
        : 'Baris Belakang';
    }

    if(card.effect === 'destroy_spell'){
      return 'Langsung pada spell lawan yang menetap';
    }

    if(card.scope === 'column'){
      return 'Shared Spell — Kolom Vertikal';
    }

    if(card.scope === 'row'){
      const side = card.placementSide === 'enemy'
        ? 'row milik lawan'
        : card.placementSide === 'either'
          ? 'row sendiri atau lawan'
          : 'row milik sendiri';

      return `Slot Spell ${side} — Baris Horizontal`;
    }

    return 'Slot Spell';
  }

  function placementSideText(card){
    if(card.category === 'creature') return 'Sisi milik sendiri';
    if(card.scope === 'column') return 'Area bersama';
    if(card.effect === 'destroy_spell') return 'Spell milik lawan';
    if(card.placementSide === 'enemy') return 'Front/Back Row milik lawan';
    if(card.placementSide === 'either') return 'Front/Back Row kedua pemain';
    return 'Front/Back Row milik sendiri';
  }

  function scopeText(card){
    if(card.category === 'creature') return 'Satu slot creature';
    if(card.scope === 'spell_slot') return 'Satu kartu spell lawan';
    if(card.scope === 'column') return 'Vertikal — satu kolom';
    if(card.scope === 'row') return 'Horizontal — satu baris';
    return 'Tidak ditentukan';
  }

  function durationText(card){
    if(card.category === 'creature') return 'Tetap sampai dikalahkan';
    if(card.duration === 'phase') return 'Sampai fase pemilik berakhir';

    if(card.duration === 'persistent' || card.duration === 'triggered'){
      if(typeof card.turnsLeft === 'number') return `Tersisa ${card.turnsLeft} giliran`;
      if(card.durationTurns) return `Menetap ${card.durationTurns} giliran`;
      return card.duration === 'triggered'
        ? 'Menetap sampai terpicu atau dihapus'
        : 'Menetap selama ada di board';
    }

    return 'Langsung selesai lalu Discard';
  }

  function targetText(card){
    if(card.category === 'creature'){
      return card.creatureType === 'melee'
        ? 'Front Row'
        : 'Back Row';
    }

    if(card.effect === 'destroy_spell') return 'Spell lawan';
    if(card.effect === 'damage') return 'Target musuh';
    if(card.effect === 'buff') return 'Creature milikmu';
    if(card.effect === 'trap_damage') return 'Attacker yang memicu trap';
    if(card.scope === 'column') return 'Satu kolom bersama';

    if(card.scope === 'row'){
      if(card.placementSide === 'enemy') return 'Row lawan';
      if(card.placementSide === 'either') return 'Row sendiri atau lawan';
      return 'Row milikmu';
    }

    return scopeText(card);
  }

  function cleanMetaRows(card,type,attack,hp,counter,statBreakdown=null){
    const rows = [
      ['Cost',card.cost],
      ['Faction',card.faction || 'Neutral'],
      ['Type',type]
    ];

    if(card.category === 'creature'){
      rows.push(
        [
          'Stats',
          statBreakdown
            ? [
                statText('⚔',statBreakdown.attack),
                statText('↩',statBreakdown.counter),
                statText('♥',statBreakdown.health)
              ].join(' / ')
            : `${attack} ATK / ${counter} CTR / ${hp} HP`
        ],
        ['Placement',targetText(card)],
        ['Duration',durationText(card)]
      );

      return rows;
    }

    rows.push(
      ['Target',targetText(card)],
      ['Duration',durationText(card)]
    );

    return rows;
  }

  function buildOverlay(){
    overlay = document.createElement('section');
    overlay.className = 'card-inspector';
    overlay.id = 'cardInspector';
    overlay.setAttribute('aria-hidden','true');

    overlay.innerHTML = `
      <button
        class="card-inspector-side card-inspector-side-prev"
        type="button"
        aria-label="Kartu sebelumnya"
      ></button>

      <button
        class="card-inspector-side card-inspector-side-next"
        type="button"
        aria-label="Kartu berikutnya"
      ></button>

      <div
        class="card-inspector-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspectTitle"
      >
        <button
          class="card-inspector-close"
          type="button"
          aria-label="Tutup detail kartu"
        >×</button>

        <div id="inspectPreview"></div>

        <div class="inspect-details">
          <div class="inspect-eyebrow" id="inspectEyebrow">Detail Kartu</div>
          <h2 class="inspect-title" id="inspectTitle">Kartu</h2>

          <div class="inspect-rule-box">
            <h3>Card Text</h3>
            <p id="inspectRules"></p>
          </div>

          <div class="inspect-meta" id="inspectMeta"></div>

          <p class="inspect-hint">
            Geser, tekan panah, atau pakai tombol kanan/kiri untuk melihat kartu lain.
            Tutup dengan Escape, tombol ×, atau klik area gelap.
          </p>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay
      .querySelector('.card-inspector-close')
      .addEventListener('click',closeInspector);

    overlay
      .querySelector('.card-inspector-side-prev')
      .addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        navigateInspector(-1);
      });

    overlay
      .querySelector('.card-inspector-side-next')
      .addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        navigateInspector(1);
      });

    overlay.addEventListener('pointerdown',event=>{
      if(event.target === overlay) closeInspector();
    });

    const dialog = overlay.querySelector('.card-inspector-dialog');

    dialog.addEventListener('pointerdown',event=>{
      if(event.target.closest('button,input,select,textarea,a')) return;
      swipePointerId = event.pointerId;
      swipeStartX = event.clientX;
      swipeStartY = event.clientY;
      dialog.setPointerCapture?.(event.pointerId);
    });

    dialog.addEventListener('pointerup',event=>{
      if(swipePointerId !== event.pointerId) return;

      const dx = event.clientX - swipeStartX;
      const dy = event.clientY - swipeStartY;

      swipePointerId = null;
      dialog.releasePointerCapture?.(event.pointerId);

      if(Math.abs(dx) < 62 || Math.abs(dx) < Math.abs(dy) * 1.25){
        return;
      }

      navigateInspector(dx < 0 ? 1 : -1);
    });

    dialog.addEventListener('pointercancel',event=>{
      if(swipePointerId !== event.pointerId) return;
      swipePointerId = null;
      dialog.releasePointerCapture?.(event.pointerId);
    });

    overlay.addEventListener('contextmenu',event=>event.preventDefault());
  }

  function updateNavigation(){
    const canNavigate = currentContext.length > 1;
    const previousButton = overlay?.querySelector('.card-inspector-side-prev');
    const nextButton = overlay?.querySelector('.card-inspector-side-next');

    for(const button of [previousButton,nextButton]){
      if(!button) continue;
      button.hidden = !canNavigate;
      button.disabled = !canNavigate;
    }

    if(!canNavigate){
      return;
    }

    const previousCard =
      currentContext[
        (currentIndex - 1 + currentContext.length) %
        currentContext.length
      ];

    const nextCard =
      currentContext[
        (currentIndex + 1) %
        currentContext.length
      ];

    if(previousButton){
      previousButton.innerHTML = sidePreviewHTML(previousCard,'‹');
    }

    if(nextButton){
      nextButton.innerHTML = sidePreviewHTML(nextCard,'›');
    }
  }

  function sidePreviewHTML(card,arrow){
    if(!card) return '';

    return `
      <span class="card-inspector-side-card ${card.category === 'spell' ? 'spell' : ''}">
        <span class="card-inspector-side-art">
          <img src="${escapeHTML(card.img)}" alt="">
        </span>
        <span class="card-inspector-side-arrow">${escapeHTML(arrow)}</span>
        <span class="card-inspector-side-info">
          <strong>${escapeHTML(card.name)}</strong>
          <small>${escapeHTML(typeText(card))}</small>
        </span>
      </span>
    `;
  }

  function renderCard(card){
    const isCreature = card.category === 'creature';
    const type = typeText(card);
    const attack = effectiveAttack(card);
    const hp = Math.max(0,card.hp ?? card.maxHp ?? 0);

    const counter = effectiveCounter(card);
    const abilityIcons = abilityIconItems(card);
    const statBreakdown = isCreature
      ? {
          attack:statParts(card,'attack',attack),
          health:statParts(card,'health',card.maxHp ?? hp),
          counter:statParts(card,'counter',counter)
        }
      : null;

    const statsHTML = isCreature
      ? `
        <div class="inspect-card-stats">
          ${statBadgeHTML('⚔',statBreakdown.attack,'Attack')}
          ${statBadgeHTML('♥',statBreakdown.health,'Health')}
          ${counter > 0 || statBreakdown.counter.base > 0 || statBreakdown.counter.bonus !== 0
            ? statBadgeHTML('↩',statBreakdown.counter,'Counter')
            : ''}
        </div>
      `
      : `
        <div class="inspect-card-stats">
          ${spellIconItems(card).map(item=>`
            <div class="inspect-stat spell-${escapeHTML(item.key)}" title="${escapeHTML(item.label)}">
              ${escapeHTML(item.icon)}
            </div>
          `).join('')}
        </div>
      `;

    document.getElementById('inspectPreview').innerHTML = `
      <article class="inspect-card ${isCreature ? '' : 'spell'}">
        <div class="inspect-card-art">
          <img src="${escapeHTML(card.img)}" alt="${escapeHTML(card.name)}">
        </div>

        <div class="inspect-card-cost">${escapeHTML(card.cost)}</div>

        <div class="inspect-card-body">
          <div class="inspect-card-name">${escapeHTML(card.name)}</div>
          <div class="inspect-card-type">${escapeHTML(type)}</div>
          <div class="inspect-card-description">${escapeHTML(generatedRule(card))}</div>
        </div>

        ${statsHTML}
        ${abilityIconHTML(abilityIcons,'inspect-passive-icons')}
      </article>
    `;

    document.getElementById('inspectEyebrow').textContent = type;
    document.getElementById('inspectTitle').textContent = card.name;
    document.getElementById('inspectRules').textContent = generatedRule(card);

    const abilityGrid = abilityIconHTML(abilityIcons,'inspect-ability-grid');
    const meta = cleanMetaRows(card,type,attack,hp,counter,statBreakdown);

    document.getElementById('inspectMeta').innerHTML = meta
      .map(([label,value])=>`
        <div class="inspect-meta-item">
          <span>${escapeHTML(label)}</span>
          <strong>${escapeHTML(value)}</strong>
        </div>
      `)
      .join('');

    const ruleBox = document.querySelector('.inspect-rule-box');
    document.querySelector('.inspect-ability-grid')?.remove();
    if(abilityGrid){
      ruleBox?.insertAdjacentHTML('afterend',abilityGrid);
    }
  }

  function openInspector(cardEl,options={}){
    const card = findCard(cardEl?.dataset?.cardId) || findCardDef(cardEl?.dataset?.cardKey);
    if(!card) return;

    if(!overlay) buildOverlay();
    window.TCGSFX?.play?.('detail_open');

    window.game?.cleanDrag?.(false);
    window.game?.hideLine?.();

    currentCard = card;
    buildContext(card,cardEl,options);
    renderCard(card);
    updateNavigation();

    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden','false');
    document.body.classList.add('card-inspector-open');
    document.dispatchEvent(new CustomEvent('tcg:card-inspector-open',{
      detail:{
        cardId:cardEl?.dataset?.cardId||card.id,
        cardKey:card.key||cardEl?.dataset?.cardKey||''
      }
    }));

    requestAnimationFrame(()=>{
      overlay.querySelector('.card-inspector-close')?.focus();
    });
  }

  function closeInspector(){
    if(!overlay?.classList.contains('open')) return;
    window.TCGSFX?.play?.('detail_close');

    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden','true');
    document.body.classList.remove('card-inspector-open');
    currentCard = null;
    currentContext = [];
    currentIndex = -1;
  }

  function navigateInspector(direction){
    if(!overlay?.classList.contains('open')) return;
    if(currentContext.length <= 1) return;

    currentIndex =
      (currentIndex + direction + currentContext.length) %
      currentContext.length;

    currentCard = currentContext[currentIndex];
    window.TCGSFX?.play?.('ui_click');
    renderCard(currentCard);
    updateNavigation();

    document.dispatchEvent(new CustomEvent('tcg:card-inspector-open',{
      detail:{
        cardId:currentCard?.id || '',
        cardKey:currentCard?.key || ''
      }
    }));
  }

  function clearHold(){
    if(holdTimer){
      clearTimeout(holdTimer);
      holdTimer = null;
    }

    holdCardEl = null;
    document.body.classList.remove('card-hold-pending');
  }

  function startHold(event,cardEl){
    clearHold();

    holdCardEl = cardEl;
    holdStartX = event.clientX;
    holdStartY = event.clientY;
    document.body.classList.add('card-hold-pending');

    holdTimer = setTimeout(()=>{
      const target = holdCardEl;
      suppressClickUntil = performance.now() + 900;

      clearHold();
      window.game?.cleanDrag?.(false);
      window.game?.cancelAttack?.();
      openInspector(target);
    },HOLD_DURATION);
  }

  function bindEvents(){
    document.addEventListener('pointerdown',event=>{
      const cardEl = inspectableCardFromEvent(event);
      if(!cardEl) return;

      if(event.button === 2){
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if(event.button !== 0) return;
      startHold(event,cardEl);
    },true);

    document.addEventListener('pointermove',event=>{
      if(!holdTimer) return;

      const moved = Math.hypot(
        event.clientX - holdStartX,
        event.clientY - holdStartY
      );

      if(moved > MOVE_TOLERANCE) clearHold();
    },true);

    document.addEventListener('pointerup',clearHold,true);
    document.addEventListener('pointercancel',clearHold,true);

    document.addEventListener('contextmenu',event=>{
      const cardEl = inspectableCardFromEvent(event);
      if(!cardEl) return;

      event.preventDefault();
      event.stopPropagation();

      clearHold();
      window.game?.cleanDrag?.(false);
      window.game?.cancelAttack?.();

      suppressClickUntil = performance.now() + 500;
      openInspector(cardEl);
    },true);

    document.addEventListener('click',event=>{
      const cardEl = inspectableCardFromEvent(event);
      const suppressed = performance.now() < suppressClickUntil;

      if(
        cardEl?.classList.contains('collection-card') &&
        !suppressed
      ){
        event.preventDefault();
        event.stopImmediatePropagation();

        clearHold();
        openInspector(cardEl);
        return;
      }

      if(!suppressed) return;
      if(!cardEl) return;

      event.preventDefault();
      event.stopImmediatePropagation();
    },true);

    document.addEventListener('keydown',event=>{
      if(event.key === 'Escape' && overlay?.classList.contains('open')){
        event.preventDefault();
        event.stopImmediatePropagation();
        closeInspector();
        return;
      }

      if(
        overlay?.classList.contains('open') &&
        (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
      ){
        event.preventDefault();
        event.stopImmediatePropagation();
        navigateInspector(event.key === 'ArrowRight' ? 1 : -1);
      }
    },true);

    window.addEventListener('blur',()=>{
      clearHold();
      closeInspector();
    });
  }

  window.TCGCardInspector = {
    open:openInspector,
    next:()=>navigateInspector(1),
    previous:()=>navigateInspector(-1),
    close:closeInspector,
    isOpen:()=>!!overlay?.classList.contains('open')
  };

  window.addEventListener('DOMContentLoaded',()=>{
    buildOverlay();
    bindEvents();
  });
})();
