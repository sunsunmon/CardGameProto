(function(){
  'use strict';

  const STORAGE_KEY = 'tcg2.decks.v1';
  const ACTIVE_KEY = 'tcg2.activeDeckId.v1';
  const DEFAULT_DECK_SIZE = 30;
  const MAX_COPIES = 2;
  let memoryDecks = [];
  let memoryActiveDeckId = 'starter';

  function cardDefs(){
    return window.CARD_DEFS || [];
  }

  function cardByKey(key){
    return cardDefs().find(card=>card.key === key) || null;
  }

  function shuffle(list){
    for(let i=list.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [list[i],list[j]] = [list[j],list[i]];
    }
    return list;
  }

  function starterKeys(){
    const curated = [
      'squire_of_dawn',
      'footman',
      'cave_rat',
      'forest_scout',
      'spear_guard',
      'wolf_rider',
      'huntress',
      'frost_adept',
      'bone_guard',
      'knight',
      'storm_caller',
      'night_stalker',
      'barkhide_bear',
      'royal_cavalier',
      'dread_knight',
      'thunder_roc',
      'royal_champion',
      'ancient_treant',
      'fortress_golem',
      'arcane_dragon',
      'dispel',
      'fire_bolt',
      'fire_bolt',
      'battle_cry',
      'blessing',
      'healing_light',
      'renewal',
      'counter_formation',
      'rain',
      'war_drums'
    ];

    const keys = curated.filter(key=>cardByKey(key));

    for(const card of cardDefs()){
      if(keys.length >= DEFAULT_DECK_SIZE) break;
      keys.push(card.key);
    }

    return keys.slice(0,DEFAULT_DECK_SIZE);
  }

  function starterDeck(){
    return {
      id:'starter',
      name:'Starter Deck',
      cards:starterKeys(),
      locked:true
    };
  }

  function readStorage(key,fallback=''){
    try{
      return localStorage.getItem(key) ?? fallback;
    }catch(error){
      return fallback;
    }
  }

  function writeStorage(key,value){
    try{
      localStorage.setItem(key,value);
      return true;
    }catch(error){
      return false;
    }
  }

  function normalizeDeck(deck){
    const cards = Array.isArray(deck?.cards)
      ? deck.cards.filter(key=>cardByKey(key))
      : [];

    return {
      id:String(deck?.id || `deck_${Date.now()}`),
      name:String(deck?.name || 'Custom Deck').trim() || 'Custom Deck',
      cards:cards.slice(0,DEFAULT_DECK_SIZE),
      locked:!!deck?.locked
    };
  }

  function readCustomDecks(){
    try{
      const parsed = JSON.parse(readStorage(STORAGE_KEY,JSON.stringify(memoryDecks)));
      return Array.isArray(parsed)
        ? parsed.map(normalizeDeck).filter(deck=>deck.id !== 'starter')
        : [];
    }catch(error){
      return memoryDecks;
    }
  }

  function writeCustomDecks(decks){
    const cleanDecks = decks
      .map(normalizeDeck)
      .filter(deck=>deck.id !== 'starter');

    memoryDecks = cleanDecks;
    writeStorage(STORAGE_KEY,JSON.stringify(cleanDecks));
  }

  function allDecks(){
    return [starterDeck(),...readCustomDecks()];
  }

  function activeDeckId(){
    const id = readStorage(ACTIVE_KEY,memoryActiveDeckId);
    return allDecks().some(deck=>deck.id === id) ? id : 'starter';
  }

  function setActiveDeck(id){
    const deck = allDecks().find(item=>item.id === id) || starterDeck();
    memoryActiveDeckId = deck.id;
    writeStorage(ACTIVE_KEY,deck.id);
    return deck;
  }

  function activeDeck(){
    return allDecks().find(deck=>deck.id === activeDeckId()) || starterDeck();
  }

  function saveDeck(deck){
    const cleanDeck = normalizeDeck(deck);
    cleanDeck.locked = false;

    const decks = readCustomDecks();
    const index = decks.findIndex(item=>item.id === cleanDeck.id);

    if(index >= 0){
      decks[index] = cleanDeck;
    }else{
      decks.push(cleanDeck);
    }

    writeCustomDecks(decks);
    setActiveDeck(cleanDeck.id);
    return cleanDeck;
  }

  function duplicateDeck(id){
    const source = allDecks().find(deck=>deck.id === id) || starterDeck();
    return saveDeck({
      id:`deck_${Date.now()}`,
      name:`${source.name} Copy`,
      cards:[...source.cards]
    });
  }

  function deleteDeck(id){
    if(id === 'starter') return false;

    const decks = readCustomDecks().filter(deck=>deck.id !== id);
    writeCustomDecks(decks);

    if(activeDeckId() === id){
      setActiveDeck('starter');
    }

    return true;
  }

  function deckStats(deck){
    const cards = deck?.cards || [];
    let creatures = 0;
    let spells = 0;
    let totalCost = 0;

    for(const key of cards){
      const card = cardByKey(key);
      if(!card) continue;
      if(card.category === 'creature') creatures += 1;
      if(card.category === 'spell') spells += 1;
      totalCost += card.cost || 0;
    }

    return {
      size:cards.length,
      creatures,
      spells,
      avgCost:cards.length ? (totalCost / cards.length).toFixed(1) : '0.0'
    };
  }

  function isDeckPlayable(deck){
    return (deck?.cards || []).filter(key=>cardByKey(key)).length > 0;
  }

  function createDeckFromSaved(owner,deck=activeDeck()){
    const validKeys = (deck?.cards || []).filter(key=>cardByKey(key));

    if(!validKeys.length){
      return window.createDeck(owner);
    }

    return shuffle(
      validKeys.map(key=>window.createCardInstance(cardByKey(key),owner))
    );
  }

  window.TCGDeckStorage = {
    DEFAULT_DECK_SIZE,
    MAX_COPIES,
    allDecks,
    activeDeck,
    activeDeckId,
    setActiveDeck,
    saveDeck,
    duplicateDeck,
    deleteDeck,
    deckStats,
    isDeckPlayable,
    createDeckFromSaved
  };
})();
