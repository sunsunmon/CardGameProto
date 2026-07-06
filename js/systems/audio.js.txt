(function(){
  'use strict';

  const SOUND_DIR = 'assets/sounds/';

  const SOUND_KEYS = [
    'ui_click',
    'ui_close',
    'invalid',
    'new_game',
    'collection_open',
    'collection_close',
    'detail_open',
    'detail_close',
    'discard_open',
    'discard_close',
    'phase_player',
    'phase_enemy',
    'turn_end',
    'timer_low',
    'draw',
    'play_card',
    'play_spell',
    'spell_cast',
    'fire',
    'buff',
    'heal',
    'attack_start',
    'impact',
    'damage',
    'hand_damage',
    'shield',
    'counter',
    'death',
    'trap_reveal',
    'poison',
    'rebirth',
    'lifesteal',
    'victory',
    'defeat',
    'draw_result',
    'bgm',
    'bgm_intense'
  ];

  function defaultSourceCandidates(key){
    const sources = [`${SOUND_DIR}${key}.mp3`];
    if(key.includes('_')){
      sources.push(`${SOUND_DIR}${key.replaceAll('_',' ')}.mp3`);
    }
    return sources;
  }

  const sources = SOUND_KEYS.reduce((map,key)=>{
    map[key] = defaultSourceCandidates(key);
    return map;
  },{});

  const state = {
    enabled: true,
    volume: .75,
    sources,
    cache: new Map(),
    failedSources: new Set(),
    musicEnabled: true,
    musicVolume: .35,
    musicAudio: null,
    musicKey: null,
    musicFadeTimers: new Set(),
    unlocked: false
  };

  function keyName(name){
    return String(name || '').trim();
  }

  function has(name){
    return Object.prototype.hasOwnProperty.call(state.sources,keyName(name));
  }

  function clampVolume(value){
    const number = Number(value);
    if(!Number.isFinite(number)) return state.volume;
    return Math.max(0,Math.min(1,number));
  }

  function sourceList(value){
    if(!value) return [];
    return Array.isArray(value) ? value.filter(Boolean) : [value];
  }

  function cacheKey(key,src){
    return `${key}\n${src}`;
  }

  function audioFor(key,src){
    if(!src || typeof Audio === 'undefined') return null;
    if(state.failedSources.has(cacheKey(key,src))) return null;

    const id = cacheKey(key,src);
    let audio = state.cache.get(id);
    if(!audio){
      audio = new Audio(src);
      audio.preload = 'auto';
      audio.volume = state.volume;
      state.cache.set(id,audio);
    }
    return audio;
  }

  function clearSourceCache(key){
    for(const id of state.cache.keys()){
      if(id.startsWith(`${key}\n`)) state.cache.delete(id);
    }

    for(const id of state.failedSources){
      if(id.startsWith(`${key}\n`)) state.failedSources.delete(id);
    }
  }

  function playCandidate(key,list,index,options){
    const src = list[index];
    const audio = audioFor(key,src);

    if(!audio){
      return index + 1 < list.length
        ? playCandidate(key,list,index + 1,options)
        : false;
    }

    try{
      const instance = audio.cloneNode(true);
      instance.volume = typeof options.volume === 'number'
        ? clampVolume(options.volume)
        : state.volume;

      instance.addEventListener('error',()=>{
        state.failedSources.add(cacheKey(key,src));
        state.cache.delete(cacheKey(key,src));

        if(index + 1 < list.length){
          playCandidate(key,list,index + 1,options);
        }
      },{once:true});

      const promise = instance.play();
      if(promise && typeof promise.catch === 'function'){
        promise.catch(()=>{});
      }
      return true;
    }catch(error){
      state.failedSources.add(cacheKey(key,src));
      state.cache.delete(cacheKey(key,src));
      return index + 1 < list.length
        ? playCandidate(key,list,index + 1,options)
        : false;
    }
  }

  function play(name,options={}){
    const key = keyName(name);
    if(!state.enabled || !has(key)) return false;

    const list = sourceList(state.sources[key]);
    if(!list.length) return false;

    return playCandidate(key,list,0,options);
  }

  function setSource(name,src){
    const key = keyName(name);
    if(!key) return;

    state.sources[key] = src || null;
    clearSourceCache(key);
  }

  function setSources(map){
    Object.entries(map || {}).forEach(([name,src])=>setSource(name,src));
  }

  function setVolume(value){
    state.volume = clampVolume(value);
    state.cache.forEach(audio=>{
      audio.volume = state.volume;
    });
  }

  function setMusicVolume(value){
    state.musicVolume = clampVolume(value);
    if(state.musicAudio) state.musicAudio.volume = state.musicVolume;
  }

  function setEnabled(value){
    state.enabled = !!value;
    if(!state.enabled) pauseMusic();
  }

  function setMusicEnabled(value){
    state.musicEnabled = !!value;
    if(!state.musicEnabled) pauseMusic();
    else if(state.unlocked && typeof window.game?.updateBattleMusic === 'function'){
      window.game.updateBattleMusic();
    }else if(state.unlocked){
      startMusic();
    }
  }

  function clearMusicFades(){
    state.musicFadeTimers.forEach(id=>clearInterval(id));
    state.musicFadeTimers.clear();
  }

  function fadeAudio(audio,from,to,duration,after){
    if(!audio) return;

    if(!duration || duration <= 0){
      audio.volume = to;
      after?.();
      return;
    }

    const startedAt = Date.now();
    audio.volume = from;

    const id = setInterval(()=>{
      const progress = Math.min(1,(Date.now() - startedAt) / duration);
      audio.volume = from + (to - from) * progress;

      if(progress >= 1){
        clearInterval(id);
        state.musicFadeTimers.delete(id);
        after?.();
      }
    },50);

    state.musicFadeTimers.add(id);
  }

  function stopMusic(){
    clearMusicFades();
    if(!state.musicAudio) return;

    try{
      state.musicAudio.pause();
      state.musicAudio.currentTime = 0;
    }catch(error){}

    state.musicAudio = null;
    state.musicKey = null;
  }

  function pauseMusic(){
    if(!state.musicAudio) return;

    try{
      state.musicAudio.pause();
    }catch(error){}
  }

  function startMusicCandidate(key,list,index,options){
    const src = list[index];
    const id = cacheKey(key,src);

    if(state.failedSources.has(id)){
      return index + 1 < list.length
        ? startMusicCandidate(key,list,index + 1,options)
        : false;
    }

    if(!src || typeof Audio === 'undefined') return false;

    try{
      const audio = new Audio(src);
      audio.loop = options.loop !== false;
      audio.preload = 'auto';
      const targetVolume = typeof options.volume === 'number'
        ? clampVolume(options.volume)
        : state.musicVolume;
      const fadeDuration = Math.max(0,Number(options.fadeDuration) || 0);
      const previousAudio = state.musicAudio;
      const previousKey = state.musicKey;
      const shouldCrossfade =
        fadeDuration > 0 &&
        previousAudio &&
        previousKey &&
        previousKey !== key;

      audio.volume = shouldCrossfade ? 0 : targetVolume;

      audio.addEventListener('error',()=>{
        if(state.musicAudio === audio){
          state.musicAudio = null;
          state.musicKey = null;
        }

        state.failedSources.add(id);

        if(index + 1 < list.length){
          startMusicCandidate(key,list,index + 1,options);
        }
      },{once:true});

      if(!shouldCrossfade) stopMusic();
      state.musicAudio = audio;
      state.musicKey = key;

      const promise = audio.play();
      if(promise && typeof promise.catch === 'function'){
        promise.catch(error=>{
          if(error?.name !== 'NotAllowedError'){
            state.failedSources.add(id);
          }
        });
      }

      if(shouldCrossfade){
        clearMusicFades();
        fadeAudio(audio,0,targetVolume,fadeDuration);
        fadeAudio(previousAudio,previousAudio.volume,0,fadeDuration,()=>{
          try{
            previousAudio.pause();
            previousAudio.currentTime = 0;
          }catch(error){}
        });
      }

      return true;
    }catch(error){
      state.failedSources.add(id);
      return index + 1 < list.length
        ? startMusicCandidate(key,list,index + 1,options)
        : false;
    }
  }

  function startMusic(name='bgm',options={}){
    const key = keyName(name);
    if(!state.enabled || !state.musicEnabled || !has(key)) return false;

    if(
      state.musicAudio &&
      state.musicKey === key &&
      !state.musicAudio.paused
    ){
      return true;
    }

    const list = sourceList(state.sources[key]);
    if(!list.length) return false;

    return startMusicCandidate(key,list,0,options);
  }

  function fadeToMusic(name='bgm',duration=1600){
    return startMusic(name,{fadeDuration:duration});
  }

  function unlock(){
    if(state.unlocked) return;
    state.unlocked = true;
    if(typeof window.game?.updateBattleMusic === 'function'){
      window.game.updateBattleMusic();
    }else{
      startMusic();
    }
  }

  window.TCGSFX = {
    keys: SOUND_KEYS.slice(),
    state,
    has,
    play,
    startMusic,
    fadeToMusic,
    pauseMusic,
    stopMusic,
    setSource,
    setSources,
    setVolume,
    setMusicVolume,
    setEnabled,
    setMusicEnabled,
    unlock
  };

  window.addEventListener('pointerdown',unlock,{once:true,capture:true});
  window.addEventListener('keydown',unlock,{once:true,capture:true});
})();
