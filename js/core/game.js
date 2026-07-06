(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const key=(row,lane)=>`${row}_${lane}`;
  const escapeHTML=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const escapeRegExp=value=>String(value??'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const creatureRows=['enemyBack','enemyFront','playerFront','playerBack'];
  const sideSpellRows=['enemySpellBack','enemySpellFront','playerSpellFront','playerSpellBack'];
  const allRows=[...creatureRows,...sideSpellRows,'sharedSpell'];
  const sleep=window.TCGFX.sleep;

  const Game={
    state:null,
    drag:null,
    locked:false,
    transitioning:false,
    timerId:null,
    collectionActiveTags:new Set(),
    tutorial:null,

    makeState(){
      return {
        phase:'player',turn:1,playerHp:25,enemyHp:25,
        playerMaxEnergy:1,enemyMaxEnergy:1,playerEnergy:1,enemyEnergy:1,
        playerDeck:[],enemyDeck:[],playerHand:[],enemyHand:[],playerDiscard:[],enemyDiscard:[],
        board:{},selectedHand:null,mode:null,timeMax:60,time:60,timerLowSfxPlayed:false,bgmMode:null,placedSequence:1,enemyOpeningTurn:true,campaign:null,initiative:null,playerOpeningResponseTurn:false,playerOpeningEnergyBonus:0,playerSkipOpeningDraw:false,enemySkipOpeningDraw:false
      };
    },

    init(){
      this.bindGlobalEvents();
      this.prepareMenuState();
      window.game=this;
      this.openMainMenu();
    },

    bindGlobalEvents(){
      const utilityPanel=$('utilityPanel');
      const panelOpen=$('panelOpen');
      const hideUtility=()=>{
        document.body.classList.add('utility-collapsed');
      };
      const showUtility=()=>{
        document.body.classList.remove('utility-collapsed');
      };

      document.body.classList.add('utility-collapsed');
      $('endBtn').addEventListener('click',()=>this.endTurn());
      panelOpen.addEventListener('click',showUtility);
      $('surrenderBtn')?.addEventListener('click',()=>{
        window.TCGSFX?.play?.('ui_close');
        hideUtility();
        this.surrenderMatch();
      });
      $('quitTutorialBtn')?.addEventListener('click',()=>{
        window.TCGSFX?.play?.('ui_close');
        hideUtility();
        this.quitTutorialToMenu();
      });

      $('mainMenuPlay')?.addEventListener('click',()=>{
        window.TCGSFX?.play?.('ui_click');
        this.openVersusOverlay();
      });

      $('mainMenuDecks')?.addEventListener('click',()=>this.openDeckBuilderFromMenu());

      $('mainMenuCollection')?.addEventListener('click',()=>{
        window.TCGSFX?.play?.('ui_click');
        this.openCollectionOverlay();
      });

      $('mainMenuGuide')?.addEventListener('click',()=>{
        window.TCGSFX?.play?.('ui_click');
        this.openGuideOverlay();
      });

      $('mainMenuTutorial')?.addEventListener('click',()=>{
        window.TCGSFX?.play?.('ui_click');
        this.closeMainMenu(false);
        this.startTutorial();
      });

      $('mainMenuAbout')?.addEventListener('click',()=>{
        window.TCGSFX?.play?.('ui_click');
        this.openAboutOverlay();
      });

      $('aboutBackBtn')?.addEventListener('click',()=>this.closeAboutOverlay());

      $('hand').addEventListener('click',e=>{
        const cardEl=e.target.closest('.hand-card');
        if(!cardEl||this.drag?.moved) return;
        this.selectHandCard(cardEl.dataset.cardId);
      });
      $('hand').addEventListener('pointerdown',e=>{
        const cardEl=e.target.closest('.hand-card');
        if(cardEl) this.startDrag(e,cardEl);
      });
      $('hand').addEventListener('mouseover',e=>{
        if(this.drag||this.state.selectedHand)return;
        const cardEl=e.target.closest('.hand-card');
        if(!cardEl||cardEl.contains(e.relatedTarget))return;
        const card=this.getCardInHand('player',cardEl.dataset.cardId);
        if(card)this.highlightDrops(card);
      });
      $('hand').addEventListener('mouseout',e=>{
        if(this.drag||this.state.selectedHand)return;
        const cardEl=e.target.closest('.hand-card');
        if(!cardEl||cardEl.contains(e.relatedTarget))return;
        document.querySelectorAll('.drop-valid').forEach(x=>x.classList.remove('drop-valid'));
      });

      document.querySelector('.board').addEventListener('click',e=>this.handleBoardClick(e));
      document.querySelector('.board').addEventListener('pointerdown',e=>{
        const cardEl=e.target.closest('.card');
        if(cardEl&&cardEl.dataset.owner==='player') this.startBoardDrag(e,cardEl);
      });
      $('enemyHero').addEventListener('click',e=>{e.stopPropagation();this.handleHeroClick('enemy')});
      $('playerHero').addEventListener('click',e=>{e.stopPropagation();this.handleHeroClick('player')});

      document.addEventListener('pointermove',e=>this.handlePointerMove(e));
      document.addEventListener('dragstart',e=>{
        if(e.target.closest?.('.card,.hand-card')){
          e.preventDefault();
        }
      },true);
      document.addEventListener('mouseover',e=>this.handleTargetHover(e,true));
      document.addEventListener('mouseout',e=>this.handleTargetHover(e,false));
      document.addEventListener('click',e=>{
        if(!this.state?.mode||this.locked) return;
        if(e.target.closest('.valid-target,.can-attack,.hand-card,.slot.drop-valid')) return;
        if(!e.target.closest('.board,.hero,.hand-panel')) this.cancelMode();
      });
      document.addEventListener('pointerdown',e=>this.handleTutorialGate(e),true);
      document.addEventListener('click',e=>this.handleTutorialGate(e),true);
      document.addEventListener('contextmenu',e=>{
        if(!this.tutorial?.active)return;
        if(e.target.closest?.('.card-inspector'))return;
        if(this.tutorialAllowsInspect(e.target))return;
        e.preventDefault();
        e.stopImmediatePropagation();
        this.tutorialMessage('Klik kanan hanya kartu yang sedang disorot untuk membuka detail viewer.');
      },true);
      document.addEventListener('tcg:card-inspector-open',e=>this.tutorialAfterInspect(e.detail));
      document.addEventListener('keydown',e=>{if(e.key==='Escape')this.cancelMode()});
      document.addEventListener('keydown',e=>{if(e.key==='Escape'){this.closeCollectionOverlay();this.closeGuideOverlay();this.closeCampaignOverlay();this.closeVersusOverlay();this.closeAboutOverlay()}});
      document.addEventListener('contextmenu',e=>{if(this.state?.mode){e.preventDefault();this.cancelMode()}});
      window.addEventListener('resize',()=>{if(this.tutorial?.active)this.updateTutorialUI()});
      window.addEventListener('blur',()=>this.cleanDrag());
    },

    ensureStylesheet(href){
      if(document.querySelector(`link[href="${href}"]`)) return;

      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href=href;
      document.head.appendChild(link);
    },

    loadScriptOnce(src){
      return new Promise((resolve,reject)=>{
        const existing=document.querySelector(`script[src="${src}"]`);
        if(existing?.dataset.loaded==='true'){
          resolve();
          return;
        }

        if(existing && document.readyState==='loading'){
          existing.addEventListener('load',resolve,{once:true});
          existing.addEventListener('error',()=>reject(new Error(`Gagal load ${src}`)),{once:true});
          return;
        }

        const script=document.createElement('script');
        script.src=src;
        script.defer=false;
        script.dataset.loaded='false';
        script.addEventListener('load',()=>{
          script.dataset.loaded='true';
          resolve();
        },{once:true});
        script.addEventListener('error',()=>reject(new Error(`Gagal load ${src}`)),{once:true});
        document.body.appendChild(script);
      });
    },

    async ensureDeckBuilderReady(){
      this.ensureStylesheet('css/deck-builder.css');

      if(!window.TCGDeckStorage){
        await this.loadScriptOnce('js/systems/deck-storage.js');
      }

      if(!window.TCGDeckBuilder?.open){
        await this.loadScriptOnce('js/ui/deck-builder.js');
      }

      if(!window.TCGDeckStorage || !window.TCGDeckBuilder?.open){
        throw new Error('Deck Builder module belum siap.');
      }
    },

    async openDeckBuilderFromMenu(){
      window.TCGSFX?.play?.('ui_click');

      try{
        await this.ensureDeckBuilderReady();
        window.TCGDeckBuilder.open();
      }catch(error){
        console.error(error);
        alert('Deck Builder belum bisa dibuka. Pastikan deck-storage.js ada di js/systems dan deck-builder.js ada di js/ui.');
      }
    },

    campaignProgressKey(){
      return 'tcg2.campaignProgress.v1';
    },

    campaignProgress(){
      try{
        const parsed=JSON.parse(localStorage.getItem(this.campaignProgressKey())||'{}');
        return {
          highestCleared:Number(parsed.highestCleared||0)
        };
      }catch(error){
        return {highestCleared:0};
      }
    },

    saveCampaignProgress(progress){
      try{
        localStorage.setItem(this.campaignProgressKey(),JSON.stringify(progress));
      }catch(error){}
    },

    isCampaignStageUnlocked(stage){
      return stage.number<=this.campaignProgress().highestCleared+1;
    },

    completeCampaignStage(stage){
      if(!stage)return;

      const progress=this.campaignProgress();
      if(stage.number>progress.highestCleared){
        progress.highestCleared=stage.number;
        this.saveCampaignProgress(progress);
      }
    },

    ensureVersusOverlay(){
      let overlay=$('versusOverlay');
      if(overlay)return overlay;

      overlay=document.createElement('section');
      overlay.id='versusOverlay';
      overlay.className='collection-overlay versus-overlay';
      overlay.hidden=true;
      overlay.setAttribute('role','dialog');
      overlay.setAttribute('aria-modal','true');
      overlay.setAttribute('aria-labelledby','versusTitle');
      overlay.innerHTML=`
        <div class="collection-shell versus-shell">
          <header class="collection-head versus-head">
            <button class="menu-back-btn" id="versusBackBtn" type="button" aria-label="Back to main menu">Back</button>
            <div>
              <span class="collection-kicker">Battle Mode</span>
              <h1 id="versusTitle">Versus AI</h1>
            </div>
          </header>

          <div class="versus-mode-list">
            <button class="versus-mode-card versus-quick" id="versusQuickBtn" type="button">
              <span>Quick Match</span>
              <strong>Duel bebas melawan deck AI standar.</strong>
            </button>
            <button class="versus-mode-card versus-campaign" id="versusCampaignBtn" type="button">
              <span>Campaign</span>
              <strong>Stage bertahap untuk latihan melawan archetype AI berbeda.</strong>
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      $('versusBackBtn').addEventListener('click',()=>this.closeVersusOverlay());
      $('versusQuickBtn').addEventListener('click',()=>{
        window.TCGSFX?.play?.('ui_click');
        this.closeVersusOverlay(false);
        this.closeMainMenu(false);
        this.newGame();
      });
      $('versusCampaignBtn').addEventListener('click',()=>{
        window.TCGSFX?.play?.('ui_click');
        this.closeVersusOverlay(false);
        this.openCampaignOverlay();
      });
      return overlay;
    },

    openVersusOverlay(){
      const overlay=this.ensureVersusOverlay();
      this.closeCollectionOverlay();
      this.closeGuideOverlay();
      this.closeCampaignOverlay(false);
      overlay.hidden=false;
      document.body.classList.add('collection-open');
      requestAnimationFrame(()=>overlay.classList.add('open'));
    },

    closeVersusOverlay(playSound=true){
      const overlay=$('versusOverlay');
      if(!overlay)return;
      if(overlay.hidden&&!overlay.classList.contains('open'))return;

      if(playSound)window.TCGSFX?.play?.('ui_close');
      overlay.classList.remove('open');
      overlay.hidden=true;
      if(
        !$('collectionOverlay')?.classList.contains('open') &&
        !$('guideOverlay')?.classList.contains('open') &&
        !$('campaignOverlay')?.classList.contains('open')
      ){
        document.body.classList.remove('collection-open');
      }
    },

    campaignStages(){
      return [
        {
          id:'rat-rush',
          number:1,
          name:'Rat Rush',
          difficulty:'Easy',
          enemyHp:18,
          aiPlaysBonus:-1,
          lesson:'Latihan menjaga lane awal dari creature murah dan Quick.',
          weakness:'Lemah terhadap blocker Front Row dan spell damage row.',
          deck:[
            'cave_rat','cave_rat','footman','footman','forest_scout','forest_scout',
            'thornling','thornling','squire_of_dawn','seedling','wolf_rider','wolf_rider',
            'razor_boar','spear_guard','huntress','huntress','venom_lizard','battle_cry',
            'battle_cry','fire_bolt','fire_bolt','siege_order','trap_rune','trap_rune',
            'war_drums','war_drums','healing_light','dispel','barkhide_bear','sabertooth'
          ]
        },
        {
          id:'iron-wall',
          number:2,
          name:'Iron Wall',
          difficulty:'Normal',
          enemyHp:23,
          aiPlaysBonus:0,
          lesson:'Latihan melawan Shield, Counter, dan board yang sulit ditembus.',
          weakness:'Lemah terhadap Pierce, debuff Attack, dan Dispel ke spell pertahanan.',
          deck:[
            'shield_bearer','shield_bearer','spear_guard','spear_guard','bone_guard','bone_guard',
            'thorn_defender','thorn_defender','barkhide_bear','barkhide_bear','knight','knight',
            'iron_sentinel','iron_sentinel','fortress_golem','royal_cavalier','royal_champion',
            'stone_skin','stone_skin','counter_formation','counter_formation','mirror_barrier',
            'mirror_barrier','blessing','blessing','healing_light','renewal','sacred_ground',
            'dispel','ancient_treant'
          ]
        },
        {
          id:'back-row-hunt',
          number:3,
          name:'Back Row Hunt',
          difficulty:'Normal+',
          enemyHp:25,
          aiPlaysBonus:0,
          lesson:'Latihan menekan Back Row, ranged, flyer, dan shared column buff.',
          weakness:'Lemah kalau Front Row musuh dibersihkan cepat dan lane dipaksa terbuka.',
          deck:[
            'forest_scout','forest_scout','huntress','huntress','frost_adept','frost_adept',
            'arcane_archer','arcane_archer','wind_falcon','wind_falcon','storm_caller',
            'storm_caller','mirror_mage','thunder_roc','thunder_roc','arcane_dragon',
            'footman','spear_guard','shield_bearer','bone_guard','rain','rain',
            'chain_lightning','chain_lightning','fire_bolt','fire_bolt','arcane_well',
            'arcane_well','dispel','battle_cry'
          ]
        },
        {
          id:'burn-column',
          number:4,
          name:'Burn Column',
          difficulty:'Hard',
          enemyHp:26,
          aiPlaysBonus:1,
          lesson:'Latihan menghadapi spell damage, column control, dan timing penyebaran board.',
          weakness:'Lemah jika kamu tidak menumpuk terlalu banyak creature di row/kolom yang sama.',
          deck:[
            'apprentice_mage','apprentice_mage','spellblade','spellblade','storm_caller',
            'storm_caller','mirror_mage','mirror_mage','rune_construct','rune_construct',
            'phoenix_initiate','phoenix_initiate','chronomancer','arcane_dragon','fire_bolt',
            'fire_bolt','chain_lightning','chain_lightning','ember_field','ember_field',
            'rain','arcane_well','dispel','dispel','weakening_curse','silence_seal',
            'battle_cry','siege_order','frost_adept','arcane_archer'
          ]
        },
        {
          id:'umbral-attrition',
          number:5,
          name:'Umbral Attrition',
          difficulty:'Hard+',
          enemyHp:28,
          aiPlaysBonus:1,
          lesson:'Latihan melawan Poison, debuff, Lifesteal, dan permainan panjang.',
          weakness:'Lemah terhadap Renewal, heal row, dan tempo cepat sebelum debuff menumpuk.',
          deck:[
            'venom_lizard','venom_lizard','plague_hound','plague_hound','shade','shade',
            'grave_acolyte','grave_acolyte','blood_witch','blood_witch','night_stalker',
            'night_stalker','dread_knight','dread_knight','soul_reaper','vampire_lord',
            'lich_sovereign','bone_guard','cave_rat','cave_rat','poison_mist','poison_mist',
            'weakening_curse','weakening_curse','silence_seal','silence_seal','ember_field',
            'fire_bolt','trap_rune','dispel'
          ]
        },
        {
          id:'root-dragon-boss',
          number:6,
          name:'Root Dragon Boss',
          difficulty:'Boss',
          enemyHp:34,
          aiPlaysBonus:1,
          lesson:'Ujian akhir: deck campuran dengan heal, big creature, shared buff, dan removal.',
          weakness:'Butuh rencana lengkap: tempo awal, Dispel tepat waktu, dan finish sebelum late game.',
          deck:[
            'shield_bearer','spear_guard','knight','royal_cavalier','royal_champion',
            'fortress_golem','elder_shaman','elder_shaman','ancient_treant','ancient_treant',
            'moon_stag','worldroot_colossus','arcane_dragon','arcane_dragon','thunder_roc',
            'lich_sovereign','vampire_lord','storm_caller','mirror_mage','barkhide_bear',
            'blessing','stone_skin','counter_formation','mirror_barrier','healing_light',
            'renewal','sacred_ground','war_drums','arcane_well','dispel'
          ]
        },
        {
          id:'vanguard-tempo',
          number:7,
          name:'Vanguard Tempo',
          difficulty:'Elite',
          enemyHp:29,
          aiPlaysBonus:1,
          lesson:'Latihan melawan curve stabil: creature murah, buff row, lalu threat besar.',
          weakness:'Tekan energy awalnya dan jangan biarkan board Vanguard melebar.',
          deck:[
            'squire_of_dawn','squire_of_dawn','footman','footman','shield_bearer','shield_bearer',
            'spear_guard','spear_guard','knight','knight','banner_captain','banner_captain',
            'royal_cavalier','royal_cavalier','royal_champion','iron_sentinel','fortress_golem',
            'blessing','blessing','stone_skin','stone_skin','counter_formation','counter_formation',
            'mirror_barrier','mirror_barrier','healing_light','renewal','dispel','battle_cry','war_drums'
          ]
        },
        {
          id:'wildclaw-siege',
          number:8,
          name:'Wildclaw Siege',
          difficulty:'Elite',
          enemyHp:30,
          aiPlaysBonus:1,
          lesson:'Latihan melawan melee pressure, Pierce, Battle Cry, dan War Drums.',
          weakness:'Lemah jika attacker besar dibunuh sebelum buff row dipakai.',
          deck:[
            'cave_rat','cave_rat','wolf_rider','wolf_rider','razor_boar','razor_boar',
            'sabertooth','sabertooth','berserker','berserker','ancient_behemoth','ancient_behemoth',
            'thunder_roc','venom_lizard','venom_lizard','barkhide_bear','barkhide_bear',
            'battle_cry','battle_cry','siege_order','siege_order','war_drums','war_drums',
            'fire_bolt','fire_bolt','trap_rune','trap_rune','dispel','rain','chain_lightning'
          ]
        },
        {
          id:'grove-renewal',
          number:9,
          name:'Grove Renewal',
          difficulty:'Elite+',
          enemyHp:31,
          aiPlaysBonus:1,
          lesson:'Latihan menembus heal, Regen, Counter, dan creature Health tebal.',
          weakness:'Butuh burst damage atau Dispel sebelum value heal berulang terlalu besar.',
          deck:[
            'seedling','seedling','thornling','thornling','grove_healer','grove_healer',
            'thorn_defender','thorn_defender','barkhide_bear','barkhide_bear','elder_shaman',
            'elder_shaman','ancient_treant','ancient_treant','moon_stag','moon_stag',
            'worldroot_colossus','healing_light','healing_light','renewal','renewal',
            'sacred_ground','sacred_ground','war_drums','arcane_well','arcane_well',
            'stone_skin','counter_formation','mirror_barrier','dispel'
          ]
        },
        {
          id:'arcanum-lock',
          number:10,
          name:'Arcanum Lock',
          difficulty:'Master',
          enemyHp:32,
          aiPlaysBonus:2,
          lesson:'Latihan menghadapi column spell, tempo mage, dan shared spell yang mengubah lane.',
          weakness:'Jangan taruh semua threat di satu kolom, dan simpan Dispel untuk engine penting.',
          deck:[
            'apprentice_mage','apprentice_mage','arcane_archer','arcane_archer','frost_adept',
            'frost_adept','spellblade','spellblade','storm_caller','storm_caller','mirror_mage',
            'mirror_mage','rune_construct','rune_construct','chronomancer','arcane_dragon',
            'rain','rain','chain_lightning','chain_lightning','arcane_well','arcane_well',
            'dispel','dispel','fire_bolt','fire_bolt','weakening_curse','silence_seal',
            'mirror_barrier','blessing'
          ]
        },
        {
          id:'umbral-curse-chain',
          number:11,
          name:'Curse Chain',
          difficulty:'Master',
          enemyHp:33,
          aiPlaysBonus:2,
          lesson:'Latihan melawan debuff bertumpuk yang menurunkan Attack dan Counter.',
          weakness:'Dispel dan Renewal sangat penting sebelum board kamu kehilangan damage.',
          deck:[
            'shade','shade','grave_acolyte','grave_acolyte','bone_guard','bone_guard',
            'night_stalker','night_stalker','blood_witch','blood_witch','plague_hound',
            'plague_hound','dread_knight','dread_knight','soul_reaper','vampire_lord',
            'lich_sovereign','weakening_curse','weakening_curse','silence_seal','silence_seal',
            'poison_mist','poison_mist','ember_field','ember_field','fire_bolt','trap_rune',
            'mirror_barrier','dispel','chain_lightning'
          ]
        },
        {
          id:'skyfire-ambush',
          number:12,
          name:'Skyfire Ambush',
          difficulty:'Master+',
          enemyHp:35,
          aiPlaysBonus:2,
          lesson:'Latihan menghadapi flyer, Quick, Splash, dan pressure lane kosong.',
          weakness:'Jaga Front Row tetap hidup dan paksa flyer bertukar ke creature, bukan ke HP.',
          deck:[
            'forest_scout','forest_scout','wind_falcon','wind_falcon','thunder_roc','thunder_roc',
            'phoenix_initiate','phoenix_initiate','arcane_dragon','arcane_dragon','huntress',
            'huntress','storm_caller','storm_caller','wolf_rider','wolf_rider','spear_guard',
            'rain','rain','battle_cry','battle_cry','chain_lightning','chain_lightning',
            'fire_bolt','fire_bolt','war_drums','arcane_well','trap_rune','dispel','siege_order'
          ]
        },
        {
          id:'mirror-trap-school',
          number:13,
          name:'Trap School',
          difficulty:'Master+',
          enemyHp:36,
          aiPlaysBonus:2,
          lesson:'Latihan membaca row trap dan timing attack agar tidak menghancurkan tempo sendiri.',
          weakness:'Serang dengan unit kecil dulu, atau gunakan Dispel sebelum attacker utama masuk.',
          deck:[
            'shield_bearer','shield_bearer','bone_guard','bone_guard','thorn_defender',
            'thorn_defender','mirror_mage','mirror_mage','rune_construct','rune_construct',
            'iron_sentinel','iron_sentinel','knight','royal_cavalier','dread_knight',
            'mirror_barrier','mirror_barrier','trap_rune','trap_rune','counter_formation',
            'counter_formation','stone_skin','stone_skin','weakening_curse','silence_seal',
            'fire_bolt','dispel','dispel','sacred_ground','healing_light'
          ]
        },
        {
          id:'poison-marsh',
          number:14,
          name:'Poison Marsh',
          difficulty:'Nightmare',
          enemyHp:37,
          aiPlaysBonus:2,
          lesson:'Latihan bertahan dari Poison Mist, Venom, dan Ember Field.',
          weakness:'Renewal, heal row, dan board kecil lebih aman daripada overcommit.',
          deck:[
            'venom_lizard','venom_lizard','plague_hound','plague_hound','cave_rat','cave_rat',
            'shade','shade','grave_acolyte','grave_acolyte','blood_witch','blood_witch',
            'night_stalker','night_stalker','vampire_lord','lich_sovereign','dread_knight',
            'poison_mist','poison_mist','ember_field','ember_field','weakening_curse',
            'weakening_curse','silence_seal','silence_seal','fire_bolt','fire_bolt',
            'trap_rune','dispel','chain_lightning'
          ]
        },
        {
          id:'column-typhoon',
          number:15,
          name:'Column Typhoon',
          difficulty:'Nightmare',
          enemyHp:38,
          aiPlaysBonus:2,
          lesson:'Latihan menghadapi shared spell yang membuat satu kolom jadi zona berbahaya.',
          weakness:'Rotasi lane, jangan penuhi satu kolom, dan rebut timing shared spell.',
          deck:[
            'arcane_archer','arcane_archer','frost_adept','frost_adept','storm_caller',
            'storm_caller','mirror_mage','mirror_mage','wind_falcon','wind_falcon',
            'thunder_roc','thunder_roc','spellblade','spellblade','rune_construct',
            'rain','rain','arcane_well','arcane_well','ember_field','ember_field',
            'sacred_ground','sacred_ground','war_drums','war_drums','chain_lightning',
            'chain_lightning','dispel','fire_bolt','battle_cry'
          ]
        },
        {
          id:'executioners-line',
          number:16,
          name:'Execution Line',
          difficulty:'Mythic',
          enemyHp:40,
          aiPlaysBonus:3,
          lesson:'Latihan melawan Execute dan damage burst pada creature yang terluka.',
          weakness:'Jangan biarkan creature setengah mati bertahan di board tanpa heal atau shield.',
          deck:[
            'razor_boar','razor_boar','sabertooth','sabertooth','berserker','berserker',
            'night_stalker','night_stalker','blood_witch','blood_witch','dread_knight',
            'dread_knight','soul_reaper','soul_reaper','ancient_behemoth','thunder_roc',
            'fire_bolt','fire_bolt','battle_cry','battle_cry','siege_order','siege_order',
            'weakening_curse','weakening_curse','poison_mist','trap_rune','war_drums',
            'ember_field','dispel','chain_lightning'
          ]
        },
        {
          id:'immortal-grove',
          number:17,
          name:'Immortal Grove',
          difficulty:'Mythic',
          enemyHp:42,
          aiPlaysBonus:3,
          lesson:'Latihan melawan late game heal, Rebirth, dan threat besar yang sulit benar-benar mati.',
          weakness:'Habisi support healer, tahan Dispel untuk sacred engine, dan jangan buang burst.',
          deck:[
            'seedling','seedling','grove_healer','grove_healer','elder_shaman','elder_shaman',
            'ancient_treant','ancient_treant','moon_stag','moon_stag','worldroot_colossus',
            'worldroot_colossus','phoenix_initiate','phoenix_initiate','arcane_dragon',
            'thorn_defender','thorn_defender','barkhide_bear','barkhide_bear','healing_light',
            'healing_light','renewal','renewal','sacred_ground','sacred_ground','arcane_well',
            'arcane_well','stone_skin','mirror_barrier','dispel'
          ]
        },
        {
          id:'royal-arcane-order',
          number:18,
          name:'Royal Arcane Order',
          difficulty:'Mythic+',
          enemyHp:44,
          aiPlaysBonus:3,
          lesson:'Latihan menghadapi deck hybrid: pertahanan Vanguard plus spell control Arcanum.',
          weakness:'Pilih target prioritas: hancurkan engine spell atau bunuh frontliner sebelum buff.',
          deck:[
            'squire_of_dawn','shield_bearer','spear_guard','knight','banner_captain',
            'royal_cavalier','royal_cavalier','royal_champion','royal_champion','iron_sentinel',
            'fortress_golem','apprentice_mage','arcane_archer','frost_adept','storm_caller',
            'mirror_mage','rune_construct','arcane_dragon','blessing','blessing',
            'stone_skin','counter_formation','mirror_barrier','rain','chain_lightning',
            'arcane_well','fire_bolt','dispel','dispel','sacred_ground'
          ]
        },
        {
          id:'void-front',
          number:19,
          name:'Void Front',
          difficulty:'Legend',
          enemyHp:46,
          aiPlaysBonus:3,
          lesson:'Latihan akhir sebelum boss: debuff, poison, traps, dan lifesteal dalam satu deck.',
          weakness:'Main lebih bersih: jangan overextend, simpan cleanse, dan paksa trade creature.',
          deck:[
            'shade','shade','grave_acolyte','bone_guard','bone_guard','plague_hound',
            'plague_hound','blood_witch','blood_witch','night_stalker','night_stalker',
            'dread_knight','dread_knight','soul_reaper','soul_reaper','vampire_lord',
            'vampire_lord','lich_sovereign','weakening_curse','weakening_curse','silence_seal',
            'silence_seal','poison_mist','poison_mist','ember_field','ember_field',
            'trap_rune','mirror_barrier','fire_bolt','dispel'
          ]
        },
        {
          id:'final-convergence',
          number:20,
          name:'Final Convergence',
          difficulty:'Final Boss',
          enemyHp:50,
          aiPlaysBonus:3,
          lesson:'Final campaign: semua archetype bercampur, dari tempo awal sampai late-game bomb.',
          weakness:'Butuh deck lengkap: early blocker, removal, Dispel, heal, dan finisher.',
          deck:[
            'cave_rat','shield_bearer','forest_scout','spear_guard','huntress','frost_adept',
            'knight','bone_guard','storm_caller','thorn_defender','royal_cavalier',
            'dread_knight','elder_shaman','thunder_roc','royal_champion','ancient_treant',
            'vampire_lord','arcane_dragon','worldroot_colossus','lich_sovereign',
            'fire_bolt','battle_cry','blessing','stone_skin','poison_mist','weakening_curse',
            'rain','arcane_well','sacred_ground','dispel'
          ]
        }
      ];
    },

    campaignStage(id){
      return this.campaignStages().find(stage=>stage.id===id)||null;
    },

    ensureCampaignOverlay(){
      let overlay=$('campaignOverlay');
      if(overlay)return overlay;

      overlay=document.createElement('section');
      overlay.id='campaignOverlay';
      overlay.className='collection-overlay campaign-overlay';
      overlay.hidden=true;
      overlay.setAttribute('role','dialog');
      overlay.setAttribute('aria-modal','true');
      overlay.setAttribute('aria-labelledby','campaignTitle');
      overlay.innerHTML=`
        <div class="collection-shell campaign-shell">
          <header class="collection-head campaign-head">
            <button class="menu-back-btn" id="campaignBackBtn" type="button" aria-label="Back to versus menu">Back</button>
            <div>
              <span class="collection-kicker">Scenario Training</span>
              <h1 id="campaignTitle">Campaign</h1>
            </div>
          </header>
          <div class="campaign-intro">
            Menangkan stage untuk membuka stage berikutnya.
          </div>
          <div class="campaign-grid" id="campaignGrid"></div>
        </div>
      `;

      document.body.appendChild(overlay);
      $('campaignBackBtn').addEventListener('click',()=>{
        window.TCGSFX?.play?.('ui_close');
        this.closeCampaignOverlay(false);
        this.openVersusOverlay();
      });
      overlay.addEventListener('click',event=>{
        const button=event.target.closest?.('[data-campaign-stage]');
        if(!button)return;

        const stageId=button.dataset.campaignStage;
        const stage=this.campaignStage(stageId);
        if(!stage || !this.isCampaignStageUnlocked(stage)){
          window.TCGSFX?.play?.('invalid');
          return;
        }

        window.TCGSFX?.play?.('ui_click');
        this.closeCampaignOverlay(false);
        this.closeMainMenu(false);
        this.newGame({campaignStageId:stageId});
      });
      return overlay;
    },

    openCampaignOverlay(){
      const overlay=this.ensureCampaignOverlay();
      this.closeCollectionOverlay();
      this.closeGuideOverlay();
      this.closeVersusOverlay(false);
      this.renderCampaignOverlay();
      overlay.hidden=false;
      document.body.classList.add('collection-open');
      requestAnimationFrame(()=>overlay.classList.add('open'));
    },

    closeCampaignOverlay(playSound=true){
      const overlay=$('campaignOverlay');
      if(!overlay)return;
      if(overlay.hidden&&!overlay.classList.contains('open'))return;

      if(playSound)window.TCGSFX?.play?.('ui_close');
      overlay.classList.remove('open');
      overlay.hidden=true;
      if(
        !$('collectionOverlay')?.classList.contains('open') &&
        !$('guideOverlay')?.classList.contains('open') &&
        !$('versusOverlay')?.classList.contains('open')
      ){
        document.body.classList.remove('collection-open');
      }
    },

    renderCampaignOverlay(){
      const grid=$('campaignGrid');
      if(!grid)return;

      const progress=this.campaignProgress();
      grid.innerHTML=this.campaignStages().map(stage=>{
        const cleared=stage.number<=progress.highestCleared;
        const unlocked=this.isCampaignStageUnlocked(stage);
        const status=cleared?'Cleared':unlocked?'Unlocked':'Locked';
        return `
        <button
          class="campaign-stage-card stage-bg-${stage.number} ${unlocked?'is-unlocked':'is-locked'} ${cleared?'is-cleared':''}"
          type="button"
          data-campaign-stage="${escapeHTML(stage.id)}"
          style="--stage-bg:url('assets/campaign/bg_stage${stage.number}.png')"
          ${unlocked?'':'disabled aria-disabled="true"'}
        >
          <span class="campaign-stage-number">Stage ${stage.number}</span>
          <strong>${escapeHTML(stage.name)}</strong>
          <em>${escapeHTML(stage.difficulty)}</em>
          <small>Enemy HP ${stage.enemyHp}</small>
          <span class="campaign-stage-status">${status}</span>
        </button>
      `}).join('');
    },

    createDeckFromKeys(keys,owner='enemy'){
      const instances=[];
      const fallbackDefs=window.CARD_DEFS||[];

      for(const keyName of keys||[]){
        const def=this.cardDef(keyName);
        if(def)instances.push(window.createCardInstance(def,owner));
      }

      for(const def of fallbackDefs){
        if(instances.length>=30)break;
        instances.push(window.createCardInstance(def,owner));
      }

      for(let i=instances.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        [instances[i],instances[j]]=[instances[j],instances[i]];
      }

      return instances.slice(0,30);
    },

    openAboutOverlay(){
      const overlay=$('aboutOverlay');
      if(!overlay)return;

      this.closeCollectionOverlay();
      this.closeGuideOverlay();
      this.closeVersusOverlay();
      this.closeCampaignOverlay();

      overlay.hidden=false;
      requestAnimationFrame(()=>{
        overlay.classList.add('open');
        $('aboutBackBtn')?.focus({preventScroll:true});
      });
    },

    closeAboutOverlay(){
      const overlay=$('aboutOverlay');
      if(!overlay)return;

      overlay.classList.remove('open');
      overlay.hidden=true;

      if($('mainMenu')?.classList.contains('open')){
        $('mainMenuAbout')?.focus({preventScroll:true});
      }
    },

    openMainMenu(){
      const menu=$('mainMenu');
      if(!menu)return;

      this.stopTimer();
      this.cancelMode(false);
      window.TCGSFX?.stopMusic?.();
      if(this.state?.phase !== 'menu'){
        this.prepareMenuState(false);
      }
      this.updateMainMenuDeckLabel();
      menu.hidden=false;
      document.body.classList.add('main-menu-open','utility-collapsed');

      requestAnimationFrame(()=>{
        menu.classList.add('open');
        $('mainMenuPlay')?.focus({preventScroll:true});
      });
    },

    closeMainMenu(startGameplay=true){
      const menu=$('mainMenu');
      if(!menu)return;

      this.closeAboutOverlay();
      menu.classList.remove('open');
      menu.hidden=true;
      document.body.classList.remove('main-menu-open');

      if(
        startGameplay &&
        this.state?.phase==='player' &&
        !this.locked &&
        !this.transitioning
      ){
        this.startTimer();
        this.state.bgmMode=null;
        this.updateBattleMusic();
      }
    },

    surrenderToMainMenu(){
      this.stopTimer();
      this.cancelMode(false);
      window.TCGSFX?.stopMusic?.();
      this.prepareMenuState();
      this.openMainMenu();
    },

    surrenderMatch(){
      if(!this.state || this.state.phase==='menu' || this.state.phase==='over')return;

      this.stopTimer();
      this.cleanDrag();
      this.cancelMode(false);
      window.TCGSFX?.play?.('defeat');
      window.TCGSFX?.stopMusic?.();
      this.state.phase='over';
      this.locked=true;
      this.transitioning=false;
      this.state.mode=null;
      this.render();
      this.banner('Surrender');
      this.log('Player surrendered the match.');
      this.showEndGameOverlay('surrender');
    },

    updateMainMenuDeckLabel(){
      const label=$('mainMenuActiveDeck');
      if(!label)return;

      const deck=window.TCGDeckStorage?.activeDeck?.();
      const stats=deck&&window.TCGDeckStorage?.deckStats?.(deck);
      label.textContent=deck
        ? `Deck: ${deck.name} · ${stats?.size || 0} cards`
        : 'Deck: Starter Deck';
    },

    cardDef(keyName){
      return (window.CARD_DEFS||[]).find(card=>card.key===keyName)||null;
    },

    createTutorialCard(keyName,owner='player'){
      const def=this.cardDef(keyName);
      return def?window.createCardInstance(def,owner):null;
    },

    startTutorial(){
      this.closeCollectionOverlay();
      this.closeGuideOverlay();
      this.hideEndGameOverlay();
      this.stopTimer();
      this.cleanDrag();
      this.locked=false;
      this.transitioning=false;

      const cavalier=this.createTutorialCard('royal_cavalier','player');
      const scout=this.createTutorialCard('forest_scout','player');
      const rain=this.createTutorialCard('rain','player');
      const fireBolt=this.createTutorialCard('fire_bolt','player');
      const trapRune=this.createTutorialCard('trap_rune','player');
      const healingLight=this.createTutorialCard('healing_light','player');
      const enemyRat=this.createTutorialCard('cave_rat','enemy');
      const enemyBack=this.createTutorialCard('frost_adept','enemy');

      this.state=this.makeState();
      this.state.playerHp=25;
      this.state.enemyHp=5;
      this.state.playerMaxEnergy=10;
      this.state.playerEnergy=10;
      this.state.enemyMaxEnergy=4;
      this.state.enemyEnergy=4;
      this.state.timeMax=180;
      this.state.time=180;
      this.state.playerHand=[cavalier,scout,rain].filter(Boolean);
      this.state.enemyHand=[enemyRat].filter(Boolean);
      this.state.playerDeck=[
        this.createTutorialCard('stone_skin','player'),
        this.createTutorialCard('blessing','player'),
        this.createTutorialCard('squire_of_dawn','player')
      ].filter(Boolean);
      this.state.enemyDeck=[
        this.createTutorialCard('thornling','enemy')
      ].filter(Boolean);

      this.tutorial={
        active:true,
        step:0,
        lane:1,
        rangedLane:2,
        cardId:cavalier?.id||null,
        scoutId:scout?.id||null,
        rainId:rain?.id||null,
        fireBoltId:fireBolt?.id||null,
        trapRuneId:trapRune?.id||null,
        healingLightId:healingLight?.id||null,
        fireBoltCard:fireBolt||null,
        trapRuneCard:trapRune||null,
        healingLightCard:healingLight||null,
        enemyCardId:enemyRat?.id||null,
        enemyBackId:enemyBack?.id||null,
        enemyBackCard:enemyBack||null,
        cardKey:'royal_cavalier',
        focusPulse:true,
        focusTimer:null,
        nudge:''
      };

      document.body.classList.add('tutorial-active');
      this.log('Tutorial started.');
      this.render();
      this.banner('Tutorial');
      this.startTimer();
    },

    ensureTutorialCoach(){
      let coach=$('tutorialCoach');
      if(coach)return coach;

      coach=document.createElement('aside');
      coach.id='tutorialCoach';
      coach.className='tutorial-coach';
      coach.hidden=true;
      coach.innerHTML=`
        <div class="tutorial-coach-head">
          <span id="tutorialStepCount">Step 1/3</span>
        </div>
        <h2 id="tutorialTitle">Tutorial</h2>
        <p id="tutorialText"></p>
        <p class="tutorial-nudge" id="tutorialNudge" hidden></p>
        <button class="tutorial-next" id="tutorialNextBtn" type="button">Next</button>
      `;
      document.body.appendChild(coach);
      $('tutorialNextBtn').addEventListener('click',()=>this.tutorialNext());
      return coach;
    },

    ensureTutorialFocus(){
      let focus=$('tutorialFocus');
      if(focus)return focus;

      focus=document.createElement('div');
      focus.id='tutorialFocus';
      focus.className='tutorial-focus-spot';
      focus.hidden=true;
      document.body.appendChild(focus);
      return focus;
    },

    tutorialSteps(){
      const ids=this.tutorial||{};
      const playerFront='.slot[data-row="playerFront"]';
      const playerBack='.slot[data-row="playerBack"]';
      const enemyFront='.slot[data-row="enemyFront"]';
      const enemyBack='.slot[data-row="enemyBack"]';
      const sideSpells='.slot[data-row="playerSpellFront"],.slot[data-row="playerSpellBack"],.slot[data-row="enemySpellFront"],.slot[data-row="enemySpellBack"],.slot[data-row="sharedSpell"]';

      return [
        {
          title:'Tujuan permainan',
          text:'Target utama adalah HP Hand. Turunkan HP Hand musuh ke 0 sebelum HP Hand kamu habis. Semua summon, spell, trap, dan attack akhirnya mengarah ke tujuan ini.',
          selector:()=>'.player-hp-status,.enemy-hp-status,#playerHp,#enemyHp',
          action:'next'
        },
        {
          title:'Energy untuk main kartu',
          text:'Energy adalah biaya aksi. Angka kiri adalah energy tersisa, angka kanan adalah max energy. Kartu tidak bisa dimainkan kalau cost-nya lebih tinggi dari energy tersisa.',
          selector:()=>'.energy-panel,.player-energy-status',
          action:'next'
        },
        {
          title:'Phase, turn, dan timer',
          text:'Game berjalan bergantian antara Player Phase dan Enemy Phase. Timer menekan player untuk bertindak. Tombol End Turn dipakai kalau kamu selesai melakukan aksi.',
          selector:()=>'.phase-badge,#timerText,#timerStatus,#endBtn',
          action:'next'
        },
        {
          title:'Deck, hand, discard',
          text:'Deck adalah tumpukan kartu yang akan di-draw. Hand adalah kartu yang bisa kamu mainkan. Discard berisi kartu mati, spell selesai, trap terpicu, atau spell yang durasinya habis.',
          selector:()=>'.hand-panel,#playerDeckPile,#playerDiscardPile,#enemyDeckPile,#enemyDiscardPile',
          action:'next'
        },
        {
          title:'Board: Front dan Back Row',
          text:'Creature dimainkan ke row. Melee masuk Front Row, ranged masuk Back Row, flyer bisa Front atau Back. Setiap lane punya jalur serang sendiri.',
          selector:()=>`${playerFront},${playerBack},${enemyFront},${enemyBack}`,
          action:'next'
        },
        {
          title:'Area spell',
          text:'Spell row dimainkan ke slot spell di sisi row. Shared spell dimainkan di tengah board dan memengaruhi kolom. Trap dan ongoing bisa menetap di board.',
          selector:()=>sideSpells,
          action:'next'
        },
        {
          title:'Baca kartu sebelum summon',
          text:'Sebelum summon kartu pertama, klik kanan Royal Cavalier di hand untuk membuka card viewer detail. Biasakan baca kartu dulu sebelum memilih slot.',
          selector:()=>`.hand-card[data-card-id="${ids.cardId}"]`,
          action:'inspect',
          cardId:()=>ids.cardId,
          allowTarget:true
        },
        {
          title:'Isi card viewer',
          text:'Di viewer ini kamu bisa baca cost, Attack, Health, Counter, tipe creature, passive icon, dan deskripsi efek kartu. Setelah paham, tekan Next untuk lanjut summon.',
          selector:()=>'.card-inspector-dialog',
          action:'next',
          closeInspectorBeforeAdvance:true
        },
        {
          title:'Summon melee ke Front Row',
          text:'Mainkan Royal Cavalier ke Front Row tengah. Kamu boleh tap kartu lalu tap slot, atau drag kartu langsung ke slot seperti gameplay biasa.',
          selector:()=>`.hand-card[data-card-id="${ids.cardId}"],.slot[data-row="playerFront"][data-lane="1"]`,
          action:'play',
          cardId:()=>ids.cardId,
          row:'playerFront',
          lane:1,
          anchorSelector:()=>'.slot[data-row="playerFront"][data-lane="1"]',
          allowTarget:true,
          afterPlay:()=>this.tutorialEnemyDrop()
        },
        {
          title:'Atribut creature',
          text:'Setelah creature dimainkan, baru atributnya penting dibaca: Attack untuk damage, Health untuk daya tahan, Counter untuk balasan jika bertahan hidup, dan icon Quick berarti bisa attack pada turn summon. Musuh juga drop Cave Rat di lane kiri.',
          selector:()=>`.card[data-card-id="${ids.cardId}"],.card[data-card-id="${ids.enemyCardId}"]`,
          action:'next'
        },
        {
          title:'Lane attack',
          text:'Serangan mengikuti lane yang sama. Kalau Front Row musuh berisi creature, target itu dipukul dulu. Kalau Front kosong tapi Back berisi, Back yang ditarget. Kalau lane kosong, damage masuk ke HP Hand.',
          selector:()=>`${enemyFront},${enemyBack}`,
          action:'next'
        },
        {
          title:'Move creature',
          text:'Di mode normal, creature lama bisa dipindah ke slot kosong yang valid satu kali per phase. Setelah move, creature tidak bisa attack pada phase yang sama. Creature yang baru summon belum boleh dipindah.',
          selector:()=>`.card[data-card-id="${ids.cardId}"],${playerFront},${playerBack}`,
          action:'next'
        },
        {
          title:'Summon ranged ke Back Row',
          text:'Mainkan Forest Scout ke Back Row kanan. Setelah summon, musuh akan punya contoh target Back Row di lane yang sama.',
          selector:()=>`.hand-card[data-card-id="${ids.scoutId}"],.slot[data-row="playerBack"][data-lane="2"]`,
          action:'play',
          cardId:()=>ids.scoutId,
          row:'playerBack',
          lane:2,
          anchorSelector:()=>'.slot[data-row="playerBack"][data-lane="2"]',
          allowTarget:true,
          afterPlay:()=>this.tutorialEnemyBackDrop()
        },
        {
          title:'Atribut ranged',
          text:'Forest Scout sudah di board, jadi sekarang atributnya dibaca sebagai ranged: dia bermain dari Back Row, menyerang lane yang sama, dan icon Quick membuatnya aktif. Musuh punya Frost Adept dengan Shield sebagai contoh defender.',
          selector:()=>`.card[data-card-id="${ids.scoutId}"],.card[data-card-id="${ids.enemyBackId}"]`,
          action:'next'
        },
        {
          title:'Pasang Rain di shared slot',
          text:'Mainkan Rain ke shared spell slot kanan, sejajar dengan Forest Scout. Rain memberi +1 Attack ke ranged dan flyer pada kolom itu selama durasinya masih ada.',
          selector:()=>`.hand-card[data-card-id="${ids.rainId}"],.slot[data-row="sharedSpell"][data-lane="2"]`,
          action:'play',
          cardId:()=>ids.rainId,
          row:'sharedSpell',
          lane:2,
          anchorSelector:()=>'.slot[data-row="sharedSpell"][data-lane="2"]',
          allowTarget:true
        },
        {
          title:'Atribut shared spell',
          text:'Rain sudah dimainkan, jadi sekarang lihat atribut spell-nya: Shared berarti efek kolom untuk kedua pemain, value +1 adalah bonus Attack, dan durasi menunjukkan berapa lama efek menetap sebelum masuk Discard.',
          selector:()=>`.card[data-card-id="${ids.rainId}"],#playerDiscardPile,#enemyDiscardPile`,
          action:'next'
        },
        {
          title:'Cast Fire Bolt ke row musuh',
          text:'Mainkan Fire Bolt ke enemy Front spell slot. Fire Bolt akan memberi damage ke semua creature pada Front Row musuh, termasuk Cave Rat.',
          selector:()=>`.hand-card[data-card-id="${ids.fireBoltId}"],.slot[data-row="enemySpellFront"][data-lane="0"]`,
          action:'play',
          cardId:()=>ids.fireBoltId,
          row:'enemySpellFront',
          lane:0,
          anchorSelector:()=>'.slot[data-row="enemySpellFront"][data-lane="0"]',
          coachPlacement:'below',
          allowTarget:true
        },
        {
          title:'Atribut instant spell',
          text:'Fire Bolt adalah instant row spell: value-nya adalah damage, area-nya row lawan, efeknya langsung selesai, lalu kartunya masuk Discard bersama creature yang mati.',
          selector:()=>'#playerDiscardPile,#enemyDiscardPile',
          action:'next'
        },
        {
          title:'Combat math',
          text:'Saat creature menyerang creature, attacker memberi damage sebesar Attack. Defender hanya membalas dengan Counter kalau masih hidup. Shield menyerap satu instance damage.',
          selector:()=>`.card[data-card-id="${ids.scoutId}"],.card[data-card-id="${ids.enemyBackId}"]`,
          action:'next'
        },
        {
          title:'Combat kartu vs kartu',
          text:'Tap Forest Scout, lalu pilih Frost Adept sebagai target. Ini contoh combat kartu vs kartu: Rain menambah Attack Scout, lalu Shield Frost Adept menyerap damage.',
          selector:()=>`.card[data-card-id="${ids.scoutId}"],.card[data-card-id="${ids.enemyBackId}"]`,
          action:'attack',
          cardId:()=>ids.scoutId,
          allowedSelector:()=>`.card[data-card-id="${ids.scoutId}"]`,
          targetOwner:'enemy',
          targetKind:'card',
          allowTarget:true
        },
        {
          title:'Passive lain',
          text:'Sniper bonus ke Back Row, Splash kena target sebelah, Execute bonus ke target terluka, Rebirth hidup sekali lagi, Regen heal awal turn, Fury aktif saat HP rendah, dan summon heal bisa memulihkan row atau Hand.',
          selector:()=>`.card[data-card-id="${ids.scoutId}"],.card[data-card-id="${ids.rainId}"]`,
          action:'next'
        },
        {
          title:'Akhiri phase',
          text:'Kalau sudah selesai main kartu atau attack, tekan End Turn. Untuk tutorial ini enemy phase akan disimulasikan singkat lalu kembali ke Player Phase.',
          selector:()=>'#endBtn',
          action:'end_turn',
          allowTarget:true
        },
        {
          title:'Awal turn baru',
          text:'Pada awal Player Phase, kamu draw kartu, max energy naik sampai batas 10, energy terisi penuh, dan creature lama siap attack lagi.',
          selector:()=>'.energy-panel,.player-energy-status,#playerDeckPile,.card[data-card-id="'+ids.cardId+'"]',
          action:'next'
        },
        {
          title:'Menyerang HP Hand',
          text:'Tap Royal Cavalier. Lane tengah musuh kosong, jadi serangan langsung masuk ke HP Hand musuh. HP musuh sudah dibuat rendah supaya tutorial cepat selesai.',
          selector:()=>`.card[data-card-id="${ids.cardId}"]`,
          action:'attack',
          cardId:()=>ids.cardId,
          allowedSelector:()=>`.card[data-card-id="${ids.cardId}"]`,
          targetOwner:'enemy',
          allowTarget:true,
          complete:true
        },
        {
          title:'Tutorial selesai',
          text:'Sekarang kamu sudah melihat alur inti: baca kartu, pakai energy, summon sesuai row, spell, shared, discard, end turn, lalu attack untuk menghabisi HP Hand musuh.',
          action:'done',
          selector:()=>null
        }
      ];
    },

    currentTutorialStep(){
      if(!this.tutorial?.active)return null;
      return this.tutorialSteps()[this.tutorial.step]||null;
    },

    tutorialStepCardId(step){
      if(!step)return null;
      return typeof step.cardId==='function'?step.cardId():step.cardId;
    },

    tutorialStepMatchesPlay(step,card,row,lane,owner){
      if(!step||step.action!=='play'||owner!=='player')return false;
      const expectedId=this.tutorialStepCardId(step);
      if(expectedId&&card?.id!==expectedId)return false;
      if(step.row&&row!==step.row)return false;
      if(step.lane!==undefined&&Number(lane)!==Number(step.lane))return false;
      return true;
    },

    tutorialAllowsInspect(target){
      const step=this.currentTutorialStep();
      if(step?.action!=='inspect')return false;
      const cardEl=target?.closest?.('.card[data-card-id],.hand-card[data-card-id]');
      if(!cardEl)return false;
      return cardEl.dataset.cardId===this.tutorialStepCardId(step);
    },

    handleTutorialGate(event){
      if(!this.tutorial?.active)return;
      if(this.drag)return;
      if(event.target.closest?.('.tutorial-coach'))return;
      if(event.target.closest?.('.tutorial-allowed'))return;
      if(event.target.closest?.('.card-inspector'))return;
      if(event.target.closest?.('#panelOpen,#quitTutorialBtn,.utility-panel'))return;
      event.preventDefault();
      event.stopPropagation();
      this.tutorialMessage('Tap hanya area yang sedang disorot atau tombol tutorial.');
    },

    updateTutorialUI(){
      document.querySelectorAll('.tutorial-highlight,.tutorial-allowed,.tutorial-action-highlight').forEach(element=>element.classList.remove('tutorial-highlight','tutorial-allowed','tutorial-action-highlight'));
      document.querySelectorAll('.tutorial-hand-focus').forEach(element=>element.classList.remove('tutorial-hand-focus'));
      const coach=this.ensureTutorialCoach();
      const focus=this.ensureTutorialFocus();

      if(!this.tutorial?.active){
        coach.hidden=true;
        focus.hidden=true;
        document.body.classList.remove('tutorial-active');
        return;
      }

      const steps=this.tutorialSteps();
      const step=steps[this.tutorial.step]||steps[0];
      coach.hidden=false;
      $('tutorialStepCount').textContent=`Step ${Math.min(this.tutorial.step+1,steps.length)}/${steps.length}`;
      $('tutorialTitle').textContent=step.title;
      $('tutorialText').innerHTML=this.tutorialTextHTML(step.text);
      const nudge=$('tutorialNudge');
      nudge.innerHTML=this.tutorialTextHTML(this.tutorial.nudge||'');
      nudge.hidden=!this.tutorial.nudge;
      const nextBtn=$('tutorialNextBtn');
      nextBtn.hidden=step.action!=='next';

      const selector=step.selector?.();
      const highlighted=[];
      const allowedSelector=step.allowTarget
        ? (step.allowedSelector?.()||selector)
        : null;
      const allowedElements=new Set(
        allowedSelector
          ? [...document.querySelectorAll(allowedSelector)]
          : []
      );

      if(selector){
        document.querySelectorAll(selector).forEach(element=>{
          element.classList.add('tutorial-highlight');
          if(element.classList.contains('hand-card')){
            element.closest('.hand-panel')?.classList.add('tutorial-hand-focus');
            element.closest('.hand')?.classList.add('tutorial-hand-focus');
          }
          if(allowedElements.has(element)){
            element.classList.add('tutorial-allowed','tutorial-action-highlight');
          }
          highlighted.push(element);
        });
      }

      if(step.action==='attack'&&this.state.mode?.type==='attack'){
        document.querySelectorAll('.valid-target').forEach(element=>{
          element.classList.add('tutorial-highlight','tutorial-allowed','tutorial-action-highlight');
          highlighted.push(element);
        });
      }

      const anchorSelector=step.anchorSelector?.();
      const anchors=anchorSelector?[...document.querySelectorAll(anchorSelector)]:highlighted;
      this.positionTutorialCoach(anchors);
      this.positionTutorialFocus(anchors.length?anchors:highlighted);
      if(this.tutorial.focusPulse){
        this.tutorial.focusPulse=false;
        this.pulseTutorialFocus();
      }else{
        focus.classList.add('is-soft');
      }
    },

    tutorialTextHTML(text){
      const raw=String(text??'');
      const cardNames=[...new Set((window.CARD_DEFS||[]).map(card=>card.name).filter(Boolean))]
        .sort((a,b)=>b.length-a.length);

      if(!raw||!cardNames.length)return escapeHTML(raw);

      const pattern=new RegExp(`(${cardNames.map(escapeRegExp).join('|')})`,'g');
      const cardNameSet=new Set(cardNames);

      return raw
        .split(pattern)
        .map(part=>cardNameSet.has(part)
          ? `<strong class="tutorial-card-name">${escapeHTML(part)}</strong>`
          : escapeHTML(part)
        )
        .join('');
    },

    positionTutorialFocus(elements=[]){
      const focus=this.ensureTutorialFocus();
      const margin=10;
      const viewportWidth=window.innerWidth||document.documentElement.clientWidth;
      const viewportHeight=window.innerHeight||document.documentElement.clientHeight;
      const rects=elements
        .map(element=>element.getBoundingClientRect())
        .filter(rect=>rect.width>0&&rect.height>0&&rect.bottom>0&&rect.right>0&&rect.top<viewportHeight&&rect.left<viewportWidth);

      if(!rects.length){
        focus.hidden=true;
        return;
      }

      const anchor=rects.reduce((box,rect)=>({
        left:Math.min(box.left,rect.left),
        top:Math.min(box.top,rect.top),
        right:Math.max(box.right,rect.right),
        bottom:Math.max(box.bottom,rect.bottom)
      }),{
        left:rects[0].left,
        top:rects[0].top,
        right:rects[0].right,
        bottom:rects[0].bottom
      });

      const left=Math.max(8,anchor.left-margin);
      const top=Math.max(8,anchor.top-margin);
      const right=Math.min(viewportWidth-8,anchor.right+margin);
      const bottom=Math.min(viewportHeight-8,anchor.bottom+margin);

      focus.hidden=false;
      focus.style.left=`${Math.round(left)}px`;
      focus.style.top=`${Math.round(top)}px`;
      focus.style.width=`${Math.round(Math.max(24,right-left))}px`;
      focus.style.height=`${Math.round(Math.max(24,bottom-top))}px`;
    },

    pulseTutorialFocus(duration=1600){
      if(!this.tutorial?.active)return;
      const focus=this.ensureTutorialFocus();
      if(this.tutorial.focusTimer){
        clearTimeout(this.tutorial.focusTimer);
      }
      focus.classList.remove('is-soft');
      focus.classList.add('is-strong');
      this.tutorial.focusTimer=setTimeout(()=>{
        focus.classList.remove('is-strong');
        focus.classList.add('is-soft');
        this.tutorial.focusTimer=null;
      },duration);
    },

    positionTutorialCoach(elements=[]){
      const coach=$('tutorialCoach');
      if(!coach||coach.hidden)return;

      const margin=12;
      const gap=12;
      const viewportWidth=window.innerWidth||document.documentElement.clientWidth;
      const viewportHeight=window.innerHeight||document.documentElement.clientHeight;

      const rects=elements
        .map(element=>element.getBoundingClientRect())
        .filter(rect=>rect.width>0&&rect.height>0&&rect.bottom>0&&rect.right>0&&rect.top<viewportHeight&&rect.left<viewportWidth);

      if(!rects.length){
        coach.style.left=`${margin}px`;
        coach.style.top=`${margin}px`;
        return;
      }

      const anchor=rects.reduce((box,rect)=>({
        left:Math.min(box.left,rect.left),
        top:Math.min(box.top,rect.top),
        right:Math.max(box.right,rect.right),
        bottom:Math.max(box.bottom,rect.bottom)
      }),{
        left:rects[0].left,
        top:rects[0].top,
        right:rects[0].right,
        bottom:rects[0].bottom
      });

      anchor.width=anchor.right-anchor.left;
      anchor.height=anchor.bottom-anchor.top;

      const coachWidth=coach.offsetWidth||340;
      const coachHeight=coach.offsetHeight||160;
      const placement=this.currentTutorialStep()?.coachPlacement;
      let left=anchor.right+gap;
      let top=anchor.top+(anchor.height/2)-(coachHeight/2);

      if(placement==='below'){
        left=anchor.left+(anchor.width/2)-(coachWidth/2);
        top=anchor.bottom+gap;
      }else if(placement==='above'){
        left=anchor.left+(anchor.width/2)-(coachWidth/2);
        top=anchor.top-coachHeight-gap;
      }

      if(placement!=='below'&&placement!=='above'&&left+coachWidth>viewportWidth-margin){
        left=anchor.left-coachWidth-gap;
      }

      if(placement!=='below'&&placement!=='above'&&left<margin){
        left=anchor.left+(anchor.width/2)-(coachWidth/2);
        top=anchor.bottom+gap;

        if(top+coachHeight>viewportHeight-margin){
          top=anchor.top-coachHeight-gap;
        }
      }

      left=Math.min(Math.max(left,margin),Math.max(margin,viewportWidth-coachWidth-margin));
      top=Math.min(Math.max(top,margin),Math.max(margin,viewportHeight-coachHeight-margin));

      coach.style.left=`${Math.round(left)}px`;
      coach.style.top=`${Math.round(top)}px`;
    },

    tutorialNext(){
      if(!this.tutorial?.active)return;
      const step=this.tutorialSteps()[this.tutorial.step];
      if(step?.action!=='next'){
        this.tutorialMessage('Lanjutkan dengan tap area yang disorot.');
        return;
      }
      if(step.closeInspectorBeforeAdvance){
        window.TCGCardInspector?.close?.();
      }
      this.tutorialAdvance(this.tutorial.step+1);
    },

    tutorialMessage(message){
      if(!this.tutorial?.active)return;
      this.tutorial.nudge=message;
      this.tutorial.focusPulse=true;
      window.TCGSFX?.play?.('invalid');
      this.updateTutorialUI();
    },

    tutorialAdvance(step){
      if(!this.tutorial?.active)return;
      this.tutorial.step=step;
      this.tutorial.nudge='';
      this.tutorial.focusPulse=true;
      this.tutorialPrepareStep(step);
      this.render();
    },

    tutorialPrepareStep(stepIndex){
      if(!this.tutorial?.active)return;
      const step=this.tutorialSteps()[stepIndex];
      if(step?.cardId?.()===this.tutorial.fireBoltId){
        this.tutorialEnsurePlayerHandCard('fireBoltCard','fireBoltAdded');
      }
    },

    tutorialEnsurePlayerHandCard(cardProp,flagProp){
      if(!this.tutorial?.active||this.tutorial[flagProp])return;
      const card=this.tutorial[cardProp];
      if(!card)return;
      if(!this.getCardInHand('player',card.id)&&!this.locateCard(card.id)){
        this.state.playerHand.push(card);
      }
      this.tutorial[flagProp]=true;
    },

    tutorialComplete(){
      if(!this.tutorial?.active)return;
      this.tutorial.step=this.tutorialSteps().length-1;
      this.tutorial.nudge='';
      this.tutorial.active=false;
      if(this.tutorial.focusTimer)clearTimeout(this.tutorial.focusTimer);
      document.body.classList.remove('tutorial-active');
      document.querySelectorAll('.tutorial-highlight,.tutorial-allowed,.tutorial-action-highlight').forEach(element=>element.classList.remove('tutorial-highlight','tutorial-allowed','tutorial-action-highlight'));
      document.querySelectorAll('.tutorial-hand-focus').forEach(element=>element.classList.remove('tutorial-hand-focus'));
      const coach=$('tutorialCoach');
      if(coach)coach.hidden=true;
      const focus=$('tutorialFocus');
      if(focus)focus.hidden=true;
      this.banner('Tutorial Complete');
    },

    stopTutorial(){
      if(this.tutorial?.focusTimer)clearTimeout(this.tutorial.focusTimer);
      this.tutorial=null;
      document.body.classList.remove('tutorial-active');
      document.querySelectorAll('.tutorial-highlight,.tutorial-allowed,.tutorial-action-highlight').forEach(element=>element.classList.remove('tutorial-highlight','tutorial-allowed','tutorial-action-highlight'));
      document.querySelectorAll('.tutorial-hand-focus').forEach(element=>element.classList.remove('tutorial-hand-focus'));
      const coach=$('tutorialCoach');
      if(coach)coach.hidden=true;
      const focus=$('tutorialFocus');
      if(focus)focus.hidden=true;
      this.newGame();
    },

    quitTutorialToMenu(){
      if(this.tutorial?.focusTimer)clearTimeout(this.tutorial.focusTimer);
      this.tutorial=null;
      document.body.classList.remove('tutorial-active','card-hold-pending','game-dragging');
      document.querySelectorAll('.tutorial-highlight,.tutorial-allowed,.tutorial-action-highlight').forEach(element=>element.classList.remove('tutorial-highlight','tutorial-allowed','tutorial-action-highlight'));
      document.querySelectorAll('.tutorial-hand-focus').forEach(element=>element.classList.remove('tutorial-hand-focus'));
      const coach=$('tutorialCoach');
      if(coach)coach.hidden=true;
      const focus=$('tutorialFocus');
      if(focus)focus.hidden=true;
      this.stopTimer();
      this.cleanDrag();
      this.prepareMenuState();
      this.openMainMenu();
    },

    tutorialGuardSelect(card){
      if(!this.tutorial?.active)return true;
      const step=this.currentTutorialStep();
      const isPlaySelection=step?.action==='play'&&card?.id===this.tutorialStepCardId(step);
      if(step?.action!=='select'&&!isPlaySelection){
        this.tutorialMessage('Belum waktunya memilih kartu. Ikuti area yang sedang disorot.');
        return false;
      }
      if(!isPlaySelection&&card?.id!==this.tutorialStepCardId(step)){
        this.tutorialMessage('Pilih kartu yang sedang disorot.');
        return false;
      }
      return true;
    },

    tutorialAfterSelect(card){
      if(!this.tutorial?.active)return;
      const step=this.currentTutorialStep();
      if(step?.action==='select'&&card?.id===this.tutorialStepCardId(step)){
        this.tutorialAdvance(this.tutorial.step+1);
      }
    },

    tutorialAfterInspect(detail){
      if(!this.tutorial?.active)return;
      const step=this.currentTutorialStep();
      if(step?.action==='inspect'&&detail?.cardId===this.tutorialStepCardId(step)){
        this.tutorialAdvance(this.tutorial.step+1);
      }
    },

    tutorialGuardPlayCard(card,row,lane,owner){
      if(!this.tutorial?.active)return true;
      const step=this.currentTutorialStep();
      if(!this.tutorialStepMatchesPlay(step,card,row,lane,owner)){
        this.tutorialMessage('Mainkan kartu ke slot yang sedang disorot.');
        return false;
      }
      return true;
    },

    tutorialEnemyDrop(){
      if(!this.tutorial?.active||this.tutorial.enemyDropped)return;
      const card=this.getCardInHand('enemy',this.tutorial.enemyCardId)||this.createTutorialCard('cave_rat','enemy');
      if(!card)return;
      this.removeFromHand('enemy',card.id);
      card.canAttack=false;
      card.summonedTurn=this.state.turn;
      if(!this.at('enemyFront',0)){
        this.place('enemyFront',0,card);
      }
      this.tutorial.enemyDropped=true;
      this.log('Tutorial: Enemy drops Cave Rat on the left lane.');
    },

    tutorialEnemyBackDrop(){
      if(!this.tutorial?.active||this.tutorial.enemyBackDropped)return;
      const card=this.tutorial.enemyBackCard||this.createTutorialCard('frost_adept','enemy');
      if(!card)return;
      card.owner='enemy';
      card.canAttack=false;
      card.summonedTurn=this.state.turn;
      if(!this.at('enemyBack',2)){
        this.place('enemyBack',2,card);
      }
      this.tutorial.enemyBackId=card.id;
      this.tutorial.enemyBackDropped=true;
      this.log('Tutorial: Enemy prepares a Frost Adept on Back Row.');
    },

    tutorialAfterPlayCard(card,row,lane,owner){
      if(!this.tutorial?.active)return;
      const step=this.currentTutorialStep();
      if(this.tutorialStepMatchesPlay(step,card,row,lane,owner)){
        step.afterPlay?.();
        this.tutorialAdvance(this.tutorial.step+1);
      }
    },

    tutorialGuardAttack(card){
      if(!this.tutorial?.active)return true;
      const step=this.currentTutorialStep();
      if(step?.action!=='attack'){
        this.tutorialMessage('Belum waktunya menyerang. Ikuti step tutorial.');
        return false;
      }
      if(card?.id!==this.tutorialStepCardId(step)){
        this.tutorialMessage('Tap creature yang sedang disorot untuk attack.');
        return false;
      }
      return true;
    },

    tutorialAfterAttack(attacker,target){
      if(!this.tutorial?.active)return;
      const step=this.currentTutorialStep();
      if(
        step?.action==='attack' &&
        attacker?.id===this.tutorialStepCardId(step) &&
        (!step.targetOwner||target?.owner===step.targetOwner) &&
        (!step.targetKind||target?.kind===step.targetKind)
      ){
        if(step.complete){
          this.tutorialComplete();
        }else{
          this.tutorialAdvance(this.tutorial.step+1);
        }
      }
    },

    async tutorialHandleEndTurn(){
      if(!this.tutorial?.active)return false;
      const step=this.currentTutorialStep();
      if(step?.action!=='end_turn'){
        this.tutorialMessage('Tutorial belum selesai. Ikuti step yang disorot dulu.');
        return true;
      }

      this.transitioning=true;
      this.stopTimer();
      this.cancelMode(false);
      this.state.phase='enemy';
      this.render();
      this.banner('Enemy Phase');
      await sleep(520);

      this.log('Tutorial: Enemy phase dilewati singkat.');
      this.state.phase='player';
      this.state.turn+=1;
      this.state.playerMaxEnergy=10;
      this.state.playerEnergy=10;
      this.state.time=this.state.timeMax;
      for(const card of Object.values(this.state.board)){
        if(card.owner==='player'&&card.category==='creature'){
          card.canAttack=true;
          card.movedThisPhase=false;
        }
      }
      this.drawImmediate('player');
      this.transitioning=false;
      this.render();
      this.banner('Player Phase');
      this.startTimer();
      this.tutorialAdvance(this.tutorial.step+1);
      return true;
    },

    ensureGuideOverlay(){
      let overlay=$('guideOverlay');
      if(overlay)return overlay;

      overlay=document.createElement('section');
      overlay.id='guideOverlay';
      overlay.className='collection-overlay guide-overlay';
      overlay.hidden=true;
      overlay.setAttribute('role','dialog');
      overlay.setAttribute('aria-modal','true');
      overlay.setAttribute('aria-labelledby','guideTitle');
      overlay.innerHTML=`
        <div class="collection-shell guide-shell">
          <header class="collection-head guide-head">
            <div>
              <span class="collection-kicker">Rule Reference</span>
              <h1 id="guideTitle">Guide</h1>
            </div>
            <button class="collection-close" id="guideCloseBtn" type="button" aria-label="Close guide">×</button>
          </header>

          <div class="guide-body">
            <section class="guide-card guide-card-primary">
              <span class="guide-number">01</span>
              <h2>Tujuan Permainan</h2>
              <p>Turunkan HP Hand musuh ke 0. Kalau HP Hand kamu habis duluan, kamu kalah. Kalau dua-duanya mencapai 0 pada resolusi yang sama, hasilnya draw.</p>
            </section>

            <section class="guide-card">
              <span class="guide-number">02</span>
              <h2>Turn & Energy</h2>
              <ul class="guide-list">
                <li>Player dan enemy bergantian menjalankan phase.</li>
                <li>Awal Player Phase: max energy naik 1 sampai batas 10, lalu energy terisi penuh.</li>
                <li>Kartu tidak bisa dimainkan kalau cost lebih besar dari energy aktif.</li>
                <li>Kartu yang berhasil dimainkan mengurangi energy sebesar cost kartu tersebut.</li>
              </ul>
            </section>

            <section class="guide-card">
              <span class="guide-number">03</span>
              <h2>Hand, Deck, Discard</h2>
              <ul class="guide-list">
                <li>Setiap awal turn, pemain aktif draw 1 kartu jika deck masih ada dan hand belum penuh.</li>
                <li>Kartu yang mati, spell instant yang selesai, trap yang terpicu, dan spell yang expired masuk Discard.</li>
                <li>Klik discard pile untuk melihat kartu yang sudah masuk. Kartu terbaru tampil paling awal.</li>
              </ul>
            </section>

            <section class="guide-card">
              <span class="guide-number">04</span>
              <h2>Board & Row</h2>
              <ul class="guide-list">
                <li>Creature punya 2 row: Front Row dan Back Row.</li>
                <li>Melee hanya bisa summon ke Front Row.</li>
                <li>Ranged hanya bisa summon ke Back Row.</li>
                <li>Flyer bisa summon ke Front atau Back Row.</li>
                <li>Setiap lane punya urutan target sendiri.</li>
              </ul>
            </section>

            <section class="guide-card">
              <span class="guide-number">05</span>
              <h2>Summon Creature</h2>
              <ul class="guide-list">
                <li>Creature hanya bisa summon ke slot kosong yang valid.</li>
                <li>Creature baru summon tidak bisa attack pada turn yang sama.</li>
                <li>Creature baru summon juga tidak bisa dipindahkan pada turn yang sama.</li>
                <li>Quick adalah pengecualian untuk attack: creature Quick bisa langsung attack setelah summon.</li>
              </ul>
            </section>

            <section class="guide-card">
              <span class="guide-number">06</span>
              <h2>Move Creature</h2>
              <ul class="guide-list">
                <li>Creature bisa dipindahkan 1 kali per phase ke slot kosong yang valid.</li>
                <li>Setelah move, creature tidak bisa attack pada phase yang sama.</li>
                <li>Creature tetap mengikuti aturan row: melee ke Front, ranged ke Back, flyer ke Front atau Back.</li>
                <li>Creature dengan Flex Row bisa berpindah lebih bebas di row pemiliknya.</li>
              </ul>
            </section>

            <section class="guide-card">
              <span class="guide-number">07</span>
              <h2>Attack Lane</h2>
              <ul class="guide-list">
                <li>Creature menyerang target di lane yang sama.</li>
                <li>Front Row musuh harus diserang dulu jika ada creature di lane itu.</li>
                <li>Jika Front kosong tapi Back berisi creature, targetnya Back Row.</li>
                <li>Jika lane musuh kosong, damage langsung masuk ke HP Hand musuh.</li>
              </ul>
            </section>

            <section class="guide-card">
              <span class="guide-number">08</span>
              <h2>Combat Math</h2>
              <ul class="guide-list">
                <li>Attacker memberi damage sebesar Attack ke defender.</li>
                <li>Defender memberi Counter hanya kalau defender masih hidup setelah menerima damage.</li>
                <li>Shield menyerap 1 instance damage dan mengurangi charge Shield.</li>
                <li>Jika creature HP-nya 0 atau kurang, creature masuk Discard kecuali Rebirth aktif.</li>
              </ul>
            </section>

            <section class="guide-card">
              <span class="guide-number">09</span>
              <h2>Spell Area</h2>
              <ul class="guide-list">
                <li>Row spell dimainkan pada spell slot row, lalu memengaruhi seluruh creature pada row itu.</li>
                <li>Column spell dimainkan pada Shared Spell slot, lalu memengaruhi creature dalam kolom yang sama.</li>
                <li>Friendly row berarti row milikmu. Enemy row berarti row musuh.</li>
                <li>Dispel menghancurkan spell lawan yang menetap di board.</li>
              </ul>
            </section>

            <section class="guide-card">
              <span class="guide-number">10</span>
              <h2>Spell Duration</h2>
              <ul class="guide-list">
                <li>Instant: efek langsung selesai, lalu kartu masuk Discard.</li>
                <li>Phase: buff sementara sampai phase pemilik efek berakhir.</li>
                <li>Ongoing: menetap beberapa turn dan memberi efek selama masih ada.</li>
                <li>Shared: menetap di tengah board dan berlaku untuk kedua pemain pada kolom itu.</li>
                <li>Trap: tertutup sampai terpicu atau durasinya habis.</li>
              </ul>
            </section>

            <section class="guide-card">
              <span class="guide-number">11</span>
              <h2>Trap</h2>
              <ul class="guide-list">
                <li>Trap yang dipasang musuh terlihat sebagai card back.</li>
                <li>Trap row terpicu saat creature pada row itu diserang.</li>
                <li>Trap Rune memberi damage ke attacker.</li>
                <li>Mirror Barrier memberi Shield ke defender sebelum damage dihitung.</li>
                <li>Trap masuk Discard setelah terpicu.</li>
              </ul>
            </section>

            <section class="guide-card guide-card-wide">
              <span class="guide-number">12</span>
              <h2>Passive & Ability</h2>
              <div class="guide-icon-grid guide-icon-grid-wide">
                <span><b>⚡</b><strong>Quick</strong><em>Bisa attack pada turn summon.</em></span>
                <span><b>🛡</b><strong>Shield</strong><em>Menyerap 1 instance damage.</em></span>
                <span><b>☠</b><strong>Poison / Venom</strong><em>Venom memberi Poison ke target yang selamat. Poison memberi damage awal turn dan berkurang 1.</em></span>
                <span><b>◐</b><strong>Stealth</strong><em>Tag stealth pada kartu. Digunakan sebagai ability/status informatif kartu.</em></span>
                <span><b>↺</b><strong>Rebirth</strong><em>Sekali saja, saat mati hidup kembali di slot yang sama dengan 1 HP.</em></span>
                <span><b>✚</b><strong>Regen</strong><em>Heal creature pada awal turn pemiliknya.</em></span>
                <span><b>◆</b><strong>Pierce</strong><em>Jika membunuh defender, sebagian excess damage bisa tembus ke Hand.</em></span>
                <span><b>♥</b><strong>Lifesteal</strong><em>Setelah memberi combat damage, heal HP Hand pemiliknya.</em></span>
                <span><b>✹</b><strong>Splash</strong><em>Memberi damage tambahan ke creature sebelah target pada row yang sama.</em></span>
                <span><b>×</b><strong>Execute</strong><em>Bonus attack saat menyerang creature yang sudah terluka.</em></span>
                <span><b>◎</b><strong>Sniper</strong><em>Bonus attack saat menyerang target di Back Row.</em></span>
                <span><b>▲</b><strong>Fury</strong><em>Bonus attack saat HP creature sudah setengah atau kurang.</em></span>
                <span><b>⇄</b><strong>Flex Row</strong><em>Bisa ditempatkan atau dipindahkan lebih fleksibel antara Front dan Back milik pemiliknya.</em></span>
                <span><b>✚</b><strong>Row Heal on Summon</strong><em>Saat summon, heal creature satu row milikmu.</em></span>
                <span><b>✚</b><strong>Hand Heal on Summon</strong><em>Saat summon, heal HP Hand pemiliknya.</em></span>
              </div>
            </section>

            <section class="guide-card guide-card-wide">
              <span class="guide-number">13</span>
              <h2>Spell Effect Examples</h2>
              <ul class="guide-list guide-list-columns">
                <li>Fire Bolt: damage semua creature pada row lawan.</li>
                <li>Healing Light: heal semua creature pada row milikmu.</li>
                <li>Renewal: heal dan hapus Poison pada row milikmu.</li>
                <li>Blessing: +Attack, +Max HP, dan heal sementara pada row.</li>
                <li>Battle Cry: +Attack sementara pada row.</li>
                <li>Siege Order: +Pierce sementara pada row.</li>
                <li>Weakening Curse: ongoing -Attack pada row lawan.</li>
                <li>Poison Mist: ongoing damage awal turn pada row lawan.</li>
                <li>Silence Seal: ongoing -Counter pada row lawan.</li>
                <li>Rain / War Drums / Sacred Ground: shared buff kolom untuk kedua pemain.</li>
                <li>Arcane Well / Ember Field: efek awal turn pada kolom.</li>
              </ul>
            </section>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      $('guideCloseBtn').addEventListener('click',()=>this.closeGuideOverlay());
      overlay.addEventListener('click',event=>{
        if(event.target===overlay)this.closeGuideOverlay();
      });
      return overlay;
    },

    openGuideOverlay(){
      const overlay=this.ensureGuideOverlay();
      this.closeCollectionOverlay();
      this.cancelMode(false);
      overlay.hidden=false;
      document.body.classList.add('guide-open');

      requestAnimationFrame(()=>{
        overlay.classList.add('open');
        $('guideCloseBtn')?.focus({preventScroll:true});
      });
    },

    closeGuideOverlay(){
      const overlay=$('guideOverlay');
      if(!overlay||overlay.hidden)return;
      window.TCGSFX?.play?.('ui_close');
      overlay.classList.remove('open');
      document.body.classList.remove('guide-open');
      overlay.hidden=true;
    },

    ensureCollectionOverlay(){
      let overlay=$('collectionOverlay');
      if(overlay)return overlay;

      overlay=document.createElement('section');
      overlay.id='collectionOverlay';
      overlay.className='collection-overlay';
      overlay.hidden=true;
      overlay.setAttribute('role','dialog');
      overlay.setAttribute('aria-modal','true');
      overlay.setAttribute('aria-labelledby','collectionTitle');
      overlay.innerHTML=`
        <div class="collection-shell">
          <header class="collection-head">
            <div>
              <span class="collection-kicker">Card Library</span>
              <h1 id="collectionTitle">Collection</h1>
            </div>
            <button class="collection-close" id="collectionCloseBtn" type="button" aria-label="Close collection">×</button>
          </header>

          <div class="collection-toolbar">
            <input class="collection-search" id="collectionSearch" type="search" placeholder="Search card, faction, effect..." autocomplete="off" />
            <select id="collectionType" aria-label="Filter card type">
              <option value="all">All Cards</option>
              <option value="creature">Creatures</option>
              <option value="spell">Spells</option>
            </select>
            <select id="collectionFaction" aria-label="Filter faction"></select>
            <select id="collectionSort" aria-label="Sort cards">
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

          <div class="collection-tag-panel" id="collectionTagPanel">
            <div class="collection-active-tags" id="collectionActiveTags" aria-label="Active tag filters"></div>
            <div class="collection-tag-list" id="collectionTagList" aria-label="Ability tag filters"></div>
          </div>

          <div class="collection-body">
            <section class="collection-grid-wrap">
              <div class="collection-count" id="collectionCount">0 cards</div>
              <div class="collection-grid" id="collectionGrid"></div>
            </section>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      $('collectionCloseBtn').addEventListener('click',()=>this.closeCollectionOverlay());
      overlay.addEventListener('click',event=>{
        if(event.target===overlay)this.closeCollectionOverlay();
      });
      $('collectionSearch').addEventListener('input',()=>this.renderCollection());
      $('collectionType').addEventListener('change',()=>this.renderCollection());
      $('collectionFaction').addEventListener('change',()=>this.renderCollection());
      $('collectionSort').addEventListener('change',()=>this.renderCollection());
      $('collectionTagList').addEventListener('click',event=>{
        const button=event.target.closest('button[data-tag]');
        if(!button)return;
        this.toggleCollectionTag(button.dataset.tag);
      });
      $('collectionActiveTags').addEventListener('click',event=>{
        const button=event.target.closest('button[data-tag]');
        if(!button)return;
        this.removeCollectionTag(button.dataset.tag);
      });
      this.populateCollectionFactions();
      this.renderCollectionTags();
      return overlay;
    },

    populateCollectionFactions(){
      const select=$('collectionFaction');
      if(!select)return;

      const factions=[...new Set((window.CARD_DEFS||[]).map(card=>card.faction).filter(Boolean))].sort();
      select.innerHTML=[
        '<option value="all">All Factions</option>',
        ...factions.map(faction=>`<option value="${escapeHTML(faction)}">${escapeHTML(faction)}</option>`)
      ].join('');
    },

    openCollectionOverlay(){
      const overlay=this.ensureCollectionOverlay();
      window.TCGSFX?.play?.('collection_open');
      this.cancelMode(false);
      overlay.hidden=false;
      document.body.classList.add('collection-open');

      this.renderCollection();
      requestAnimationFrame(()=>{
        overlay.classList.add('open');
        $('collectionSearch')?.focus({preventScroll:true});
      });
    },

    closeCollectionOverlay(){
      const overlay=$('collectionOverlay');
      if(!overlay || overlay.hidden)return;
      window.TCGSFX?.play?.('collection_close');
      overlay.classList.remove('open');
      document.body.classList.remove('collection-open');
      overlay.hidden=true;
    },

    collectionTypeText(card){
      if(card.category==='creature'){
        if(card.creatureType==='melee')return 'Creature Jarak Dekat';
        if(card.creatureType==='ranged')return 'Creature Jarak Jauh';
        return 'Creature Flyer';
      }

      if(card.spellType==='instant')return 'Spell Instan';
      if(card.spellType==='trap')return 'Spell Perangkap';
      if(card.spellType==='ongoing')return 'Spell Berkelanjutan';
      if(card.spellType==='shared')return 'Shared Spell';
      return 'Kartu Spell';
    },

    collectionRule(card){
      if(card.description)return card.description;
      if(card.category==='creature'){
        return card.creatureType==='melee'
          ? 'Tempatkan creature ini di Baris Depan.'
          : 'Tempatkan creature ini di Baris Belakang.';
      }
      return 'Deskripsi lengkap untuk kartu ini belum tersedia.';
    },

    collectionSpellAreaInfo(card){
      if(card.spellType==='shared'||card.scope==='column')return{key:'shared',icon:'↕',label:'Shared Column'};
      if(card.scope==='spell_slot'||card.effect==='destroy_spell')return{key:'spell-slot',icon:'✖',label:'Spell Target'};
      if(card.scope==='row'){
        if(card.placementSide==='enemy')return{key:'enemy-row',icon:'⇥',label:'Enemy Row'};
        if(card.placementSide==='either')return{key:'any-row',icon:'⇄',label:'Any Row'};
        return{key:'friendly-row',icon:'⇤',label:'Your Row'};
      }
      return{key:'target',icon:'◇',label:'Target'};
    },

    collectionSpellTimingInfo(card){
      if(card.spellType==='trap')return{key:'trap',icon:'⚠',label:'Trap'};
      if(card.spellType==='shared')return{key:'field',icon:'∞',label:'Field'};
      if(card.spellType==='ongoing')return{key:'ongoing',icon:'∞',label:'Ongoing'};
      return{key:'instant',icon:'⚡',label:'Instant'};
    },

    collectionAbilityIconItems(card){
      if(card.category==='spell'){
        return[
          this.collectionSpellAreaInfo(card),
          this.collectionSpellTimingInfo(card)
        ];
      }

      const items=[];
      if(card.quick)items.push({key:'quick',icon:'⚡',label:'Quick'});
      if(card.shield)items.push({key:'shield',icon:'🛡',label:'Shield',value:card.shield});
      if(card.venom)items.push({key:'poison',icon:'☠',label:'Poison',value:card.venom});
      if(card.stealth)items.push({key:'stealth',icon:'◐',label:'Stealth'});
      if(card.rebirth)items.push({key:'rebirth',icon:'↺',label:'Rebirth'});
      if(card.regen)items.push({key:'regen',icon:'✚',label:'Regeneration',value:card.regen});
      if(card.pierce)items.push({key:'pierce',icon:'◆',label:'Pierce',value:card.pierce});
      if(card.lifesteal)items.push({key:'lifesteal',icon:'♥',label:'Lifesteal',value:card.lifesteal});
      if(card.splash)items.push({key:'splash',icon:'✹',label:'Splash',value:card.splash});
      if(card.execute)items.push({key:'execute',icon:'×',label:'Execute',value:card.execute});
      if(card.sniper)items.push({key:'sniper',icon:'◎',label:'Sniper',value:card.sniper});
      if(card.fury)items.push({key:'fury',icon:'▲',label:'Fury',value:card.fury});
      if(card.flexRow)items.push({key:'flex-row',icon:'⇄',label:'Flex Row'});
      if(card.rowHealOnSummon)items.push({key:'heal-row',icon:'✚',label:'Heal Row on Summon',value:card.rowHealOnSummon});
      if(card.handHealOnSummon)items.push({key:'heal-hand',icon:'✚',label:'Heal Hand on Summon',value:card.handHealOnSummon});
      return items;
    },

    collectionAbilityIconHTML(items,className){
      if(!items.length)return '';
      const spellKeys=new Set(['target','shared','spell-slot','enemy-row','any-row','friendly-row','trap','field','ongoing','instant']);
      return `
        <div class="${className}">
          ${items.map(item=>`
            <span class="inspect-passive-chip passive-${escapeHTML(item.key)}" title="${escapeHTML(item.label)}">
              <b>${escapeHTML(item.icon)}</b>
              ${item.value?`<em>${escapeHTML(item.value)}</em>`:''}
              ${className==='inspect-ability-grid'&&!spellKeys.has(item.key)?`<strong>${escapeHTML(item.label)}</strong>`:''}
            </span>
          `).join('')}
        </div>
      `;
    },

    collectionGridAbilityHTML(card){
      const items=this.collectionAbilityIconItems(card);
      if(!items.length)return '';

      return `
        <span class="collection-ability-icons" aria-hidden="true">
          ${items.slice(0,5).map(item=>`
            <span class="collection-ability-icon passive-${escapeHTML(item.key)}" title="${escapeHTML(item.label)}">
              <b>${escapeHTML(item.icon)}</b>
              ${item.value?`<em>${escapeHTML(item.value)}</em>`:''}
            </span>
          `).join('')}
        </span>
      `;
    },

    collectionTagCatalog(){
      const map=new Map();

      for(const card of window.CARD_DEFS||[]){
        for(const item of this.collectionAbilityIconItems(card)){
          if(!item?.key)continue;
          if(!map.has(item.key)){
            map.set(item.key,{
              key:item.key,
              icon:item.icon,
              label:item.label
            });
          }
        }
      }

      return [...map.values()].sort((a,b)=>a.label.localeCompare(b.label));
    },

    collectionCardTagKeys(card){
      return new Set(this.collectionAbilityIconItems(card).map(item=>item.key));
    },

    toggleCollectionTag(tag){
      if(!tag)return;
      if(this.collectionActiveTags.has(tag))this.collectionActiveTags.delete(tag);
      else this.collectionActiveTags.add(tag);
      this.renderCollection();
    },

    removeCollectionTag(tag){
      if(!tag)return;
      this.collectionActiveTags.delete(tag);
      this.renderCollection();
    },

    clearCollectionTags(){
      this.collectionActiveTags.clear();
      this.renderCollection();
    },

    renderCollectionTags(){
      const list=$('collectionTagList');
      const active=$('collectionActiveTags');
      if(!list||!active)return;

      const catalog=this.collectionTagCatalog();
      const activeItems=catalog.filter(item=>this.collectionActiveTags.has(item.key));

      active.classList.toggle('has-active-tags',activeItems.length>0);
      active.innerHTML=activeItems.length
        ? `
          <span class="collection-tag-label">Active</span>
          ${activeItems.map(item=>`
            <button class="collection-tag-chip active" type="button" data-tag="${escapeHTML(item.key)}" aria-label="Remove ${escapeHTML(item.label)} filter">
              <b>${escapeHTML(item.icon)}</b>
              <span>${escapeHTML(item.label)}</span>
              <em>×</em>
            </button>
          `).join('')}
          <button class="collection-tag-clear" type="button" data-tag="__clear">Clear</button>
        `
        : '';

      active.querySelector('[data-tag="__clear"]')?.addEventListener('click',event=>{
        event.stopPropagation();
        this.clearCollectionTags();
      });

      list.innerHTML=catalog.map(item=>`
        <button class="collection-tag-chip ${this.collectionActiveTags.has(item.key)?'selected':''}" type="button" data-tag="${escapeHTML(item.key)}">
          <b>${escapeHTML(item.icon)}</b>
          <span>${escapeHTML(item.label)}</span>
        </button>
      `).join('');
    },

    collectionMetaHTML(rows){
      return rows.map(([label,value])=>`
        <div class="inspect-meta-item">
          <span>${escapeHTML(label)}</span>
          <strong>${escapeHTML(value)}</strong>
        </div>
      `).join('');
    },

    collectionCardHTML(card){
      const stats=card.category==='creature'
        ? `<span class="atk">⚔ ${card.atk||0}</span><span class="counter">↩ ${card.counter||0}</span><span class="hp">♥ ${card.hp||0}</span>`
        : `<span>${escapeHTML((card.spellType||'spell').toUpperCase())}</span>`;

      return `
        <button class="collection-card ${escapeHTML(card.category)}" type="button" data-card-key="${escapeHTML(card.key)}" title="Klik untuk detail">
          <span class="collection-cost">${card.cost||0}</span>
          <span class="collection-art"><img src="${escapeHTML(card.img)}" alt="" onerror="this.style.display='none'"></span>
          <span class="collection-info">
            <strong>${escapeHTML(card.name)}</strong>
            <small>${escapeHTML(card.faction||'Neutral')} · ${escapeHTML(card.category==='creature'?card.creatureType:card.spellType)}</small>
            ${this.collectionGridAbilityHTML(card)}
          </span>
          <span class="collection-stats">${stats}</span>
        </button>
      `;
    },

    collectionDetailHTML(card){
      if(!card){
        return '<div class="collection-empty">No cards found.</div>';
      }

      const type=this.collectionTypeText(card);
      const rule=this.collectionRule(card);
      const abilityIcons=this.collectionAbilityIconItems(card);
      const stats=card.category==='creature'
        ? `
          <div class="inspect-card-stats">
            <div class="inspect-stat attack">⚔ ${card.atk||0}</div>
            <div class="inspect-stat health">♥ ${card.hp||0}</div>
            ${card.counter?`<div class="inspect-stat counter">↩ ${card.counter}</div>`:''}
          </div>
        `
        : `
          <div class="inspect-card-stats">
            ${abilityIcons.map(item=>`
              <div class="inspect-stat spell-${escapeHTML(item.key)}" title="${escapeHTML(item.label)}">
                ${escapeHTML(item.icon)}
              </div>
            `).join('')}
          </div>
        `;
      return `
        <article class="collection-detail-card ${escapeHTML(card.category)}">
          <div class="collection-inspect-preview">
            <article class="inspect-card ${card.category==='spell'?'spell':''}">
              <div class="inspect-card-art">
                <img src="${escapeHTML(card.img)}" alt="${escapeHTML(card.name)}" onerror="this.style.display='none'">
              </div>

              <div class="inspect-card-cost">${escapeHTML(card.cost||0)}</div>

              <div class="inspect-card-body">
                <div class="inspect-card-name">${escapeHTML(card.name)}</div>
                <div class="inspect-card-type">${escapeHTML(type)}</div>
                <div class="inspect-card-description">${escapeHTML(rule)}</div>
              </div>

              ${stats}
              ${this.collectionAbilityIconHTML(abilityIcons,'inspect-passive-icons')}
            </article>
          </div>
        </article>
      `;
    },

    collectionSortValue(card,sort){
      if(sort.startsWith('cost'))return card.cost||0;
      if(sort.startsWith('attack'))return card.category==='creature'?(card.atk||0):0;
      if(sort.startsWith('hp'))return card.category==='creature'?(card.hp||0):0;
      if(sort.startsWith('counter'))return card.category==='creature'?(card.counter||0):0;
      if(sort.startsWith('name'))return card.name||'';
      if(sort.startsWith('type'))return card.category==='creature'?(card.creatureType||''):(card.spellType||'');
      if(sort.startsWith('faction'))return card.faction||'';
      return card.cost||0;
    },

    sortCollectionCards(cards){
      const sort=$('collectionSort')?.value||'cost_asc';
      const direction=sort.endsWith('_desc')?-1:1;

      return cards.slice().sort((a,b)=>{
        const av=this.collectionSortValue(a,sort);
        const bv=this.collectionSortValue(b,sort);

        if(typeof av==='number'||typeof bv==='number'){
          const diff=((Number(av)||0)-(Number(bv)||0))*direction;
          if(diff)return diff;
        }else{
          const diff=String(av).localeCompare(String(bv))*direction;
          if(diff)return diff;
        }

        return (a.cost-b.cost)||a.name.localeCompare(b.name);
      });
    },

    collectionSearchTerms(card){
      const terms=[
        card.name,
        card.faction,
        card.category,
        card.creatureType,
        card.spellType,
        card.scope,
        card.effect,
        card.description,
        this.collectionTypeText(card)
      ];

      return terms;
    },

    filteredCollectionCards(){
      const query=($('collectionSearch')?.value||'').trim().toLowerCase();
      const type=$('collectionType')?.value||'all';
      const faction=$('collectionFaction')?.value||'all';
      const activeTags=[...this.collectionActiveTags];

      const cards=(window.CARD_DEFS||[])
        .filter(card=>type==='all'||card.category===type)
        .filter(card=>faction==='all'||card.faction===faction)
        .filter(card=>{
          if(!activeTags.length)return true;
          const tags=this.collectionCardTagKeys(card);
          return activeTags.every(tag=>tags.has(tag));
        })
        .filter(card=>{
          if(!query)return true;
          return this.collectionSearchTerms(card)
            .some(value=>String(value||'').toLowerCase().includes(query));
        });

      return this.sortCollectionCards(cards);
    },

    renderCollection(){
      const grid=$('collectionGrid');
      const count=$('collectionCount');
      if(!grid||!count)return;

      const cards=this.filteredCollectionCards();
      this.renderCollectionTags();
      grid.innerHTML=cards.map(card=>this.collectionCardHTML(card)).join('');
      count.textContent=`${cards.length} / ${(window.CARD_DEFS||[]).length} cards`;
    },

    resetTutorialUI(){
      if(this.tutorial?.focusTimer)clearTimeout(this.tutorial.focusTimer);
      this.tutorial=null;
      document.body.classList.remove('tutorial-active');
      document.querySelectorAll('.tutorial-highlight,.tutorial-allowed,.tutorial-action-highlight').forEach(element=>element.classList.remove('tutorial-highlight','tutorial-allowed','tutorial-action-highlight'));
      document.querySelectorAll('.tutorial-hand-focus').forEach(element=>element.classList.remove('tutorial-hand-focus'));
      const coach=$('tutorialCoach');
      if(coach)coach.hidden=true;
      const focus=$('tutorialFocus');
      if(focus)focus.hidden=true;
    },

    prepareMenuState(renderState=true){
      this.resetTutorialUI();
      this.hideEndGameOverlay();
      this.hideReviewBoardMenu();
      this.hideInitiativeOverlay();
      this.stopTimer();
      this.cleanDrag();
      if(this.state)this.cancelMode(false);
      window.TCGSFX?.stopMusic?.();
      this.locked=true;
      this.transitioning=false;
      this.state=this.makeState();
      this.state.phase='menu';
      this.state.playerEnergy=0;
      this.state.enemyEnergy=0;
      this.state.playerMaxEnergy=0;
      this.state.enemyMaxEnergy=0;
      this.state.bgmMode=null;

      const log=$('log');
      if(log)log.innerHTML='';

      if(renderState)this.render();
    },

    ensureInitiativeOverlay(){
      let overlay=$('initiativeOverlay');
      if(overlay)return overlay;

      overlay=document.createElement('section');
      overlay.id='initiativeOverlay';
      overlay.className='initiative-overlay';
      overlay.hidden=true;
      overlay.setAttribute('role','dialog');
      overlay.setAttribute('aria-modal','true');
      overlay.setAttribute('aria-labelledby','initiativeTitle');
      overlay.innerHTML=`
        <div class="initiative-card">
          <span class="initiative-kicker">Draw Phase</span>
          <h1 id="initiativeTitle">Choose Initiative</h1>
          <p>Pilih tempo awal duel. Jalan kedua mendapat bonus energy sementara pada turn pertama.</p>
          <div class="initiative-actions">
            <button class="initiative-choice initiative-first" id="initiativeFirstBtn" type="button">
              <span>Go First</span>
              <strong>Mulai duluan dengan Energy normal 1/1.</strong>
            </button>
            <button class="initiative-choice initiative-second" id="initiativeSecondBtn" type="button">
              <span>Go Second</span>
              <strong>Enemy mulai duluan. Turn pertamamu mendapat +1 Energy sementara.</strong>
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      $('initiativeFirstBtn').addEventListener('click',()=>this.chooseInitiative('first'));
      $('initiativeSecondBtn').addEventListener('click',()=>this.chooseInitiative('second'));
      return overlay;
    },

    showInitiativeOverlay(){
      const overlay=this.ensureInitiativeOverlay();
      overlay.hidden=false;
      requestAnimationFrame(()=>{
        overlay.classList.add('show');
        $('initiativeFirstBtn')?.focus({preventScroll:true});
      });
    },

    hideInitiativeOverlay(){
      const overlay=$('initiativeOverlay');
      if(!overlay)return;
      overlay.classList.remove('show');
      overlay.hidden=true;
    },

    async chooseInitiative(choice){
      if(!this.state || this.state.phase!=='draw')return;

      window.TCGSFX?.play?.('ui_click');
      this.hideInitiativeOverlay();
      this.state.initiative=choice;
      this.locked=false;

      if(choice==='first'){
        this.state.phase='player';
        this.state.playerEnergy=this.state.playerMaxEnergy;
        this.transitioning=false;
        this.banner('Player Phase');
        this.render();
        this.startTimer();
        this.updateBattleMusic?.();
        this.log('Player memilih Go First.');
        return;
      }

      this.state.playerOpeningResponseTurn=true;
      this.state.playerOpeningEnergyBonus=1;
      this.state.playerSkipOpeningDraw=true;
      this.state.enemySkipOpeningDraw=true;
      this.transitioning=true;
      this.stopTimer();
      this.cancelMode(false);
      this.state.phase='enemy';
      this.render();
      this.banner('Enemy Phase');
      this.updateBattleMusic?.();
      this.log('Player memilih Go Second: turn pertama mendapat +1 Energy sementara.');
      await sleep(650);
      await this.startEnemyTurn();
    },

    async newGame(options={}){
      this.resetTutorialUI();
      window.TCGSFX?.play?.('new_game');
      this.hideEndGameOverlay();
      this.hideReviewBoardMenu();
      this.hideInitiativeOverlay();
      this.stopTimer();this.cleanDrag();this.locked=false;this.transitioning=false;
      this.closeMainMenu(false);
      this.state=this.makeState();
      const campaignStage=this.campaignStage(options.campaignStageId);
      if(campaignStage){
        this.state.campaign={
          stageId:campaignStage.id,
          stageNumber:campaignStage.number,
          stageName:campaignStage.name,
          difficulty:campaignStage.difficulty,
          aiPlaysBonus:campaignStage.aiPlaysBonus||0
        };
        this.state.enemyHp=campaignStage.enemyHp||this.state.enemyHp;
      }
      this.state.playerDeck=window.TCGDeckStorage
        ? window.TCGDeckStorage.createDeckFromSaved('player')
        : createDeck('player');
      this.state.enemyDeck=campaignStage
        ? this.createDeckFromKeys(campaignStage.deck,'enemy')
        : createDeck('enemy');
      this.prepareOpeningDeck('player');
      this.prepareOpeningDeck('enemy');
      this.state.playerHand=[];
      this.state.enemyHand=[];
      const log=$('log');
      if(log)log.innerHTML='';
      this.log(campaignStage
        ? `Campaign Stage ${campaignStage.number}: ${campaignStage.name} started.`
        : 'New match started.'
      );
      this.transitioning=true;
      this.render();
      this.banner(campaignStage?`Stage ${campaignStage.number}`:'Draw Phase');
      await sleep(220);
      for(let i=0;i<5;i++){
        await Promise.all([
          this.drawAnimated('player'),
          this.drawAnimated('enemy')
        ]);
        await sleep(80);
      }
      this.transitioning=false;
      this.locked=true;
      this.state.phase='draw';
      this.state.playerEnergy=this.state.playerMaxEnergy;
      this.state.enemyEnergy=this.state.enemyMaxEnergy;
      this.render();
      this.banner('Draw Phase');
      this.showInitiativeOverlay();
    },

    drawImmediate(owner){
      const deck=owner==='player'?this.state.playerDeck:this.state.enemyDeck;
      const hand=owner==='player'?this.state.playerHand:this.state.enemyHand;
      if(deck.length&&hand.length<8) hand.push(deck.shift());
    },

    ensureStarterHand(owner){
      const deck=owner==='player'?this.state.playerDeck:this.state.enemyDeck;
      const hand=owner==='player'?this.state.playerHand:this.state.enemyHand;
      if(hand.some(c=>c.cost<=1)) return;
      const idx=deck.findIndex(c=>c.cost<=1);
      if(idx>=0&&hand.length){const starter=deck.splice(idx,1)[0];deck.push(hand.pop());hand.push(starter)}
    },

    prepareOpeningDeck(owner){
      const deck=owner==='player'?this.state.playerDeck:this.state.enemyDeck;
      if(deck.slice(0,5).some(c=>c.cost<=1)) return;
      const idx=deck.findIndex(c=>c.cost<=1);
      if(idx<0) return;
      const swapIndex=Math.min(4,deck.length-1);
      [deck[swapIndex],deck[idx]]=[deck[idx],deck[swapIndex]];
    },

    async drawAnimated(owner){
      const deck=owner==='player'?this.state.playerDeck:this.state.enemyDeck;
      const hand=owner==='player'?this.state.playerHand:this.state.enemyHand;
      if(!deck.length||hand.length>=8) return false;
      const deckEl=$(owner==='player'?'playerDeckPile':'enemyDeckPile');
      await TCGFX.drawCard(deckEl,$('hand'),owner);
      hand.push(deck.shift());
      this.render();
      if(owner==='player'){
        const last=$('hand').lastElementChild;
        if(last){last.animate([{transform:'translateY(18px) scale(.84)',opacity:.35},{transform:'translateY(-10px) scale(1.08)',opacity:1,offset:.7},{transform:'translateY(0) scale(1)',opacity:1}],{duration:380,easing:'ease-out'})}
      }
      return true;
    },

    getCardInHand(owner,id){
      return (owner==='player'?this.state.playerHand:this.state.enemyHand).find(c=>c.id===id)||null;
    },
    removeFromHand(owner,id){
      const hand=owner==='player'?this.state.playerHand:this.state.enemyHand;
      const i=hand.findIndex(c=>c.id===id);return i>=0?hand.splice(i,1)[0]:null;
    },
    discard(card){if(card)(card.owner==='player'?this.state.playerDiscard:this.state.enemyDiscard).push(card)},
    at(row,lane){return this.state.board[key(row,lane)]||null},
    place(row,lane,card){card.placedAt=this.state.placedSequence++;this.state.board[key(row,lane)]=card},
    remove(row,lane){const k=key(row,lane),c=this.state.board[k];delete this.state.board[k];return c},
    locateCard(id){
      for(const [k,c] of Object.entries(this.state.board)) if(c?.id===id){const cut=k.lastIndexOf('_');return {row:k.slice(0,cut),lane:Number(k.slice(cut+1)),card:c}}
      return null;
    },

    currentEnergy(owner){return owner==='player'?this.state.playerEnergy:this.state.enemyEnergy},
    spendEnergy(owner,n){if(owner==='player')this.state.playerEnergy-=n;else this.state.enemyEnergy-=n},
    sharedSpells(){return [0,1,2].map(i=>this.at('sharedSpell',i)).filter(Boolean)},
    effectiveAttack(card){
      if(!card||card.category!=='creature') return 0;
      let value=card.atk+(card.atkBonus||0);
      for(const spell of this.sharedSpells()){
        if(spell.effect==='ranged_aura'&&card.creatureType==='ranged') value+=spell.value;
        if(spell.effect==='melee_aura'&&card.creatureType==='melee') value+=spell.value;
      }
      return Math.max(0,value);
    },
    arcaneEnergyBonus(){return this.sharedSpells().filter(c=>c.effect==='energy_aura').reduce((s,c)=>s+c.value,0)},

    cardHTML(card,extra=''){
      const enemy=card.owner==='enemy'?'enemy':'';
      const spell=card.category==='spell'?'spell-card':'';
      const faceDown=card.spellType==='trap'&&card.owner==='enemy'?'face-down':'';
      const selected=this.state.selectedHand===card.id?'hand-selected':'';
      const art=`<div class="art"><img src="${card.img}" alt="${card.name}" draggable="false" onerror="this.style.display='none'"></div>`;
      let stats='';
      if(card.category==='creature') stats=`<div class="stats"><span class="atk">⚔ ${this.effectiveAttack(card)}</span><span class="hp">♥ ${card.hp}</span></div>`;
      else stats=`<div class="stats"><span class="atk">✦ ${card.value||0}</span><span class="hp">${card.spellType==='instant'?'NOW':card.spellType.toUpperCase()}</span></div>`;
      return `<article class="card ${enemy} ${spell} ${faceDown} ${selected} ${extra}" data-card-id="${card.id}" data-owner="${card.owner}">
        <div class="cost">${card.cost}</div>${art}
        <div class="card-info"><div class="name">${card.name}</div><div class="type">${card.category==='creature'?card.creatureType:card.spellType}</div></div>${stats}
      </article>`;
    },

    render(){
      const s=this.state;
      $('phaseText').textContent=s.phase==='player'?'Your Phase':s.phase==='enemy'?'Enemy Phase':s.phase==='draw'?'Draw Phase':'Game Over';
      $('turnText').textContent=`Turn ${s.turn}`;
      $('turnText').hidden=true;
      $('turnText').setAttribute('aria-hidden','true');
      $('playerHp').textContent=Math.max(0,s.playerHp);$('enemyHp').textContent=Math.max(0,s.enemyHp);
      $('energy').textContent=s.playerEnergy;$('maxEnergy').textContent=Math.min(10,s.playerMaxEnergy+this.arcaneEnergyBonus());$('handCount').textContent=s.playerHand.length;
      $('playerDeckCount').textContent=s.playerDeck.length;$('enemyDeckCount').textContent=s.enemyDeck.length;
      $('playerDiscardCount').textContent=s.playerDiscard.length;$('enemyDiscardCount').textContent=s.enemyDiscard.length;
      for(const [id,n] of [['playerDeckPile',s.playerDeck.length],['enemyDeckPile',s.enemyDeck.length],['playerDiscardPile',s.playerDiscard.length],['enemyDiscardPile',s.enemyDiscard.length]]) $(id).classList.toggle('empty',n===0);
      $('endBtn').disabled=s.phase!=='player'||this.locked||this.transitioning;

      document.querySelectorAll('.slot').forEach(slot=>{
        const row=slot.dataset.row,lane=Number(slot.dataset.lane);slot.classList.remove('drop-valid','drop-hover','target','valid-target');slot.innerHTML='';
        const c=this.at(row,lane);if(c){const attackReady=c.owner==='player'&&c.category==='creature'&&c.canAttack&&s.phase==='player'?'can-attack':'';slot.innerHTML=this.cardHTML(c,attackReady)}
      });
      $('hand').innerHTML='';
      s.playerHand.forEach(c=>{
        const invalid=c.cost>s.playerEnergy?'invalid':'';$('hand').insertAdjacentHTML('beforeend',this.cardHTML(c,`hand-card ${invalid}`));
      });
      this.updateBattleMusic();
      this.applyModeVisuals();this.updateTimerUI();
      this.updateTutorialUI();
    },

    isBattleNearEnd(){
      const playerHp=Math.max(0,this.state.playerHp);
      const enemyHp=Math.max(0,this.state.enemyHp);
      const totalHp=playerHp+enemyHp;

      return playerHp<=8||enemyHp<=8||totalHp<=22||(this.state.turn>=8&&totalHp<=32);
    },

    updateBattleMusic(){
      if(
        !this.state ||
        this.state.phase==='over' ||
        this.state.phase==='menu' ||
        document.body.classList.contains('main-menu-open')
      ){
        return;
      }

      const nextMode=this.isBattleNearEnd()?'intense':'normal';
      const nextTrack=nextMode==='intense'?'bgm_intense':'bgm';
      const currentTrack=window.TCGSFX?.state?.musicKey;
      const currentAudio=window.TCGSFX?.state?.musicAudio;

      if(
        this.state.bgmMode===nextMode &&
        currentTrack===nextTrack &&
        currentAudio &&
        !currentAudio.paused
      ){
        return;
      }

      const fadeDuration=this.state.bgmMode?1800:0;
      this.state.bgmMode=nextMode;
      window.TCGSFX?.fadeToMusic?.(nextTrack,fadeDuration);
    },

    applyModeVisuals(){
      const mode=this.state.mode;$('modeHint').textContent='Ready';this.hideLine();
      document.querySelectorAll('.attack-active,.valid-target,.target').forEach(el=>el.classList.remove('attack-active','valid-target','target'));
      if(!mode) return;
      if(mode.type==='attack'){
        const source=this.cardEl(mode.attackerId);source?.classList.add('attack-active');$('modeHint').textContent='Attack mode — choose yellow target';
        for(const t of this.validAttackTargets(mode.attackerId)) this.markTarget(t);
      }else if(mode.type==='spell'){
        const source=this.cardEl(mode.cardId);source?.classList.add('attack-active');$('modeHint').textContent=`${mode.card.name} — choose target`;
        for(const t of this.validSpellTargets(mode.card)) this.markTarget(t);
      }
    },

    markTarget(t){
      let el=null;if(t.kind==='hero')el=$(t.owner==='enemy'?'enemyHero':'playerHero');else el=document.querySelector(`.slot[data-row="${t.row}"][data-lane="${t.lane}"]`);
      if(el){el.classList.add('target','valid-target');el.dataset.targetKind=t.kind;el.dataset.targetOwner=t.owner||'';el.dataset.targetRow=t.row||'';el.dataset.targetLane=t.lane??''}
    },

    selectHandCard(id){
      if(this.state.phase!=='player'||this.locked) return;
      if(this.state.mode) this.cancelMode(false);
      const card=this.getCardInHand('player',id);
      if(card&&!this.tutorialGuardSelect(card))return;
      this.state.selectedHand=this.state.selectedHand===id?null:id;this.render();
      if(card)this.highlightDrops(card);
      this.tutorialAfterSelect(card);
    },

    allowedRows(card,owner){
      if(card.category==='creature') return owner==='player'?(card.creatureType==='melee'?['playerFront']:['playerBack']):(card.creatureType==='melee'?['enemyFront']:['enemyBack']);
      if(card.spellType==='shared') return ['sharedSpell'];
      if(owner==='player') return ['playerSpellFront','playerSpellBack'];
      return ['enemySpellFront','enemySpellBack'];
    },

    canDrop(card,row,lane,owner){
      if(this.state.phase!==owner||card.cost>this.currentEnergy(owner)) return false;
      if(!this.allowedRows(card,owner).includes(row)) return false;
      if(card.category==='spell'&&card.spellType==='instant') return true;
      return !this.at(row,lane);
    },

    highlightDrops(card){
      document.querySelectorAll('.slot').forEach(slot=>{if(this.canDrop(card,slot.dataset.row,Number(slot.dataset.lane),'player'))slot.classList.add('drop-valid')});
    },

    async playCardToSlot(cardId,row,lane,owner='player'){
      if(this.locked) return false;
      const card=this.getCardInHand(owner,cardId);if(!card||!this.canDrop(card,row,lane,owner)){window.TCGSFX?.play?.('invalid');return false}
      if(!this.tutorialGuardPlayCard(card,row,lane,owner))return false;
      if(card.category==='spell'&&card.spellType==='instant'){
        window.TCGSFX?.play?.('play_spell');
        if(owner==='player') this.beginSpellTarget(card); else await this.aiCastInstant(card);
        return true;
      }
      window.TCGSFX?.play?.(card.category==='spell'?'play_spell':'play_card');
      this.spendEnergy(owner,card.cost);this.removeFromHand(owner,card.id);card.canAttack=false;card.summonedTurn=this.state.turn;
      this.place(row,lane,card);this.state.selectedHand=null;
      this.log(`${owner==='player'?'Player':'Enemy'} played ${card.name}.`);this.render();
      const el=this.cardEl(card.id);if(el)el.animate([{transform:'translateY(18px) scale(.72)',opacity:.2},{transform:'translateY(-5px) scale(1.08)',opacity:1,offset:.72},{transform:'translateY(0) scale(1)',opacity:1}],{duration:430,easing:'ease-out'});
      await sleep(260);this.tutorialAfterPlayCard(card,row,lane,owner);return true;
    },

    beginSpellTarget(card){
      this.state.mode={type:'spell',cardId:card.id,card};this.state.selectedHand=card.id;this.render();
    },

    validSpellTargets(card){
      const out=[];
      if(card.effect==='damage'){
        for(const row of ['enemyFront','enemyBack'])for(let lane=0;lane<3;lane++){const c=this.at(row,lane);if(c)out.push({kind:'card',owner:'enemy',row,lane,card:c})}
        out.push({kind:'hero',owner:'enemy'});
      }else if(card.effect==='buff'){
        for(const row of ['playerFront','playerBack'])for(let lane=0;lane<3;lane++){const c=this.at(row,lane);if(c)out.push({kind:'card',owner:'player',row,lane,card:c})}
      }
      return out;
    },

    async resolvePlayerSpellTarget(target){
      const mode=this.state.mode;if(!mode||mode.type!=='spell'||this.locked) return;
      const card=this.getCardInHand('player',mode.cardId);if(!card||card.cost>this.state.playerEnergy){this.cancelMode();return}
      const valid=this.validSpellTargets(card).some(t=>t.kind===target.kind&&t.owner===target.owner&&t.row===target.row&&t.lane===target.lane);
      if(!valid) return;
      window.TCGSFX?.play?.('spell_cast');
      this.locked=true;const source=this.cardEl(card.id);const targetEl=target.kind==='hero'?$('enemyHero'):this.cardEl(target.card.id);
      this.hideLine();
      if(card.effect==='damage') await TCGFX.fireBolt(source,targetEl); else await TCGFX.blessing(targetEl);
      this.spendEnergy('player',card.cost);this.removeFromHand('player',card.id);this.discard(card);
      if(card.effect==='damage'){
        if(target.kind==='hero'){this.state.enemyHp-=card.value;this.updateBattleMusic();TCGFX.damage(targetEl,`-${card.value}`);this.log(`Fire Bolt dealt ${card.value} damage to Enemy Hero.`)}
        else{target.card.hp-=card.value;TCGFX.damage(targetEl,`-${card.value}`);this.log(`Fire Bolt dealt ${card.value} damage to ${target.card.name}.`);if(target.card.hp<=0)this.destroyCreature(target.row,target.lane)}
      }else{
        target.card.atkBonus+=card.value;target.card.maxHp+=card.value;target.card.hp+=card.value;target.card.buffs.push('blessing');this.log(`Blessing gave ${target.card.name} +${card.value}/+${card.value}.`)
      }
      this.state.mode=null;this.state.selectedHand=null;this.locked=false;this.render();this.checkGameOver();
    },

    handleBoardClick(e){
      if(this.locked) return;
      const targetEl=e.target.closest('.valid-target');
      if(targetEl&&this.state.mode){
        const t=this.targetFromElement(targetEl);if(this.state.mode.type==='attack')this.resolvePlayerAttackTarget(t);else this.resolvePlayerSpellTarget(t);return;
      }
      const slot=e.target.closest('.slot');
      if(slot&&this.state.selectedHand){this.playCardToSlot(this.state.selectedHand,slot.dataset.row,Number(slot.dataset.lane),'player').then(ok=>{if(!ok)this.log('That card cannot be played there.')});return}
      const boardCard=e.target.closest('.card');
      if(boardCard){
        const loc=this.locateCard(boardCard.dataset.cardId);if(loc&&loc.card.owner==='player'&&loc.card.category==='creature'&&loc.card.canAttack&&this.state.phase==='player')this.beginAttack(loc.card.id);
        return;
      }
      if(this.state.mode)this.cancelMode();
    },

    handleHeroClick(owner){
      if(!this.state.mode||this.locked) return;
      const el=$(owner==='enemy'?'enemyHero':'playerHero');if(!el.classList.contains('valid-target'))return;
      const t={kind:'hero',owner};if(this.state.mode.type==='attack')this.resolvePlayerAttackTarget(t);else this.resolvePlayerSpellTarget(t);
    },
    targetFromElement(el){
      if(el.classList.contains('hero'))return {kind:'hero',owner:el.id==='enemyHero'?'enemy':'player'};
      const row=el.dataset.row,lane=Number(el.dataset.lane),card=this.at(row,lane);return {kind:'card',owner:card?.owner,row,lane,card};
    },

    beginAttack(id){
      if(this.locked||this.state.phase!=='player')return;const loc=this.locateCard(id);if(!loc||!loc.card.canAttack)return;
      if(!this.tutorialGuardAttack(loc.card))return;
      this.state.mode={type:'attack',attackerId:id};this.state.selectedHand=null;this.render();
    },
    validAttackTargets(attackerId){
      const loc=this.locateCard(attackerId);if(!loc)return[];const lane=loc.lane,front=this.at('enemyFront',lane),back=this.at('enemyBack',lane);
      if(front)return[{kind:'card',owner:'enemy',row:'enemyFront',lane,card:front}];if(back)return[{kind:'card',owner:'enemy',row:'enemyBack',lane,card:back}];return[{kind:'hero',owner:'enemy'}];
    },

    async resolvePlayerAttackTarget(target){
      const mode=this.state.mode;if(!mode||mode.type!=='attack'||this.locked)return;
      const valid=this.validAttackTargets(mode.attackerId).some(t=>t.kind===target.kind&&t.owner===target.owner&&t.row===target.row&&t.lane===target.lane);if(!valid)return;
      const aLoc=this.locateCard(mode.attackerId);this.state.mode=null;await this.resolveAttack(aLoc,target);
    },

    async resolveAttack(aLoc,target,after){
      if(!aLoc||!aLoc.card||!aLoc.card.canAttack){after&&after();return}
      this.locked=true;this.hideLine();const attacker=aLoc.card;
      if(target.kind==='card'){
        const trapKilled=await this.triggerTrap(target.row,aLoc);if(trapKilled){this.locked=false;this.state.mode=null;this.render();after&&after();return}
      }
      const attackerEl=this.cardEl(attacker.id);const targetEl=target.kind==='hero'?$(target.owner==='enemy'?'enemyHero':'playerHero'):this.cardEl(target.card.id);
      await TCGFX.flyCard(attackerEl,targetEl);
      attacker.canAttack=false;
      if(target.kind==='hero'){
        const quickRushPenalty=attacker.quick&&attacker.summonedTurn===this.state.turn?1:0;
        const dmg=Math.max(1,this.effectiveAttack(attacker)-quickRushPenalty);if(target.owner==='enemy')this.state.enemyHp-=dmg;else this.state.playerHp-=dmg;this.updateBattleMusic();TCGFX.damage(targetEl,`-${dmg}`);this.log(`${attacker.name} hit ${target.owner==='enemy'?'Enemy':'Player'} Hero for ${dmg}.${quickRushPenalty?' Quick rush reduced direct damage by 1.':''}`)
      }else{
        const atkA=this.effectiveAttack(attacker),atkD=this.effectiveAttack(target.card);TCGFX.calc(attackerEl,targetEl,`${attacker.name} ${atkA} ⚔ ${target.card.name} ${atkD}`);
        target.card.hp-=atkA;attacker.hp-=atkD;TCGFX.damage(targetEl,`-${atkA}`);TCGFX.damage(attackerEl,`-${atkD}`);
        this.log(`${attacker.name} attacked ${target.card.name}: ${atkA} / ${atkD}.`);
        await sleep(420);if(target.card.hp<=0)this.destroyCreature(target.row,target.lane);if(attacker.hp<=0)this.destroyCreature(aLoc.row,aLoc.lane);
      }
      this.locked=false;this.state.mode=null;this.render();this.tutorialAfterAttack(attacker,target);this.checkGameOver();after&&after();
    },

    async triggerTrap(defenderRow,attackerLoc){
      const map={playerFront:'playerSpellFront',playerBack:'playerSpellBack',enemyFront:'enemySpellFront',enemyBack:'enemySpellBack'};const spellRow=map[defenderRow];if(!spellRow)return false;
      const trap=this.at(spellRow,0);if(!trap||trap.effect!=='trap_damage')return false;
      const trapEl=this.cardEl(trap.id);await TCGFX.trapReveal(trapEl);const attacker=this.at(attackerLoc.row,attackerLoc.lane);if(!attacker)return true;
      attacker.hp-=trap.value;TCGFX.damage(this.cardEl(attacker.id),`-${trap.value}`);this.log(`Trap Rune triggered and dealt ${trap.value} damage to ${attacker.name}.`);
      this.discard(this.remove(spellRow,0));this.render();await sleep(350);
      if(attacker.hp<=0){this.destroyCreature(attackerLoc.row,attackerLoc.lane);this.render();return true}return false;
    },

    destroyCreature(row,lane){const c=this.remove(row,lane);if(c){window.TCGSFX?.play?.('death');this.discard(c);this.log(`${c.name} was destroyed.`)}},

    cancelMode(render=true){this.state.mode=null;this.state.selectedHand=null;this.hideLine();if(render)this.render()},

    makeDragGhost(cardEl){
      const ghost=cardEl.cloneNode(true);
      const rect=cardEl.getBoundingClientRect();
      ghost.classList.add('drag-ghost');
      ghost.classList.remove('tutorial-highlight','tutorial-allowed','tutorial-action-highlight','hand-selected','drag-source');
      ghost.setAttribute('aria-hidden','true');
      ghost.querySelectorAll('img').forEach(img=>img.draggable=false);
      ghost.style.width=`${Math.round(rect.width)}px`;
      ghost.style.height=`${Math.round(rect.height)}px`;
      return ghost;
    },

    captureDragPointer(e,cardEl){
      if(e.pointerId===undefined)return;
      try{
        cardEl.setPointerCapture?.(e.pointerId);
      }catch(_){}
    },

    startDrag(e,cardEl){
      if(this.state.phase!=='player'||this.locked)return;const card=this.getCardInHand('player',cardEl.dataset.cardId);if(!card)return;
      if(this.state.mode)this.cancelMode(false);
      e.preventDefault();
      e.stopPropagation();
      document.body.classList.remove('card-hold-pending');
      document.body.classList.add('game-dragging');
      this.drag={card,source:cardEl,ghost:this.makeDragGhost(cardEl),startX:e.clientX,startY:e.clientY,moved:false,pointerId:e.pointerId,captureEl:cardEl};
      this.captureDragPointer(e,cardEl);
      document.body.appendChild(this.drag.ghost);cardEl.classList.add('drag-source');this.moveGhost(e.clientX,e.clientY);this.highlightDrops(card);
      this.bindDragEvents(this.onDragEnd);
    },
    onDragMove:e=>{
      const g=Game;if(!g.drag)return;e.preventDefault();if(Math.abs(e.clientX-g.drag.startX)>5||Math.abs(e.clientY-g.drag.startY)>5)g.drag.moved=true;g.moveGhost(e.clientX,e.clientY);
      document.querySelectorAll('.drop-hover').forEach(x=>x.classList.remove('drop-hover'));const hit=g.pointerSlotAt(e.clientX,e.clientY);if(hit?.classList.contains('drop-valid'))hit.classList.add('drop-hover');
    },
    onDragEnd:e=>{
      const g=Game;if(!g.drag)return;const drag=g.drag;const hit=g.pointerSlotAt(e.clientX,e.clientY);g.cleanDrag(false);
      if(drag.moved){
        if(hit)g.playCardToSlot(drag.card.id,hit.dataset.row,Number(hit.dataset.lane),'player').then(ok=>{if(!ok){g.log('Drop failed. Use a glowing slot.');g.render()}});
        else{g.log('Drop canceled.');g.render()}
      }
    },
    pointerSlotAt(x,y){
      const ghost=this.drag?.ghost;
      const source=this.drag?.source;
      const oldDisplay=ghost?.style.display;
      const oldSourcePointerEvents=source?.style.pointerEvents;
      if(ghost)ghost.style.display='none';
      if(source)source.style.pointerEvents='none';
      const hit=document.elementFromPoint(x,y)?.closest('.slot')||null;
      if(ghost)ghost.style.display=oldDisplay||'';
      if(source)source.style.pointerEvents=oldSourcePointerEvents||'';
      return hit;
    },
    moveGhost(x,y){if(this.drag?.ghost){this.drag.ghost.style.left=x+'px';this.drag.ghost.style.top=y+'px'}},
    bindDragEvents(endHandler){
      if(!this.drag)return;
      document.body.classList.add('game-dragging');
      this.drag.endHandler=endHandler;
      document.addEventListener('pointermove',this.onDragMove,true);
      document.addEventListener('pointerup',endHandler,true);
      document.addEventListener('pointercancel',endHandler,true);
    },
    unbindDragEvents(){
      if(!this.drag?.endHandler)return;
      document.removeEventListener('pointermove',this.onDragMove,true);
      document.removeEventListener('pointerup',this.drag.endHandler,true);
      document.removeEventListener('pointercancel',this.drag.endHandler,true);
    },
    cleanDrag(render=false){if(this.drag){this.unbindDragEvents();try{if(this.drag.pointerId!==undefined&&this.drag.captureEl?.hasPointerCapture?.(this.drag.pointerId))this.drag.captureEl.releasePointerCapture(this.drag.pointerId)}catch(_){}this.drag.ghost?.remove();this.drag.source?.classList.remove('drag-source')}document.body.classList.remove('game-dragging','card-hold-pending');document.querySelectorAll('.drag-ghost').forEach(x=>x.remove());document.querySelectorAll('.drop-valid,.drop-hover').forEach(x=>x.classList.remove('drop-valid','drop-hover'));this.drag=null;if(render)this.render()},

    startBoardDrag(e,cardEl){
      if(this.state.phase!=='player'||this.locked)return;const loc=this.locateCard(cardEl.dataset.cardId);if(!loc||loc.card.owner!=='player'||loc.card.category!=='creature')return;
      if(loc.card.summonedTurn===this.state.turn){window.TCGSFX?.play?.('invalid');return}
      if(loc.card.movedThisPhase)return;
      if(this.state.mode)this.cancelMode(false);
      e.preventDefault();
      e.stopPropagation();
      document.body.classList.remove('card-hold-pending');
      document.body.classList.add('game-dragging');
      this.drag={card:loc.card,source:cardEl,ghost:this.makeDragGhost(cardEl),startX:e.clientX,startY:e.clientY,moved:false,pointerId:e.pointerId,captureEl:cardEl,fromBoard:true,fromRow:loc.row,fromLane:loc.lane};
      this.captureDragPointer(e,cardEl);
      document.body.appendChild(this.drag.ghost);cardEl.classList.add('drag-source');this.moveGhost(e.clientX,e.clientY);this.highlightMoveDrops(loc.card);
      this.bindDragEvents(this.onBoardDragEnd);
    },
    highlightMoveDrops(card){
      const allowed=card.flexRow?null:this.allowedRows(card,card.owner);
      document.querySelectorAll('.slot').forEach(slot=>{const row=slot.dataset.row;if(!creatureRows.includes(row)||!row.startsWith(card.owner))return;if(allowed&&!allowed.includes(row))return;if(!this.at(row,Number(slot.dataset.lane)))slot.classList.add('drop-valid')});
    },
    onBoardDragEnd:e=>{
      const g=Game;if(!g.drag)return;const drag=g.drag;const hit=g.pointerSlotAt(e.clientX,e.clientY);g.cleanDrag(false);
      if(drag.moved&&drag.fromBoard){
        const rowOk=drag.card.flexRow||g.allowedRows(drag.card,drag.card.owner).includes(hit?.dataset.row);
        if(hit&&creatureRows.includes(hit.dataset.row)&&hit.dataset.row.startsWith(drag.card.owner)&&rowOk&&!g.at(hit.dataset.row,Number(hit.dataset.lane))){
          g.remove(drag.fromRow,drag.fromLane);g.place(hit.dataset.row,Number(hit.dataset.lane),drag.card);
          drag.card.movedThisPhase=true;drag.card.canAttack=false;
          g.log(`${drag.card.name} dipindahkan ke row lain.`);
        }else g.log('Pindah dibatalkan. Kartu ini hanya bisa pindah sesuai row-nya (melee depan, ranged belakang).');
        g.render();
      }
    },

    isPlayerTargetingMode(){
      return this.state?.phase==='player'&&!!this.state.mode&&!this.locked&&!this.transitioning;
    },
    handlePointerMove(e){
      if(this.drag)return;if(!this.isPlayerTargetingMode())return;const over=e.target.closest?.('.valid-target');if(over){this.showLineTo(over);return}this.showLineToPoint(e.clientX,e.clientY);
    },
    handleTargetHover(e,enter){
      const el=e.target.closest?.('.valid-target');if(!el||!this.isPlayerTargetingMode())return;if(enter){el.classList.add('attack-hover-target');this.showLineTo(el)}else el.classList.remove('attack-hover-target');
    },
    modeSourceEl(){if(!this.state.mode)return null;return this.state.mode.type==='attack'?this.cardEl(this.state.mode.attackerId):this.cardEl(this.state.mode.cardId)},
    linePath(a,b){const dx=b.x-a.x,dy=b.y-a.y,curve=Math.max(40,Math.min(120,Math.abs(dx)*.18+Math.abs(dy)*.12)),side=dx>=0?1:-1;return`M ${a.x} ${a.y} C ${a.x+dx*.3+curve*side} ${a.y-curve}, ${a.x+dx*.72+curve*side} ${a.y+dy*.88+curve}, ${b.x} ${b.y}`},
    showLineTo(el){const source=this.modeSourceEl(),line=$('targetLine');if(!source||!el)return;line.setAttribute('d',this.linePath(TCGFX.center(source),TCGFX.center(el)));line.classList.add('show')},
    showLineToPoint(x,y){const source=this.modeSourceEl(),line=$('targetLine');if(!source)return;line.setAttribute('d',this.linePath(TCGFX.center(source),{x,y}));line.classList.add('show')},
    hideLine(){const line=$('targetLine');line.classList.remove('show');line.setAttribute('d','');document.querySelectorAll('.attack-hover-target').forEach(x=>x.classList.remove('attack-hover-target'))},
    cardEl(id){return document.querySelector(`.card[data-card-id="${id}"]`)},

    async startPlayerTurn(){
      if(this.checkGameOver())return;this.transitioning=true;this.state.phase='player';const openingResponse=!!this.state.playerOpeningResponseTurn;if(!openingResponse){this.state.turn+=1;this.state.playerMaxEnergy=Math.min(10,this.state.playerMaxEnergy+1)}const openingBonus=this.state.playerOpeningEnergyBonus||0;this.state.playerEnergy=Math.min(10,this.state.playerMaxEnergy+this.arcaneEnergyBonus()+openingBonus);this.state.playerOpeningResponseTurn=false;this.state.playerOpeningEnergyBonus=0;
      for(const c of Object.values(this.state.board))if(c.owner==='player'&&c.category==='creature')c.canAttack=true;
      this.banner('Player Phase');this.render();if(this.state.playerSkipOpeningDraw){this.state.playerSkipOpeningDraw=false}else await this.drawAnimated('player');this.transitioning=false;this.startTimer();this.render();this.log(openingBonus?'Player turn started with +1 temporary Energy.':'Player turn started.');
    },

    async endTurn(){
      if(this.tutorial?.active){
        if(await this.tutorialHandleEndTurn())return;
      }
      if(this.state.phase!=='player'||this.locked||this.transitioning)return;window.TCGSFX?.play?.('turn_end');this.transitioning=true;this.stopTimer();this.cancelMode(false);this.state.phase='enemy';this.render();this.banner('Enemy Phase');await sleep(650);await this.startEnemyTurn();
    },

    async startEnemyTurn(){
      if(this.checkGameOver())return;const opening=!!this.state.enemyOpeningTurn;this.state.enemyOpeningTurn=false;this.state.enemyMaxEnergy=Math.min(10,this.state.enemyMaxEnergy+(opening?0:1));this.state.enemyEnergy=Math.min(10,this.state.enemyMaxEnergy+this.arcaneEnergyBonus());for(const c of Object.values(this.state.board))if(c.owner==='enemy'&&c.category==='creature')c.canAttack=true;
      this.render();if(this.state.enemySkipOpeningDraw){this.state.enemySkipOpeningDraw=false}else await this.drawAnimated('enemy');await this.aiMainPhase();await this.aiAttackPhase();this.transitioning=false;if(!this.checkGameOver())await this.startPlayerTurn();
    },

    async aiMainPhase(){
      const maxPlays=Math.max(1,(this.state.turn<=3?2:3)+(this.state.campaign?.aiPlaysBonus||0));
      let plays=0;while(plays<maxPlays){const choice=this.chooseAiPlay();if(!choice)break;await this.aiPlay(choice);plays++;if(this.checkGameOver())break;await sleep(300)}
    },
    chooseAiPlay(){
      const hand=this.state.enemyHand.filter(c=>c.cost<=this.state.enemyEnergy);
      if(!hand.length)return null;
      const fire=hand.find(c=>c.effect==='damage'&&this.aiDamageTarget());if(fire)return{card:fire};
      const bless=hand.find(c=>c.effect==='buff'&&this.aiBuffTarget());if(bless)return{card:bless};
      const trap=hand.find(c=>c.spellType==='trap'&&this.aiTrapRow());if(trap)return{card:trap,row:this.aiTrapRow(),lane:0};
      const shared=hand.find(c=>c.spellType==='shared'&&this.aiSharedLane()!==null);if(shared)return{card:shared,row:'sharedSpell',lane:this.aiSharedLane()};
      const creatures=hand.filter(c=>c.category==='creature').sort((a,b)=>b.cost-a.cost);
      for(const c of creatures){const rows=this.allowedRows(c,'enemy');for(const row of rows)for(let lane=0;lane<3;lane++)if(!this.at(row,lane))return{card:c,row,lane}}
      return null;
    },
    aiDamageTarget(){
      const candidates=[];for(const row of ['playerFront','playerBack'])for(let lane=0;lane<3;lane++){const c=this.at(row,lane);if(c)candidates.push({kind:'card',owner:'player',row,lane,card:c})}
      candidates.sort((a,b)=>(a.card.hp<=3?100:0)+this.effectiveAttack(a.card)-(b.card.hp<=3?100:0)-this.effectiveAttack(b.card));return candidates[0]||{kind:'hero',owner:'player'};
    },
    aiBuffTarget(){const arr=[];for(const row of ['enemyFront','enemyBack'])for(let lane=0;lane<3;lane++){const c=this.at(row,lane);if(c)arr.push({kind:'card',owner:'enemy',row,lane,card:c})}return arr.sort((a,b)=>this.effectiveAttack(b.card)-this.effectiveAttack(a.card))[0]||null},
    aiTrapRow(){if(!this.at('enemySpellFront',0))return'enemySpellFront';if(!this.at('enemySpellBack',0))return'enemySpellBack';return null},
    aiSharedLane(){for(let i=0;i<3;i++)if(!this.at('sharedSpell',i))return i;return null},

    async aiPlay(choice){
      const card=choice.card;if(card.spellType==='instant'){await this.aiCastInstant(card);return}
      await this.playCardToSlot(card.id,choice.row,choice.lane,'enemy');
    },
    async aiCastInstant(card){
      const target=card.effect==='damage'?this.aiDamageTarget():this.aiBuffTarget();if(!target)return false;
      window.TCGSFX?.play?.('play_spell');
      this.locked=true;const source=card.effect==='damage'?$('enemySpellFront'):$('enemySpellBack');const targetEl=target.kind==='hero'?$('playerHero'):this.cardEl(target.card.id);
      if(card.effect==='damage')await TCGFX.fireBolt(source,targetEl);else await TCGFX.blessing(targetEl);
      this.spendEnergy('enemy',card.cost);this.removeFromHand('enemy',card.id);this.discard(card);
      if(card.effect==='damage'){
        if(target.kind==='hero'){this.state.playerHp-=card.value;this.updateBattleMusic();TCGFX.damage(targetEl,`-${card.value}`);this.log(`Enemy Fire Bolt hit Player Hero for ${card.value}.`)}
        else{target.card.hp-=card.value;TCGFX.damage(targetEl,`-${card.value}`);this.log(`Enemy Fire Bolt hit ${target.card.name} for ${card.value}.`);if(target.card.hp<=0)this.destroyCreature(target.row,target.lane)}
      }else{target.card.atkBonus+=card.value;target.card.maxHp+=card.value;target.card.hp+=card.value;target.card.buffs.push('blessing');this.log(`Enemy Blessing buffed ${target.card.name}.`)}
      this.locked=false;this.render();await sleep(350);return true;
    },

    async aiAttackPhase(){
      const attackers=[];for(const row of ['enemyFront','enemyBack'])for(let lane=0;lane<3;lane++){const c=this.at(row,lane);if(c?.canAttack)attackers.push({row,lane,card:c})}
      for(const a of attackers){const live=this.at(a.row,a.lane);if(!live||!live.canAttack)continue;const front=this.at('playerFront',a.lane),back=this.at('playerBack',a.lane);const target=front?{kind:'card',owner:'player',row:'playerFront',lane:a.lane,card:front}:back?{kind:'card',owner:'player',row:'playerBack',lane:a.lane,card:back}:{kind:'hero',owner:'player'};
        this.state.mode={type:'attack',attackerId:live.id};this.render();const targetEl=target.kind==='hero'?$('playerHero'):document.querySelector(`.slot[data-row="${target.row}"][data-lane="${target.lane}"]`);this.showLineTo(targetEl);await sleep(700);this.state.mode=null;await this.resolveAttack({row:a.row,lane:a.lane,card:live},target);await sleep(300);if(this.checkGameOver())break}
    },

    startTimer(){this.stopTimer();this.state.time=this.state.timeMax;this.state.timerLowSfxPlayed=false;this.updateTimerUI();this.timerId=setInterval(()=>{if(this.state.phase!=='player'||this.locked)return;this.state.time=Math.max(0,this.state.time-1);this.updateTimerUI();if(this.state.time<=0)this.endTurn()},1000)},
    stopTimer(){if(this.timerId){clearInterval(this.timerId);this.timerId=null}},
    updateTimerUI(){
      const ratio=Math.max(0,Math.min(1,this.state.time/this.state.timeMax)),circ=2*Math.PI*53,p=$('timerProgress');
      $('timerText').textContent=`${Math.ceil(this.state.time)}s`;p.style.strokeDasharray=circ;p.style.strokeDashoffset=circ*(1-ratio);p.classList.toggle('mid',ratio<=.5&&ratio>.2);p.classList.toggle('low',ratio<=.2);$('timerStatus').textContent=this.state.phase==='player'?(ratio<=.2?'Hurry!':'Player action'):this.state.phase==='enemy'?'Enemy action':'Finished';
      if(this.state.phase==='player'&&this.state.time<=10&&!this.state.timerLowSfxPlayed){
        this.state.timerLowSfxPlayed=true;
        window.TCGSFX?.play?.('timer_low');
      }
    },

    checkGameOver(){
      if(this.state.enemyHp>0&&this.state.playerHp>0)return false;
      if(this.state.phase==='over')return true;

      const result=this.state.enemyHp<=0&&this.state.playerHp<=0?'draw':this.state.enemyHp<=0?'win':'defeat';
      if(result==='win'&&this.state.campaign?.stageId){
        this.completeCampaignStage(this.campaignStage(this.state.campaign.stageId));
      }
      window.TCGSFX?.play?.(result==='win'?'victory':result==='defeat'?'defeat':'draw_result');
      window.TCGSFX?.stopMusic?.();
      this.stopTimer();this.state.phase='over';this.locked=true;this.state.mode=null;this.render();

      if(result==='win'){this.banner('You Win');this.log('Player wins the match.')}
      else if(result==='defeat'){this.banner('Defeat');this.log('Enemy wins the match.')}
      else{this.banner('Draw');this.log('The match ended in a draw.')}

      this.showEndGameOverlay(result);
      return true;
    },
    ensureEndGameOverlay(){
      let overlay=$('gameEndOverlay');
      if(overlay)return overlay;

      overlay=document.createElement('section');
      overlay.id='gameEndOverlay';
      overlay.className='game-end-overlay';
      overlay.hidden=true;
      overlay.setAttribute('aria-modal','true');
      overlay.setAttribute('role','dialog');
      overlay.setAttribute('aria-labelledby','gameEndTitle');
      overlay.innerHTML=`
        <div class="game-end-glow" aria-hidden="true"></div>
        <div class="game-end-card">
          <div class="game-end-burst" aria-hidden="true"></div>
          <span class="game-end-kicker" id="gameEndKicker">Match Complete</span>
          <h1 class="game-end-title" id="gameEndTitle">You Win</h1>
          <p class="game-end-subtitle" id="gameEndSubtitle">The enemy hand has fallen.</p>
          <div class="game-end-stats" aria-label="Match result">
            <span><b id="gameEndTurn">0</b><small>Turn</small></span>
            <span><b id="gameEndPlayerHp">0</b><small>Your HP</small></span>
            <span><b id="gameEndEnemyHp">0</b><small>Enemy HP</small></span>
          </div>
          <div class="game-end-actions">
            <button class="game-end-primary" id="gameEndNewBtn" type="button">New Game</button>
            <button class="game-end-secondary" id="gameEndReviewBtn" type="button">Review Board</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      $('gameEndNewBtn').addEventListener('click',()=>{
        const campaignStageId=overlay.dataset.campaignStageId;
        this.newGame(campaignStageId?{campaignStageId}:{});
      });
      $('gameEndReviewBtn').addEventListener('click',()=>{
        window.TCGSFX?.play?.('ui_close');
        if(overlay.dataset.secondaryAction==='menu'){
          this.prepareMenuState();
          this.openMainMenu();
          return;
        }
        this.hideEndGameOverlay();
        this.showReviewBoardMenu();
      });
      return overlay;
    },
    ensureReviewBoardMenu(){
      let menu=$('reviewBoardMenu');
      if(menu)return menu;

      menu=document.createElement('div');
      menu.id='reviewBoardMenu';
      menu.className='review-board-menu';
      menu.hidden=true;
      menu.innerHTML=`
        <button class="review-board-back" id="reviewBoardBackBtn" type="button">Back to Menu</button>
      `;

      document.body.appendChild(menu);
      $('reviewBoardBackBtn').addEventListener('click',()=>{
        window.TCGSFX?.play?.('ui_close');
        this.hideReviewBoardMenu();
        this.prepareMenuState();
        this.openMainMenu();
      });

      return menu;
    },
    showReviewBoardMenu(){
      const menu=this.ensureReviewBoardMenu();
      menu.hidden=false;
      requestAnimationFrame(()=>menu.classList.add('show'));
    },
    hideReviewBoardMenu(){
      const menu=$('reviewBoardMenu');
      if(!menu)return;
      menu.classList.remove('show');
      menu.hidden=true;
    },
    showEndGameOverlay(result){
      const overlay=this.ensureEndGameOverlay();
      this.hideReviewBoardMenu();
      const copy={
        win:{
          kicker:'Victory',
          title:'You Win',
          subtitle:'The enemy hand has fallen. Nice finish.'
        },
        defeat:{
          kicker:'Defeat',
          title:'Defeat',
          subtitle:'Your hand was broken. Time for a cleaner revenge run.'
        },
        draw:{
          kicker:'Match Complete',
          title:'Draw',
          subtitle:'Both hands collapsed in the same clash.'
        },
        surrender:{
          kicker:'Surrender',
          title:'Surrender',
          subtitle:'Kamu menyerah dari duel ini. Atur ulang tempo, lalu coba run berikutnya.'
        }
      }[result]||{};
      const isSurrender=result==='surrender';
      const campaign=this.state?.campaign||null;

      overlay.hidden=false;
      overlay.classList.remove('show','win','defeat','draw','surrender');
      overlay.classList.add(result);
      overlay.dataset.secondaryAction=isSurrender?'menu':'review';
      overlay.dataset.campaignStageId=campaign?.stageId||'';

      $('gameEndKicker').textContent=copy.kicker;
      $('gameEndTitle').textContent=copy.title;
      $('gameEndSubtitle').textContent=copy.subtitle;
      $('gameEndTurn').textContent=this.state.turn;
      $('gameEndPlayerHp').textContent=Math.max(0,this.state.playerHp);
      $('gameEndEnemyHp').textContent=Math.max(0,this.state.enemyHp);
      $('gameEndNewBtn').textContent=campaign?'Main Stage Lagi':isSurrender?'Main Lagi':'New Game';
      $('gameEndReviewBtn').textContent=isSurrender?'Back to Menu':'Review Board';

      requestAnimationFrame(()=>{
        overlay.classList.add('show');
        $('gameEndNewBtn')?.focus({preventScroll:true});
      });
    },
    hideEndGameOverlay(){
      const overlay=$('gameEndOverlay');
      if(!overlay)return;
      overlay.classList.remove('show');
      overlay.hidden=true;
    },
    banner(text){
      if(text==='Player Phase')window.TCGSFX?.play?.('phase_player');
      else if(text==='Enemy Phase')window.TCGSFX?.play?.('phase_enemy');
      const phaseText =
        text==='Player Phase'
          ? `Your Phase · Turn ${this.state?.turn ?? 1}`
          : text==='Enemy Phase'
            ? `Enemy Phase · Turn ${this.state?.turn ?? 1}`
            : text;
      $('bannerText').textContent=phaseText;const b=$('banner');b.classList.remove('show');void b.offsetWidth;b.classList.add('show')
    },
    log(text){const line=document.createElement('div');line.textContent=`• ${text}`;$('log').prepend(line)}
  };

  window.addEventListener('DOMContentLoaded',()=>Game.init());
})();
