
"use strict";
(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const mm = document.getElementById("mm");
  const mctx = mm.getContext("2d");
  const faceC = document.getElementById("face-c");
  const fctx = faceC.getContext("2d");
  const pv = document.getElementById("pv");
  const pctx = pv.getContext("2d");
  const $ = (id) => document.getElementById(id);
  const OUTLINE = "#4A3525";
  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
  const rand = (a,b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const dist = (a,b) => Math.hypot(a.x - b.x, a.y - b.y);
  const lerp = (a,b,t) => a + (b-a)*t;

  let W=0,H=0,DPR=1, VIEW_ZOOM=1.35, time=0, shake=0, flash=0;
  let mode = "boot"; // boot title create play
  let mapId = "plaza";
  const keys = Object.create(null);
  const stick = { on:false, ox:0, oy:0, x:0, y:0, dx:0, dy:0 };
  let auto = false, bgmOn = true, menuOpen = false, mounted = false;
  let lastCombatAt = -1e9;
  const COMBAT_HOLD = 5;

  const CLASSES = [
    { id:"sword", name:"蒼穹劍士", icon:"⚔️", role:"近戰物理／坦克", desc:"單手闊劍＋圓盾。旅人皮甲起步，擅長衝鋒與守護。", color:"#8B5A2B",
      skills:["破空斬","衝鋒突刺","聖盾猛擊","劍刃旋風斬"], ult:"諸神裁決聖劍", atk:16, hp:120, mp:40, range:78, speed:168 },
    { id:"mage", name:"星詠法師", icon:"🔮", role:"遠程範圍魔法", desc:"浮空星盤＋法杖。以奧術星彈點亮夜空。", color:"#3A5CBF",
      skills:["奧術星彈","星辰閃現","赤楓烈焰陣","極光冰封新星"], ult:"極光天星隕落", atk:14, hp:90, mp:80, range:150, speed:158 },
    { id:"archer", name:"逐風遊俠", icon:"🏹", role:"遠程高暴擊／攻速", desc:"翡翠獵弓＋羽帽披風。箭矢如風。", color:"#2E7D4F",
      skills:["疾風二連矢","後躍翻滾射擊","扇形五連箭","蒼穹流星箭雨"], ult:"貫穿天地・破曉矢", atk:15, hp:100, mp:55, range:170, speed:176 },
    { id:"priest", name:"聖樹祭司", icon:"✨", role:"治療增益／光屬性", desc:"聖光法典＋金錘。守護同伴，也降下天罰。", color:"#C9A227",
      skills:["聖光懲戒彈","世界樹恩典","生命年輪結界","天罰雷光柱"], ult:"六翼熾天使降臨", atk:13, hp:110, mp:75, range:140, speed:160 },
    { id:"merchant", name:"雲海行商", icon:"💰", role:"中程戰商／召喚", desc:"黃金算盤＋商旅背囊。金幣也能成為兵器。", color:"#C49A3C",
      skills:["破甲金幣鏢","金錢重擊","漫天金幣雨","商盟傭兵召集"], ult:"財神降世・黃金殿", atk:14, hp:105, mp:50, range:120, speed:164 }
  ];

  const MAPS = {
    plaza: { w:2752, h:1536, src:"assets/maps/plaza.jpg", mask:"assets/masks/plaza.png", safe:true, name:"風車鎮主城廣場", sign:"風車鎮廣場", sub:"安全區域 · 主城",
      spawn:[1376, 1071],
      blocks:[
        {x:1321,y:811,r:119},{x:826,y:474,r:138},{x:657,y:949,r:55},{x:1376,y:1224,r:61},{x:1804,y:1163,r:61},
        {x:1160,y:1120,r:108},{x:1240,y:1205,r:60},{x:1060,y:1165,r:45},
        {x:1735,y:1100,r:112},{x:1665,y:1188,r:40},{x:1865,y:1095,r:55},
        {x:805,y:890,r:105},{x:800,y:990,r:40},{x:720,y:845,r:80},
        {x:2095,y:800,r:118},{x:2010,y:925,r:32},{x:2155,y:930,r:45},{x:2210,y:790,r:45},
        {x:1350,y:430,r:95},{x:1350,y:505,r:38},{x:1250,y:485,r:48},
        {x:1030,y:500,r:75},{x:1080,y:390,r:90}
      ],
      portals:[
        {x:2110,y:459,r:107,to:"field", ts:[657,612], name:"南郊星門"},
        {x:657,y:1255,r:98,to:"market", ts:[764,1193], name:"市集茶座"},
        {x:2293,y:1255,r:98,to:"docks", ts:[795,643], name:"雲港石橋"},
        {x:657,y:459,r:83,to:"forge", ts:[700,500], name:"鍛造訓練場"}
      ],
      npcs:[
        {id:"luna", name:"天空領航員・露娜", tag:"🧭 領航員", x:1957, y:581, color:"#3A6CBF",
          talk:"羅盤指向八大浮空大陸。南郊草原的星門已經為你點亮，先去那裡熟悉戰鬥吧。需要我送你一程嗎？", travel:true},
        {id:"arya", name:"職業大導師・艾莉亞", tag:"📜 導師", x:1101, y:949, color:"#6B4CAF",
          talk:"每一條傳承都會在 Lv.10、35、50 綻放新的光芒。現在先把基礎技能用順，SP 會在升級時獲得。"}
      ]},
    field: { w:2752, h:1536, src:"assets/maps/field.jpg", mask:"assets/masks/field.png", safe:false, name:"風車鎮南郊草原", sign:"南郊草原", sub:"1〜8 等冒險區域",
      spawn:[657,612],
      blocks:[{x:1498,y:490,r:122},{x:657,y:949,r:46}],
      portals:[{x:612,y:474,r:107,to:"plaza", ts:[2079,551], name:"返回主城星門"}],
      npcs:[],
      spawns:[[948,796],[1193,1071],[1682,979],[1957,765],[2293,658],[1498,1193],[1070,658],[2370,1071]]
    },
    market: { w:2752, h:1536, src:"assets/maps/market.jpg", mask:"assets/masks/market.png", safe:true, name:"風車鎮市集茶座", sign:"市集茶座", sub:"安全區域 · 風車鎮",
      spawn:[764,1193],
      blocks:[{x:657,y:459,r:168},{x:1682,y:796,r:55},{x:1957,y:949,r:55}],
      portals:[{x:642,y:1316,r:107,to:"plaza", ts:[764,1224], name:"返回廣場"}],
      npcs:[
        {id:"hawkins", name:"商盟大掌櫃・霍金斯", tag:"💰 商盟", x:795, y:658, color:"#C49A3C",
          talk:"算盤已經為你撥好了。跨島特產的行情之後會在「跑商茶座」開放。先去南郊弄點金幣回來吧！"},
        {id:"buck", name:"雲海茶座職人・巴克", tag:"☕ 茶座", x:1804, y:949, color:"#8B5A2B",
          talk:"來一杯手沖靈飲吧。溫暖的咖啡香能讓步伐更輕盈。（獲得 30 秒移動速度提升）", buff:"speed"}
      ]},
    docks: { w:2752, h:1536, src:"assets/maps/docks.jpg", mask:"assets/masks/docks.png", safe:true, name:"琉璃雲海港", sign:"琉璃雲海港", sub:"安全區域 · 港口",
      spawn:[795,643],
      blocks:[{x:1070,y:382,r:76}],
      portals:[
        {x:459,y:428,r:107,to:"plaza", ts:[2263,1224], name:"返回廣場"},
        {x:1376,y:1255,r:107,to:"beach", ts:[917,535], name:"雲灣沙灘"}
      ],
      npcs:[]},
    beach: { w:2752, h:1536, src:"assets/maps/beach.jpg", mask:"assets/masks/beach.png", safe:false, name:"晨潮南岸", sign:"晨潮南岸", sub:"1〜8 等冒險區域",
      spawn:[917,535],
      blocks:[],
      portals:[{x:612,y:337,r:122,to:"docks", ts:[1376,1163], name:"返回雲港"}],
      npcs:[],
      spawns:[[1070,734],[1376,643],[1682,796],[1223,918]]
    },

    forge: { w:1536, h:858, src:"assets/maps/forge.jpg", mask:"assets/masks/forge.png", safe:true, name:"鍛造訓練場", sign:"鍛造訓練場", sub:"安全區域 · 工坊",
      spawn:[700,500],
      blocks:[{x:380,y:280,r:90}],
      portals:[{x:200,y:700,r:80,to:"plaza", ts:[764,520], name:"返回廣場"}],
      npcs:[{id:"iron", name:"神兵鍛造師・鐵鬚", tag:"🔨 鍛造", x:480, y:400, color:"#8B4513",
        talk:"星軌齒輪可以改變普攻的形態。鍛造爐還在預熱，等你蒐集到第一批空晶，我就幫你鑲上去。"}]}
  };

  const MONSTERS = {
    clover: { name:"三葉草晶露姆", hp:36, atk:6, spd:42, exp:14, gold:[3,7], scale:0.42, lv:1 },
    dandelion: { name:"風車蒲公英球怪", hp:32, atk:5, spd:50, exp:12, gold:[2,6], scale:0.42, lv:1 },
    crab: { name:"迷途貨箱寄居蟹", hp:48, atk:8, spd:34, exp:18, gold:[6,14], scale:0.46, lv:2 },
    penguin: { name:"鐵桶企鵝", hp:55, atk:9, spd:46, exp:22, gold:[5,12], scale:0.44, lv:2 }
  };

  const images = {};
  const masks = {};
  const player = {
    x:1376, y:1071, vx:0, vy:0, facing:1, walk:0,
    classId:"sword", gender:"male", name:"",
    lv:1, exp:0, expMax:50, gold:0, sp:0,
    hp:120, maxHp:120, mp:40, maxMp:40,
    atkCd:0, anim:0, hurt:0, inv:0, dash:0, dashCd:0,
    target:null, quest:null,
    items:{ potion:25, scroll:3, elixir:4 }
  };
  const skills = [];
  let ult = { name:"", cd:0, max:18 };
  const enemies = [];
  const parts = [];
  const floats = [];
  const paws = [];
  const coins = [];
  const logs = [];
  let near = null;
  let cam = {x:0,y:0};
  let hpShown = 120;
  const shiba = { follow:true, x:1346, y:1079, facing:1, walk:0, tongue:0 };
  let speedBuff = 0;
  let discovered = {plaza:true};

  const STORAGE_GUEST = "yunhai.guestId";
  const STORAGE_SAVE = "yunhai.save";
  const NAME_MIN = 1;
  const NAME_MAX = 8;
  const SAVE_AUTO_SEC = 5;
  let guestId = "";
  let saveDirty = false;
  let saveClock = 0;

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }
  function storageSet(key, val) {
    try { localStorage.setItem(key, val); return true; } catch (_) { return false; }
  }
  function ensureGuestId() {
    let id = storageGet(STORAGE_GUEST) || "";
    if (!id) {
      id = (globalThis.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : ("g-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12));
      storageSet(STORAGE_GUEST, id);
    }
    guestId = id;
    return id;
  }
  function normalizeName(raw) {
    return String(raw == null ? "" : raw).replace(/^[\s\u3000]+|[\s\u3000]+$/g, "").replace(/[\s\u3000]+/g, " ");
  }
  function validateName(raw) {
    const name = normalizeName(raw);
    const n = Array.from(name).length;
    if (!name || n < NAME_MIN) return { ok:false, name, message:"請輸入角色名（1 至 8 個字）" };
    if (n > NAME_MAX) return { ok:false, name, message:"角色名最多 8 個字" };
    if (/[\u0000-\u001F\u007F]/.test(name)) return { ok:false, name, message:"角色名含有無法使用的字元" };
    return { ok:true, name, message:"" };
  }
  function showNameHint(msg) {
    const el = $("name-hint");
    if (el) el.textContent = msg || "";
  }
  function snapshotSave() {
    return {
      version: 1,
      guestId: guestId || ensureGuestId(),
      name: player.name,
      classId: player.classId,
      gender: player.gender,
      lv: player.lv,
      exp: player.exp,
      expMax: player.expMax,
      gold: player.gold,
      sp: player.sp,
      hp: player.hp,
      maxHp: player.maxHp,
      mp: player.mp,
      maxMp: player.maxMp,
      items: {
        potion: (player.items && player.items.potion) | 0,
        scroll: (player.items && player.items.scroll) | 0,
        elixir: (player.items && player.items.elixir) | 0
      },
      quest: player.quest ? JSON.parse(JSON.stringify(player.quest)) : newQuestState(),
      discovered: Object.assign({}, discovered),
      mapId,
      x: player.x,
      y: player.y,
      facing: player.facing,
      mounted: !!mounted,
      savedAt: Date.now()
    };
  }
  function readSave() {
    const raw = storageGet(STORAGE_SAVE);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      if (!data || data.version !== 1) return null;
      if (!validateName(data.name).ok) return null;
      if (!CLASSES.some(c => c.id === data.classId)) return null;
      if (data.gender !== "male" && data.gender !== "female") return null;
      if (!MAPS[data.mapId]) return null;
      if (!Number.isFinite(Number(data.x)) || !Number.isFinite(Number(data.y))) return null;
      return data;
    } catch (_) {
      return null;
    }
  }
  function writeSave() {
    if (mode !== "play") return false;
    if (!validateName(player.name).ok) return false;
    return storageSet(STORAGE_SAVE, JSON.stringify(snapshotSave()));
  }
  function requestSave(immediate) {
    if (mode !== "play") return;
    if (immediate) {
      writeSave();
      saveDirty = false;
      saveClock = 0;
    } else {
      saveDirty = true;
    }
  }
  function applySave(data) {
    player.name = data.name;
    player.classId = data.classId;
    player.gender = data.gender === "female" ? "female" : "male";
    player.lv = data.lv | 0;
    player.exp = Number(data.exp) || 0;
    player.expMax = Number(data.expMax) || Math.floor(50 * Math.pow(Math.max(1, player.lv), 1.28));
    player.gold = data.gold | 0;
    player.sp = data.sp | 0;
    player.maxHp = Number(data.maxHp) || 1;
    player.maxMp = Number(data.maxMp) || 0;
    player.hp = Number(data.hp);
    player.mp = Number(data.mp);
    if (!Number.isFinite(player.hp)) player.hp = player.maxHp;
    if (!Number.isFinite(player.mp)) player.mp = player.maxMp;
    player.items = {
      potion: (data.items && data.items.potion) | 0,
      scroll: (data.items && data.items.scroll) | 0,
      elixir: (data.items && data.items.elixir) | 0
    };
    player.quest = data.quest ? JSON.parse(JSON.stringify(data.quest)) : newQuestState();
    if (!player.quest || !player.quest.southTrial) player.quest = newQuestState();
    discovered = Object.assign({ plaza:true }, data.discovered || {});
    mapId = data.mapId;
    player.x = Number(data.x);
    player.y = Number(data.y);
    player.facing = data.facing === -1 ? -1 : 1;
    player.vx = player.vy = 0;
    mounted = !!data.mounted;
    shiba.x = player.x - 30; shiba.y = player.y + 8;
    cam.x = player.x - visW() / 2; cam.y = player.y - visH() * 0.58;
  }
  function refreshTitle() {
    const data = readSave();
    const fresh = $("title-fresh");
    const cont = $("title-continue");
    const conf = $("title-confirm");
    if (conf) conf.style.display = "none";
    if (data) {
      if (fresh) fresh.style.display = "none";
      if (cont) cont.style.display = "block";
      const c = CLASSES.find(x => x.id === data.classId);
      const summary = $("save-summary");
      if (summary) summary.textContent = data.name + "  ·  " + (c ? c.name : data.classId) + "  ·  Lv." + data.lv;
    } else {
      if (fresh) fresh.style.display = "block";
      if (cont) cont.style.display = "none";
    }
  }
  function syncGenderButtons() {
    if ($("btn-male")) $("btn-male").classList.toggle("sel", player.gender === "male");
    if ($("btn-female")) $("btn-female").classList.toggle("sel", player.gender === "female");
  }
  function openCreate() {
    $("title").classList.remove("show");
    $("create").classList.add("show");
    mode = "create";
    player.name = "";
    player.classId = "sword";
    player.gender = "male";
    const input = $("hero-name-input");
    if (input) { input.value = ""; showNameHint(""); }
    buildClassCards();
    applyClass();
    syncGenderButtons();
    audioResume();
    pushScene();
    if (input) setTimeout(() => input.focus(), 50);
  }
  function tryEnterTown() {
    const input = $("hero-name-input");
    const result = validateName(input ? input.value : "");
    if (!result.ok) {
      showNameHint(result.message);
      if (input) input.focus();
      return;
    }
    showNameHint("");
    player.name = result.name;
    startPlay();
  }
  function continuePlay() {
    const data = readSave();
    if (!data) { refreshTitle(); return; }
    applySave(data);
    mode = "play";
    applyClass();
    spawnField();
    $("title").classList.remove("show");
    $("create").classList.remove("show");
    lastCombatAt = -1e9;
    audioResume();
    pushScene();
    log("[系統] 歡迎回來，" + player.name + "。🐾");
    log("[系統] 冒險從「" + (MAPS[mapId].sign || MAPS[mapId].name) + "」繼續。");
    syncArea();
    syncHud();
    requestSave(true);
  }

  function cls() { return CLASSES.find(c => c.id === player.classId) || CLASSES[0]; }

  function visW() { return W / VIEW_ZOOM; }
  function visH() { return H / VIEW_ZOOM; }
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    VIEW_ZOOM = clamp(Math.min(W/960, H/540) * 1.15, 1.2, 1.65);
    canvas.width = (W*DPR)|0; canvas.height = (H*DPR)|0;
    canvas.style.width = W+"px"; canvas.style.height = H+"px";
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }

  function loadImg(src) {
    return new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error(src));
      i.src = src;
    });
  }

  async function boot() {
    const list = [];
    for (const k of Object.keys(MAPS)) {
      list.push(["map_"+k, MAPS[k].src]);
      list.push(["mask_"+k, MAPS[k].mask]);
    }
    const POSES = ["idle","idle2","walk","ready","attack","dizzy"];
    for (const kind of Object.keys(MONSTERS)) {
      for (const pose of POSES) {
        list.push([kind+"_"+pose, "assets/sprites/"+kind+"_"+pose+".png"]);
      }
    }
    for (const id of ["sword","mage","archer","priest","merchant","beginner"]) {
      for (const pose of POSES) {
        list.push([id+"_"+pose, "assets/chars/"+id+"_"+pose+".png"]);
      }
    }
    for (const pose of POSES) {
      list.push(["shiba_"+pose, "assets/shiba/shiba_"+pose+".png"]);
    }
    let n=0;
    for (const [key,src] of list) {
      try { images[key] = await loadImg(src); }
      catch(e) { console.warn("missing", src); }
      n++;
      $("load-bar").style.width = (n/list.length*100)+"%" ;
    }
    for (const k of Object.keys(MAPS)) {
      const im = images["mask_"+k];
      if (!im) continue;
      const c = document.createElement("canvas");
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext("2d");
      g.drawImage(im,0,0);
      masks[k] = { w:c.width, h:c.height, data:g.getImageData(0,0,c.width,c.height).data };
    }
    $("load").style.display = "none";
    mode = "title";
    ensureGuestId();
    refreshTitle();
    buildClassCards();
    syncGenderButtons();
    requestAnimationFrame(loop);
  }

  function walkable(x,y) {
    const m = MAPS[mapId];
    if (!m) return false;
    if (x<20||y<20||x>m.w-20||y>m.h-20) return false;
    for (const b of m.blocks||[]) if (Math.hypot(x-b.x,y-b.y) < b.r) return false;
    const mk = masks[mapId];
    if (mk) {
      const mx = clamp((x/m.w*mk.w)|0, 0, mk.w-1);
      const my = clamp((y/m.h*mk.h)|0, 0, mk.h-1);
      if (mk.data[(my*mk.w+mx)*4] < 128) return false;
    }
    return true;
  }

  function tryMove(ent, dx, dy) {
    const nx = ent.x + dx, ny = ent.y + dy;
    if (walkable(nx, ny)) { ent.x=nx; ent.y=ny; return true; }
    if (walkable(nx, ent.y)) { ent.x=nx; return true; }
    if (walkable(ent.x, ny)) { ent.y=ny; return true; }
    return false;
  }

  function applyClass() {
    const c = cls();
    player.maxHp = c.hp + (player.lv-1)*16;
    player.maxMp = c.mp + (player.lv-1)*6;
    if (player.hp<=0 || mode!=="play") { player.hp = player.maxHp; player.mp = player.maxMp; }
    else { player.hp = Math.min(player.hp, player.maxHp); player.mp = Math.min(player.mp, player.maxMp); }
    skills.length = 0;
    c.skills.forEach((name,i) => skills.push({ name, cd:0, max: 5+i*1.4, icon:"✦" }));
    ult.name = c.ult; ult.max = 16;
    const btns = ["sk-heal","sk-star","sk-shield"];
    btns.forEach((id,i)=>{
      if (!skills[i] || !$(id)) return;
      $(id).title = skills[i].name;
    });
    if ($("sk-ult")) $("sk-ult").title = ult.name;
    $("hero-name").textContent = player.name;
    syncArea();
    syncHud();
  }

  function syncArea() {
    const m = MAPS[mapId];
    if (!m) return;
    const title = $("area-title") || $("area-board");
    if (title) title.textContent = m.sign || m.name;
    $("area-sub").textContent = m.sub || (m.safe ? "安全區域" : "冒險區域");
  }
  function syncHud() {
    $("hero-lv").textContent = "Lv."+player.lv;
    $("hero-name").textContent = player.name;
    const hp = clamp(player.hp/player.maxHp,0,1);
    $("hp-fill").style.width = (hp*100)+"%";
    hpShown = lerp(hpShown, player.hp, 0.08);
    $("hp-white").style.width = (clamp(hpShown/player.maxHp,0,1)*100)+"%";
    $("mp-fill").style.width = (clamp(player.mp/player.maxMp,0,1)*100)+"%";
    const expPct = clamp(player.exp/player.expMax,0,1)*100;
    $("exp-fill-top").style.width = expPct+"%";
    $("exp-pct").textContent = "EXP "+expPct.toFixed(1)+"%";
    document.querySelectorAll("#status .bar").forEach(b => {
      b.style.setProperty("--bw", b.clientWidth + "px");
    });
    $("skills").classList.toggle("town", !!MAPS[mapId].safe);
    $("auto-hunt").classList.toggle("on", auto);
    $("area-auto").classList.toggle("on", auto && !MAPS[mapId].safe);
    if ($("n-potion")) $("n-potion").textContent = String(player.items.potion);
    if ($("n-scroll")) $("n-scroll").textContent = String(player.items.scroll);
    if ($("n-elixir")) $("n-elixir").textContent = String(player.items.elixir);
    const bind = ["sk-heal","sk-star","sk-shield"];
    bind.forEach((id,i) => {
      const el = $(id) && $(id).querySelector(".cd");
      if (!el || !skills[i]) return;
      if (skills[i].cd>0) { el.style.display="flex"; el.textContent=Math.ceil(skills[i].cd); }
      else el.style.display="none";
    });
    const uel = $("sk-ult").querySelector(".cd");
    if (uel) {
      if (ult.cd>0) { uel.style.display="flex"; uel.textContent=Math.ceil(ult.cd); }
      else uel.style.display="none";
    }
  }

  function formatLogLine(msg) {
    return String(msg)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/^\[系統\]/, '<span class="lg-sys">[系統]</span>')
      .replace(/^\[獲得\]/, '<span class="lg-get">[獲得]</span>');
  }
  function log(msg) {
    logs.unshift(msg);
    if (logs.length>2) logs.length=2;
    $("log").innerHTML = logs.map(formatLogLine).join("<br>");
  }

  function addPart(x,y,c,n,sp) {
    for (let i=0;i<(n||8);i++) {
      const a=rand(0,Math.PI*2), s=rand(20, sp||140);
      parts.push({x,y,vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:rand(.25,.7), max:.7, c, sz:rand(1.5,3.5)});
    }
  }
  function addFloat(x,y,text,kind){
    if (kind===true) kind="crit";
    if (kind===false || kind==null) kind="dmg";
    const stack = floats.filter(f => Math.hypot(f.x-x, f.y-y)<28).length;
    floats.push({x, y:y-stack*20, text, kind, crit:kind==="crit", life: (kind==="exp"||kind==="gold")?1.2:0.95, vy:-46});
  }

  function audio() { return window.CSTAudio || null; }
  function audioResume() {
    const a = audio();
    if (!a) return;
    a.resume();
    a.setEnabled(bgmOn);
  }
  function noteCombat() { lastCombatAt = time; }
  function combatActive() {
    const m = MAPS[mapId];
    if (!m || m.safe) return false;
    if (mapId!=="field" && mapId!=="beach") return false;
    for (const e of enemies) {
      if (!e.dead && dist(e, player) < 220) { lastCombatAt = time; break; }
    }
    return (time - lastCombatAt) < COMBAT_HOLD;
  }
  function pushScene() {
    const a = audio();
    if (!a) return;
    const m = MAPS[mapId] || {};
    a.setScene({ mode, mapId, safe: !!m.safe, inCombat: combatActive() });
  }
  function sfx(name, a1, a2) {
    const a = audio();
    if (!a || !a.sfx[name]) return;
    a.sfx[name](a1, a2);
  }

  function gainExp(n) {
    player.exp += n;
    while (player.exp >= player.expMax) {
      player.exp -= player.expMax;
      player.lv++; player.sp++;
      player.expMax = Math.floor(50*Math.pow(player.lv,1.28));
      const c=cls();
      player.maxHp = c.hp + (player.lv-1)*16;
      player.maxMp = c.mp + (player.lv-1)*6;
      player.hp = player.maxHp; player.mp = player.maxMp;
      flash=.5; addFloat(player.x, player.y-60, "升級！", "crit");
      addPart(player.x, player.y, "#E8B84A", 24, 200);
      log("升到了 Lv "+player.lv+"！獲得 1 點 SP");
      sfx("levelUp");
      requestSave(true);
    }
  }

  function spawnField() {
    enemies.length=0;
    const m = MAPS[mapId];
    if (m.safe || !m.spawns) return;
    const kinds = mapId==="beach" ? ["penguin","dandelion","crab","penguin"] : ["clover","dandelion","crab","penguin"];
    m.spawns.forEach((s,i) => {
      const kind = kinds[i % kinds.length];
      const t = MONSTERS[kind];
      enemies.push({
        kind, name:t.name, lv:t.lv||1, x:s[0]+rand(-20,20), y:s[1]+rand(-16,16),
        hp:t.hp, maxHp:t.hp, atk:t.atk, spd:t.spd, exp:t.exp, gold:t.gold, scale:t.scale,
        facing:1, walk:0, state:"idle", timer:rand(0,2), atkCd:0, hurt:0, dead:0,
        vx:0, vy:0, homeX:s[0], homeY:s[1]
      });
    });
  }

  function warp(to, ts) {
    mapId = to;
    discovered[to]=true;
    lastCombatAt = -1e9;
    sfx("warp");
    player.x = ts[0]; player.y=ts[1];
    player.vx=player.vy=0;
    shiba.x=player.x-30; shiba.y=player.y+8;
    cam.x = player.x - visW()/2; cam.y = player.y - visH()/2;
    spawnField();
    flash=.35;
    log("[系統] 抵達「"+(MAPS[to].sign||MAPS[to].name)+"」");
    syncArea();
    syncHud();
    requestSave(true);
    pushScene();
  }

  function kill(e) {
    if (e.dead) return;
    e.dead=0.01; e.state="dizzy";
    const g = (rand(e.gold[0], e.gold[1]+1))|0;
    gainExp(e.exp);
    player.gold += g;
    addPart(e.x, e.y-20, "#E8B84A", 16, 160);
    addFloat(e.x, e.y-58, "⭐ +"+e.exp+" 經驗", "exp");
    addFloat(e.x, e.y-38, "🪙 +"+g+" 金幣", "gold");
    log("[獲得] 擊敗了"+e.name+"，+"+e.exp+" 經驗、+"+g+" 金幣");
    sfx("coins");
    const trial = player.quest && player.quest.southTrial;
    if (trial && trial.accepted && !trial.turnedIn && (mapId==="field" || mapId==="beach")) {
      if (trial.count<5) trial.count++;
      if (trial.count===5) log("委託完成！可以回去找露娜了");
    }
  }

  function deal(e, dmg, crit) {
    if (!e || e.dead) return;
    const d = Math.max(1, (dmg*(crit?2:1)*rand(.92,1.08))|0);
    e.hp -= d; e.hurt=.2; e.state = e.state==="dizzy"?e.state:"ready";
    addFloat(e.x, e.y-70, "傷害 -"+d+"!", crit?"crit":"dmg");
    addPart(e.x, e.y-20, crit?"#E8B84A":"#fff", crit?14:8, 120);
    if (crit) shake=.2;
    sfx("hit", { crit: !!crit });
    if (e.hp<=0) kill(e);
  }

  function hurtPlayer(d, from) {
    if (player.inv>0) return;
    player.hp = Math.max(0, player.hp-d);
    player.hurt=.25; player.inv=.5;
    shake=.18;
    addFloat(player.x, player.y-70, "傷害 -"+(d|0)+"!", "dmg");
    if (from) {
      const a=Math.atan2(player.y-from.y, player.x-from.x);
      player.vx+=Math.cos(a)*120; player.vy+=Math.sin(a)*90;
    }
    if (player.hp<=0) {
      player.hp=0;
      log("你倒下了…露娜把你送回了風車鎮。");
      player.hp = player.maxHp*0.6;
      sfx("death");
      warp("plaza", MAPS.plaza.spawn);
    } else {
      sfx("hurt");
      noteCombat();
    }
    syncHud();
  }

  function doAttack() {
    if (player.atkCd>0 || mode!=="play") return;
    const c=cls();
    player.atkCd = 0.55;
    player.anim=1;
    sfx("attack", c.id);
    noteCombat();
    let tgt = player.target;
    if (!tgt || tgt.dead || dist(player,tgt)>c.range+30) {
      tgt=null; let bd=c.range+20;
      for (const e of enemies) { if(e.dead) continue; const d=dist(player,e); if(d<bd){bd=d;tgt=e;} }
      player.target=tgt;
    }
    const ang = tgt ? Math.atan2(tgt.y-player.y, tgt.x-player.x) : (player.facing>=0?0:Math.PI);
    if (tgt) player.facing = Math.cos(ang)>=0?1:-1;
    const crit = Math.random()<0.18;
    const dmg = c.atk + (player.lv-1)*2;
    if (c.id==="mage" || c.id==="archer" || c.id==="merchant") {
      // projectile visual
      addPart(player.x+player.facing*20, player.y-28, c.color, 6, 80);
    }
    for (const e of enemies) {
      if (e.dead) continue;
      const d=dist(player,e);
      const a=Math.atan2(e.y-player.y,e.x-player.x);
      const ad=Math.abs(Math.atan2(Math.sin(a-ang), Math.cos(a-ang)));
      if (d < c.range && ad < (c.id==="sword"?1.2:0.7)) deal(e, dmg, crit);
    }
    player.mp = Math.min(player.maxMp, player.mp+1);
  }

  function cast(i) {
    if (mode!=="play") return;
    const c=cls();
    if (i===-1) {
      if (ult.cd>0 || player.mp<18) return;
      ult.cd=ult.max; player.mp-=18; player.anim=1; shake=.4; flash=.3;
      log("施放 "+ult.name+"！");
      sfx("ult", c.id);
      noteCombat();
      enemies.forEach(e => { if(!e.dead && dist(player,e)<210) deal(e, (c.atk+player.lv*3)*2.8, true); });
      addPart(player.x, player.y, "#E8B84A", 40, 260);
      return;
    }
    const s=skills[i]; if(!s||s.cd>0) return;
    const cost = 6+i*2;
    if (player.mp<cost) { log("魔力不足"); return; }
    player.mp-=cost; s.cd=s.max; player.anim=1;
    log("施放 "+s.name);
    sfx("skill", i, c.id);
    noteCombat();
    if (s.name.indexOf("閃現")>=0 || s.name.indexOf("後躍")>=0 || s.name.indexOf("衝鋒")>=0) {
      const dir = player.facing;
      const step = s.name.indexOf("後躍")>=0 ? -90 : 110;
      tryMove(player, dir*step, 0);
      if (s.name.indexOf("衝鋒")>=0) {
        enemies.forEach(e=>{ if(!e.dead && dist(player,e)<90) deal(e,c.atk*1.8,false); });
      }
    } else if (s.name.indexOf("恩典")>=0 || s.name.indexOf("年輪")>=0) {
      player.hp=Math.min(player.maxHp, player.hp+player.maxHp*0.28);
      addPart(player.x, player.y, "#7EC97A", 18, 80);
    } else {
      const r = 90+i*30;
      enemies.forEach(e=>{ if(!e.dead && dist(player,e)<r) deal(e, c.atk*(1.3+i*0.4), Math.random()<0.2); });
      addPart(player.x, player.y-10, c.color, 16+i*6, 180);
      if (i>=2) shake=.22;
    }
    syncHud();
  }

  function doDash() {
    if (player.dashCd>0) return;
    player.dash=0.18; player.dashCd=1.1;
    addPart(player.x, player.y, "#fff", 8, 60);
  }

  function update(dt) {
    time+=dt; shake=Math.max(0,shake-dt*2); flash=Math.max(0,flash-dt*1.8);
    speedBuff=Math.max(0,speedBuff-dt);
    if (mode!=="play") return;

    let ix=0, iy=0;
    if (keys["keyw"]||keys["arrowup"]) iy-=1;
    if (keys["keys"]||keys["arrowdown"]) iy+=1;
    if (keys["keya"]||keys["arrowleft"]) ix-=1;
    if (keys["keyd"]||keys["arrowright"]) ix+=1;
    if (stick.on) { ix+=stick.dx; iy+=stick.dy; }
    if (auto && !MAPS[mapId].safe) {
      let t=null,bd=1e9;
      for (const e of enemies){ if(e.dead) continue; const d=dist(player,e); if(d<bd){bd=d;t=e;} }
      if (t) {
        const a=Math.atan2(t.y-player.y,t.x-player.x);
        const c=cls();
        if (bd>c.range*0.75) { ix+=Math.cos(a); iy+=Math.sin(a); }
        player.target=t;
        if (bd<c.range && player.atkCd<=0) doAttack();
        skills.forEach((s,i)=>{ if(s.cd<=0 && player.mp>10) cast(i); });
      }
    }
    const len=Math.hypot(ix,iy)||1;
    if (ix||iy) { ix/=len; iy/=len; if(ix) player.facing = ix>=0?1:-1; }
    const c=cls();
    const spd = (c.speed + (mounted?50:0) + (speedBuff>0?40:0)) * (player.dash>0?2.2:1);
    player.vx = lerp(player.vx, ix*spd, 0.2);
    player.vy = lerp(player.vy, iy*spd, 0.2);
    tryMove(player, player.vx*dt, player.vy*dt);
    const moving = Math.hypot(player.vx, player.vy)>12;
    player.walk += moving ? dt*7 : 0;
    player.atkCd=Math.max(0,player.atkCd-dt);
    player.anim=Math.max(0,player.anim-dt*3);
    player.hurt=Math.max(0,player.hurt-dt);
    player.inv=Math.max(0,player.inv-dt);
    player.dash=Math.max(0,player.dash-dt);
    player.dashCd=Math.max(0,player.dashCd-dt);
    skills.forEach(s=>s.cd=Math.max(0,s.cd-dt));
    ult.cd=Math.max(0,ult.cd-dt);
    if (player.mp<player.maxMp) player.mp=Math.min(player.maxMp, player.mp+dt*2.2);

    // shiba
    const tx = player.x - player.facing* (mounted?0:36);
    const ty = player.y + (mounted?10:8);
    shiba.x = lerp(shiba.x, tx, mounted?0.35:0.08);
    shiba.y = lerp(shiba.y, ty, mounted?0.35:0.08);
    if (Math.hypot(shiba.x-tx, shiba.y-ty)>4) {
      shiba.walk+=dt*8; shiba.facing = (tx>=shiba.x)?1:-1;
      if (mounted || Math.random()<dt*8) {
        paws.push({x:shiba.x - shiba.facing*6, y:shiba.y+10, life:2, rot:rand(-.3,.3)});
      }
    }
    shiba.tongue += dt;

    // paw fade
    for (let i=paws.length-1;i>=0;i--) { paws[i].life-=dt; if(paws[i].life<=0) paws.splice(i,1); }

    // enemies
    for (const e of enemies) {
      if (e.dead) { e.dead+=dt; continue; }
      e.hurt=Math.max(0,e.hurt-dt);
      e.atkCd=Math.max(0,e.atkCd-dt);
      e.timer-=dt;
      const d=dist(e,player);
      if (d<220) {
        const a=Math.atan2(player.y-e.y, player.x-e.x);
        e.facing = Math.cos(a)>=0?1:-1;
        if (d>58) {
          e.state="walk"; e.walk+=dt*6;
          tryMove(e, Math.cos(a)*e.spd*dt, Math.sin(a)*e.spd*dt);
        } else {
          e.state = e.atkCd<=0 ? "attack" : "ready";
          if (e.atkCd<=0) { e.atkCd=1.6; hurtPlayer(e.atk, e); }
        }
      } else {
        if (e.timer<=0) {
          e.timer=rand(1,3);
          const a=rand(0,Math.PI*2);
          e.vx=Math.cos(a); e.vy=Math.sin(a); e.state="walk";
        }
        if (e.state==="walk") {
          e.walk+=dt*4;
          if (!tryMove(e, e.vx*e.spd*0.5*dt, e.vy*e.spd*0.5*dt)) e.timer=0;
          e.facing=e.vx>=0?1:-1;
          if (Math.hypot(e.x-e.homeX,e.y-e.homeY)>160) { e.vx=Math.sign(e.homeX-e.x); e.vy=Math.sign(e.homeY-e.y); }
        } else e.state="idle";
      }
    }
    for (let i=enemies.length-1;i>=0;i--) if (enemies[i].dead>1.4) {
      const e=enemies[i];
      // respawn later at home
      const kind=e.kind; const hx=e.homeX, hy=e.homeY;
      enemies.splice(i,1);
      setTimeout(() => {
        if (mapId!=="field" && mapId!=="beach") return;
        const t=MONSTERS[kind];
        enemies.push({ kind,name:t.name,lv:t.lv||1,x:hx,y:hy,hp:t.hp,maxHp:t.hp,atk:t.atk,spd:t.spd,exp:t.exp,gold:t.gold,scale:t.scale,facing:1,walk:0,state:"idle",timer:1,atkCd:0,hurt:0,dead:0,vx:0,vy:0,homeX:hx,homeY:hy });
      }, 5000);
    }

    for (let i=parts.length-1;i>=0;i--) {
      const p=parts[i]; p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=80*dt;
      if(p.life<=0) parts.splice(i,1);
    }
    for (let i=floats.length-1;i>=0;i--) {
      const f=floats[i]; f.life-=dt; f.y+=f.vy*dt; f.vy+=70*dt;
      if(f.life<=0) floats.splice(i,1);
    }

    // interact
    near=null;
    const m=MAPS[mapId];
    let best=Infinity, typ=null, obj=null;
    for (const p of m.portals) {
      const d=Math.hypot(player.x-p.x, player.y-p.y);
      if (d<Math.max(70, p.r||0) && d<best) { best=d; typ="portal"; obj=p; }
    }
    for (const n of m.npcs) {
      const d=Math.hypot(player.x-n.x, player.y-n.y);
      if (d<70 && d<best) { best=d; typ="npc"; obj=n; }
    }
    if (obj) {
      near={typ,obj};
      $("prompt").style.display="block";
      $("prompt").textContent = typ==="portal" ? ("前往「"+MAPS[obj.to].name+"」") : ("與"+obj.name+"交談");
    } else $("prompt").style.display="none";

    cam.x = lerp(cam.x, player.x-visW()/2, 0.12);
    cam.y = lerp(cam.y, player.y-visH()*0.58, 0.12);
    cam.x = clamp(cam.x, 0, Math.max(0, m.w-visW()));
    cam.y = clamp(cam.y, 0, Math.max(0, m.h-visH()));

    if ((Math.floor(time*10)%2)===0) syncHud();
    drawFace();
    pushScene();
    saveClock += dt;
    if (saveClock >= SAVE_AUTO_SEC) requestSave(true);
  }

  function newQuestState() {
    return { southTrial: { accepted:false, count:0, turnedIn:false, hintSaid:false } };
  }
  function trialQuest() {
    if (!player.quest) player.quest = newQuestState();
    return player.quest.southTrial;
  }
  function npcTalk(n) {
    const q = trialQuest();
    if (n.id==="luna") {
      if (!q.accepted)
        return "羅盤指向八大浮空大陸。南郊草原的星門已經為你點亮。先去那裡熟悉戰鬥，為我帶回五次平安歸來的足跡，好嗎？需要我送你一程嗎？";
      if (!q.turnedIn && q.count<5)
        return "羅盤還沒有感到你的步伐站穩。再於南郊草原或晨潮南岸擊敗魔物，湊滿五次，然後回來找我。要我送你到星門嗎？";
      if (!q.turnedIn)
        return "風吹過羅盤，指針穩了些。做得很好。這一點路費，請收好。之後若想前往已經踏足的地方，隨時來找我。";
      if (!q.hintSaid)
        return "更遠的空島還在雲層後面。等你準備好，羅盤會再為你轉一格。";
      return "羅盤指向八大浮空大陸。想去已發現的地方，我可以立刻送你一程。";
    }
    if (n.id==="arya") {
      if (q.accepted && !q.turnedIn)
        return "劍、星、弓、光與算盤，都是艾瑟蘭留下的路。先把步伐走穩，再來談轉職也不遲。";
      return n.talk;
    }
    if (n.id==="hawkins") {
      if (q.turnedIn)
        return "路費進袋的聲音，我聽得很清楚。等商路正式開張，霍金斯會第一個給你派單。";
      return n.talk;
    }
    if (n.id==="buck") {
      if (q.turnedIn)
        return "南郊的蒲公英絨毛，有時會被風送到港邊。你若再路過晨潮南岸，記得聞一聞潮氣——那是下一杯特調的線索。（獲得 30 秒移動速度提升）";
      return n.talk;
    }
    if (n.id==="iron") {
      if (q.turnedIn)
        return "活著回來的旅人，爐火也願意多旺一會兒。空晶不用急，先讓手熟悉武器的重量。";
      return n.talk;
    }
    return n.talk;
  }
  let dlgAfter = null;
  function warpToSouthField() {
    warp("field", MAPS.field.spawn);
  }
  function commitLunaTalk() {
    const q = trialQuest();
    if (!q.accepted) {
      q.accepted = true;
      q.count = 0;
      log("接取委託：南郊試行——擊敗 5 隻魔物，返回廣場找露娜。");
      requestSave(true);
      warpToSouthField();
      return;
    }
    if (!q.turnedIn && q.count>=5) {
      q.turnedIn = true;
      player.gold += 50;
      player.items.potion += 3;
      sfx("coins");
      log("委託完成：南郊試行。獲得 50 金幣、治療藥水 ×3。");
      syncHud();
      requestSave(true);
      return;
    }
    if (q.turnedIn && !q.hintSaid) { q.hintSaid = true; requestSave(true); }
    warpToSouthField();
  }
  function interact() {
    if (!near || mode!=="play") return;
    dlgAfter = null;
    if (near.typ==="portal") warp(near.obj.to, near.obj.ts);
    else {
      const n=near.obj;
      $("dlg-title").textContent = n.tag+"  "+n.name;
      $("dlg-body").textContent = npcTalk(n);
      $("dialog").classList.add("show");
      sfx("talk");
      if (n.id==="luna") dlgAfter = commitLunaTalk;
      if (n.buff==="speed") { speedBuff=30; log("巴克的靈飲讓你步伐輕盈了！"); }
    }
  }

  // ---------- drawing ----------
  function strokeFill(g, fill, lw) {
    g.fillStyle=fill; g.fill();
    g.strokeStyle=OUTLINE; g.lineWidth=lw||2; g.lineJoin="round"; g.lineCap="round"; g.stroke();
  }

  function drawPlate(g, x, y, text, color, size) {
    g.save();
    g.font = "800 "+(size||13)+"px PingFang TC, Microsoft JhengHei, sans-serif";
    g.textAlign = "center";
    g.lineJoin = "round";
    g.miterLimit = 2;
    g.lineWidth = 5;
    g.strokeStyle = "rgba(255,248,232,.94)";
    g.strokeText(text, x, y);
    g.fillStyle = color || "#3A8AD8";
    g.fillText(text, x, y);
    g.restore();
  }

  const HERO_H = 122;
  const SHIBA_H = 76;

  function officialPose(opt) {
    if (opt.dizzy) return "dizzy";
    if ((opt.anim || 0) > 0) return "attack";
    if (opt.ready) return "ready";
    if (opt.moving) return (Math.floor((opt.walk || 0) * 0.9) % 2 === 0) ? "walk" : "idle2";
    const t = (opt.walk != null ? opt.walk : time);
    return (Math.floor(t * 2 + (opt._x || 0)) % 2 === 0) ? "idle" : "idle2";
  }

  function drawSpriteAt(g, img, x, y, h, facing, flash) {
    if (!img) return;
    const w = h * (img.naturalWidth / img.naturalHeight);
    g.save();
    g.translate(x, y);
    g.scale(facing < 0 ? -1 : 1, 1);
    g.fillStyle = "rgba(74,53,37,.22)";
    g.beginPath();
    g.ellipse(0, 6, Math.max(12, w * 0.28), 5, 0, 0, Math.PI * 2);
    g.fill();
    if (flash) g.filter = "brightness(1.4)";
    g.drawImage(img, -w / 2, -h + 8, w, h);
    g.restore();
  }

  function drawShiba(g, x, y, sc, fac, walk, mount) {
    const h = SHIBA_H * (sc || 1);
    const tx = player.x - player.facing * (mount ? 0 : 36);
    const ty = player.y + (mount ? 10 : 8);
    const moving = Math.hypot(shiba.x - tx, shiba.y - ty) > 4;
    let pose = "idle";
    if (player.hurt > 0) pose = "dizzy";
    else if (mount && player.anim > 0) pose = "attack";
    else if (moving) pose = "walk";
    else pose = (Math.floor(time * 2) % 2 === 0) ? "idle" : "idle2";
    const img = images["shiba_" + pose] || images["shiba_idle"];
    drawSpriteAt(g, img, x, y, h, fac);
  }

  function drawHero(g, x, y, opt) {
    const c = CLASSES.find(k => k.id === opt.classId) || CLASSES[0];
    const id = (c && c.id) || opt.classId || "sword";
    const h = HERO_H * (opt.scale || 1);
    const pose = officialPose({
      dizzy: opt.dizzy, hurt: opt.hurt, anim: opt.anim,
      ready: opt.ready, moving: opt.moving, walk: opt.walk, _x: x
    });
    const img = images[id + "_" + pose] || images[id + "_idle"];
    drawSpriteAt(g, img, x, y, h, opt.facing || 1, (opt.hurt || 0) > 0);
  }

  function drawHair(g, c, gender, col, walk) {
    const sway = Math.sin(walk)*2;
    g.fillStyle=col;
    if (c.id==="mage" || c.id==="priest" || (gender==="female" && c.id==="merchant")) {
      g.beginPath(); g.ellipse(0,-32,16,10,0,0,Math.PI*2); strokeFill(g,col);
      g.beginPath(); g.arc(-12+sway,-32,7,0,Math.PI*2); strokeFill(g,col); // bun
      if (c.id==="mage") {
        g.beginPath(); g.moveTo(-18,-32); g.quadraticCurveTo(-26+sway,-20, -16,-18); strokeFill(g,"#3A5CBF",1.5);
        g.fillStyle="#E8B84A"; g.beginPath(); g.arc(-14,-36,2.2,0,Math.PI*2); g.fill();
      }
      // bangs
      g.beginPath(); g.ellipse(-7,-28,6,7, -0.3,0,Math.PI*2); strokeFill(g,col);
      g.beginPath(); g.ellipse(7,-28,6,7, 0.3,0,Math.PI*2); strokeFill(g,col);
    } else {
      g.beginPath(); g.ellipse(0,-32,16,11,0,0,Math.PI*2); strokeFill(g,col);
      g.beginPath(); g.ellipse(-12,-28,6,8,-0.4,0,Math.PI*2); strokeFill(g,col);
      g.beginPath(); g.ellipse(12,-28,6,8,0.4,0,Math.PI*2); strokeFill(g,col);
    }
  }

  function drawNpc(g, n) {
    const bob=Math.sin(time*2.4 + n.x)*2;
    const x=n.x, y=n.y+bob;
    g.save();
    g.translate(x, y);
    g.fillStyle="rgba(74,53,37,.22)";
    g.beginPath(); g.ellipse(0, 8, 14, 5, 0, 0, Math.PI*2); g.fill();
    g.beginPath(); g.roundRect(-11, -16, 22, 24, 8); strokeFill(g, n.color||"#C49A3C");
    g.beginPath(); g.ellipse(0, -28, 13, 13, 0, 0, Math.PI*2); strokeFill(g, "#F3C7A3");
    g.fillStyle="rgba(240,120,120,.28)";
    g.beginPath(); g.ellipse(-6,-26,3,2,0,0,Math.PI*2); g.fill();
    g.beginPath(); g.ellipse(6,-26,3,2,0,0,Math.PI*2); g.fill();
    g.fillStyle=OUTLINE;
    g.beginPath(); g.ellipse(-5,-30,2.4,3,0,0,Math.PI*2); g.fill();
    g.beginPath(); g.ellipse(5,-30,2.4,3,0,0,Math.PI*2); g.fill();
    g.fillStyle="#fff";
    g.beginPath(); g.arc(-4.2,-31,0.8,0,Math.PI*2); g.fill();
    g.beginPath(); g.arc(5.8,-31,0.8,0,Math.PI*2); g.fill();
    g.beginPath(); g.ellipse(0,-36,13,8,0,0,Math.PI*2); strokeFill(g, n.color||"#5A3A1C");
    g.restore();
    g.save();
    g.font="bold 11px PingFang TC, Noto Sans TC, sans-serif";
    g.textAlign="center";
    const label=n.tag;
    const w=g.measureText(label).width+14;
    g.fillStyle="rgba(255,246,230,.92)";
    g.strokeStyle="#C48A3A"; g.lineWidth=2;
    g.beginPath(); g.roundRect(n.x-w/2, n.y-90, w, 16, 8); g.fill(); g.stroke();
    g.fillStyle=OUTLINE; g.fillText(label, n.x, n.y-78);
    g.restore();
  }

  function drawMonster(g, e) {
    let pose="idle";
    if (e.dead) pose="dizzy";
    else if (e.state==="attack") pose="attack";
    else if (e.state==="ready") pose="ready";
    else if (e.state==="walk") pose = (Math.floor(e.walk)%2===0)?"walk":"idle2";
    else pose = (Math.floor(time*2+e.x)%2===0)?"idle":"idle2";
    const img = images[e.kind+"_"+pose] || images[e.kind+"_idle"];
    const h = 104 * e.scale / 0.42;
    if (img) {
      const w = h * (img.naturalWidth/img.naturalHeight);
      g.save();
      if (e.hurt>0) g.filter="brightness(1.4)";
      if (e.dead) g.globalAlpha=Math.max(0, 1-e.dead);
      g.translate(e.x, e.y);
      g.scale(e.facing, 1);
      g.drawImage(img, -w/2, -h+8, w, h);
      g.restore();
    }
    if (!e.dead) {
      const bw=36, bh=5;
      g.fillStyle="rgba(0,0,0,.45)"; g.fillRect(e.x-bw/2, e.y-h+6, bw, bh);
      g.fillStyle="#E23A4A"; g.fillRect(e.x-bw/2, e.y-h+6, bw*clamp(e.hp/e.maxHp,0,1), bh);
    }
  }

  function render() {
    ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.fillStyle="#87C6EF"; ctx.fillRect(0,0,W,H);
    const m = MAPS[mapId];
    const img = images["map_"+mapId];
    ctx.save();
    if (shake>0) ctx.translate((Math.random()-.5)*10*shake,(Math.random()-.5)*10*shake);
    ctx.scale(VIEW_ZOOM, VIEW_ZOOM);
    ctx.translate(-cam.x, -cam.y);
    if (img) ctx.drawImage(img, 0, 0, m.w, m.h);
    // portals glow
    for (const p of m.portals) {
      const t=0.5+0.5*Math.sin(time*3);
      ctx.beginPath(); ctx.arc(p.x,p.y, 18+t*4, 0, Math.PI*2);
      ctx.fillStyle=`rgba(120,220,255,${0.25+t*0.2})`; ctx.fill();
      ctx.strokeStyle=`rgba(180,240,255,${0.6})`; ctx.lineWidth=2; ctx.stroke();
    }
    // paws
    for (const p of paws) {
      const a=clamp(p.life/2,0,1);
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.globalAlpha=a;
      ctx.fillStyle="#F4A8C4";
      ctx.beginPath(); ctx.ellipse(0,0,4.5,3.5,0,0,Math.PI*2); ctx.fill();
      [[-4,-4],[0,-6],[4,-4]].forEach(([x,y])=>{ ctx.beginPath(); ctx.ellipse(x,y,2,2.2,0,0,Math.PI*2); ctx.fill(); });
      if (a<0.35) { ctx.fillStyle="#fff"; ctx.globalAlpha=a; ctx.beginPath(); ctx.arc(0,-2,1.2,0,Math.PI*2); ctx.fill(); }
      ctx.restore();
    }
    // y-sort
    const ents = [];
    if (!mounted) ents.push({y:shiba.y, z:0, draw:()=>drawShiba(ctx, shiba.x, shiba.y, 1, shiba.facing, shiba.walk, false)});
    ents.push({y:player.y, z:1, draw:()=>{
      if (mounted) {
        drawShiba(ctx, player.x, player.y+6, 1.05, player.facing, player.walk, true);
        drawHero(ctx, player.x, player.y-26, {classId:player.classId, facing:player.facing, walk:player.walk, anim:player.anim, gender:player.gender, moving:Math.hypot(player.vx,player.vy)>12, scale:0.95, hurt:player.hurt, ready:combatActive()});
      } else {
        drawHero(ctx, player.x, player.y, {classId:player.classId, facing:player.facing, walk:player.walk, anim:player.anim, gender:player.gender, moving:Math.hypot(player.vx,player.vy)>12, hurt:player.hurt, ready:combatActive()});
      }
    }});
    for (const n of m.npcs) ents.push({y:n.y, z:0, draw:()=>drawNpc(ctx,n)});
    for (const e of enemies) ents.push({y:e.y, z:0, draw:()=>drawMonster(ctx,e)});
    ents.sort((a,b)=>a.y-b.y || a.z-b.z);
    ents.forEach(e=>e.draw());

    // parts / floats in world
    for (const p of parts) {
      ctx.globalAlpha=clamp(p.life/p.max,0,1);
      ctx.fillStyle=p.c; ctx.beginPath(); ctx.arc(p.x,p.y,p.sz,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
    }
    // nameplates
    drawPlate(ctx, player.x, (mounted?player.y-138:player.y-118), player.name, "#3A8AD8", 15);
    drawPlate(ctx, player.x, (mounted?player.y-122:player.y-102), "Lv."+player.lv+" "+cls().name, "#3A8AD8", 12);
    if (!mounted) drawPlate(ctx, shiba.x, shiba.y-78, "阿柴 🐾", "#C47A2A", 13);
    for (const e of enemies) {
      if (e.dead) continue;
      const eh = 104 * e.scale / 0.42;
      drawPlate(ctx, e.x, e.y-eh-10, e.name+"  Lv."+(e.lv||1), "#5A3A1C", 13);
    }

    for (const f of floats) {
      const pal = {
        dmg:  { fill:"#FF3B4A", size:22, stroke:"#fff" },
        crit: { fill:"#FF7A18", size:24, stroke:"#fff" },
        exp:  { fill:"#FFE08A", size:16, stroke:"#5A3A1C" },
        gold: { fill:"#FFD24A", size:16, stroke:"#5A3A1C" },
        heal: { fill:"#7CFF8A", size:16, stroke:"#1A4A20" }
      }[f.kind] || { fill:"#fff", size:16, stroke:"#4A3525" };
      ctx.globalAlpha=clamp(f.life,0,1);
      ctx.font=`900 ${pal.size}px PingFang TC, Microsoft JhengHei, sans-serif`;
      ctx.textAlign="center"; ctx.lineJoin="round"; ctx.miterLimit=2;
      ctx.strokeStyle=pal.stroke; ctx.lineWidth=f.kind==="dmg"||f.kind==="crit"?6:4;
      ctx.strokeText(f.text,f.x,f.y);
      ctx.fillStyle=pal.fill; ctx.fillText(f.text,f.x,f.y);
      ctx.globalAlpha=1;
    }

    // speech bubble if near npc
    if (near && near.typ==="npc") {
      const n=near.obj;
      ctx.fillStyle="#fff"; ctx.strokeStyle=OUTLINE; ctx.lineWidth=2;
      ctx.beginPath(); ctx.roundRect(n.x+16, n.y-90, 10, 8, 4); ctx.fill(); // small
    }

    // joystick visual
    if (stick.on) {
      ctx.save(); ctx.setTransform(DPR,0,0,DPR,0,0);
      ctx.globalAlpha=0.3;
      ctx.strokeStyle="#E8B84A"; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(stick.ox, stick.oy, 48, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath();
      // octagram
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4 - Math.PI/8, r=i%2?48:36;
        i===0?ctx.moveTo(stick.ox+Math.cos(a)*r, stick.oy+Math.sin(a)*r):ctx.lineTo(stick.ox+Math.cos(a)*r, stick.oy+Math.sin(a)*r);
      }
      ctx.closePath(); ctx.stroke();
      ctx.globalAlpha=0.45;
      ctx.beginPath(); ctx.arc(stick.x, stick.y, 16, 0, Math.PI*2); ctx.fillStyle="#E8B84A"; ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    if (flash>0) { ctx.fillStyle=`rgba(255,240,200,${flash*0.55})`; ctx.fillRect(0,0,W,H); }

    // minimap
    const mim = images["map_"+mapId];
    if (mim) {
      mctx.fillStyle="#8FCB8A"; mctx.fillRect(0,0,184,184);
      mctx.save();
      mctx.beginPath(); mctx.arc(92,92,90,0,Math.PI*2); mctx.clip();
      const s=184/Math.max(m.w,m.h);
      const ox=(184-m.w*s)/2, oy=(184-m.h*s)/2;
      mctx.drawImage(mim, ox, oy, m.w*s, m.h*s);
      mctx.fillStyle="#E23A4A";
      mctx.beginPath(); mctx.arc(ox+player.x*s, oy+player.y*s, 4, 0, Math.PI*2); mctx.fill();
      mctx.restore();
    }

    // create preview
    if (mode==="create" || $("create").classList.contains("show")) {
      pctx.clearRect(0,0,180,200);
      pctx.fillStyle="#F7E8C6"; pctx.fillRect(0,0,180,200);
      drawHero(pctx, 90, 150, {classId:player.classId, facing:1, walk:time*3, anim:0, gender:player.gender, moving:true, scale:1.15});
    }
  }

  function drawFace() {
    const img = images[player.classId+"_idle"] || images[player.classId+"_idle2"];
    fctx.clearRect(0,0,104,104);
    fctx.fillStyle="#F8D7B0";
    fctx.fillRect(0,0,104,104);
    if (!img) return;
    const h = 210;
    const w = h * (img.naturalWidth/img.naturalHeight);
    fctx.drawImage(img, 52-w/2, -8, w, h);
  }

  let last=performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt=Math.min(0.05,(now-last)/1000); last=now;
    if (document.body) document.body.dataset.mode = mode;
    update(dt);
    render();
  }

  function canvasPos(ev) {
    const r=canvas.getBoundingClientRect();
    return {x:ev.clientX-r.left, y:ev.clientY-r.top};
  }
  function worldFrom(sx,sy){ return {x:sx/VIEW_ZOOM+cam.x, y:sy/VIEW_ZOOM+cam.y}; }

  function onDown(ev) {
    if (mode!=="play") return;
    if (audio()) audio().resume();
    if (ev.target && ev.target.closest && ev.target.closest("#hud button, #skills, #drawer, #prompt, .overlay, .icon-btn")) return;
    const p=canvasPos(ev);
    // left bottom stick zone
    if (p.x < W*0.45 && p.y > H*0.4) {
      stick.on=true; stick.ox=p.x; stick.oy=p.y; stick.x=p.x; stick.y=p.y; stick.dx=0; stick.dy=0;
      if (ev.pointerId!=null && canvas.setPointerCapture) try{ canvas.setPointerCapture(ev.pointerId); }catch(_){}
      return;
    }
    const w=worldFrom(p.x,p.y);
    // click enemy / npc / portal
    for (const e of enemies) {
      if (!e.dead && Math.hypot(w.x-e.x, w.y-e.y)<40) { player.target=e; if(player.atkCd<=0) doAttack(); return; }
    }
    const m=MAPS[mapId];
    for (const n of m.npcs) if (Math.hypot(w.x-n.x,w.y-n.y)<40){ near={typ:"npc",obj:n}; interact(); return; }
    for (const pt of m.portals) if (Math.hypot(w.x-pt.x,w.y-pt.y)<50){ near={typ:"portal",obj:pt}; interact(); return; }
    doAttack();
  }
  function onMove(ev) {
    if (!stick.on) return;
    const p=canvasPos(ev);
    const dx=p.x-stick.ox, dy=p.y-stick.oy;
    const len=Math.hypot(dx,dy);
    const max=48;
    const k=len>max?max/len:1;
    stick.x=stick.ox+dx*k; stick.y=stick.oy+dy*k;
    stick.dx=(dx*k)/max; stick.dy=(dy*k)/max;
  }
  function onUp() { stick.on=false; stick.dx=stick.dy=0; }

  function startPlay() {
    discovered = {plaza:true};
    mounted = false;
    auto = false;
    speedBuff = 0;
    applyClass();
    mapId="plaza";
    player.x=MAPS.plaza.spawn[0]; player.y=MAPS.plaza.spawn[1];
    shiba.x=player.x-30; shiba.y=player.y+8;
    cam.x=player.x-visW()/2; cam.y=player.y-visH()*0.58;
    player.quest=newQuestState(); player.gold=80; player.lv=1; player.exp=0; player.expMax=50;
    player.hp=cls().hp; player.maxHp=cls().hp; player.mp=cls().mp; player.maxMp=cls().mp;
    player.items={ potion:25, scroll:3, elixir:4 };
    spawnField();
    mode="play";
    $("title").classList.remove("show");
    $("create").classList.remove("show");
    lastCombatAt = -1e9;
    audioResume();
    pushScene();
    log("[系統] 歡迎來到風車鎮，"+player.name+"！🐾");
    log("[系統] 星門就在廣場東北側，阿柴會一直跟著你。");
    syncArea();
    syncHud();
    requestSave(true);
  }

  function buildClassCards() {
    $("class-list").innerHTML = CLASSES.map(c =>
      `<button class="card${c.id===player.classId?" sel":""}" data-id="${c.id}" type="button"><img class="card-art" src="assets/chars/${c.id}_idle.png" alt=""><h3>${c.icon} ${c.name}</h3><p>${c.role}<br>${c.desc}</p></button>`
    ).join("");
    $("class-list").onclick = (e) => {
      const b=e.target.closest(".card"); if(!b) return;
      player.classId=b.dataset.id;
      buildClassCards(); applyClass();
    };
  }

  function openSheet(kind) {
    const c=cls();
    const titles={stat:"🧍 屬性", eq:"⚔️ 裝備與星軌齒輪", skill:"🌳 技能樹", mount:"🐉 坐騎", pet:"🐾 靈獸", trade:"💰 跑商茶座", map:"🗺️ 空島地圖", bestiary:"📖 魔物圖鑑"};
    $("sheet-title").textContent = titles[kind]||"";
    let html="";
    if (kind==="stat") {
      html = `名字：${player.name}<br>職業：${c.name}<br>等級：Lv ${player.lv}<br>生命：${Math.ceil(player.hp)} / ${player.maxHp}<br>魔力：${Math.ceil(player.mp)} / ${player.maxMp}<br>攻擊：${c.atk+(player.lv-1)*2}<br>金幣：${player.gold}<br>技能點 SP：${player.sp}`;
    } else if (kind==="skill") {
      html = c.skills.map((n,i)=>`Lv.${Math.min(10,1+Math.floor(player.lv/5))}　${n}`).join("<br>") + `<br><br>奧義：${c.ult}<br>升級可獲得 SP，之後可在此強化技能視覺與威力。`;
    } else if (kind==="mount") {
      html = "🐕 疾風柴犬獸<br>圓滾滾的招牌坐騎。按下右下角柴犬按鈕即可上下坐騎。跑過草地時會留下粉紅色肉球腳印。";
    } else if (kind==="pet") {
      html = "靈獸進化與雲海散步系統將在後續版本開放。現在可以先與肥柴犬同行。";
    } else if (kind==="eq") {
      html = "星軌齒輪改裝槽：軸心／外環齒輪／星晶核心。<br>鍛造爐還在預熱，去找鐵鬚打聽吧。";
    } else if (kind==="trade") {
      html = "跨島跑商與實體商車護送即將開放。霍金斯已經在市集等你。";
    } else if (kind==="map") {
      html = Object.keys(MAPS).map(k=>{
        const open=discovered[k];
        return `${open?"◆":"◇"} ${MAPS[k].name}${open?"　（已發現）":"　（未踏足）"}`;
      }).join("<br>")+"<br><br>點選已發現的地點可請露娜傳送。";
    } else if (kind==="bestiary") {
      html = Object.values(MONSTERS).map(t=>`◆ ${t.name}　HP ${t.hp}　EXP ${t.exp}`).join("<br>");
    }
    $("sheet-body").innerHTML=html;
    $("sheet").classList.add("show");
    if (kind==="map") {
      $("sheet-body").innerHTML = Object.keys(MAPS).map(k=>{
        const open=discovered[k];
        return `<button class="opt" data-warp="${k}" ${open?"":"disabled"} type="button">${MAPS[k].name}</button>`;
      }).join(" ");
    }
  }

  // events
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", ev => {
    const tag = ev.target && ev.target.tagName;
    if (tag==="INPUT" || tag==="TEXTAREA" || (ev.target && ev.target.isContentEditable)) return;
    keys[ev.code.toLowerCase()]=true;
    if (ev.repeat) return;
    if (ev.code==="KeyQ") cast(0);
    if (ev.code==="KeyW") { if(!keys._wmove) {} }
    if (ev.code==="Digit1") cast(0);
    if (ev.code==="Digit2") cast(1);
    if (ev.code==="Digit3") cast(2);
    if (ev.code==="Digit4") cast(3);
    if (ev.code==="KeyR") cast(-1);
    if (ev.code==="KeyF") interact();
    if (ev.code==="Space") { ev.preventDefault(); doAttack(); }
    if (ev.code==="ShiftLeft" || ev.code==="KeyZ") doDash();
    if (ev.code==="KeyC") toggleMount();
    if (ev.code==="KeyA" && ev.altKey) { ev.preventDefault(); toggleAuto(); }
    if (ev.code==="KeyQ" && ev.ctrlKey) {} // keep Q for skill; auto is 自動狩獵掣
    if (ev.code==="KeyT") toggleAuto();
    if (ev.code==="Enter" || ev.code==="KeyE") interact();
    if (ev.code==="Escape") { $("drawer").classList.remove("open"); $("dialog").classList.remove("show"); $("sheet").classList.remove("show"); dlgAfter=null; }
  });
  window.addEventListener("keyup", ev => { keys[ev.code.toLowerCase()]=false; });
  const SFX_UI_SKIP = { "sk-atk":1, "sk-heal":1, "sk-star":1, "sk-shield":1, "sk-ult":1, "sk-mount":1, "item-potion":1, "item-scroll":1, "item-elixir":1, "prompt":1 };
  document.addEventListener("click", ev => {
    const el=ev.target.closest("button, .card, .opt, .go, .hit");
    if (!el) return;
    if (el.id && SFX_UI_SKIP[el.id]) return;
    sfx("ui");
  }, true);
  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);

  function toggleAuto(){
    auto=!auto;
    log(auto?"[系統] 自動狩獵已開啟。":"[系統] 自動狩獵已關閉。");
    syncHud();
  }
  function toggleMount(){
    mounted=!mounted;
    log(mounted?"[系統] 騎上了阿柴！":"[系統] 從阿柴身上下來了。");
    sfx("mount", mounted);
    requestSave(true);
  }
  function useItem(kind){
    if (player.items[kind]<=0) { log("[系統] 道具不足。"); return; }
    if (kind==="potion") {
      if (player.hp>=player.maxHp) { log("[系統] 生命已經滿了。"); return; }
      const n=Math.max(28, (player.maxHp*0.45)|0);
      player.hp=Math.min(player.maxHp, player.hp+n);
      player.items.potion--;
      addFloat(player.x, player.y-50, "+"+n+" HP", "heal");
      log("[獲得] 使用了回復藥水。");
    } else if (kind==="elixir") {
      if (player.mp>=player.maxMp) { log("[系統] 魔力已經滿了。"); return; }
      const n=Math.max(16, (player.maxMp*0.55)|0);
      player.mp=Math.min(player.maxMp, player.mp+n);
      player.items.elixir--;
      addFloat(player.x, player.y-50, "+"+n+" MP", "heal");
      log("[獲得] 使用了魔力靈飲。");
    } else if (kind==="scroll") {
      player.items.scroll--;
      log("[獲得] 使用了回城卷軸。");
      warp("plaza", MAPS.plaza.spawn);
    }
    sfx("item", kind);
    syncHud();
    requestSave(true);
  }
  function openSettings(){
    $("sheet-title").textContent="設置";
    $("sheet-body").innerHTML =
      `<button class="opt" id="tog-bgm" type="button">${bgmOn?"音樂：開":"音樂：關"}</button>`+
      `<p style="margin-top:12px;font-size:13px;line-height:1.7">移動：畫面左半邊虛擬搖桿，或 WASD／方向鍵<br>`+
      `攻擊：空白鍵或右下攻擊鍵　技能：1 2 3，R 為奧義<br>`+
      `衝刺：Shift　騎乘阿柴：C 或左下小狗掣<br>`+
      `道具：畫面底部三個圓形欄位　自動狩獵：右上或技能盤 ⏩</p>`;
    $("sheet").classList.add("show");
    $("tog-bgm").onclick=()=>{
      bgmOn=!bgmOn;
      const a=audio();
      if (a) {
        a.setEnabled(bgmOn);
        if (bgmOn) { a.resume(); pushScene(); }
      }
      $("tog-bgm").textContent = bgmOn?"音樂：開":"音樂：關";
    };
  }

  $("sk-atk").onclick=()=>doAttack();
  $("sk-heal").onclick=()=>cast(0);
  $("sk-star").onclick=()=>cast(1);
  $("sk-shield").onclick=()=>cast(2);
  $("sk-ult").onclick=()=>cast(-1);
  $("sk-auto").onclick=()=>toggleAuto();
  $("sk-mount").onclick=()=>toggleMount();
  $("item-potion").onclick=()=>useItem("potion");
  $("item-scroll").onclick=()=>useItem("scroll");
  $("item-elixir").onclick=()=>useItem("elixir");
  $("prompt").onclick=()=>interact();
  $("menu-btn").onclick=()=> $("drawer").classList.toggle("open");
  $("auto-hunt").onclick=()=>toggleAuto();
  $("bgm-btn").onclick=()=>openSettings();
  $("btn-chat").onclick=()=>{ $("sheet-title").textContent="對話"; $("sheet-body").textContent="世界頻道即將開放。現在可以用左下角系統日誌查看冒險紀錄。"; $("sheet").classList.add("show"); };
  $("drawer").onclick=(e)=>{
    const b=e.target.closest("button"); if(!b) return;
    $("drawer").classList.remove("open");
    openSheet(b.dataset.p);
  };
  $("dlg-ok").onclick=()=>{
    $("dialog").classList.remove("show");
    if (dlgAfter) { const fn=dlgAfter; dlgAfter=null; fn(); }
  };
  $("sheet-ok").onclick=()=> $("sheet").classList.remove("show");
  $("sheet").addEventListener("click", ev=>{
    const b=ev.target.closest("[data-warp]");
    if(!b) return;
    const id=b.dataset.warp;
    if(!discovered[id]) return;
    $("sheet").classList.remove("show");
    warp(id, MAPS[id].spawn);
  });
  $("btn-begin").onclick=()=> openCreate();
  $("btn-continue").onclick=()=> continuePlay();
  $("btn-new").onclick=()=>{
    const data = readSave();
    $("title-fresh").style.display = "none";
    $("title-continue").style.display = "none";
    $("title-confirm").style.display = "block";
    $("title-confirm-text").textContent = data
      ? ("開新存檔會覆蓋「"+data.name+"」的現有進度，確定要重新開始嗎？")
      : "確定要開新存檔嗎？";
  };
  $("btn-new-ok").onclick=()=> openCreate();
  $("btn-new-cancel").onclick=()=> refreshTitle();
  $("btn-enter").onclick=()=> tryEnterTown();
  $("btn-male").onclick=()=>{ player.gender="male"; syncGenderButtons(); };
  $("btn-female").onclick=()=>{ player.gender="female"; syncGenderButtons(); };
  const nameInput = $("hero-name-input");
  if (nameInput) {
    nameInput.addEventListener("input", () => {
      const typed = nameInput.value;
      const result = validateName(typed);
      if (typed && !result.ok && Array.from(normalizeName(typed)).length > NAME_MAX) showNameHint(result.message);
      else showNameHint("");
    });
    nameInput.addEventListener("keydown", ev => {
      ev.stopPropagation();
      if (ev.key==="Enter") { ev.preventDefault(); tryEnterTown(); }
    });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") requestSave(true);
  });
  window.addEventListener("pagehide", () => requestSave(true));

  resize();
  boot().catch(err => {
    console.error(err);
    $("load").innerHTML = "<div class='logo'>載入失敗</div><p>請喺遊戲資料夾執行 python3 -m http.server 8000，再用瀏覽器打開 http://127.0.0.1:8000/。唔好直接雙擊 index.html。</p>";
  });
})();
