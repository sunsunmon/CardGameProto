(function(){
  'use strict';

  const $ = id=>document.getElementById(id);

  let overlay = null;
  let editingDeck = null;
  let editingCards = [];
  let selectedDeckId = 'starter';
  let currentDrag = null;
  let smartPreviewCards = [];
  let smartPreviousCards = null;

  const SMART_PICK = {
    styles:{
      balanced:{
        label:'Balanced',
        creatureRatio:.67,
        lowRatio:.27,
        midRatio:.46,
        targetAvg:3.2
      },
      manual:{
        label:'Manual Mix',
        creatureRatio:.67,
        lowRatio:.27,
        midRatio:.46,
        targetAvg:3.2
      },
      attack:{
        label:'Attack',
        creatureRatio:.7,
        lowRatio:.3,
        midRatio:.46,
        targetAvg:3.1
      },
      defense:{
        label:'Defense',
        creatureRatio:.72,
        lowRatio:.23,
        midRatio:.45,
        targetAvg:3.5
      },
      heal:{
        label:'Heal',
        creatureRatio:.66,
        lowRatio:.25,
        midRatio:.5,
        targetAvg:3.3
      },
      effect:{
        label:'Effect',
        creatureRatio:.56,
        lowRatio:.24,
        midRatio:.5,
        targetAvg:3.4
      }
    },
    defaultStyle:'balanced'
  };

  function escapeHTML(value){
    return String(value ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  function storage(){
    return window.TCGDeckStorage;
  }

  function cardDefs(){
    return window.CARD_DEFS || [];
  }

  function cardByKey(key){
    return cardDefs().find(card=>card.key === key) || null;
  }

  function spellAreaInfo(card){
    if(card.spellType === 'shared' || card.scope === 'column') return {key:'shared',icon:'↕',label:'Shared Column'};
    if(card.scope === 'spell_slot' || card.effect === 'destroy_spell') return {key:'spell-slot',icon:'✖',label:'Spell Target'};
    if(card.scope === 'row'){
      if(card.placementSide === 'enemy') return {key:'enemy-row',icon:'⇥',label:'Enemy Row'};
      if(card.placementSide === 'either') return {key:'any-row',icon:'⇄',label:'Any Row'};
      return {key:'friendly-row',icon:'⇤',label:'Your Row'};
    }
    return {key:'target',icon:'◇',label:'Target'};
  }

  function spellTimingInfo(card){
    if(card.spellType === 'trap') return {key:'trap',icon:'⚠',label:'Trap'};
    if(card.spellType === 'shared') return {key:'field',icon:'∞',label:'Field'};
    if(card.spellType === 'ongoing') return {key:'ongoing',icon:'∞',label:'Ongoing'};
    return {key:'instant',icon:'⚡',label:'Instant'};
  }

  function abilityIconItems(card){
    if(card.category === 'spell'){
      return [
        spellAreaInfo(card),
        spellTimingInfo(card)
      ];
    }

    const items = [];
    if(card.quick) items.push({key:'quick',icon:'⚡',label:'Quick'});
    if(card.shield) items.push({key:'shield',icon:'🛡',label:'Shield',value:card.shield});
    if(card.venom) items.push({key:'poison',icon:'☠',label:'Poison',value:card.venom});
    if(card.stealth) items.push({key:'stealth',icon:'◐',label:'Stealth'});
    if(card.rebirth) items.push({key:'rebirth',icon:'↺',label:'Rebirth'});
    if(card.regen) items.push({key:'regen',icon:'✚',label:'Regeneration',value:card.regen});
    if(card.pierce) items.push({key:'pierce',icon:'◆',label:'Pierce',value:card.pierce});
    if(card.lifesteal) items.push({key:'lifesteal',icon:'♥',label:'Lifesteal',value:card.lifesteal});
    if(card.splash) items.push({key:'splash',icon:'✹',label:'Splash',value:card.splash});
    if(card.execute) items.push({key:'execute',icon:'×',label:'Execute',value:card.execute});
    if(card.sniper) items.push({key:'sniper',icon:'◎',label:'Sniper',value:card.sniper});
    if(card.fury) items.push({key:'fury',icon:'▲',label:'Fury',value:card.fury});
    if(card.flexRow) items.push({key:'flex-row',icon:'⇄',label:'Flex Row'});
    if(card.rowHealOnSummon) items.push({key:'heal-row',icon:'✚',label:'Heal Row on Summon',value:card.rowHealOnSummon});
    if(card.handHealOnSummon) items.push({key:'heal-hand',icon:'✚',label:'Heal Hand on Summon',value:card.handHealOnSummon});
    return items;
  }

  function abilityIconHTML(card){
    const items = abilityIconItems(card);
    if(!items.length) return '';

    return `
      <span class="deck-build-ability-icons" aria-label="Card abilities">
        ${items.slice(0,5).map(item=>`
          <span class="deck-build-ability-icon passive-${escapeHTML(item.key)}" title="${escapeHTML(item.label)}">
            <b>${escapeHTML(item.icon)}</b>
            ${item.value ? `<em>${escapeHTML(item.value)}</em>` : ''}
          </span>
        `).join('')}
      </span>
    `;
  }

  function poolAbilityIconHTML(card){
    const items = abilityIconItems(card);
    if(!items.length) return '';

    return `
      <span class="deck-card-ability-icons" aria-hidden="true">
        ${items.slice(0,5).map(item=>`
          <span class="deck-card-ability-icon passive-${escapeHTML(item.key)}" title="${escapeHTML(item.label)}">
            <b>${escapeHTML(item.icon)}</b>
            ${item.value ? `<em>${escapeHTML(item.value)}</em>` : ''}
          </span>
        `).join('')}
      </span>
    `;
  }

  function countCopies(key){
    return editingCards.filter(item=>item === key).length;
  }

  function searchTerms(card){
    return [
      card.name,
      card.faction,
      card.category,
      card.creatureType,
      card.spellType,
      card.scope,
      card.effect,
      card.description
    ];
  }

  function sortValue(card,sort){
    if(sort.startsWith('cost')) return card.cost || 0;
    if(sort.startsWith('attack')) return card.category === 'creature' ? (card.atk || 0) : 0;
    if(sort.startsWith('hp')) return card.category === 'creature' ? (card.hp || 0) : 0;
    if(sort.startsWith('counter')) return card.category === 'creature' ? (card.counter || 0) : 0;
    if(sort.startsWith('name')) return card.name || '';
    if(sort.startsWith('type')) return card.category === 'creature' ? (card.creatureType || '') : (card.spellType || '');
    if(sort.startsWith('faction')) return card.faction || '';
    return card.cost || 0;
  }

  function sortCards(cards){
    const sort = $('deckCardSort')?.value || 'cost_asc';
    const direction = sort.endsWith('_desc') ? -1 : 1;

    return cards.slice().sort((a,b)=>{
      const av = sortValue(a,sort);
      const bv = sortValue(b,sort);

      if(typeof av === 'number' || typeof bv === 'number'){
        const diff = ((Number(av) || 0) - (Number(bv) || 0)) * direction;
        if(diff) return diff;
      }else{
        const diff = String(av).localeCompare(String(bv)) * direction;
        if(diff) return diff;
      }

      return (a.cost - b.cost) || a.name.localeCompare(b.name);
    });
  }

  function sortedCards(){
    const query = ($('deckCardSearch')?.value || '').trim().toLowerCase();
    const type = $('deckCardType')?.value || 'all';
    const faction = $('deckCardFaction')?.value || 'all';

    const cards = cardDefs()
      .filter(card=>type === 'all' || card.category === type)
      .filter(card=>faction === 'all' || card.faction === faction)
      .filter(card=>{
        if(!query) return true;
        return searchTerms(card)
          .some(value=>String(value || '').toLowerCase().includes(query));
      });

    return sortCards(cards);
  }

  function populateFactionSelect(id='deckCardFaction'){
    const select = $(id);
    if(!select) return;

    const current = select.value || 'all';
    const factions = [...new Set(cardDefs().map(card=>card.faction).filter(Boolean))].sort();

    select.innerHTML = [
      '<option value="all">All Factions</option>',
      ...factions.map(faction=>`<option value="${escapeHTML(faction)}">${escapeHTML(faction)}</option>`)
    ].join('');

    select.value = factions.includes(current) ? current : 'all';
  }

  function populateFactions(){
    populateFactionSelect('deckCardFaction');
    populateFactionSelect('deckSmartFaction');
  }

  function smartStyle(styleKey=''){
    const key = styleKey || $('deckSmartStyle')?.value || SMART_PICK.defaultStyle;
    const style = SMART_PICK.styles[key] || SMART_PICK.styles[SMART_PICK.defaultStyle];
    return {
      key:SMART_PICK.styles[key] ? key : SMART_PICK.defaultStyle,
      ...style
    };
  }

  function smartTargets(styleKey=''){
    const style = smartStyle(styleKey);
    const deckSize = storage().DEFAULT_DECK_SIZE;
    const creatures = Math.round(deckSize * style.creatureRatio);
    const spells = deckSize - creatures;
    const low = Math.round(deckSize * style.lowRatio);
    const mid = Math.round(deckSize * style.midRatio);
    const high = deckSize - low - mid;

    return {deckSize,creatures,spells,low,mid,high,avg:style.targetAvg,style};
  }

  function costBand(card){
    const cost = card.cost || 0;
    if(cost <= 2) return 'low';
    if(cost <= 4) return 'mid';
    return 'high';
  }

  function hasAnyAbility(card,keys){
    const items = abilityIconItems(card).map(item=>item.key);
    return keys.some(key=>items.includes(key));
  }

  function smartStyleBonus(card,styleKey){
    if(styleKey === 'attack'){
      let bonus = 0;
      if(card.category === 'creature'){
        bonus += (card.atk || 0) * 2.2;
        if(card.quick) bonus += 12;
        if(card.pierce) bonus += 8;
        if(card.fury) bonus += 8;
        if(card.sniper) bonus += 7;
        if(card.lifesteal) bonus += 4;
      }else{
        bonus += (card.value || 0) * 3;
        if(card.effect === 'damage' || card.effect === 'destroy_spell') bonus += 10;
        if(card.spellType === 'instant') bonus += 6;
      }
      return bonus;
    }

    if(styleKey === 'defense'){
      let bonus = 0;
      if(card.category === 'creature'){
        bonus += (card.hp || 0) * 2.3;
        bonus += (card.counter || 0) * 2.2;
        if(card.shield) bonus += 12;
        if(card.regen) bonus += 8;
        if(card.stealth) bonus += 6;
        if(card.rebirth) bonus += 7;
      }else{
        if(card.spellType === 'trap') bonus += 10;
        if(card.effect === 'buff' || card.effect === 'shield') bonus += 8;
      }
      return bonus;
    }

    if(styleKey === 'heal'){
      let bonus = 0;
      if(card.category === 'creature'){
        if(card.rowHealOnSummon) bonus += 18;
        if(card.handHealOnSummon) bonus += 18;
        if(card.lifesteal) bonus += 12;
        if(card.regen) bonus += 9;
      }else{
        if(card.effect === 'heal') bonus += 20;
        if(card.effect === 'buff') bonus += 5;
      }
      return bonus;
    }

    if(styleKey === 'effect'){
      let bonus = 0;
      bonus += abilityIconItems(card).length * 5;
      if(card.category === 'spell'){
        bonus += 8;
        if(card.spellType === 'ongoing' || card.spellType === 'shared') bonus += 9;
        if(card.spellType === 'trap') bonus += 8;
      }else if(hasAnyAbility(card,['poison','stealth','rebirth','splash','execute','flex-row','shield'])){
        bonus += 10;
      }
      return bonus;
    }

    return 0;
  }

  function smartScore(card,preferredFaction,styleKey){
    const style = SMART_PICK.styles[styleKey] || SMART_PICK.styles[SMART_PICK.defaultStyle];
    let score = 0;
    if(preferredFaction !== 'all' && card.faction === preferredFaction) score += 80;
    if(card.category === 'creature'){
      score += (card.atk || 0) * 2.2;
      score += (card.hp || 0) * 1.8;
      score += (card.counter || 0) * 1.4;
    }else{
      score += (card.value || 0) * 2.4;
      if(card.spellType === 'instant') score += 2;
      if(card.spellType === 'ongoing' || card.spellType === 'shared') score += 3;
      if(card.spellType === 'trap') score += 2.5;
    }

    score += abilityIconItems(card).length * 2.5;
    score += smartStyleBonus(card,styleKey);
    score -= Math.abs((card.cost || 0) - style.targetAvg) * .7;
    return score;
  }

  function cardCountInList(list,key){
    return list.filter(item=>item === key).length;
  }

  function canSmartAdd(list,card){
    if(!card) return false;
    if(list.length >= storage().DEFAULT_DECK_SIZE) return false;
    return cardCountInList(list,card.key) < storage().MAX_COPIES;
  }

  function smartCandidates({category,band,preferredFaction,strictFaction,styleKey}){
    return cardDefs()
      .filter(card=>!category || card.category === category)
      .filter(card=>!band || costBand(card) === band)
      .filter(card=>!strictFaction || preferredFaction === 'all' || card.faction === preferredFaction)
      .map(card=>({
        card,
        weight:Math.max(1,smartScore(card,preferredFaction,styleKey))
      }));
  }

  function pickWeightedCandidate(candidates,list){
    const available = candidates.filter(item=>canSmartAdd(list,item.card));
    if(!available.length) return null;

    const total = available.reduce((sum,item)=>sum + item.weight,0);
    let roll = Math.random() * total;

    for(const item of available){
      roll -= item.weight;
      if(roll <= 0) return item.card;
    }

    return available[available.length - 1].card;
  }

  function addSmartCards(list,options,targetCount){
    let added = 0;
    const preferredFaction = options.preferredFaction || 'all';
    const styleKey = options.styleKey || smartStyle().key;
    const candidateSets = [
      smartCandidates({...options,preferredFaction,styleKey,strictFaction:preferredFaction !== 'all'}),
      smartCandidates({...options,preferredFaction,styleKey,strictFaction:false})
    ];

    for(const candidates of candidateSets){
      while(added < targetCount){
        const card = pickWeightedCandidate(candidates,list);
        if(!card) break;
        list.push(card.key);
        added += 1;
      }
      if(added >= targetCount) break;
    }

    return added;
  }

  function countSmart(list,predicate){
    return list
      .map(cardByKey)
      .filter(card=>card && predicate(card))
      .length;
  }

  function deckProfile(){
    const cards = editingCards.map(cardByKey).filter(Boolean);
    const size = cards.length || 1;
    const creatures = cards.filter(card=>card.category === 'creature').length;
    const spells = cards.filter(card=>card.category === 'spell').length;
    const low = cards.filter(card=>costBand(card) === 'low').length;
    const mid = cards.filter(card=>costBand(card) === 'mid').length;
    const high = cards.filter(card=>costBand(card) === 'high').length;
    const avg = cards.reduce((sum,card)=>sum + (card.cost || 0),0) / size;
    const attack = cards.reduce((sum,card)=>sum + (card.category === 'creature' ? (card.atk || 0) : (card.value || 0)),0);
    const defense = cards.reduce((sum,card)=>sum + (card.category === 'creature' ? (card.hp || 0) + (card.counter || 0) : 0),0);
    const heal = cards.filter(card=>card.effect === 'heal' || card.rowHealOnSummon || card.handHealOnSummon || card.lifesteal || card.regen).length;
    const effects = cards.filter(card=>card.category === 'spell' || abilityIconItems(card).length >= 2).length;
    const quick = cards.filter(card=>card.quick).length;
    const costOne = cards.filter(card=>(card.cost || 0) <= 1).length;
    const costTwoOrLess = cards.filter(card=>(card.cost || 0) <= 2).length;

    return {cards,size,creatures,spells,low,mid,high,avg,attack,defense,heal,effects,quick,costOne,costTwoOrLess};
  }

  function deckBalanceWarnings(profile){
    const warnings = [];
    const targetSize = storage().DEFAULT_DECK_SIZE;

    if(profile.cards.length < targetSize){
      warnings.push(`Deck belum penuh: ${profile.cards.length}/${targetSize} kartu.`);
    }

    if(profile.cards.length >= targetSize && profile.costTwoOrLess < 8){
      warnings.push('Early game tipis: usahakan minimal 8 kartu cost 1-2 agar tidak sering skip turn awal.');
    }

    if(profile.cards.length >= targetSize && profile.costOne < 3){
      warnings.push('Cost 1 terlalu sedikit: opening hand bisa terasa berat.');
    }

    if(profile.avg > 4){
      warnings.push('Avg cost tinggi: deck kuat di late-game, tapi rawan kalah tempo.');
    }

    if(profile.quick > 7){
      warnings.push('Quick sangat banyak: deck agresif, tapi bisa kehabisan gas kalau board berhasil ditahan.');
    }

    if(profile.creatures < 16 && profile.cards.length >= targetSize){
      warnings.push('Creature sedikit: kamu mungkin kesulitan menjaga lane.');
    }

    return warnings;
  }

  function deckConclusion(){
    const profile = deckProfile();
    if(!profile.cards.length){
      return '<b>Deck kosong.</b> Tambahkan kartu manual atau buka Smart Pick untuk membuat draft deck.';
    }

    const speed = profile.avg <= 2.6
      ? 'cepat dan ringan'
      : profile.avg >= 4
        ? 'berat dan late-game'
        : 'tempo sedang';
    const mainType = profile.creatures >= profile.spells * 2
      ? 'lebih mengandalkan creature'
      : profile.spells > profile.creatures
        ? 'lebih mengandalkan spell'
        : 'cukup seimbang antara creature dan spell';
    const style = profile.heal >= 4
      ? 'punya sustain/heal yang kuat'
      : profile.effects >= 10
        ? 'banyak memainkan efek dan kontrol'
        : profile.attack > profile.defense * 1.15
          ? 'cenderung agresif'
          : profile.defense > profile.attack * 1.15
            ? 'cenderung bertahan'
            : 'cukup fleksibel';

    const warnings = deckBalanceWarnings(profile);
    const warningHTML = warnings.length
      ? `<span class="deck-balance-warnings">${warnings.map(escapeHTML).join('<br>')}</span>`
      : '';

    return `<b>Kesimpulan:</b> deck ini ${speed}, ${mainType}, dan ${style}. Avg ${profile.avg.toFixed(1)} berarti rata-rata energy cost kartu yang akan kamu draw/mainkan.${warningHTML}`;
  }

  function generateSmartDeck({styleKey=SMART_PICK.defaultStyle,preferredFaction='all',baseCards=[]}={}){
    const targets = smartTargets(styleKey);
    const appliedStyleKey = targets.style.key;
    const next = [...baseCards].slice(0,targets.deckSize);
    const remainingSlots = Math.max(0,targets.deckSize - next.length);
    const bandOrder = [
      ['low',targets.low],
      ['mid',targets.mid],
      ['high',targets.high]
    ];

    for(const [band,bandTarget] of bandOrder){
      if(next.length >= targets.deckSize) break;

      const currentBand = countSmart(next,card=>costBand(card) === band);
      const needBand = Math.max(0,Math.min(bandTarget - currentBand,targets.deckSize - next.length));
      const creatureTarget = Math.round(bandTarget * targets.style.creatureRatio);
      const currentCreatureBand = countSmart(next,card=>card.category === 'creature' && costBand(card) === band);
      const creatureNeed = Math.max(0,Math.min(creatureTarget - currentCreatureBand,needBand));

      addSmartCards(next,{category:'creature',band,preferredFaction,styleKey:appliedStyleKey},creatureNeed);
      addSmartCards(next,{category:'spell',band,preferredFaction,styleKey:appliedStyleKey},Math.max(0,needBand - creatureNeed));
    }

    addSmartCards(
      next,
      {category:'creature',preferredFaction,styleKey:appliedStyleKey},
      Math.max(0,targets.creatures - countSmart(next,card=>card.category === 'creature'))
    );
    addSmartCards(
      next,
      {category:'spell',preferredFaction,styleKey:appliedStyleKey},
      Math.max(0,targets.spells - countSmart(next,card=>card.category === 'spell'))
    );
    addSmartCards(
      next,
      {preferredFaction,styleKey:appliedStyleKey},
      Math.max(0,Math.min(remainingSlots,targets.deckSize - next.length))
    );

    return next.slice(0,targets.deckSize);
  }

  function smartDialogOptions(){
    return {
      styleKey:$('deckSmartStyle')?.value || SMART_PICK.defaultStyle,
      preferredFaction:$('deckSmartFaction')?.value || 'all',
      mode:$('deckSmartMode')?.value || 'create'
    };
  }

  function generateSmartPreview(){
    const options = smartDialogOptions();
    const baseCards = options.mode === 'fill' ? editingCards : [];
    smartPreviewCards = generateSmartDeck({...options,baseCards});
    renderSmartPreview();
    window.TCGSFX?.play?.('ui_click');
  }

  function openSmartPickDialog(){
    if(!editingDeck) return;
    const dialog = $('deckSmartDialog');
    if(!dialog) return;

    smartPreviewCards = [];
    $('deckSmartStyle').value = SMART_PICK.defaultStyle;
    $('deckSmartMode').value = 'create';
    $('deckSmartConfirmReplace').checked = false;
    populateFactionSelect('deckSmartFaction');
    $('deckSmartFaction').value = $('deckCardFaction')?.value || 'all';
    dialog.hidden = false;
    dialog.classList.add('open');
    generateSmartPreview();
  }

  function closeSmartPickDialog(){
    const dialog = $('deckSmartDialog');
    if(!dialog) return;
    dialog.classList.remove('open');
    dialog.hidden = true;
    smartPreviewCards = [];
  }

  function applySmartPick(){
    if(!editingDeck || !smartPreviewCards.length) return;

    const options = smartDialogOptions();
    if(options.mode === 'replace' && !$('deckSmartConfirmReplace')?.checked) return;

    const canUndoInPlace = options.mode !== 'create' && !editingDeck.locked;
    smartPreviousCards = canUndoInPlace ? [...editingCards] : null;

    if(options.mode === 'create' || editingDeck.locked){
      const sourceName = deckName(editingDeck).replace(/\s+Auto$/,'');
      const saved = storage().saveDeck({
        id:`deck_${Date.now()}`,
        name:`${sourceName} Auto`,
        cards:smartPreviewCards
      });
      selectedDeckId = saved.id;
      editingDeck = saved;
      editingCards = [...saved.cards];
    }else{
      editingCards = [...smartPreviewCards];
    }

    closeSmartPickDialog();
    renderEditor();
    if(canUndoInPlace){
      renderUndoNotice();
    }else{
      hideUndoNotice();
    }
    window.TCGSFX?.play?.('ui_click');
  }

  function renderSmartPreview(){
    const stats = storage().deckStats({cards:smartPreviewCards});
    const options = smartDialogOptions();
    const style = smartStyle(options.styleKey);
    const warning = $('deckSmartWarning');
    const confirmWrap = $('deckSmartConfirmWrap');
    const applyButton = $('deckSmartApplyBtn');

    $('deckSmartPreviewStats').innerHTML = `
      <span>${stats.size}/${storage().DEFAULT_DECK_SIZE} cards</span>
      <span>${stats.creatures} creature</span>
      <span>${stats.spells} spell</span>
      <span>avg ${stats.avgCost}</span>
    `;
    $('deckSmartPreviewList').innerHTML = smartPreviewCards
      .map(key=>smartPreviewCardHTML(key,smartPreviewCards))
      .join('');
    $('deckSmartDialogNote').textContent =
      `${style.label} akan membuat deck ${stats.avgCost <= 2.6 ? 'lebih cepat' : stats.avgCost >= 4 ? 'lebih berat' : 'tempo sedang'} dengan prioritas ${options.preferredFaction === 'all' ? 'semua faction' : options.preferredFaction}.`;

    const replaceMode = options.mode === 'replace';
    warning.hidden = !replaceMode;
    confirmWrap.hidden = !replaceMode;
    applyButton.textContent = options.mode === 'create'
      ? 'Create New Deck'
      : options.mode === 'fill'
        ? 'Fill Empty Slots'
        : 'Replace Deck';
    applyButton.classList.toggle('danger',replaceMode);
    applyButton.disabled = replaceMode && !$('deckSmartConfirmReplace')?.checked;
  }

  function renderUndoNotice(){
    const notice = $('deckUndoNotice');
    if(!notice || !smartPreviousCards) return;

    notice.hidden = false;
    window.clearTimeout(notice._hideTimer);
    notice._hideTimer = window.setTimeout(()=>{
      notice.hidden = true;
    },6000);
  }

  function hideUndoNotice(){
    const notice = $('deckUndoNotice');
    if(!notice) return;
    notice.hidden = true;
    window.clearTimeout(notice._hideTimer);
  }

  function undoSmartPick(){
    if(!smartPreviousCards || !editingDeck || editingDeck.locked) return;

    editingCards = [...smartPreviousCards];
    smartPreviousCards = null;
    $('deckUndoNotice').hidden = true;
    renderCardPool();
    renderCurrentDeck();
    window.TCGSFX?.play?.('ui_close');
  }

  function renderDeckViewDialog(){
    const stats = storage().deckStats({cards:editingCards});
    $('deckViewStats').innerHTML = `
      <span>${stats.size}/${storage().DEFAULT_DECK_SIZE} cards</span>
      <span>${stats.creatures} creature</span>
      <span>${stats.spells} spell</span>
      <span>avg ${stats.avgCost}</span>
    `;
    $('deckViewList').innerHTML = editingCards.length
      ? editingCards.map(key=>smartPreviewCardHTML(key,editingCards,{
        interactive:true,
        extraClass:'deck-current-preview-card'
      })).join('')
      : '<p class="deck-view-empty">Deck masih kosong.</p>';
  }

  function openDeckViewDialog(){
    const dialog = $('deckViewDialog');
    if(!dialog) return;

    renderDeckViewDialog();
    dialog.hidden = false;
    dialog.classList.add('open');
    window.TCGSFX?.play?.('ui_click');
  }

  function closeDeckViewDialog(){
    const dialog = $('deckViewDialog');
    if(!dialog) return;

    dialog.classList.remove('open');
    dialog.hidden = true;
    window.TCGSFX?.play?.('ui_close');
  }

  function updateSmartControls(){
    const autoButton = $('deckSmartOpenBtn');
    if(!autoButton) return;

    autoButton.disabled = !editingDeck;
  }

  function deckName(deck){
    return deck?.name || 'Custom Deck';
  }

  function deckRowHTML(deck){
    const stats = storage().deckStats(deck);
    const active = deck.id === storage().activeDeckId();
    const selected = deck.id === selectedDeckId;

    return `
      <div class="deck-list-item ${selected ? 'selected' : ''} ${active ? 'active' : ''}" data-deck-id="${escapeHTML(deck.id)}">
        <button
          class="deck-active-radio"
          type="button"
          data-deck-use-id="${escapeHTML(deck.id)}"
          aria-label="Use ${escapeHTML(deckName(deck))}"
          aria-pressed="${active ? 'true' : 'false'}"
        >Use</button>
        <button class="deck-list-select" type="button" data-deck-select-id="${escapeHTML(deck.id)}">
          <strong>${escapeHTML(deckName(deck))}</strong>
          <span>${stats.size} cards · ${stats.creatures} creature · ${stats.spells} spell</span>
        </button>
      </div>
    `;
  }

  function previewCopyCount(list,key){
    return list.filter(item=>item === key).length;
  }

  function smartPreviewCardHTML(key,list,options={}){
    const card = cardByKey(key);
    if(!card) return '';

    const interactive = !!options.interactive;
    const extraClass = options.extraClass || '';
    const type = card.category === 'creature' ? card.creatureType : card.spellType;
    const stats = card.category === 'creature'
      ? `<span class="atk">⚔ ${card.atk || 0}</span><span class="counter">↩ ${card.counter || 0}</span><span class="hp">♥ ${card.hp || 0}</span>`
      : `<span>${escapeHTML((card.spellType || 'spell').toUpperCase())}</span>`;

    return `
      <article
        class="deck-card-pick deck-smart-preview-card ${interactive ? 'deck-preview-inspectable' : ''} ${escapeHTML(extraClass)} ${escapeHTML(card.category)}"
        ${interactive ? `data-card-key="${escapeHTML(key)}" title="Klik atau klik kanan untuk detail"` : ''}
        aria-label="${escapeHTML(card.name)}"
      >
        <span class="deck-card-cost">${card.cost || 0}</span>
        <span class="deck-card-art">
          <img src="${escapeHTML(card.img)}" alt="">
        </span>
        <span class="deck-card-stats">${stats}</span>
        <span class="deck-card-info">
          <span class="deck-card-name">${escapeHTML(card.name)}</span>
          <span class="deck-card-type">${escapeHTML(card.faction || 'Neutral')} · ${escapeHTML(type)}</span>
          ${poolAbilityIconHTML(card)}
        </span>
        <span class="deck-card-copy">${previewCopyCount(list,key)}/${storage().MAX_COPIES}</span>
      </article>
    `;
  }

  function cardThumbHTML(card){
    const copies = countCopies(card.key);
    const atLimit = copies >= storage().MAX_COPIES;
    const deckFull = editingCards.length >= storage().DEFAULT_DECK_SIZE;
    const type = card.category === 'creature' ? card.creatureType : card.spellType;
    const stats = card.category === 'creature'
      ? `<span class="atk">⚔ ${card.atk || 0}</span><span class="counter">↩ ${card.counter || 0}</span><span class="hp">♥ ${card.hp || 0}</span>`
      : `<span>${escapeHTML((card.spellType || 'spell').toUpperCase())}</span>`;

    return `
      <button class="deck-card-pick ${escapeHTML(card.category)} ${atLimit || deckFull ? 'disabled' : ''}" type="button" data-card-key="${escapeHTML(card.key)}" draggable="${atLimit || deckFull ? 'false' : 'true'}" title="Klik untuk tambah, drag ke deck, klik kanan untuk detail">
        <span class="deck-card-cost">${card.cost || 0}</span>
        <span class="deck-card-art">
          <img src="${escapeHTML(card.img)}" alt="">
        </span>
        <span class="deck-card-stats">${stats}</span>
        <span class="deck-card-info">
          <span class="deck-card-name">${escapeHTML(card.name)}</span>
          <span class="deck-card-type">${escapeHTML(card.faction || 'Neutral')} · ${escapeHTML(type)}</span>
          ${poolAbilityIconHTML(card)}
        </span>
        <span class="deck-card-copy">${copies}/${storage().MAX_COPIES}</span>
      </button>
    `;
  }

  function deckCardLineHTML(key,index){
    const card = cardByKey(key);
    if(!card) return '';
    const type = card.category === 'creature' ? card.creatureType : card.spellType;
    const stats = card.category === 'creature'
      ? `<span class="deck-build-stat atk">⚔ ${card.atk || 0}</span><span class="deck-build-stat counter">↩ ${card.counter || 0}</span><span class="deck-build-stat hp">♥ ${card.hp || 0}</span>`
      : `<span class="deck-build-stat spell">✦ ${card.value || 0}</span>`;

    return `
      <button class="deck-build-card" type="button" data-card-index="${index}" data-card-key="${escapeHTML(key)}" draggable="true" title="Klik untuk hapus, drag untuk pindah/hapus, klik kanan untuk detail">
        <span class="deck-build-thumb ${card.category === 'spell' ? 'spell' : ''}" aria-hidden="true">
          <span class="deck-build-thumb-art">
            <img src="${escapeHTML(card.img)}" alt="" onerror="this.style.display='none'">
          </span>
          <span class="deck-build-thumb-cost">${card.cost || 0}</span>
          <span class="deck-build-thumb-name">${escapeHTML(card.name)}</span>
        </span>
        <span class="deck-build-info">
          <strong>${escapeHTML(card.name)}</strong>
          <small>${escapeHTML(type)}</small>
          ${abilityIconHTML(card)}
        </span>
        <span class="deck-build-stats">${stats}</span>
      </button>
    `;
  }

  function dragPayload(event,type,value,key=''){
    currentDrag = {
      type,
      value:String(value),
      key:String(key || value)
    };

    event.dataTransfer.effectAllowed = type === 'pool-card' ? 'copy' : 'move';
    event.dataTransfer.setData('text/plain',String(value));
    event.dataTransfer.setData('application/x-tcg-deck-drag-type',type);
    event.dataTransfer.setData('application/x-tcg-card-key',String(key || value));

    if(type === 'deck-index'){
      event.dataTransfer.setData('application/x-tcg-deck-index',String(value));
    }
  }

  function dragType(event){
    return currentDrag?.type ||
      event.dataTransfer.getData('application/x-tcg-deck-drag-type');
  }

  function clearDragState(){
    currentDrag = null;
    overlay
      ?.querySelectorAll('.dragging,.drag-over')
      .forEach(element=>element.classList.remove('dragging','drag-over'));
  }

  function buildOverlay(){
    const existing = $('deckBuilderOverlay');
    if(existing){
      overlay = existing;
      return;
    }

    overlay = document.createElement('section');
    overlay.id = 'deckBuilderOverlay';
    overlay.className = 'deck-builder-overlay';
    overlay.hidden = true;
    overlay.setAttribute('aria-labelledby','deckBuilderTitle');

    overlay.innerHTML = `
      <div class="deck-builder-shell">
        <header class="deck-builder-head">
          <div>
            <span class="deck-builder-kicker">Deck Builder</span>
            <h2 id="deckBuilderTitle">Decks</h2>
          </div>
          <button class="deck-builder-close" id="deckBuilderClose" type="button" aria-label="Close deck builder">×</button>
        </header>

        <div class="deck-builder-layout">
          <aside class="deck-list-panel">
            <button class="deck-new-btn" id="deckNewBtn" type="button">New Deck</button>
            <div class="deck-list" id="deckList"></div>
          </aside>

          <section class="deck-editor-panel">
            <div class="deck-editor-toolbar">
              <input id="deckNameInput" type="text" maxlength="32" aria-label="Deck name" />
              <div class="deck-smart-tools">
                <button id="deckSmartOpenBtn" type="button">Smart Pick...</button>
              </div>
              <div class="deck-editor-actions">
                <button id="deckSaveBtn" type="button">Save</button>
                <button id="deckDuplicateBtn" type="button">Duplicate</button>
                <button id="deckDeleteBtn" type="button">Delete</button>
              </div>
            </div>

            <div class="deck-builder-columns">
              <section class="deck-pool">
                <div class="deck-card-filters">
                  <input id="deckCardSearch" type="search" placeholder="Search cards..." autocomplete="off" />
                  <select id="deckCardType" aria-label="Filter card type">
                    <option value="all">All</option>
                    <option value="creature">Creature</option>
                    <option value="spell">Spell</option>
                  </select>
                  <select id="deckCardFaction" aria-label="Filter faction"></select>
                  <select id="deckCardSort" aria-label="Sort cards">
                    <option value="cost_asc">Energy Low</option>
                    <option value="cost_desc">Energy High</option>
                    <option value="attack_desc">Attack High</option>
                    <option value="hp_desc">HP High</option>
                    <option value="counter_desc">Counter High</option>
                    <option value="name_asc">Name A-Z</option>
                    <option value="type_asc">Type</option>
                    <option value="faction_asc">Faction</option>
                  </select>
                </div>
                <div class="deck-card-pool" id="deckCardPool"></div>
              </section>

              <section class="deck-current">
                <div class="deck-current-head">
                  <div>
                    <strong id="deckCurrentCount">0 / 30</strong>
                    <span id="deckCurrentStats">0 creature · 0 spell</span>
                  </div>
                  <button id="deckViewCardsBtn" type="button">View Cards</button>
                </div>
                <div class="deck-undo-notice" id="deckUndoNotice" hidden>
                  <span>Smart Pick applied.</span>
                  <button id="deckUndoSmartBtn" type="button">Undo</button>
                </div>
                <div class="deck-balance-panel">
                  <div class="deck-smart-vars" id="deckSmartVars"></div>
                  <p class="deck-avg-help" id="deckAvgHelp"></p>
                </div>
                <div class="deck-current-list" id="deckCurrentList"></div>
              </section>
            </div>
          </section>
        </div>
      </div>
      <div class="deck-smart-dialog" id="deckSmartDialog" hidden>
        <div class="deck-smart-dialog-card">
          <header>
            <div>
              <span>Smart Pick</span>
              <h3>Generate Deck Preview</h3>
            </div>
            <button id="deckSmartCloseBtn" type="button" aria-label="Close smart pick">×</button>
          </header>

          <div class="deck-smart-form">
            <label>
              <span>Style</span>
              <select id="deckSmartStyle">
                <option value="balanced" selected>Balanced</option>
                <option value="attack">Attack</option>
                <option value="defense">Defense</option>
                <option value="heal">Heal</option>
                <option value="effect">Effect</option>
                <option value="manual">Manual Mix</option>
              </select>
            </label>
            <label>
              <span>Faction</span>
              <select id="deckSmartFaction"></select>
            </label>
            <label>
              <span>Apply Mode</span>
              <select id="deckSmartMode">
                <option value="create" selected>Create New Deck</option>
                <option value="fill">Fill Empty Slots</option>
                <option value="replace">Replace Current Deck</option>
              </select>
            </label>
          </div>

          <p class="deck-smart-note" id="deckSmartDialogNote"></p>
          <div class="deck-smart-preview-stats" id="deckSmartPreviewStats"></div>
          <div class="deck-smart-preview-list" id="deckSmartPreviewList"></div>
          <p class="deck-smart-warning" id="deckSmartWarning" hidden>Mode replace akan menimpa susunan deck yang sedang kamu edit.</p>
          <label class="deck-smart-confirm" id="deckSmartConfirmWrap" hidden>
            <input id="deckSmartConfirmReplace" type="checkbox" />
            <span>Saya paham deck sekarang akan tertimpa.</span>
          </label>

          <footer>
            <button id="deckSmartGenerateBtn" type="button">Generate Preview</button>
            <button id="deckSmartRerollBtn" type="button">Reroll</button>
            <button id="deckSmartCancelBtn" type="button">Cancel</button>
            <button id="deckSmartApplyBtn" type="button">Create New Deck</button>
          </footer>
        </div>
      </div>
      <div class="deck-smart-dialog deck-view-dialog" id="deckViewDialog" hidden>
        <div class="deck-smart-dialog-card deck-view-dialog-card">
          <header>
            <div>
              <span>Current Deck</span>
              <h3>Deck Cards</h3>
            </div>
            <button class="deck-dialog-close" id="deckViewCloseBtn" type="button" aria-label="Close deck view">×</button>
          </header>

          <div class="deck-smart-preview-stats" id="deckViewStats"></div>
          <div class="deck-smart-preview-list deck-view-preview-list" id="deckViewList"></div>

          <footer>
            <button id="deckViewDoneBtn" type="button">Done</button>
          </footer>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    $('deckBuilderClose').addEventListener('click',closeDeckBuilder);
    overlay.addEventListener('click',event=>{
      if(event.target === overlay) closeDeckBuilder();
    });

    $('deckNewBtn').addEventListener('click',newDeck);
    $('deckSaveBtn').addEventListener('click',saveDeck);
    $('deckDuplicateBtn').addEventListener('click',duplicateDeck);
    $('deckDeleteBtn').addEventListener('click',deleteDeck);
    $('deckSmartOpenBtn').addEventListener('click',openSmartPickDialog);
    $('deckViewCardsBtn').addEventListener('click',openDeckViewDialog);
    $('deckViewCloseBtn').addEventListener('click',closeDeckViewDialog);
    $('deckViewDoneBtn').addEventListener('click',closeDeckViewDialog);
    $('deckUndoSmartBtn').addEventListener('click',undoSmartPick);
    $('deckSmartCloseBtn').addEventListener('click',closeSmartPickDialog);
    $('deckSmartCancelBtn').addEventListener('click',closeSmartPickDialog);
    $('deckSmartGenerateBtn').addEventListener('click',generateSmartPreview);
    $('deckSmartRerollBtn').addEventListener('click',generateSmartPreview);
    $('deckSmartApplyBtn').addEventListener('click',applySmartPick);
    $('deckSmartStyle').addEventListener('change',()=>{
      generateSmartPreview();
    });
    $('deckSmartFaction').addEventListener('change',generateSmartPreview);
    $('deckSmartMode').addEventListener('change',()=>{
      $('deckSmartConfirmReplace').checked = false;
      generateSmartPreview();
    });
    $('deckSmartConfirmReplace').addEventListener('change',renderSmartPreview);
    $('deckSmartDialog').addEventListener('click',event=>{
      if(event.target === $('deckSmartDialog')) closeSmartPickDialog();
    });
    $('deckViewDialog').addEventListener('click',event=>{
      if(event.target === $('deckViewDialog')) closeDeckViewDialog();
    });
    $('deckViewList').addEventListener('click',event=>{
      const card = event.target.closest('.deck-preview-inspectable[data-card-key]');
      if(!card) return;
      event.preventDefault();
      event.stopPropagation();
      window.TCGCardInspector?.open?.(card);
    });
    $('deckCardSearch').addEventListener('input',renderCardPool);
    $('deckCardType').addEventListener('change',renderCardPool);
    $('deckCardFaction').addEventListener('change',renderCardPool);
    $('deckCardSort').addEventListener('change',renderCardPool);
    populateFactions();

    $('deckList').addEventListener('click',event=>{
      const activeButton = event.target.closest('[data-deck-use-id]');
      if(activeButton){
        activateDeck(activeButton.dataset.deckUseId);
        return;
      }

      const selectButton = event.target.closest('[data-deck-select-id]');
      if(selectButton){
        selectDeck(selectButton.dataset.deckSelectId);
      }
    });

    $('deckCardPool').addEventListener('click',event=>{
      const item = event.target.closest('[data-card-key]');
      if(!item || item.classList.contains('disabled')) return;
      addCard(item.dataset.cardKey);
    });

    $('deckCardPool').addEventListener('dragstart',event=>{
      const item = event.target.closest('.deck-card-pick[data-card-key]');
      if(!item || item.classList.contains('disabled')){
        event.preventDefault();
        return;
      }

      item.classList.add('dragging');
      dragPayload(event,'pool-card',item.dataset.cardKey);
    });

    $('deckCardPool').addEventListener('dragover',event=>{
      if(dragType(event) !== 'deck-index') return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      $('deckCardPool').classList.add('drag-over');
    });

    $('deckCardPool').addEventListener('dragleave',event=>{
      if(!$('deckCardPool').contains(event.relatedTarget)){
        $('deckCardPool').classList.remove('drag-over');
      }
    });

    $('deckCardPool').addEventListener('drop',event=>{
      if(dragType(event) !== 'deck-index') return;
      event.preventDefault();
      const index = Number(
        currentDrag?.value ||
        event.dataTransfer.getData('application/x-tcg-deck-index')
      );
      removeCard(index);
      clearDragState();
    });

    $('deckCurrentList').addEventListener('click',event=>{
      const item = event.target.closest('[data-card-index]');
      if(!item) return;
      removeCard(Number(item.dataset.cardIndex));
    });

    $('deckCurrentList').addEventListener('dragstart',event=>{
      const item = event.target.closest('.deck-build-card[data-card-index]');
      if(!item){
        event.preventDefault();
        return;
      }

      item.classList.add('dragging');
      dragPayload(
        event,
        'deck-index',
        item.dataset.cardIndex,
        item.dataset.cardKey
      );
    });

    $('deckCurrentList').addEventListener('dragover',event=>{
      const type = dragType(event);
      if(type !== 'pool-card' && type !== 'deck-index') return;
      event.preventDefault();
      event.dataTransfer.dropEffect = type === 'pool-card' ? 'copy' : 'move';
      $('deckCurrentList').classList.add('drag-over');
    });

    $('deckCurrentList').addEventListener('dragleave',event=>{
      if(!$('deckCurrentList').contains(event.relatedTarget)){
        $('deckCurrentList').classList.remove('drag-over');
      }
    });

    $('deckCurrentList').addEventListener('drop',event=>{
      const type = dragType(event);
      if(type !== 'pool-card' && type !== 'deck-index') return;

      event.preventDefault();

      if(type === 'pool-card'){
        addCard(
          currentDrag?.key ||
          event.dataTransfer.getData('application/x-tcg-card-key')
        );
      }else{
        const fromIndex = Number(
          currentDrag?.value ||
          event.dataTransfer.getData('application/x-tcg-deck-index')
        );
        const target = event.target.closest('.deck-build-card[data-card-index]');
        const toIndex = target
          ? Number(target.dataset.cardIndex)
          : editingCards.length - 1;
        moveCard(fromIndex,toIndex);
      }

      clearDragState();
    });

    overlay.addEventListener('dragend',clearDragState);
  }

  function renderDeckList(){
    $('deckList').innerHTML = storage()
      .allDecks()
      .map(deckRowHTML)
      .join('');
  }

  function renderCardPool(){
    $('deckCardPool').innerHTML = sortedCards()
      .map(cardThumbHTML)
      .join('');
  }

  function renderCurrentDeck(){
    const stats = storage().deckStats({cards:editingCards});
    $('deckCurrentCount').textContent =
      `${stats.size} / ${storage().DEFAULT_DECK_SIZE}`;
    $('deckCurrentStats').textContent =
      `${stats.creatures} creature · ${stats.spells} spell · avg ${stats.avgCost}`;
    $('deckCurrentStats').title =
      'Avg adalah rata-rata energy cost kartu di deck.';

    const profile = deckProfile();
    $('deckSmartVars').innerHTML = `
      <span>Current</span>
      <span>${profile.creatures} creature</span>
      <span>${profile.spells} spell</span>
      <span>${profile.low} low</span>
      <span>${profile.mid} mid</span>
      <span>${profile.high} high</span>
      <span>avg ${profile.cards.length ? profile.avg.toFixed(1) : '0.0'}</span>
    `;
    $('deckAvgHelp').innerHTML =
      deckConclusion();

    $('deckCurrentList').innerHTML = editingCards
      .map(deckCardLineHTML)
      .join('');
  }

  function renderEditor(){
    if(!editingDeck){
      selectDeck(storage().activeDeckId());
      return;
    }

    $('deckNameInput').value = editingDeck.name;
    $('deckNameInput').disabled = !!editingDeck.locked;
    $('deckSaveBtn').disabled = !!editingDeck.locked;
    $('deckDeleteBtn').disabled = !!editingDeck.locked;
    updateSmartControls();

    populateFactions();
    renderDeckList();
    renderCardPool();
    renderCurrentDeck();
  }

  function selectDeck(id){
    const deck = storage().allDecks().find(item=>item.id === id) ||
      storage().activeDeck();

    smartPreviousCards = null;
    hideUndoNotice();
    selectedDeckId = deck.id;
    editingDeck = {
      ...deck,
      cards:[...deck.cards]
    };
    editingCards = [...deck.cards];

    renderEditor();
  }

  function newDeck(){
    smartPreviousCards = null;
    hideUndoNotice();
    selectedDeckId = `deck_${Date.now()}`;
    editingDeck = {
      id:selectedDeckId,
      name:'Custom Deck',
      cards:[],
      locked:false
    };
    editingCards = [];
    renderEditor();
    $('deckNameInput')?.focus({preventScroll:true});
  }

  function addCard(key){
    if(!cardByKey(key)) return false;
    if(editingCards.length >= storage().DEFAULT_DECK_SIZE) return false;
    if(countCopies(key) >= storage().MAX_COPIES) return false;

    editingCards.push(key);
    renderCardPool();
    renderCurrentDeck();
    window.TCGSFX?.play?.('ui_click');
    return true;
  }

  function removeCard(index){
    if(index < 0 || index >= editingCards.length) return false;
    editingCards.splice(index,1);
    renderCardPool();
    renderCurrentDeck();
    window.TCGSFX?.play?.('ui_close');
    return true;
  }

  function moveCard(fromIndex,toIndex){
    if(fromIndex < 0 || fromIndex >= editingCards.length) return false;
    if(toIndex < 0 || toIndex >= editingCards.length) return false;
    if(fromIndex === toIndex) return false;

    const [card] = editingCards.splice(fromIndex,1);
    editingCards.splice(toIndex,0,card);
    renderCurrentDeck();
    window.TCGSFX?.play?.('ui_click');
    return true;
  }

  function saveDeck(){
    if(!editingDeck || editingDeck.locked) return;

    const saved = storage().saveDeck({
      ...editingDeck,
      name:$('deckNameInput').value,
      cards:editingCards
    });

    selectedDeckId = saved.id;
    editingDeck = saved;
    editingCards = [...saved.cards];
    renderEditor();
    window.game?.updateMainMenuDeckLabel?.();
    window.TCGSFX?.play?.('ui_click');
  }

  function activateDeck(id){
    const targetId = id || selectedDeckId;
    if(!targetId) return;

    if(editingDeck && selectedDeckId === targetId && !editingDeck.locked){
      saveDeck();
      return;
    }

    storage().setActiveDeck(targetId);
    renderDeckList();
    window.game?.updateMainMenuDeckLabel?.();
    window.TCGSFX?.play?.('ui_click');
  }

  function duplicateDeck(){
    if(!editingDeck) return;
    const copy = storage().duplicateDeck(selectedDeckId);
    selectDeck(copy.id);
    window.TCGSFX?.play?.('ui_click');
  }

  function deleteDeck(){
    if(!editingDeck || editingDeck.locked) return;

    storage().deleteDeck(selectedDeckId);
    selectDeck(storage().activeDeckId());
    window.game?.updateMainMenuDeckLabel?.();
    window.TCGSFX?.play?.('ui_close');
  }

  function openDeckBuilder(){
    if(!storage()){
      alert('Deck storage belum siap. Pastikan js/systems/deck-storage.js sudah dipasang sebelum deck-builder.js.');
      return;
    }

    if(!overlay) buildOverlay();

    selectedDeckId = storage().activeDeckId();
    selectDeck(selectedDeckId);
    overlay.hidden = false;
    document.body.classList.add('deck-builder-open');
    window.TCGSFX?.play?.('collection_open');

    requestAnimationFrame(()=>{
      overlay.classList.add('open');
    });
  }

  function closeDeckBuilder(){
    if(!overlay || overlay.hidden) return;

    overlay.classList.remove('open');
    overlay.hidden = true;
    document.body.classList.remove('deck-builder-open');
    window.TCGSFX?.play?.('collection_close');
  }

  window.TCGDeckBuilder = {
    open:openDeckBuilder,
    close:closeDeckBuilder
  };

  if(document.readyState === 'loading'){
    window.addEventListener('DOMContentLoaded',()=>{
      buildOverlay();
    });
  }else{
    buildOverlay();
  }
})();
