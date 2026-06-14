/* engine.js — محرّك سكن (core + pages1 + pages2 مدموجين). نفس منطق المشروع القديم بالظبط. */
"use strict";

(function(){
  "use strict";

  // ---------- config ----------
  const DEFAULT_API = (location.protocol === "http:" || location.protocol === "https:")
    ? location.origin.replace(/\/$/, "") + "/api"
    : "https://sakan-md.vercel.app/api";
  const API = () => localStorage.getItem("sakan_api") || DEFAULT_API;

  // PIN Lock helpers
  const PIN_KEY   = "sakan_pin";          // hashed PIN per device
  const PIN_WHO   = "sakan_pin_who";      // "m" or "d" — who locked this device
  const PIN_TOKEN = "sakan_token";        // session token
  function pinHash(p){ let h=0; for(let i=0;i<p.length;i++) h=((h<<5)-h)+p.charCodeAt(i)|0; return h.toString(36); }
  const hasPinSetup = () => !!localStorage.getItem(PIN_KEY) && !!localStorage.getItem(PIN_TOKEN);
  const pinCorrect  = (p)=> pinHash(p)===localStorage.getItem(PIN_KEY);
  const devWho      = () => localStorage.getItem(PIN_WHO)||null;

  // Initial view logic: token + PIN set → show pin screen; token, no pin → home; no token → onboarding
  const PAGE_VIEW = (typeof window!=="undefined" && window.SAKAN_VIEW) || "home";
  const _hasToken = !!localStorage.getItem("sakan_token");
  const _hasPin   = !!localStorage.getItem(PIN_KEY);
  const _unlocked = (function(){ try{ return sessionStorage.getItem("sakan_unlocked")==="1"; }catch(e){ return false; } })();
  // بوابة الدخول للصفحات المنفصلة: أي صفحة غير auth لازم توكن
  if(!_hasToken && PAGE_VIEW!=="onboarding"){ location.replace("auth.html"); }
  if(_hasToken && PAGE_VIEW==="onboarding"){ location.replace("index.html"); }
  const _initView = !_hasToken ? "onboarding" : ((_hasPin && !_unlocked) ? "pinlock" : PAGE_VIEW);

  const S = {
    token: _hasToken ? localStorage.getItem("sakan_token") : null,
    code:  localStorage.getItem("sakan_code")  || null,
    name:  localStorage.getItem("sakan_name")  || null,
    email: localStorage.getItem("sakan_email") || null,
    view: _initView, resourceId: null, tab: "summary",
    detail: null, responses: {},
    pinEntry: "", pinStep: "lock",  // lock | setup1 | setup2 | whoselect
    pinWho: devWho(),               // "m"=مصطفى "d"=ضحى
    pinSetup1: "",                  // first entry in setup flow
  };
  if(PAGE_VIEW==="resource"){ try{ const _p=new URLSearchParams(location.search); S.resourceId=_p.get("id")||null; S.tab=_p.get("tab")||"summary"; }catch(e){} }

  const STATE_AR = {
    not_started:"لم يبدأ", in_progress:"قيد العمل", completed:"مكتمل",
    open:"بانتظار ردّ كلٍّ مننا", answered_by_one:"ردّ واحد مننا", ready_to_reveal:"جاهز للكشف",
    revealed:"مكشوف", decided:"تقرّر", draft:"مسودّة", confirmed:"مؤكَّد", revisited:"قيد المراجعة",
  };

  // ---------- helpers ----------
  const el = document.getElementById("app");
  const esc = (s)=> String(s==null?"":s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  function toast(msg){ const t=document.getElementById("toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove("show"),2600); }

  async function api(method, path, body){
    const res = await fetch(API()+path, {
      method,
      headers: Object.assign({"content-type":"application/json"}, S.token?{authorization:"Bearer "+S.token}:{}),
      body: body? JSON.stringify(body): undefined,
    });
    let data=null; try{ data = await res.json(); }catch(e){}
    if(!res.ok){
      const code = data && data.error ? data.error.code : ("HTTP_"+res.status);
      if((code==="UNAUTHENTICATED" || res.status===401) && S.token){
        S.token=null; S.code=null; save(); S.view="onboarding"; render(); toast("انتهت الجلسة — سجّل دخولك تاني");
      }
      const e=new Error(code); e.code=code; e.data=data; throw e;
    }
    return data;
  }
  function errMsg(e){
    const m = {
      FIREBASE_ENV_MISSING:"الخادم غير مهيّأ بعد (متغيّر البيئة ناقص).",
      QUESTION_LOCKED:"السؤال أُغلق بعد الكشف ولا يمكن تعديل الإجابة.",
      STATE_CONFLICT:"لا يمكن الكشف قبل أن تجيبا كلاكما.",
      NO_REVEALED_QUESTION:"اكشفا سؤالًا واحدًا على الأقل قبل تسجيل القرار.",
      NO_QUESTIONS_LINKED:"اختر سؤالًا واحدًا على الأقل للقرار.",
      INVALID_CODE:"الكود غير صحيح أو مُستخدَم.",
      PAIR_FULL:"هذا الميثاق مكتمل بطرفين بالفعل.",
      UNAUTHENTICATED:"انتهت الجلسة، سجّل الدخول من جديد.",
      BAD_CREDENTIALS:"الإيميل أو الباسوورد غلط.",
      EMAIL_TAKEN:"الإيميل ده مستخدم بالفعل — جرّب تسجيل الدخول.",
      BAD_EMAIL:"اكتب إيميل صحيح.",
      WEAK_PASSWORD:"الباسوورد لازم ٤ حروف على الأقل.",
    };
    return m[e.code] || ("حدث خطأ: "+(e.code||"غير معروف"));
  }
  function save(){
    if(S.token) localStorage.setItem("sakan_token",S.token); else localStorage.removeItem("sakan_token");
    if(S.code) localStorage.setItem("sakan_code",S.code); else localStorage.removeItem("sakan_code");
    if(S.name) localStorage.setItem("sakan_name",S.name); else localStorage.removeItem("sakan_name");
    if(S.email) localStorage.setItem("sakan_email",S.email); else localStorage.removeItem("sakan_email");
  }
  function titleFromUrl(u){
    try{
      const m = u.match(/[?&]list=([\w-]+)/); if(m) return "قائمة تشغيل · "+m[1].slice(0,8);
      const v = u.match(/(?:youtu\.be\/|[?&]v=)([\w-]{6,})/); if(v) return "فيديو · "+v[1];
    }catch(e){}
    return u.length>44 ? u.slice(0,44)+"…" : u;
  }
  function logout(){
    localStorage.removeItem("sakan_token"); localStorage.removeItem("sakan_code");
    localStorage.removeItem("sakan_name"); localStorage.removeItem(PIN_KEY); localStorage.removeItem(PIN_WHO);
    S.token=S.code=S.name=null; S.pinEntry=""; S.pinWho=null;
    try{sessionStorage.removeItem("sakan_unlocked");}catch(e){} location.replace("auth.html");
  }

  // ---------- الدرج الجانبي (تقسيم زي زاد) ----------
  const NAVSECS = [
    { items:[["home","الرئيسية","🏠"]] },
    { title:"رحلتنا", items:[["journeys","قوائمنا","▶️"],["library","المكتبة","📚"],["myjourney","رحلتي","🌿"]] },
    { title:"الحوار والقرار", items:[["discussions","المناقشات","💬"],["decisionlog","القرارات","✅"],["charter","ميثاقنا","📜"]] },
    { title:"حياتنا", items:[["connect","تواصلنا","💞"],["quicknotes","مفكّرتنا","📝"],["tasks","المهام","🗒️"],["budget","الميزانية","💰"],["shopping","المشتريات","🛒"]] },
    { title:"الإعدادات", items:[["settings","الإعدادات","⚙️"],["logout","خروج","↩️"]] },
  ];
  function renderDrawer(){
    const d = document.getElementById("drawer"); if(!d) return;
    if(!S.token){ d.innerHTML=""; return; }
    const cur = S.view;
    let html = `<div class="dw-head"><div class="dw-brand">سكن</div><button class="dw-x" data-dw="close" aria-label="إغلاق">✕</button></div>`;
    if(S.code) html += `<div class="dw-code">كود الميثاق: <b>${esc(S.code)}</b></div>`;
    html += NAVSECS.map(sec=>{
      const links = sec.items.map(([act,label,ico])=>{
        return `<button class="dw-link ${act===cur?'active':''}" data-act="${act}"><span class="dw-ico">${ico}</span><span>${label}</span></button>`;
      }).join("");
      if(!sec.title) return `<div class="dw-group">${links}</div>`;
      return `<div class="dw-sep" data-dwsec>${esc(sec.title)}<span class="dw-arrow">▾</span></div><div class="dw-group">${links}</div>`;
    }).join("");
    html += `<div class="dw-sep" style="cursor:default">السمة</div>
      <div class="themesw dw-theme" role="group" aria-label="السمة" style="margin:4px 8px">
        <button data-set-theme="light" title="فاتح">☀️</button>
        <button data-set-theme="dark" title="داكن">🌙</button>
        <button data-set-theme="oled" title="OLED">⚫</button></div>`;
    html += `<div class="dw-foot" style="color:rgba(244,236,214,.5);font-size:12px;text-align:center;margin-top:18px">سكن · مساحتنا إحنا الاتنين 🌿</div>`;
    d.innerHTML = html;
    markTheme();
  }
  function openDrawer(){ renderDrawer(); document.getElementById("drawerBg").hidden=false; const d=document.getElementById("drawer"); requestAnimationFrame(()=>{ d.classList.add("open"); document.getElementById("drawerBg").classList.add("open"); }); document.body.style.overflow="hidden"; }
  function closeDrawer(){ const d=document.getElementById("drawer"), bg=document.getElementById("drawerBg"); if(d) d.classList.remove("open"); if(bg){ bg.classList.remove("open"); setTimeout(()=>{ if(bg) bg.hidden=true; },260); } document.body.style.overflow=""; }

  // ---------- header ----------
  function renderBar(){
    const b = document.getElementById("barActions");
    if(b){
      if(S.token){
        const QA=[["home","الرئيسية"],["journeys","قوائمنا"],["library","المكتبة"],["discussions","المناقشات"],["decisionlog","القرارات"]];
        b.innerHTML = `<div class="qa">`+QA.map(([a,l])=>`<button class="qa-link ${S.view===a?'on':''}" data-act="${a}">${l}</button>`).join("")+`</div>`
          + `<div class="qa-theme" role="group" aria-label="السمة"><button data-set-theme="light" title="فاتح">☀️</button><button data-set-theme="dark" title="داكن">🌙</button></div>`;
      } else b.innerHTML = "";
    }
    const bn = document.getElementById("brandName");
    if(bn){ const idx = S.token ? (/ضحى|ضحي/.test(S.name||"")?1:(/مصطف/.test(S.name||"")?2:0)) : 0; const src = idx? document.querySelector('#nameAssets [data-ni="'+idx+'"]') : null; bn.innerHTML = src? src.outerHTML : ""; }
    const hb = document.querySelector(".hamburger"); if(hb) hb.style.display = S.token ? "flex" : "none";
    renderDrawer();
    markTheme();
  }
  function markTheme(){
    const cur = document.documentElement.getAttribute("data-theme")||"light";
    document.querySelectorAll(".themesw button, .qa-theme button").forEach(x=>x.classList.toggle("on", x.dataset.setTheme===cur));
  }
  function applyTheme(t){
    document.documentElement.setAttribute("data-theme", t);
    try{ localStorage.setItem("sakan_theme", t); }catch(e){}
    markTheme();
  }

  // ---------- views ----------
  function render(){
    renderBar();
    document.body.classList.toggle("pre-auth", !S.token || S.view==="pinlock");
    if(S.view==="pinlock") return renderPinLock();
    if(!S.token){ return renderOnboarding(); }
    if(S.view==="resource" && S.resourceId){ return renderResource(); }
    if(S.view==="home") return renderHome();
    if(S.view==="journeys") return renderJourneys();
    if(S.view==="discussions") return renderDiscussionsAll();
    if(S.view==="decisionlog") return renderDecisionLog();
    if(S.view==="connect") return renderConnect();
    if(S.view==="charter") return renderCharter();
    if(S.view==="tasks") return renderTasks();
    if(S.view==="budget") return renderBudget();
    if(S.view==="shopping") return renderShopping();
    if(S.view==="quicknotes") return renderQuickNotes();
    if(S.view==="myjourney")  return renderMyJourney();
    if(S.view==="settings") return renderSettings();
    return renderLibrary();
  }

  // ---------- phase 2 + home: helpers ----------
  const OWN_AR = { m:"مصطفى", d:"ضحى", both:"الاتنين" };
  const fmtMoney = (n)=> (Number(n)||0).toLocaleString("ar-EG");
  function pageTitle(t, lede){ return `<h1 class="display">${esc(t)}</h1>${lede?`<p class="lede">${esc(lede)}</p>`:""}`; }

  // ---------- phase 3: journeys & stages ----------
  const STAGES = [
    {n:0, title:"التأسيس والنيّة", theme:"الزواج كميثاق وعبادة ومقصد — قبل أي تفاصيل."},
    {n:1, title:"الخطوبة والاختيار", theme:"فقه الخطوبة، معايير الاختيار، والتخطيط العملي."},
    {n:2, title:"فهم الذات والآخر", theme:"بناء شخصية الطرفين وفهم طبيعة كلٍّ ودوره."},
    {n:3, title:"المودة والمهارات", theme:"فن العشرة والمعايشة وتنمية الحب وآداب البيت."},
    {n:4, title:"التأهيل الشامل", theme:"برامج متكاملة تجمع وتعمّق ما سبق."},
    {n:5, title:"متقدّم وللرجوع", theme:"مواضيع جانبية أو لأوقات الأزمات."},
  ];
  const PRIO_AR = { high:"عالية", medium:"متوسطة", later:"لاحقًا" };
  const PRIO_W  = { high:0, medium:1, later:2 };
  // التقسيم الجديد: ٤ كاتيجوريز + قائمتان (يوتيوب/تيليجرام)
  const CATS = [
    { id:"khotouba", title:"الخطوبة والاختيار", ico:"💍", theme:"التأسيس، فقه الخطوبة، معايير الاختيار، وفهم الذات." },
    { id:"zawaj",    title:"مرحلة الجواز",       ico:"🤝", theme:"المودة وفن العشرة ومهارات البيت في أول الزواج." },
    { id:"baad",     title:"ما بعد الجواز",       ico:"🏡", theme:"برامج التأهيل الشامل وبناء البيت المستقر." },
    { id:"tarbiya",  title:"التربية",            ico:"🌱", theme:"تربية الأبناء وبناء جيل صالح." },
  ];
  const STAGE_CAT = { 0:"khotouba", 1:"khotouba", 2:"khotouba", 3:"zawaj", 4:"baad", 5:"baad" };
  const catOf = r => r.category || STAGE_CAT[Number(r.stage)] || "khotouba";
  function srcOf(r){ const l=r.link||""; if(/youtu\.?be|youtube/i.test(l)) return "youtube"; if(/t\.me|telegram/i.test(l)) return "telegram"; return (r.type==="video")?"youtube":"telegram"; }
  const TYPE_ICON = { course:"🎓", book:"📖", video:"🎬", pdf:"📄", article:"📰" };
  const hasYt = r => /youtu\.?be/.test(r.link||"");
  function progPill(st, who){ const done=st==='completed'; return `<span class="pill dot ${done?'':'warn'}" title="${who}: ${STATE_AR[st]||st}">${done?who+' ✓':(st==='in_progress'?who+' •':who)}</span>`; }
  function dualProg(p){ p=p||{mine:'not_started',partner:'not_started'}; return `<span style="display:inline-flex;gap:6px;flex:none;align-items:center">${progPill(p.mine,'أنا')}${progPill(p.partner,'شريكي')}</span>`; }
  function ytMark(r){ return hasYt(r)?`<span title="يوتيوب" style="color:#e23;flex:none;font-size:13px">▶</span> `:""; }
  // أصول الأسماء مدمجة inline: Asset 1 = ضحى، Asset 2 = مصطفى. اللون يتبع الثيم (داكن على اللايت، أبيض على الدارك).
  function nameCal(){
    const n = S.name||"";
    const idx = /ضحى|ضحي/.test(n) ? 1 : (/مصطف/.test(n) ? 2 : 0);
    if(!idx) return "";
    const alt = idx===1 ? "ضحى" : "مصطفى";
    const src = document.querySelector('#nameAssets [data-ni="'+idx+'"]');
    const svg = src ? src.outerHTML : '<span class="namefallback">'+alt+'</span>';
    return `<div class="namecal" role="img" aria-label="${alt}">${svg}</div>`;
  }
  function greetHero(){
    const n = S.name||"";
    const cal = nameCal();
    if(cal){
      const sub = /ضحى|ضحي/.test(n) ? "نوّرتِ سكن 🌿" : "نوّرت سكن 🌿";
      return `<div class="card greet"><div class="hi">أهلًا</div>${cal}<p class="muted" style="margin:8px 0 0">${sub}</p></div>`;
    }
    const who = (n && n!=="أنا") ? esc(n) : "بكم في سكن";
    return `<div class="card greet"><div class="hi">أهلًا</div><h1 class="display" style="margin:4px 0 0">${who}</h1></div>`;
  }

  async function renderJourneys(){
    S.view="journeys"; S.resourceId=null;
    if(!S.playlist) S.playlist="youtube";
    el.innerHTML = pageTitle("قوائمنا","منهجنا مقسوم على ٤ مراحل: الخطوبة، مرحلة الجواز، ما بعد الجواز، والتربية.") + `<div id="jBody"><div class="empty">…تحميل</div></div>`;
    try{
      const items = await api("GET","/resources");
      const seeded = items.some(r=>r.seed);
      const counts = { youtube: items.filter(r=>srcOf(r)==="youtube").length, telegram: items.filter(r=>srcOf(r)==="telegram").length };
      let html = "";
      // زر استيراد المنهج — ظاهر دائمًا (يستورد لو لسه، وبيقول مستورد لو خلاص)
      html += `<div class="card" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
        <div style="flex:1;min-width:180px"><div class="eyebrow">${seeded?"منهجنا":"ابدأ الرحلة"}</div>
          <p class="muted" style="margin:2px 0 0;font-size:13px">${seeded?"المنهج مستورد. تقدر تعيد الاستيراد لإضافة أي جديد.":"استورد دورات وكتب التأهيل دفعة واحدة، جاهزة للحوار والقرارات."}</p></div>
        <button class="btn accent" data-act="seedCurriculum">${seeded?"تحديث المنهج":"استورد المنهج"}</button></div>`;
      // محوّل القائمة (يوتيوب / تيليجرام)
      html += `<div class="pl-seg" role="group" aria-label="القائمة">
        <button class="${S.playlist==='youtube'?'on':''}" data-act="setPlaylist" data-pl="youtube"><span class="pl-ic">▶</span> يوتيوب <span class="pl-n">${counts.youtube}</span></button>
        <button class="${S.playlist==='telegram'?'on':''}" data-act="setPlaylist" data-pl="telegram"><span class="pl-ic tg">✈</span> تيليجرام <span class="pl-n">${counts.telegram}</span></button></div>`;
      html += `<p class="muted" style="margin:6px 2px 0;font-size:12.5px">📍 الشارة <b>أنا / شريكي</b> على كل مادة بتوريكم مين سمعها ووصل لفين.</p>`;
      const inList = items.filter(r=> srcOf(r)===S.playlist);
      if(!inList.length){
        html += `<div class="empty">مفيش موارد في قائمة ${S.playlist==='youtube'?'يوتيوب':'تيليجرام'} لسه.</div>`;
      } else {
        for(const c of CATS){
          const inCat = inList.filter(r=> catOf(r)===c.id)
            .sort((a,b)=> (PRIO_W[a.priority]??1)-(PRIO_W[b.priority]??1) || (a.order||999)-(b.order||999) || (a.createdAt-b.createdAt));
          if(!inCat.length) continue;
          const done = inCat.filter(r=> r.prog && r.prog.mine==='completed' && r.prog.partner==='completed').length;
          html += `<div class="cat-h"><span class="cat-ic">${c.ico}</span><div><div class="cat-t">${esc(c.title)}</div><div class="cat-s">${esc(c.theme)} — <b>${done}/${inCat.length}</b> خلّصناه معًا</div></div></div>`
            + inCat.map(r=>`<div class="card res" data-open="${esc(r.id)}">
                <div style="display:flex;gap:12px;align-items:center;flex:1;min-width:0">
                  <span style="font-size:22px;flex:none">${TYPE_ICON[r.type]||"📄"}</span>
                  <div style="min-width:0"><h2 style="margin:0;font-size:17px">${ytMark(r)}${esc(r.title)}</h2>
                  <div class="meta">${r.speaker?esc(r.speaker)+" · ":""}${r.episodes?esc(r.episodes)+" حلقة":""}</div></div>
                </div>
                <div style="display:flex;gap:6px;flex:none;align-items:center">${r.priority?`<span class="pill warn">${PRIO_AR[r.priority]||esc(r.priority)}</span>`:""}${dualProg(r.prog)}</div>
              </div>`).join("");
        }
      }
      document.getElementById("jBody").innerHTML = html;
    }catch(e){ document.getElementById("jBody").innerHTML = `<div class="empty">${esc(errMsg(e))}</div>`; }
  }



  // ========== PIN Lock ==========
  function getNameSVG(who){
    // who: "m"=مصطفى(ni=2), "d"=ضحى(ni=1)
    const ni = who==="m" ? 2 : who==="d" ? 1 : 0;
    if(!ni) return "";
    const src = document.querySelector('#nameAssets [data-ni="'+ni+'"]');
    return src ? src.outerHTML : "";
  }

  function renderPinLock(){
    S.view="pinlock";
    document.body.classList.add("pre-auth");
    const bg = document.getElementById("app");

    const step = S.pinStep || "lock";
    const who  = S.pinWho;  // "m" | "d" | null

    // ---- Who-select (first time, no device owner set) ----
    if(step==="whoselect" || (!who && step==="lock")){
      S.pinStep="whoselect";
      const svg1 = getNameSVG("d");
      const svg2 = getNameSVG("m");
      bg.innerHTML = `<div class="pin-screen">
        <div class="pin-logo">سكن</div>
        <p class="pin-sub">من بيستخدم الجهاز ده؟</p>
        <div class="pin-who-select">
          <button class="pin-who-btn ${S.pinWhoSel==='d'?'sel':''}" data-act="pinWhoSel" data-w="d">
            ${svg1||'<span class="pin-who-name" style="font-size:28px;font-family:ThmanyahSerifDisplay,serif">ضحى</span>'}
            <span class="pin-who-name">ضحى</span>
          </button>
          <button class="pin-who-btn ${S.pinWhoSel==='m'?'sel':''}" data-act="pinWhoSel" data-w="m">
            ${svg2||'<span class="pin-who-name" style="font-size:28px;font-family:ThmanyahSerifDisplay,serif">مصطفى</span>'}
            <span class="pin-who-name">مصطفى</span>
          </button>
        </div>
        ${S.pinWhoSel?`<button class="auth-btn" style="max-width:340px" data-act="pinWhoConfirm">تأكيد</button>`:""}
        <p class="pin-hint" style="margin-top:18px"><a href="#" data-act="pinSkip">تخطّي القفل وادخل مباشرة ←</a></p>
      </div>`;
      return;
    }

    // ---- Setup flow: enter PIN twice ----
    if(step==="setup1" || step==="setup2"){
      const label = step==="setup1" ? "أنشئ كود PIN جديد (٤ أرقام)" : "أكّد الكود تاني";
      const svg   = getNameSVG(who);
      const entry = S.pinEntry||"";
      bg.innerHTML = `<div class="pin-screen">
        <div class="pin-logo">سكن</div>
        ${svg?`<div class="pin-name-svg">${svg}</div>`:""}
        <div class="pin-card">
          <p class="pin-setup-label">${label}</p>
          <div class="pin-dots" id="pinDots">
            ${[0,1,2,3].map(i=>`<div class="pin-dot${i<entry.length?' fill':''}"></div>`).join("")}
          </div>
          <div class="pin-grid">${pinGridHTML()}</div>
          <p class="pin-err" id="pinErr"></p>
        </div>
        <p class="pin-hint" style="margin-top:18px"><a href="#" data-act="pinSkip">تخطّي الإعداد</a></p>
      </div>`;
      return;
    }

    // ---- Lock screen: enter PIN to unlock ----
    const svg  = getNameSVG(who);
    const name = who==="m" ? "مصطفى" : who==="d" ? "ضحى" : "";
    const entry = S.pinEntry||"";
    bg.innerHTML = `<div class="pin-screen">
      <div class="pin-logo">سكن</div>
      ${svg?`<div class="pin-name-svg">${svg}</div>`:""}
      <div class="pin-card">
        <p class="pin-setup-label" style="margin-bottom:8px">أهلًا${name?" "+name:""}، ادخل الكود</p>
        <div class="pin-dots" id="pinDots">
          ${[0,1,2,3].map(i=>`<div class="pin-dot${i<entry.length?' fill':''}"></div>`).join("")}
        </div>
        <div class="pin-grid">${pinGridHTML()}</div>
        <p class="pin-err" id="pinErr"></p>
      </div>
      <p class="pin-hint" style="margin-top:18px"><a href="#" data-act="pinForgot">نسيت الكود؟</a></p>
    </div>`;
  }

  function pinGridHTML(){
    const keys = ["١","٢","٣","٤","٥","٦","٧","٨","٩","","٠","⌫"];
    return keys.map((k,i)=>{
      if(k==="") return `<div></div>`;
      if(k==="⌫") return `<button class="pin-key del" data-act="pinKey" data-k="del">⌫</button>`;
      const digit = ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"].indexOf(k).toString();
      return `<button class="pin-key" data-act="pinKey" data-k="${digit}">${k}</button>`;
    }).join("");
  }

  function pinUpdateDots(entry){
    const dots = document.querySelectorAll(".pin-dot");
    dots.forEach((d,i)=>{ d.classList.toggle("fill", i<entry.length); });
  }

  function pinShakeDots(){
    const dots = document.querySelectorAll(".pin-dot");
    dots.forEach(d=>{ d.classList.add("shake"); setTimeout(()=>d.classList.remove("shake"),500); });
  }

  function pinHandleKey(k){
    const step = S.pinStep||"lock";
    if(k==="del"){ S.pinEntry=(S.pinEntry||"").slice(0,-1); pinUpdateDots(S.pinEntry); return; }
    S.pinEntry=(S.pinEntry||"")+k;
    pinUpdateDots(S.pinEntry);
    if(S.pinEntry.length<4) return;

    // ---- 4 digits entered ----
    const pin = S.pinEntry;
    S.pinEntry="";

    if(step==="setup1"){
      S.pinSetup1=pin; S.pinStep="setup2"; renderPinLock(); return;
    }
    if(step==="setup2"){
      if(pin!==S.pinSetup1){
        pinShakeDots();
        const e=document.getElementById("pinErr"); if(e) e.textContent="الكودان مش متطابقَين، حاول تاني";
        S.pinStep="setup1"; S.pinSetup1="";
        setTimeout(()=>renderPinLock(),700); return;
      }
      localStorage.setItem(PIN_KEY, pinHash(pin));
      document.body.classList.remove("pre-auth");
      S.pinStep="lock"; try{sessionStorage.setItem("sakan_unlocked","1");}catch(e){} location.reload(); return;
    }
    if(step==="lock"){
      if(pinCorrect(pin)){
        document.body.classList.remove("pre-auth");
        S.pinStep="lock"; try{sessionStorage.setItem("sakan_unlocked","1");}catch(e){} location.reload(); return;
      }
      pinShakeDots();
      const e=document.getElementById("pinErr"); if(e) e.textContent="كود غلط — حاول تاني";
      setTimeout(()=>pinUpdateDots(""),700);
    }
  }

  // ========== QuickNotes (مفكّرتنا) ==========
  // localStorage helpers — بتشتغل من غير backend
  function qnKey(scope){ return "sakan_qn_" + scope + "_" + (S.code||"local"); }
  function qnLoad(scope){ try{ return JSON.parse(localStorage.getItem(qnKey(scope))||"[]"); }catch(e){ return []; } }
  function qnSave(scope, arr){ try{ localStorage.setItem(qnKey(scope), JSON.stringify(arr)); }catch(e){} }
  // للنوتس الخاصة بيك فقط (scope=private), نستخدم uid أيضاً
  function qnKeyPriv(){ return "sakan_qn_private_" + (S.uid||"me"); }
  function qnLoadPriv(){ try{ return JSON.parse(localStorage.getItem(qnKeyPriv())||"[]"); }catch(e){ return []; } }
  function qnSavePriv(arr){ try{ localStorage.setItem(qnKeyPriv(), JSON.stringify(arr)); }catch(e){} }

  async function renderQuickNotes(){
    S.view="quicknotes"; S.resourceId=null;
    const panel = S.qnPanel || "shared";
    const myName = S.name || "أنا";
    const isShared = panel==="shared";

    el.innerHTML = pageTitle("مفكّرتنا","مساحة خاصة لكل منا — ومساحة مشتركة بيننا.")
    + `<div class="qn-tabs">
        <button class="qn-tab ${panel==='shared'?'on':''}" data-act="qnPanel" data-p="shared">🌿 مشتركة</button>
        <button class="qn-tab ${panel==='private'?'on':''}" data-act="qnPanel" data-p="private">🔒 خاصتي</button>
       </div>
       <div id="qnBody"></div>`;

    // Load notes
    const notes = isShared ? qnLoad("shared") : qnLoadPriv();

    const addCard = `
      <div class="qn-glass">
        <p class="qn-panel-label">${isShared?"📌 ملاحظة مشتركة جديدة":"🔒 ملاحظة خاصة بيك فقط"}</p>
        <div class="qn-add-row">
          <input id="qnTitleInp" class="qn-title-inp" placeholder="${isShared?'عنوان الملاحظة المشتركة…':'عنوان ملاحظتك الخاصة…'}" autocomplete="off">
          <textarea id="qnBodyInp" class="qn-input" placeholder="${isShared?'اكتبوا هنا سوا — هيشوفها الاتنين 🌿':'اكتب هنا حاجة خاصة بيك — مش هيشوفها حد غيرك 🔒'}"></textarea>
        </div>
        <div class="actions"><span class="spacer"></span>
          <button class="btn sm" data-act="qnAdd" data-scope="${panel}">+ أضِف ملاحظة</button>
        </div>
      </div>`;

    const noteCards = notes.length
      ? [...notes].reverse().map(n=>`
          <div class="qn-note">
            <div class="actions" style="align-items:flex-start;gap:6px;margin-bottom:0">
              <div style="flex:1">
                <div class="qn-note-title">${esc(n.title||"بدون عنوان")}</div>
                <div class="qn-note-body" style="margin-top:7px">${esc(n.body||"")}</div>
              </div>
              <button class="qn-del" data-act="qnDel" data-id="${esc(n.id)}" data-scope="${panel}" title="حذف">✕</button>
            </div>
            <div class="qn-note-meta">
              ${isShared?`<span class="qn-badge">👥 مشتركة</span>`:`<span class="qn-badge">🔒 خاصتك</span>`}
              ${n.author?`<span>• ${esc(n.author)}</span>`:""}
              ${n.ts?`<span>• ${new Date(n.ts).toLocaleDateString("ar-EG",{day:"numeric",month:"short",year:"numeric"})}</span>`:""}
            </div>
          </div>`).join("")
      : `<p class="empty" style="text-align:center;padding:28px 0">${isShared?"لسه ما فيش ملاحظات مشتركة — ابدأوا بأول واحدة 🌿":"مساحتك الخاصة فاضية — اكتب حاجة ليك إنت بس 🔒"}</p>`;

    document.getElementById("qnBody").innerHTML = addCard + noteCards;
  }

  function qnDoAdd(scope){
    const title=(document.getElementById("qnTitleInp").value||"").trim();
    const body=(document.getElementById("qnBodyInp").value||"").trim();
    if(!body) return toast("اكتب ملاحظتك الأول");
    const note = { id: Date.now().toString(36)+Math.random().toString(36).slice(2,6), title:title||"ملاحظة", body, author:S.name||"", ts:Date.now() };
    if(scope==="shared"){
      const arr = qnLoad("shared"); arr.push(note); qnSave("shared", arr);
      toast("أُضيفت للمشترك 🌿");
    } else {
      const arr = qnLoadPriv(); arr.push(note); qnSavePriv(arr);
      toast("حُفظت خاصتك 🔒");
    }
    renderQuickNotes();
  }

  function qnDoDel(id, scope){
    if(!confirm("تمسح الملاحظة دي؟")) return;
    if(scope==="shared"){
      const arr = qnLoad("shared").filter(n=>n.id!==id); qnSave("shared", arr);
    } else {
      const arr = qnLoadPriv().filter(n=>n.id!==id); qnSavePriv(arr);
    }
    S.qnPanel=scope; renderQuickNotes();
  }

  async function renderHome(){
    S.view="home"; S.resourceId=null;
    el.innerHTML = greetHero()
      + `<div id="focusBox"></div>`
      + `<div class="card tight"><div class="eyebrow">نعمة النهارده</div>
          <div class="row" style="margin-top:4px"><input id="homeGrat" type="text" placeholder="نعمة من بيتنا نشكر الله عليها…"></div>
          <div class="actions"><span class="spacer"></span><button class="btn sm" data-act="addGratHome">أضِف للامتنان</button></div></div>`
      + `<div id="loops"><div class="empty">…تحميل</div></div>`;
    try{
      const [items, foc] = await Promise.all([api("GET","/resources"), api("GET","/focus")]);
      const fb = document.getElementById("focusBox");
      if(foc.focus){ const r=foc.focus; fb.innerHTML = `
        <div class="card res" data-open="${esc(r.id)}" style="border-color:var(--brand-gold)">
          <div style="display:flex;gap:14px;align-items:center;flex:1;min-width:0">
            ${ r.thumbnail ? `<img src="${esc(r.thumbnail)}" alt="" loading="lazy" style="width:104px;height:62px;object-fit:cover;border-radius:10px;flex:none">` : "" }
            <div style="min-width:0"><div class="eyebrow" style="margin-bottom:2px">📌 مادتنا دلوقتي</div><h2 style="margin:0">${ytMark(r)}${esc(r.title)}</h2></div>
          </div>
          <div style="display:flex;gap:6px;flex:none;align-items:center">${dualProg(r.prog)}</div></div>
        <div class="actions" style="margin:-6px 0 16px"><span class="spacer"></span><button class="linkbtn" data-act="clearFocus">إزالة التركيز</button></div>`;
      }
      const bothDone = r => r.prog && r.prog.mine==='completed' && r.prog.partner==='completed';
      const open = items.filter(r=> !bothDone(r));
      const box = document.getElementById("loops");
      if(!open.length){ box.innerHTML = `<div class="empty">مفيش حلقات مفتوحة 🌿 خلّصنا كل المواد المضافة. نقدر نضيف مورد جديد من المكتبة.</div>`; return; }
      box.innerHTML = `<div class="eyebrow" style="margin-bottom:10px">حلقات مفتوحة</div>` + open.slice(0,8).map(r=>`
        <div class="card res" data-open="${esc(r.id)}">
          <div style="display:flex;gap:14px;align-items:center;flex:1;min-width:0">
            ${ r.thumbnail ? `<img src="${esc(r.thumbnail)}" alt="" loading="lazy" style="width:104px;height:62px;object-fit:cover;border-radius:10px;flex:none">` : "" }
            <div style="min-width:0"><h2 style="margin:0">${ytMark(r)}${esc(r.title)}</h2><div class="meta" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.link?esc(r.link):"بدون رابط"}</div></div>
          </div>
          ${dualProg(r.prog)}
        </div>`).join("");
    }catch(e){ document.getElementById("loops").innerHTML = `<div class="empty">${esc(errMsg(e))}</div>`; }
  }

  async function renderTasks(){
    S.view="tasks"; S.resourceId=null;
    el.innerHTML = pageTitle("المهام ومخطّط الفرح","مهامنا بتتقسّم بينّا بمسؤول وتاريخ — إحنا فريق واحد.") + `
      <div class="card tight">
        <div class="row"><label>المهمة</label><input id="tTitle" type="text" placeholder="مثلًا: حجز القاعة"></div>
        <div class="row"><label>المسؤول</label>
          <div class="themesw" id="tOwner" role="group" style="border-radius:12px">
            <button type="button" data-own="m" style="width:auto;padding:6px 12px">مصطفى</button>
            <button type="button" data-own="d" style="width:auto;padding:6px 12px">ضحى</button>
            <button type="button" data-own="both" class="on" style="width:auto;padding:6px 12px">الاتنين</button></div></div>
        <div class="row"><label>تاريخ (اختياري)</label><input id="tDue" type="text" placeholder="2026-08-01"></div>
        <button class="btn" data-act="addTask">أضِف مهمة</button>
      </div>
      <div id="tList"><div class="empty">…تحميل</div></div>`;
    document.getElementById("tOwner").addEventListener("click",ev=>{const b=ev.target.closest("button[data-own]");if(!b)return;[...ev.currentTarget.children].forEach(x=>x.classList.toggle("on",x===b));});
    await reloadTasks();
  }
  async function reloadTasks(){
    try{
      const items = await api("GET","/tasks");
      const list = document.getElementById("tList");
      list.innerHTML = items.length ? items.map(t=>`
        <div class="card tight"><div class="actions" style="justify-content:space-between">
          <div style="display:flex;align-items:center;gap:10px">
            <button class="btn ${t.done?'':'ghost'} sm" data-act="toggleTask" data-id="${esc(t.id)}">${t.done?'✓ تم':'علّم تم'}</button>
            <span style="${t.done?'text-decoration:line-through;opacity:.6':''}">${esc(t.title)}</span></div>
          <button class="linkbtn" data-act="delTask" data-id="${esc(t.id)}">حذف</button></div>
          <div class="actions" style="margin-top:8px"><span class="pill">المسؤول: ${esc(OWN_AR[t.owner]||t.owner)}</span>${t.due?`<span class="pill warn">📅 ${esc(t.due)}</span>`:""}</div>
        </div>`).join("") : `<div class="empty">مفيش مهام. أضيفوا أول مهمة فوق.</div>`;
    }catch(e){ document.getElementById("tList").innerHTML=`<div class="empty">${esc(errMsg(e))}</div>`; }
  }

  async function renderBudget(){
    S.view="budget"; S.resourceId=null;
    el.innerHTML = pageTitle("الميزانية المشتركة","نتتبّع فلوسنا رايحة فين: مخطّط، مدفوع، ومتبقّي.") + `
      <div class="card tight">
        <div class="row"><label>اسم البند</label><input id="bLabel" type="text" placeholder="مثلًا: قاعة الفرح"></div>
        <div class="row"><label>الفئة (اختياري)</label><input id="bCat" type="text" placeholder="فرح / جهاز / بيت / فواتير"></div>
        <div class="row"><label>المبلغ المخطّط</label><input id="bPlanned" type="text" placeholder="0"></div>
        <button class="btn" data-act="addBudget">أضِف بند</button>
      </div>
      <div id="bSummary"></div><div id="bList"><div class="empty">…تحميل</div></div>`;
    await reloadBudget();
  }
  async function reloadBudget(){
    try{
      const items = await api("GET","/budget");
      const planned = items.reduce((a,b)=>a+(+b.planned||0),0), paid = items.reduce((a,b)=>a+(+b.paid||0),0);
      document.getElementById("bSummary").innerHTML = `<div class="card tight"><div class="actions">
        <span class="pill">المخطّط: ${fmtMoney(planned)}</span><span class="pill warn">المدفوع: ${fmtMoney(paid)}</span>
        <span class="pill dot ${planned-paid<=0?'':'warn'}">المتبقّي: ${fmtMoney(planned-paid)}</span></div></div>`;
      const list = document.getElementById("bList");
      list.innerHTML = items.length ? items.map(b=>{const rem=(+b.planned||0)-(+b.paid||0);return `
        <div class="card tight"><div class="actions" style="justify-content:space-between"><h2 style="margin:0;font-size:17px">${esc(b.label)}</h2>
          <button class="linkbtn" data-act="delBudget" data-id="${esc(b.id)}">حذف</button></div>
          <div class="actions" style="margin-top:8px">${b.cat?`<span class="pill">${esc(b.cat)}</span>`:""}<span class="pill warn">مدفوع ${fmtMoney(b.paid)} / ${fmtMoney(b.planned)}</span>
          <span class="pill dot ${rem<=0?'':'warn'}">${rem<=0?'مكتمل':'باقي '+fmtMoney(rem)}</span>
          <div class="spacer"></div><button class="btn soft sm" data-act="payBudget" data-id="${esc(b.id)}">سجّل دفعة</button></div>
        </div>`}).join("") : `<div class="empty">مفيش بنود. أضيفوا بنود الميزانية فوق.</div>`;
    }catch(e){ document.getElementById("bList").innerHTML=`<div class="empty">${esc(errMsg(e))}</div>`; }
  }

  async function renderShopping(){
    S.view="shopping"; S.resourceId=null;
    el.innerHTML = pageTitle("قائمة المشتريات","قائمة حيّة لبيتنا — الشطب بيظهر للاتنين.") + `
      <div class="card tight"><div class="row"><label>الصنف</label><input id="sText" type="text" placeholder="حليب، بيض، إصلاح سباكة…"></div>
        <button class="btn" data-act="addShop">أضِف</button></div>
      <div id="sList"><div class="empty">…تحميل</div></div>`;
    await reloadShopping();
  }
  async function reloadShopping(){
    try{
      const items = await api("GET","/shopping");
      const list = document.getElementById("sList");
      list.innerHTML = items.length ? items.map(s=>`
        <div class="card tight"><div class="actions" style="justify-content:space-between">
          <div style="display:flex;align-items:center;gap:10px"><button class="btn ${s.done?'':'ghost'} sm" data-act="toggleShop" data-id="${esc(s.id)}">${s.done?'✓':'○'}</button>
          <span style="${s.done?'text-decoration:line-through;opacity:.6':''}">${esc(s.text)}</span></div>
          <button class="linkbtn" data-act="delShop" data-id="${esc(s.id)}">حذف</button></div></div>`).join("")
        : `<div class="empty">القائمة فاضية. أضيفوا اللي البيت محتاجه.</div>`;
    }catch(e){ document.getElementById("sList").innerHTML=`<div class="empty">${esc(errMsg(e))}</div>`; }
  }

  async function renderSettings(){
    S.view="settings"; S.resourceId=null;
    const pinSet = !!localStorage.getItem(PIN_KEY);
    const whoName = devWho()==="m"?"مصطفى":devWho()==="d"?"ضحى":"";
    el.innerHTML = pageTitle("الإعدادات","الخصوصية أولًا. بياناتنا ملكنا.") + `
      <div class="card"><div class="eyebrow">الميثاق</div><p class="muted" style="margin-top:-6px">كود ميثاقكم: <b>${esc(S.code||"—")}</b> — شاركه مع شريكك مرة واحدة فقط.</p></div>

      <div class="card">
        <div class="eyebrow">قفل الجهاز 🔐</div>
        <p class="muted" style="margin-top:-6px">
          ${pinSet ? `كود PIN مفعّل على الجهاز ده${whoName?" ("+whoName+")":" "}.` : "مفيش كود PIN على الجهاز ده — الأب مكشوف لأي حد."}
        </p>
        <div class="actions" style="flex-wrap:wrap;gap:8px;margin-top:10px">
          <button class="btn sm" data-act="setupPin">${pinSet?"تغيير الكود":"إعداد كود PIN"}</button>
          ${pinSet?`<button class="btn ghost sm" data-act="clearPin">إزالة القفل</button>`:""}
        </div>
      </div>

      <div class="card"><div class="eyebrow">بياناتك</div><h2>تصدير كل البيانات</h2>
        <p class="muted" style="margin-top:-6px">المكتبة، القرارات، المهام، الميزانية، والمشتريات في ملف JSON واحد.</p>
        <button class="btn" data-act="export">تصدير (JSON)</button></div>
      <div class="card"><div class="eyebrow">الحساب</div><div class="actions"><button class="btn ghost" data-act="logout">تسجيل الخروج</button></div></div>`;
  }

  function authField(ico, id, type, ph, val, eye){
    return `<div class="auth-field"><span class="af-ico">${ico}</span>`
      + `<input id="${id}" type="${type}" ${type==='email'?'inputmode="email"':''} placeholder="${ph}" value="${val||''}">`
      + (eye?`<button class="af-eye" data-act="togglePw" data-for="${id}" aria-label="إظهار">👁️</button>`:'')
      + `</div>`;
  }
  function renderOnboarding(){
    const mode = S.authMode || "login";
    const em = esc(S.email||"");
    const tabs = `<div class="auth-tabs">
      <button class="auth-tab ${mode==='login'?'on':''}" data-act="authMode" data-m="login">تسجيل الدخول</button>
      <button class="auth-tab ${mode!=='login'?'on':''}" data-act="authMode" data-m="signup">حساب جديد</button></div>`;
    let body;
    if(mode==="login"){
      body = authField("📧","emailL","email","الإيميل",em)
        + authField("🔒","pwL","password","الباسوورد","",true)
        + `<button class="auth-btn" data-act="login">دخول</button>`
        + `<p class="auth-hint">أول مرة معانا؟ <a href="#" data-act="authMode" data-m="signup">اعمل حساب جديد</a></p>`;
    } else if(mode==="join"){
      body = `<p class="auth-hint" style="margin:0 0 12px">معاك كود من شريكك؟ ادخل بياناتك وانضم لنفس الميثاق.</p>`
        + authField("🙂","nameJ","text","اسمك (مثلًا: ضحى)")
        + authField("🔑","codeJ","text","كود الميثاق")
        + authField("📧","emailJ","email","الإيميل")
        + authField("🔒","pwJ","password","الباسوورد","",true)
        + `<button class="auth-btn ghost" data-act="join">انضمام للميثاق</button>`
        + `<p class="auth-hint"><a href="#" data-act="authMode" data-m="signup">← رجوع لإنشاء حساب جديد</a></p>`;
    } else { // signup (first time, partner A)
      body = `<p class="auth-hint" style="margin:0 0 12px">ابدأ مساحتكم، وهتاخد كود تشاركه مع شريكك لينضم.</p>`
        + authField("🙂","nameC","text","اسمك (مثلًا: مصطفى)")
        + authField("📧","emailC","email","الإيميل")
        + authField("🔒","pwC","password","باسوورد (٤ حروف على الأقل)","",true)
        + `<button class="auth-btn" data-act="create">إنشاء ميثاقنا</button>`
        + `<p class="auth-hint">معاك كود شريكك؟ <a href="#" data-act="authMode" data-m="join">انضم بيه</a></p>`;
    }
    el.innerHTML = `<div class="auth">
      <div class="auth-brand"><div class="auth-logo">سكن</div><p class="auth-tag">مساحتنا إحنا الاتنين بس — نتعلّم، نتناقش، ونتفق.</p></div>
      <div class="auth-card">${tabs}${body}</div>
      <p class="auth-foot">خاصّة بطبيعتها · من غير مشاركة عامة 🌿</p>
      <button class="linkbtn auth-api" data-act="apiedit">تغيير عنوان الخادم</button>
    </div>`;
  }

  const APP_URL = location.origin;
  const NB_PROMPT = `أنت تعمل كمحلل محتوى خبير لمشروع «سكن»، نظام تشغيل خاص للأزواج يهدف لتعزيز التوافق (Alignment) عبر التعلّم المنظّم والنقاش الهادف وتوثيق القرارات. مهمتك: تحويل المحتوى المقدَّم (رابط فيديو أو نص) إلى معرفة منظّمة وقابلة للتطبيق ومحفّزة للنقاش بين الزوجين.

قواعد «سكن»: الزوجان أولًا · الخصوصية أساس · كل مورد يولّد نقاشًا · كل نقاش يولّد قرارًا · لا ميزات اجتماعية · القرارات أهم من الملاحظات.

أخرِج بالضبط بهذا التنسيق (Markdown):

## [عنوان الفيديو]

### 1. ملخص تحليلي مفصل
(الفكرة المحورية، البنية الرئيسية، الحجج والأدلة، الخلاصة. حتى 300 كلمة.)

### 2. أهم الأفكار والدروس
(7–10 نقاط، كل نقطة مبدأ يمكن للزوجين التأمل فيه وتطبيقه.)

### 3. أسئلة للنقاش العميق بين الزوجين
(5–7 أسئلة مفتوحة تشجّع على التأمل الذاتي، تبادل وجهات النظر، كشف التوقعات، تحديد التوافق/الاختلاف، والتخطيط. تجنّب أسئلة نعم/لا.)

### 4. تطبيقات عملية متعددة الأوجه
(5–8 تطبيقات: أفعال فردية، أنشطة زوجية مشتركة، ونقاط لاتخاذ القرار.)`;

  function resCard(r){
    return `<div class="card res" data-open="${esc(r.id)}">
      <div style="display:flex;gap:14px;align-items:center;flex:1;min-width:0">
        ${ r.thumbnail ? `<img src="${esc(r.thumbnail)}" alt="" loading="lazy" style="width:104px;height:62px;object-fit:cover;border-radius:10px;flex:none">` : `<span style="font-size:22px;flex:none">${TYPE_ICON[r.type]||"📄"}</span>` }
        <div style="min-width:0"><h2 style="margin:0;font-size:17px">${ytMark(r)}${esc(r.title)}</h2><div class="meta" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.link?esc(r.link):"بدون رابط"}</div></div>
      </div>
      <div style="display:flex;gap:6px;flex:none;align-items:center">${r.priority?`<span class="pill warn">${PRIO_AR[r.priority]||esc(r.priority)}</span>`:""}${dualProg(r.prog)}</div>
    </div>`;
  }
  function doSearch(q, items, questions, decisions){
    const box=document.getElementById("searchResults"), list=document.getElementById("list"), lc=document.getElementById("libListWrap");
    q=(q||"").trim().toLowerCase();
    if(!q){ if(box) box.innerHTML=""; if(lc) lc.style.display=""; return; }
    if(lc) lc.style.display="none";
    const hit=(s)=> String(s||"").toLowerCase().includes(q);
    const ri=items.filter(r=> hit(r.title)||hit(r.speaker)||hit(r.purpose)||hit(r.link));
    const qi=(questions||[]).filter(x=> hit(x.text));
    const di=(decisions||[]).filter(x=> hit(x.title)||hit(x.context)||hit(x.summary));
    let html="";
    if(ri.length) html += `<div class="eyebrow" style="margin-top:14px">موارد (${ri.length})</div>`+ri.map(resCard).join("");
    if(qi.length) html += `<div class="eyebrow" style="margin-top:16px">أسئلة نقاش (${qi.length})</div>`+qi.map(x=>`<div class="card res" data-openq="${esc(x.resourceId)}"><div style="flex:1;min-width:0">💬 ${esc(x.text)}</div></div>`).join("");
    if(di.length) html += `<div class="eyebrow" style="margin-top:16px">قرارات (${di.length})</div>`+di.map(x=>`<div class="card res" data-act="decisionlog"><div style="flex:1;min-width:0">✅ ${esc(x.title||x.context||"قرار")}</div></div>`).join("");
    if(!html) html = `<div class="empty" style="margin-top:12px">مفيش نتائج لـ «${esc(q)}».</div>`;
    if(box) box.innerHTML = html;
  }

  async function renderLibrary(){
    S.view="library"; S.resourceId=null;
    el.innerHTML = pageTitle("المكتبة","كل موادنا في مكان واحد — دوّر، أضِف، وتابعوا تقدّم بعض.")
    + `<div class="card"><div class="eyebrow">بحث في كل حاجة</div>
        <div class="row" style="margin-top:4px"><input id="libSearch" type="search" placeholder="دوّر في الموارد، أسئلة النقاش، والقرارات…"></div>
        <div id="searchResults"></div></div>`
    + `<div class="card"><div class="eyebrow">إضافة</div><h2 style="margin:2px 0 0">أضِف موردًا</h2>
        <details class="hintbox">
          <summary>إزاي نجهّز المورد بالظبط؟ (NotebookLM)</summary>
          <ol style="margin:10px 0 0; padding-inline-start:20px; line-height:2; font-size:13.5px">
            <li>افتح <b>NotebookLM</b> وحط رابط الفيديو كـ <b>Source</b>.</li>
            <li>اضغط «انسخ البرومت» تحت والصقه في NotebookLM.</li>
            <li>هيطلّعلك: ملخّص + أهم الأفكار + أسئلة نقاش + تطبيقات عملية.</li>
            <li>الصق كل قسم في خانته تحت — وهنحفظهم جاهزين للحوار والقرار.</li>
          </ol>
          <div class="actions" style="margin-top:10px; gap:8px; flex-wrap:wrap">
            <button class="btn soft sm" data-act="copyPrompt">📋 انسخ البرومت</button>
            <a class="btn ghost sm" href="https://notebooklm.google.com" target="_blank" rel="noopener">افتح NotebookLM ↗</a>
            <button class="btn ghost sm" data-act="copyAppUrl">🔗 انسخ رابط التطبيق</button>
          </div>
        </details>
        <div class="row"><label>العنوان</label><input id="rTitle" type="text" placeholder="مثلًا: حتى ترضى"></div>
        <div class="row"><label>الرابط (يوتيوب / تيليجرام)</label><input id="rLink" type="text" placeholder="https://..."></div>
        <div class="row"><label>الملخّص</label><textarea id="rSummary" placeholder="الصق الملخّص من NotebookLM…"></textarea></div>
        <div class="row"><label>أهم الأفكار <span class="muted">(سطر لكل فكرة)</span></label><textarea id="rInsights" placeholder="فكرة في كل سطر…"></textarea></div>
        <div class="row"><label>أسئلة النقاش <span class="muted">(سطر لكل سؤال)</span></label><textarea id="rQuestions" placeholder="سؤال في كل سطر…"></textarea></div>
        <div class="row"><label>تطبيقات عملية <span class="muted">(سطر لكل تطبيق)</span></label><textarea id="rApps" placeholder="تطبيق في كل سطر…"></textarea></div>
        <button class="btn" data-act="addRes">أضِف المورد</button></div>`
    + `<div id="libListWrap">
        <div class="eyebrow" style="margin-top:24px">موادنا <span class="muted" id="libCount"></span></div>
        <p class="muted" style="margin:-2px 0 10px;font-size:13px">الشارة <b>أنا / شريكي</b> بتوريكم مين سمع إيه ووصل لفين.</p>
        <div id="list"><div class="empty">…تحميل</div></div></div>`
    + `<details class="card" style="margin-top:18px"><summary style="cursor:pointer;font-weight:700;color:var(--primary-ink)">استيراد سريع لروابط كتير</summary>
        <p class="muted" style="margin-top:8px;font-size:13px">رابط في كل سطر.</p>
        <div class="row"><textarea id="bulk" placeholder="https://...&#10;https://..." style="min-height:110px"></textarea></div>
        <button class="btn ghost" data-act="importBulk">استورد الكل</button></details>`;
    try{
      const [items, questions, decisions] = await Promise.all([api("GET","/resources"), api("GET","/questions").catch(()=>[]), api("GET","/decisions").catch(()=>[])]);
      items.sort((a,b)=> (PRIO_W[a.priority]??1)-(PRIO_W[b.priority]??1) || (hasYt(b)-hasYt(a)) || (b.createdAt-a.createdAt));
      const cnt=document.getElementById("libCount"); if(cnt) cnt.textContent="("+items.length+")";
      const list=document.getElementById("list");
      if(list) list.innerHTML = items.length ? items.map(resCard).join("") : `<div class="empty">لسه مفيش موارد. استورد المنهج من «قوائمنا» أو ضيف مورد فوق.</div>`;
      const si=document.getElementById("libSearch");
      if(si) si.addEventListener("input", ()=> doSearch(si.value, items, questions||[], decisions||[]));
    }catch(e){ const l=document.getElementById("list"); if(l) l.innerHTML = `<div class="empty">${esc(errMsg(e))}</div>`; }
  }

  async function renderResource(){
    el.innerHTML = `<div class="empty">…تحميل</div>`;
    try{ S.detail = await api("GET","/resources/"+S.resourceId); }
    catch(e){ el.innerHTML = `<div class="empty">${esc(errMsg(e))}</div><button class="btn ghost" data-act="library">رجوع</button>`; return; }
    const r = S.detail.resource;
    const emb = ytEmbed(r.link);
    const pg = r.prog || {mine:'not_started',partner:'not_started'};
    const pgBtn = (v,lbl)=>`<button data-act="setProg" data-val="${v}" style="width:auto;padding:0 11px" class="${pg.mine===v?'on':''}">${lbl}</button>`;
    const prBtn = (v,lbl)=>`<button data-act="setPrio" data-val="${v}" style="width:auto;padding:0 11px" class="${r.priority===v?'on':''}">${lbl}</button>`;
    const curCat = catOf(r);
    const ctBtn = (v,lbl)=>`<button data-act="setCat" data-val="${v}" style="width:auto;padding:0 11px" class="${curCat===v?'on':''}">${lbl}</button>`;
    el.innerHTML = `
      <button class="linkbtn" data-act="library">→ المكتبة</button>
      <h1 class="display" style="margin-top:8px">${ytMark(r)}${esc(r.title)}</h1>
      <div class="card tight" style="display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center">
        <span class="muted" style="flex:none">متابعتي:</span>
        <div class="themesw">${pgBtn('not_started','لم أبدأ')}${pgBtn('in_progress','أشاهد')}${pgBtn('completed','أنهيت ✓')}</div>
        <span class="muted" style="flex:none">شريكي:</span> ${progPill(pg.partner,'شريكي')}
        <span class="spacer"></span>
        <span class="muted" style="flex:none">الأولوية:</span>
        <div class="themesw">${prBtn('high','عالية')}${prBtn('medium','متوسطة')}${prBtn('later','لاحقًا')}</div>
        <button class="btn soft sm" data-act="setFocus" style="flex:none">📌 مادتنا دلوقتي</button>
      </div>
      <div class="card tight" style="display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center">
        <span class="muted" style="flex:none">التصنيف:</span>
        <div class="themesw">${CATS.map(c=>ctBtn(c.id,c.ico+' '+c.title)).join("")}</div>
      </div>
      ${ emb ? `<div style="margin-top:14px;border-radius:var(--radius-sm);overflow:hidden;aspect-ratio:16/9;background:#000"><iframe src="${emb}" style="width:100%;height:100%;border:0" allowfullscreen loading="lazy"></iframe></div>`
            : (r.link ? `<div style="margin-top:8px"><a class="linkbtn" href="${esc(r.link)}" target="_blank" rel="noopener">فتح المصدر ↗</a></div>` : "") }
      <div class="tabs">
        <button class="tab ${S.tab==='summary'?'active':''}" data-tab="summary">الملخص</button>
        <button class="tab ${S.tab==='discussion'?'active':''}" data-tab="discussion">الحوار</button>
        <button class="tab ${S.tab==='notes'?'active':''}" data-tab="notes">ملاحظات</button>
        <button class="tab ${S.tab==='decisions'?'active':''}" data-tab="decisions">القرارات</button>
      </div>
      <div id="tab"></div>`;
    if(S.tab==="summary") renderSummary();
    else if(S.tab==="discussion") renderDiscussion();
    else if(S.tab==="notes") renderNotes();
    else renderDecisions();
  }
  function ytEmbed(link){
    link = link||"";
    const v = link.match(/(?:youtu\.be\/|[?&]v=)([\w-]{6,})/);
    if(v) return "https://www.youtube.com/embed/"+v[1];
    const p = link.match(/[?&]list=([\w-]+)/);
    if(p && /youtube\.com\/playlist/.test(link)) return "https://www.youtube.com/embed/videoseries?list="+p[1];
    return null;
  }
  async function renderNotes(){
    const t = document.getElementById("tab");
    t.innerHTML = `<div class="empty">…تحميل</div>`;
    let n; try{ n = await api("GET","/resources/"+S.resourceId+"/notes"); }catch(e){ t.innerHTML=`<div class="empty">${esc(errMsg(e))}</div>`; return; }
    t.innerHTML = `
      <div class="card"><div class="eyebrow">ملاحظات مشتركة</div>
        <p class="muted" style="margin-top:-6px">نشوفها ونعدّلها إحنا الاتنين.</p>
        <textarea id="sharedNote" placeholder="نقاط اتفقتوا تكتبوها سوا…">${esc(n.shared)}</textarea>
        <div class="actions" style="margin-top:8px"><span class="spacer"></span><button class="btn sm" data-act="saveSharedNote">احفظ المشتركة</button></div></div>
      <div class="card"><div class="eyebrow">ملاحظاتك الخاصة</div>
        <p class="muted" style="margin-top:-6px">تظهر لك وحدك.</p>
        <textarea id="privNote" placeholder="تأملاتك الخاصة حول هذا المورد…">${esc(n.mine)}</textarea>
        <div class="actions" style="margin-top:8px"><span class="spacer"></span><button class="btn sm" data-act="savePrivateNote">احفظ الخاصة</button></div></div>`;
  }

  function renderSummary(){
    const t = document.getElementById("tab");
    const sum = S.detail.summary;
    t.innerHTML = `
      <div class="card">
        <div class="eyebrow">الملخص</div>
        ${ sum ? `<p style="white-space:pre-wrap">${esc(sum.content)}</p>`
               : `<p class="muted">لم يُولَّد ملخص بعد. سيُولّده الذكاء الاصطناعي من نص المصدر (هو فقط يلخّص ويقترح الأسئلة — القرار لينا إحنا بس).</p>` }
        <div class="actions" style="margin-top:12px">
          <button class="btn ${sum?'ghost':''}" data-act="genSummary">${sum?'إعادة التوليد':'وَلِّد الملخص'}</button>
        </div>
      </div>
      <div class="card tight">
        <div class="actions"><span class="muted">جاهزين للحوار؟</span><div class="spacer"></div>
        <button class="btn soft" data-act="goDiscuss">يلا نبدأ الحوار ←</button></div>
      </div>`;
  }

  async function renderDiscussion(){
    const t = document.getElementById("tab");
    const qs = S.detail.questions || [];
    if(!qs.length){
      t.innerHTML = `<div class="card"><div class="eyebrow">الحوار</div>
        <p class="muted">لا توجد أسئلة بعد. ولِّد أسئلة نقاش من الملخص، أو أضِف سؤالك الخاص.</p>
        <div class="actions" style="margin-top:10px">
          <button class="btn" data-act="genQuestions">وَلِّد أسئلة للنقاش</button>
        </div></div>
        <div class="card tight"><div class="row"><label>أضِف سؤالًا بنفسك</label><input id="qNew" type="text" placeholder="اكتب سؤالًا…"></div><button class="btn ghost sm" data-act="addQ">أضِف السؤال</button></div>`;
      return;
    }
    t.innerHTML = `<div id="qs"><div class="empty">…تحميل الإجابات</div></div>
      <div class="card tight"><div class="row"><label>أضِف سؤالًا</label><input id="qNew" type="text" placeholder="اكتب سؤالًا…"></div><button class="btn ghost sm" data-act="addQ">أضِف السؤال</button></div>`;
    // load each question's responses
    const data = await Promise.all(qs.map(q=> api("GET","/questions/"+q.id+"/responses").then(r=>({q,r})).catch(()=>({q,r:{questionState:q.state,mine:null,partner:null}}))));
    document.getElementById("qs").innerHTML = data.map(({q,r})=>{
      const st = r.questionState;
      const locked = st==="revealed" || st==="decided";
      const mine = r.mine? r.mine.text : "";
      const partnerCell = (locked && r.partner)
        ? `<div class="ans revealed-glow"><div class="who"><span class="pill" style="background:var(--accent-soft);color:#7c4b5b">الطرف الآخر</span></div><div class="body">${esc(r.partner.text)}</div></div>`
        : `<div class="ans covered"><div class="lock">۝</div><div>إجابة الطرف الآخر مخفية<br>حتى تجيبا كلاكما</div></div>`;
      return `<div class="q" data-q="${esc(q.id)}">
        <p class="qtext">${esc(q.text)}</p>
        <span class="pill dot ${locked?'':'warn'}">${STATE_AR[st]||esc(st)}</span>
        <div class="answers">
          <div class="ans">
            <div class="who">إجابتك</div>
            <textarea class="myans" ${locked?'disabled':''} placeholder="${locked?'':'اكتب إجابتك بصدق…'}">${esc(mine)}</textarea>
            ${locked? '' : `<div style="margin-top:8px"><button class="btn sm" data-act="saveAns" data-q="${esc(q.id)}">احفظ إجابتي</button></div>`}
          </div>
          ${partnerCell}
        </div>
        ${ st==="ready_to_reveal" ? `<div class="actions" style="margin-top:12px"><button class="btn accent sm" data-act="reveal" data-q="${esc(q.id)}">اكشفا الإجابتين معًا</button></div>`
          : (st==="answered_by_one" ? `<div class="actions" style="margin-top:12px"><span class="muted" style="font-size:13px">بانتظار الطرف الآخر…</span><button class="linkbtn" data-act="force" data-q="${esc(q.id)}">اكشف الآن</button></div>` : "") }
      </div>`;
    }).join("");
  }

  const CAT_AR = { general:"عام", financial:"مالي", family:"عائلي", life:"حياتي" };
  function decCard(d, opts){
    const inResource = opts && opts.inResource;
    return `<div class="card">
        <div class="eyebrow">قرار${d.category?` · ${CAT_AR[d.category]||esc(d.category)}`:""}</div>
        <p style="font-family:'El Messiri',serif; font-size:18px; margin:0 0 ${(d.context||d.reviewDate)?'6':'10'}px">${esc(d.statement)}</p>
        ${d.context?`<p class="muted" style="font-size:13.5px;margin:0 0 8px">السياق: ${esc(d.context)}</p>`:""}
        ${d.reviewDate?`<p class="muted" style="font-size:13px;margin:0 0 8px">📅 مراجعة: ${esc(d.reviewDate)}${d.reviewed?' · تمت':''}</p>`:""}
        <div class="actions">
          <span class="pill dot ${d.state==='confirmed'?'':'warn'}" style="${d.state==='confirmed'?'background:var(--accent-soft);color:#7c4b5b':''}">${STATE_AR[d.state]||esc(d.state)} ${d.confirmCount?('· '+d.confirmCount+'/2'):''}</span>
          ${ inResource && d.state!=="confirmed" ? `<button class="btn accent sm" data-act="confirm" data-d="${esc(d.id)}">أؤكّد موافقتي</button>` : (d.state==="confirmed"? `<span class="muted" style="font-size:13px">مؤكَّد من كليكما.</span>`:"") }
          ${ (d.state==="confirmed" && !d.reviewed) ? `<button class="btn ghost sm" data-act="reviewDec" data-d="${esc(d.id)}">تمت المراجعة</button>` : "" }
        </div>
      </div>`;
  }

  function renderDecisions(){
    const t = document.getElementById("tab");
    const decs = S.detail.decisions || [];
    const qs = (S.detail.questions||[]).filter(q=> q.state==="revealed" || q.state==="decided");
    const list = decs.length ? decs.map(d=> decCard(d,{inResource:true})).join("") : `<div class="empty">لا قرارات بعد. القرار هو ثمرة الحوار — سجّلاه بعد أن تكشفا إجاباتكما.</div>`;

    t.innerHTML = list + `
      <div class="card">
        <div class="eyebrow">تسجيل قرار</div>
        <h2>على إيه اتفقنا؟</h2>
        ${ qs.length ? `
        <div class="row"><label>صياغة القرار</label><textarea id="dStmt" placeholder="مثلًا: اتفقنا على تخصيص ليلة أسبوعية للحوار."></textarea></div>
        <div class="row"><label>السياق (اختياري)</label><textarea id="dContext" placeholder="إيه اللي أدّى للقرار ده؟"></textarea></div>
        <div class="row"><label>التصنيف</label>
          <div class="themesw" id="dCat" role="group" style="border-radius:12px;flex-wrap:wrap">
            <button type="button" data-cat="general" class="on" style="width:auto;padding:6px 12px">عام</button>
            <button type="button" data-cat="financial" style="width:auto;padding:6px 12px">مالي</button>
            <button type="button" data-cat="family" style="width:auto;padding:6px 12px">عائلي</button>
            <button type="button" data-cat="life" style="width:auto;padding:6px 12px">حياتي</button></div></div>
        <div class="row"><label>تاريخ مراجعة (اختياري)</label><input id="dReview" type="text" placeholder="2026-12-01"></div>
        <label>اربط القرار بالأسئلة التي ناقشتماها</label>
        <div class="checks">${qs.map(q=>`<label><input type="checkbox" class="dq" value="${esc(q.id)}"><span>${esc(q.text)}</span></label>`).join("")}</div>
        <button class="btn" data-act="createDec">سجّل القرار (مسودّة)</button>
        <p class="muted" style="font-size:12.5px; margin-top:10px">القرار يبقى نهائي بس لما نأكّده إحنا الاتنين.</p>
        ` : `<p class="muted">اكشفا سؤالًا واحدًا على الأقل في تبويب الحوار أولًا، ثم عودا لتسجيل قراركما.</p>` }
      </div>`;
  }

  // ========== رحلتي ==========
  async function renderMyJourney(){
    S.view="myjourney"; S.resourceId=null;
    el.innerHTML = pageTitle("رحلتي 🌿","خطواتك إنت بس — مش بيشوفها حد غيرك.")
      + `<div id="jrnBody"><div class="empty">…تحميل</div></div>`;

    let data;
    try { data = await api("GET","/journey"); }
    catch(e){ document.getElementById("jrnBody").innerHTML=`<div class="empty">${esc(errMsg(e))}</div>`; return; }

    const { events, myId } = data;
    if(!events.length){
      document.getElementById("jrnBody").innerHTML=`<div class="empty" style="padding:40px">لسه مفيش رحلة. ابدأ بإضافة مورد أو متابعة محتوى 🌱</div>`;
      return;
    }

    // ── Icon & label per event type ──
    function evIcon(e){
      if(e.entity==="resource"){
        if(e.type==="created")          return {ico:"📚",txt:"أضفت موردًا جديدًا"+(e.title?` · ${e.title}`:"")};
        if(e.type==="progress"||e.type==="transition"){
          if(e.to==="completed")        return {ico:"✅",txt:"أنهيت مادة"+(e.title?` · ${e.title}`:"")};
          if(e.to==="in_progress")      return {ico:"▶️",txt:"بدأت مادة"+(e.title?` · ${e.title}`:"")};
        }
        if(e.type==="summary_generated") return {ico:"🤖",txt:"ولّدت ملخصًا"+(e.title?` · ${e.title}`:"")};
      }
      if(e.entity==="question"){
        if(e.type==="created")          return {ico:"💬",txt:"أضفت سؤالًا للنقاش"+(e.title?` من · ${e.title}`:"")};
        if(e.type==="response_submitted") return {ico:"✍️",txt:"أجبت على سؤال"+(e.title?` في · ${e.title}`:"")};
        if(e.type==="transition" && e.to==="revealed") return {ico:"👀",txt:"كشفت الإجابات"+(e.title?` · ${e.title}`:"")};
      }
      if(e.entity==="decision"){
        if(e.type==="created")          return {ico:"⚡",txt:"سجّلت قرارًا"+(e.title?` من · ${e.title}`:"")};
        if(e.type==="confirmation")     return {ico:"🤝",txt:"أكّدت قرارًا"};
      }
      if(e.entity==="task" && e.type==="created") return {ico:"🗒️",txt:"أضفت مهمة"};
      return {ico:"🔔",txt:`نشاط`};
    }

    // ── Group by day ──
    function dayLabel(ts){
      const d = new Date(ts);
      const today = new Date(); today.setHours(0,0,0,0);
      const yd = new Date(today); yd.setDate(yd.getDate()-1);
      if(d >= today) return "اليوم";
      if(d >= yd)    return "أمس";
      return d.toLocaleDateString("ar-EG",{weekday:"long",month:"long",day:"numeric"});
    }

    // ── Render timeline ──
    let html = "";
    let lastDay = null;

    events.forEach(e=>{
      const day = dayLabel(e.createdAt);
      if(day !== lastDay){
        if(lastDay !== null) html += `</div>`;
        html += `<div class="jrn-day-label">${day}</div><div class="jrn-group">`;
        lastDay = day;
      }
      const {ico,txt} = evIcon(e);
      // رحلتي = أنا بس — مفيش حاجة من الطرف الآخر هنا
      const who    = "أنا";
      const whoClr = "var(--primary)";
      const time   = new Date(e.createdAt).toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"});
      html += `
        <div class="jrn-item ${e.isMine?'mine':'partner'}">
          <div class="jrn-ico">${ico}</div>
          <div class="jrn-body">
            <span class="jrn-who" style="color:${whoClr}">${who}</span>
            <span class="jrn-txt">${esc(txt)}</span>
            <span class="jrn-time">${time}</span>
          </div>
        </div>`;
    });
    if(lastDay !== null) html += `</div>`;

    document.getElementById("jrnBody").innerHTML = html;
  }

  async function renderDiscussionsAll(){
    S.view="discussions"; S.resourceId=null;
    el.innerHTML = pageTitle("المناقشات","كل الأسئلة من موادنا في مكان واحد.") + `<div id="dscBody"><div class="empty">…تحميل</div></div>`;
    try{
      const [qs, res] = await Promise.all([api("GET","/questions"), api("GET","/resources")]);
      const titles = Object.fromEntries(res.map(r=>[r.id, r.title]));
      const body=document.getElementById("dscBody");
      if(!qs.length){ body.innerHTML=`<div class="empty">لسه مفيش أسئلة. افتح موردًا وولّد منه أسئلة نقاش.</div>`; return; }
      const byRes={}; qs.forEach(q=>{ (byRes[q.resourceId]=byRes[q.resourceId]||[]).push(q); });
      body.innerHTML = Object.keys(byRes).map(rid=>`<div class="eyebrow" style="margin-top:20px">${esc(titles[rid]||"مورد")}</div>`
        + byRes[rid].map(q=>`<div class="card res" data-openq="${esc(rid)}">
            <div style="flex:1;min-width:0"><p style="margin:0">${esc(q.text)}</p></div>
            <span class="pill dot ${['revealed','decided'].includes(q.state)?'':'warn'}" style="flex:none">${STATE_AR[q.state]||esc(q.state)}</span>
          </div>`).join("")).join("");
    }catch(e){ document.getElementById("dscBody").innerHTML=`<div class="empty">${esc(errMsg(e))}</div>`; }
  }

  async function renderDecisionLog(){
    S.view="decisionlog"; S.resourceId=null;
    el.innerHTML = pageTitle("سجل القرارات","كل ما اتفقنا عليه — مرتّب ودائم.") + `<div id="decBody"><div class="empty">…تحميل</div></div>`;
    try{
      const decs = await api("GET","/decisions");
      document.getElementById("decBody").innerHTML = decs.length ? decs.map(d=> decCard(d,{inResource:false})).join("")
        : `<div class="empty">لا قرارات بعد. كل حوار تكملوه يتحوّل لقرار من تبويب القرارات داخل المورد.</div>`;
    }catch(e){ document.getElementById("decBody").innerHTML=`<div class="empty">${esc(errMsg(e))}</div>`; }
  }

  // ---------- phase 5: التواصل ----------
  const MOOD_OPT = [["great","😍 رائعة"],["good","🙂 جيدة"],["ok","😐 عادية"],["low","😟 متعبة"]];
  const moodLabel = (v)=> (MOOD_OPT.find(m=>m[0]===v)||["","—"])[1];
  async function renderCharter(){
    S.view="charter"; S.resourceId=null;
    el.innerHTML = pageTitle("ميثاقنا","اتفاقاتنا الثابتة اللي نرجعلها وقت الحاجة — من قلبنا ومن منهجنا.") + `<div id="chBody"><div class="empty">…تحميل</div></div>`;
    try{
      const items = await api("GET","/charter");
      const by = k => items.filter(x=>x.kind===k);
      const calm = by("calmword")[0];
      const listBlock = (k, ph) => {
        const arr = by(k);
        return `<div class="row" style="margin-top:4px"><input id="ch_${k}" type="text" placeholder="${ph}"></div>
          <div class="actions"><span class="spacer"></span><button class="btn sm" data-act="addCharter" data-kind="${k}">أضِف</button></div>
          ${arr.length? arr.map(it=>`<div class="actions" style="justify-content:space-between;padding:7px 0;border-top:1px solid var(--line)">
            <span style="flex:1">• ${esc(it.text)}</span><button class="linkbtn" data-act="delCharter" data-id="${esc(it.id)}">حذف</button></div>`).join("")
            : `<p class="muted" style="font-size:13px">لسه فاضي.</p>`}`;
      };
      document.getElementById("chBody").innerHTML = `
        <div class="card"><div class="eyebrow">كلمة التهدئة</div>
          <p class="muted" style="margin-top:-6px;font-size:13px">كلمة سرّ بسيطة نقولها أول ما النبرة تبدأ تحتدّ — إشارة نوقف عندها فورًا.</p>
          ${calm? `<div class="codebox" style="font-size:20px;letter-spacing:1px">${esc(calm.text)}</div>
            <div class="actions" style="margin-top:8px"><span class="spacer"></span><button class="linkbtn" data-act="delCharter" data-id="${esc(calm.id)}">تغيير/حذف</button></div>`
          : `<div class="row" style="margin-top:4px"><input id="ch_calmword" type="text" placeholder="مثلًا: القمر 🌙"></div>
            <div class="actions"><span class="spacer"></span><button class="btn sm" data-act="addCharter" data-kind="calmword">احفظ الكلمة</button></div>`}</div>

        <div class="card"><div class="eyebrow">ميثاق التغافل</div>
          <p class="muted" style="margin-top:-6px;font-size:13px">الحاجات الصغيرة اللي اتفقنا نعدّي عنها ومنوقفش عندها (الـ20%).</p>
          ${listBlock("tagaful","حاجة نتغافل عنها…")}</div>

        <div class="card"><div class="eyebrow">قواعدنا وقت الخلاف</div>
          <p class="muted" style="margin-top:-6px;font-size:13px">قواعد نلتزم بيها وقت ما نختلف — زي قاعدة الـ24 ساعة، مفيش صمت عقابي، مننامش غاضبين.</p>
          ${listBlock("conflict","قاعدة نلتزم بيها…")}</div>

        <div class="card"><div class="eyebrow">نيّاتنا</div>
          <p class="muted" style="margin-top:-6px;font-size:13px">ليه احنا هنا — النيّات اللي بنعقد عليها بيتنا.</p>
          ${listBlock("niyyah","نيّة من نيّاتنا…")}</div>`;
    }catch(e){ document.getElementById("chBody").innerHTML = `<div class="empty">${esc(errMsg(e))}</div>`; }
  }

  function keyCol(arr, mine){
    if(!arr.length) return `<p class="muted" style="font-size:12.5px">—</p>`;
    return arr.map(k=>`<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid var(--line)">
      <span style="font-size:13.5px">${k.kind==='soothe'?'🌿':'⚠️'} ${esc(k.text)}</span>
      ${mine?`<button class="linkbtn" data-act="delKey" data-id="${esc(k.id)}">حذف</button>`:""}</div>`).join("");
  }

  async function renderConnect(){
    S.view="connect"; S.resourceId=null;
    el.innerHTML = pageTitle("تواصلنا","مساحة لمودّتنا: أمنياتنا، امتناننا، رسايلنا، واللي يصعب قوله.") + `<div id="cBody"><div class="empty">…تحميل</div></div>`;
    try{
      const [wishes,grat,caps,mood,safe,keys] = await Promise.all([
        api("GET","/wishes"), api("GET","/gratitude"), api("GET","/capsules"), api("GET","/mood"), api("GET","/safespace"), api("GET","/keys")
      ]);
      document.getElementById("cBody").innerHTML =
        `<div class="card"><div class="eyebrow">فحص حالتنا الآن</div>
          <div class="actions" style="flex-wrap:wrap;gap:8px;margin-top:6px">
            ${MOOD_OPT.map(([v,l])=>`<button class="btn ${mood.mine===v?'':'ghost'} sm" data-act="setMood" data-v="${v}">${l}</button>`).join("")}</div>
          <p class="muted" style="font-size:13px;margin-top:10px">أنت: <b>${esc(moodLabel(mood.mine))}</b> · شريكك: <b>${mood.partner?esc(moodLabel(mood.partner)):"لم يحدّد بعد"}</b></p></div>

        <div class="card"><div class="eyebrow">قائمة أمنياتنا</div>
          <div class="row"><input id="wText" type="text" placeholder="حاجة نفسنا نعملها سوا…"></div>
          <div class="actions"><span class="spacer"></span><button class="btn sm" data-act="addWish">أضِف</button></div>
          ${wishes.length? wishes.map(w=>`<div class="actions" style="justify-content:space-between;padding:6px 0;border-top:1px solid var(--line)">
            <div style="display:flex;align-items:center;gap:8px"><button class="btn ${w.done?'':'ghost'} sm" data-act="toggleWish" data-id="${esc(w.id)}">${w.done?'✓':'○'}</button>
            <span style="${w.done?'text-decoration:line-through;opacity:.6':''}">${esc(w.text)}</span></div>
            <button class="linkbtn" data-act="delWish" data-id="${esc(w.id)}">حذف</button></div>`).join("") : `<p class="muted" style="font-size:13px">ابدأوا بأمنية واحدة.</p>`}</div>

        <div class="card"><div class="eyebrow">مساحة الامتنان</div>
          <p class="muted" style="margin-top:-6px;font-size:13px">اكتب حاجة بتشكر فيها شريك حياتك — نشوفها إحنا الاتنين.</p>
          <div class="row"><input id="gText" type="text" placeholder="ممتنّ لك لأنك…"></div>
          <div class="actions"><span class="spacer"></span><button class="btn sm" data-act="addGrat">أضِف</button></div>
          ${grat.length? grat.map(g=>`<div class="actions" style="justify-content:space-between;padding:6px 0;border-top:1px solid var(--line)">
            <span>${esc(g.text)} <span class="pill ${g.mine?'':'warn'}" style="margin-inline-start:6px">${g.mine?'أنا':'شريكي'}</span></span>
            ${g.mine?`<button class="linkbtn" data-act="delGrat" data-id="${esc(g.id)}">حذف</button>`:""}</div>`).join("") : `<p class="muted" style="font-size:13px">امتنان صغير يصنع فرقًا.</p>`}</div>

        <div class="card"><div class="eyebrow">كتالوج المفاتيح</div>
          <p class="muted" style="margin-top:-6px;font-size:13px">كل واحد يكتب مفاتيحه: إيه اللي بيهدّيني وإيه اللي بيضايقني — عشان نتعلّم بعض ونراعي بعض.</p>
          <div class="row" style="margin-top:4px"><label>يهدّيني 🌿</label><input id="keySoothe" type="text" placeholder="بحس بالأمان لما…"></div>
          <div class="actions" style="margin-bottom:4px"><span class="spacer"></span><button class="btn sm" data-act="addKey" data-kind="soothe">أضِف</button></div>
          <div class="row"><label>يضايقني ⚠️</label><input id="keyAnnoy" type="text" placeholder="بضايق لما…"></div>
          <div class="actions"><span class="spacer"></span><button class="btn sm ghost" data-act="addKey" data-kind="annoy">أضِف</button></div>
          <div class="answers" style="margin-top:12px">
            <div><div class="muted" style="font-size:12.5px;margin-bottom:2px">مفاتيحي</div>${keyCol(keys.mine,true)}</div>
            <div><div class="muted" style="font-size:12.5px;margin-bottom:2px">مفاتيح شريكي</div>${keyCol(keys.partner,false)}</div>
          </div></div>

        <div class="card"><div class="eyebrow">رسالة للمستقبل</div>
          <p class="muted" style="margin-top:-6px;font-size:13px">اكتب رسالة تُختَم حتى تاريخ تختاره؛ رسالة شريكك تظهر لك بعد تاريخها فقط.</p>
          <div class="row"><textarea id="capContent" placeholder="رسالة لنا بعد سنة…"></textarea></div>
          <div class="row"><label>تاريخ الفتح (اختياري)</label><input id="capDate" type="text" placeholder="2027-06-01"></div>
          <div class="actions"><span class="spacer"></span><button class="btn sm" data-act="addCapsule">اختِم الرسالة</button></div>
          ${caps.length? caps.map(c=>`<div class="card tight" style="margin-top:8px">
            <div class="actions" style="justify-content:space-between"><span class="pill ${c.mine?'':'warn'}">${c.mine?'رسالتك':'رسالة شريكك'}</span>${c.openDate?`<span class="pill">📅 ${esc(c.openDate)}</span>`:""}</div>
            <p style="margin:8px 0 0">${c.sealed?'<span class="muted">🔒 مختومة حتى تاريخها.</span>':esc(c.content)}</p></div>`).join("") : ""}</div>

        <div class="card"><div class="eyebrow">صندوق التفاهم</div>
          <p class="muted" style="margin-top:-6px;font-size:13px">اطرح موضوعًا يصعب قوله — بهدوء، وبصيغة المشاعر والاحتياج.</p>
          <div class="row"><label>الموضوع</label><input id="safeTopic" type="text" placeholder="حاجة نفسي نتكلم فيها…"></div>
          <div class="row"><label>أشعر أنّ…</label><input id="safeFeel" type="text" placeholder="بصراحة بحس إن…"></div>
          <div class="row"><label>وأحتاج…</label><input id="safeNeed" type="text" placeholder="محتاج منك…"></div>
          <div class="actions"><span class="spacer"></span><button class="btn sm" data-act="addSafe">ضَعها في الصندوق</button></div>
          ${safe.length? safe.map(x=>`<div class="card tight" style="margin-top:8px">
            <div class="actions" style="justify-content:space-between"><b>${esc(x.topic)}</b><span class="pill ${x.status==='addressed'?'':'warn'} dot">${x.status==='addressed'?'تمت معالجته':'مفتوح'}</span></div>
            ${x.feeling?`<p class="muted" style="font-size:13.5px;margin:6px 0 0">أشعر: ${esc(x.feeling)}</p>`:""}
            ${x.need?`<p class="muted" style="font-size:13.5px;margin:2px 0 0">أحتاج: ${esc(x.need)}</p>`:""}
            <div class="actions" style="margin-top:8px"><span class="pill ${x.mine?'':'warn'}">${x.mine?'مني':'من شريكي'}</span>${x.status!=='addressed'?`<div class="spacer"></div><button class="btn soft sm" data-act="safeAddressed" data-id="${esc(x.id)}">تكلّمنا فيه</button>`:""}</div></div>`).join("") : `<p class="muted" style="font-size:13px">الصندوق فاضي — وده كويس.</p>`}</div>`;
    }catch(e){ document.getElementById("cBody").innerHTML = `<div class="empty">${esc(errMsg(e))}</div>`; }
  }

  // ---------- actions ----------
  const ROUTES = { home:"index.html", journeys:"journeys.html", library:"library.html",
    discussions:"discussions.html", decisionlog:"decisions.html", connect:"connect.html",
    myjourney:"myjourney.html", charter:"charter.html", quicknotes:"notes.html",
    tasks:"tasks.html", budget:"budget.html", shopping:"shopping.html", settings:"settings.html" };
  async function go(act, node){
    try{
      // تنقّل متعدّد الصفحات: روابط حقيقية بدل تبديل الـ view
      if(ROUTES[act] && act !== (window.SAKAN_VIEW||"home")){ location.href = ROUTES[act]; return; }
      if(act==="authMode"){ S.authMode=node.dataset.m; renderOnboarding(); return; }
      if(act==="togglePw"){ const i=document.getElementById(node.dataset.for); if(i){ i.type = i.type==="password"?"text":"password"; node.textContent = i.type==="password"?"👁️":"🙈"; } return; }
      if(act==="apiedit"){
        const v = prompt("عنوان الخادم (API base):", API());
        if(v){ localStorage.setItem("sakan_api", v.trim().replace(/\/$/,"")); render(); }
        return;
      }
      if(act==="login"){
        const email=(document.getElementById("emailL").value||"").trim();
        const pw=(document.getElementById("pwL").value||"");
        if(!email||!pw) return toast("اكتب الإيميل والباسوورد");
        const out = await api("POST","/login",{ email, password:pw });
        S.token=out.token; S.code=out.pairCode||null; S.name=out.displayName||null; S.email=email; save(); location.replace("index.html");
        toast("أهلًا بيك تاني 🌿"); return;
      }
      if(act==="create"){
        const name = (document.getElementById("nameC").value||"").trim();
        const email=(document.getElementById("emailC").value||"").trim();
        const pw=(document.getElementById("pwC").value||"");
        if(!email||!pw) return toast("اكتب الإيميل والباسوورد");
        const out = await api("POST","/pair",{ email, password:pw, displayName:name||"أنا" });
        S.token=out.token; S.code=out.pairCode; S.name=out.displayName||name; S.email=email; save(); location.replace("index.html");
        toast("تم إنشاء الميثاق — شارك الكود "+out.pairCode); return;
      }
      if(act==="join"){
        const name=(document.getElementById("nameJ").value||"").trim();
        const code=(document.getElementById("codeJ").value||"").trim().toUpperCase();
        const email=(document.getElementById("emailJ").value||"").trim();
        const pw=(document.getElementById("pwJ").value||"");
        if(!code) return toast("أدخل الكود");
        if(!email||!pw) return toast("اكتب الإيميل والباسوورد");
        const out = await api("POST","/pair/join",{ code, email, password:pw, displayName:name||"أنا" });
        S.token=out.token; S.code=out.pairCode||null; S.name=out.displayName||name; S.email=email; save(); location.replace("index.html");
        toast("انضممت إلى الميثاق"); return;
      }
      if(act==="logout") return logout();
      if(act==="library"){ S.view="library"; S.tab="summary"; render(); return; }

      if(act==="setProg"){ await api("PUT","/resources/"+S.resourceId+"/progress",{ status:node.dataset.val }); renderResource(); return; }
      if(act==="setPrio"){ await api("PUT","/resources/"+S.resourceId+"/priority",{ priority:node.dataset.val }); toast("اتحدّثت الأولوية"); renderResource(); return; }
      if(act==="setCat"){ await api("PUT","/resources/"+S.resourceId+"/category",{ category:node.dataset.val }); toast("اتحدّث التصنيف"); renderResource(); return; }
      if(act==="setPlaylist"){ S.playlist=node.dataset.pl; renderJourneys(); return; }

      if(act==="addRes"){
        const title=(document.getElementById("rTitle").value||"").trim();
        if(!title) return toast("اكتب عنوان المورد");
        const link=(document.getElementById("rLink").value||"").trim();
        const summary=(document.getElementById("rSummary").value||"").trim();
        const insights=(document.getElementById("rInsights").value||"").trim();
        const questions=(document.getElementById("rQuestions").value||"").trim();
        const applications=(document.getElementById("rApps").value||"").trim();
        await api("POST","/resources/full",{ title, link:link||null, summary, insights, questions, applications });
        toast("أُضيف المورد ✦"); renderLibrary(); return;
      }
      if(act==="copyPrompt"){ try{ await navigator.clipboard.writeText(NB_PROMPT); toast("اتنسخ البرومت ✦"); }catch(e){ toast("منعرفش ننسخ — حدّده يدوي"); } return; }
      if(act==="copyAppUrl"){ try{ await navigator.clipboard.writeText(APP_URL); toast("اتنسخ رابط التطبيق"); }catch(e){} return; }
      if(act==="importBulk"){
        const lines=(document.getElementById("bulk").value||"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
        if(!lines.length) return toast("الصق رابطًا واحدًا على الأقل");
        node.disabled=true; const orig=node.textContent;
        const q=lines.slice(); let done=0, ok=0;
        async function worker(){ while(q.length){ const link=q.shift(); try{ await api("POST","/resources",{ title:titleFromUrl(link), link }); ok++; }catch(e){} done++; node.textContent="…"+done+"/"+lines.length; } }
        await Promise.all(Array.from({length:Math.min(4,lines.length)}, worker));   // 4 at a time → أسرع بكتير
        node.disabled=false; node.textContent=orig;
        toast("تم استيراد "+ok+" من "+lines.length+" — تقدر تعيد تسميتها لاحقًا");
        renderLibrary(); return;
      }
      if(act==="open" || node?.dataset.open){ location.href="resource.html?id="+encodeURIComponent(node.dataset.open)+"&tab=summary"; return; }

      if(act==="genSummary"){ await api("POST","/resources/"+S.resourceId+"/summary"); toast("تم توليد الملخص"); renderResource(); return; }
      if(act==="goDiscuss"){ S.tab="discussion"; renderResource(); return; }
      if(act==="genQuestions"){ await api("POST","/resources/"+S.resourceId+"/questions/generate"); toast("تم توليد الأسئلة"); renderResource(); return; }
      if(act==="addQ"){ const txt=(document.getElementById("qNew").value||"").trim(); if(!txt) return toast("اكتب السؤال"); await api("POST","/resources/"+S.resourceId+"/questions",{text:txt}); renderResource(); return; }

      if(act==="saveAns"){
        const q=node.dataset.q; const box=document.querySelector(`.q[data-q="${q}"] .myans`);
        const text=(box.value||"").trim(); if(!text) return toast("اكتب إجابتك");
        await api("PUT","/questions/"+q+"/responses",{text}); toast("حُفظت إجابتك"); renderResource(); return;
      }
      if(act==="reveal"){ await api("POST","/questions/"+node.dataset.q+"/reveal"); toast("انكشفت الإجابتان"); renderResource(); return; }
      if(act==="force"){ if(confirm("الكشف الآن قبل أن يجيب الطرف الآخر؟")){ await api("POST","/questions/"+node.dataset.q+"/force-reveal"); renderResource(); } return; }

      if(act==="createDec"){
        const statement=(document.getElementById("dStmt").value||"").trim();
        if(!statement) return toast("اكتب صياغة القرار");
        const questionIds=[...document.querySelectorAll(".dq:checked")].map(x=>x.value);
        if(!questionIds.length) return toast("اختر سؤالًا واحدًا على الأقل");
        const context=(document.getElementById("dContext").value||"").trim();
        const category=(document.querySelector("#dCat button.on")||{}).dataset?.cat || "general";
        const reviewDate=(document.getElementById("dReview").value||"").trim();
        await api("POST","/decisions",{ resourceId:S.resourceId, statement, questionIds, context:context||null, category, reviewDate:reviewDate||null });
        toast("سُجّل القرار كمسودّة"); renderResource(); return;
      }
      if(act==="confirm"){ await api("POST","/decisions/"+node.dataset.d+"/confirm"); toast("سُجّلت موافقتك"); renderResource(); return; }

      // ---- navigation to new pages ----
      if(act==="home"){ S.view="home"; render(); return; }
      if(act==="journeys"){ S.view="journeys"; render(); return; }
      if(act==="discussions"){ S.view="discussions"; render(); return; }
      if(act==="decisionlog"){ S.view="decisionlog"; render(); return; }
      if(act==="connect"){ S.view="connect"; render(); return; }
      if(act==="myjourney"){ S.view="myjourney"; render(); return; }

      // ---- PIN Lock actions ----
      if(act==="pinKey"){ pinHandleKey(node.dataset.k); return; }
      if(act==="pinWhoSel"){ S.pinWhoSel=node.dataset.w; renderPinLock(); return; }
      if(act==="pinWhoConfirm"){
        const w=S.pinWhoSel; if(!w) return;
        localStorage.setItem(PIN_WHO,w); S.pinWho=w; S.pinWhoSel=null;
        // Check if PIN already set
        if(localStorage.getItem(PIN_KEY)){ S.pinStep="lock"; renderPinLock(); }
        else { S.pinStep="setup1"; S.pinEntry=""; renderPinLock(); }
        return;
      }
      if(act==="pinSkip"){
        // Skip without setting PIN — go straight home
        localStorage.removeItem(PIN_KEY); localStorage.removeItem(PIN_WHO);
        document.body.classList.remove("pre-auth");
        S.pinStep="lock"; try{sessionStorage.setItem("sakan_unlocked","1");}catch(e){} location.reload(); return;
      }
      if(act==="pinForgot"){
        if(!confirm("هتتطلع من الجلسة وتعيد تسجيل الدخول — تكمل؟")) return;
        logout(); return;
      }
      if(act==="clearPin"){
        if(!confirm("هتشيل قفل الـ PIN — أي حد ممسك الموبايل يقدر يدخل. متأكد؟")) return;
        localStorage.removeItem(PIN_KEY); localStorage.removeItem(PIN_WHO);
        S.pinWho=null; toast("اتشال القفل"); renderSettings(); return;
      }
      if(act==="setupPin"){
        // Called from Settings
        S.pinStep="setup1"; S.pinEntry=""; S.pinSetup1="";
        S.view="pinlock"; renderPinLock(); return;
      }
      if(act==="quicknotes"){ S.view="quicknotes"; S.qnPanel="shared"; render(); return; }
      if(act==="qnPanel"){ S.qnPanel=node.dataset.p; renderQuickNotes(); return; }
      if(act==="qnAdd"){ qnDoAdd(node.dataset.scope||"shared"); return; }
      if(act==="qnDel"){ qnDoDel(node.dataset.id, node.dataset.scope||"shared"); return; }
      if(act==="charter"){ S.view="charter"; render(); return; }

      if(act==="addCharter"){ const k=node.dataset.kind; const inp=document.getElementById("ch_"+k); const t=(inp&&inp.value||"").trim(); if(!t) return toast("اكتب حاجة الأول"); await api("POST","/charter",{kind:k,text:t}); renderCharter(); return; }
      if(act==="delCharter"){ await api("POST","/charter/"+node.dataset.id+"/delete"); renderCharter(); return; }
      if(act==="addKey"){ const k=node.dataset.kind; const inp=document.getElementById(k==='soothe'?"keySoothe":"keyAnnoy"); const t=(inp&&inp.value||"").trim(); if(!t) return toast("اكتب مفتاح"); await api("POST","/keys",{kind:k,text:t}); renderConnect(); return; }
      if(act==="delKey"){ await api("POST","/keys/"+node.dataset.id+"/delete"); renderConnect(); return; }
      if(act==="setFocus"){ await api("PUT","/focus",{resourceId:S.resourceId}); toast("بقت مادتنا دلوقتي 📌"); renderResource(); return; }
      if(act==="clearFocus"){ await api("POST","/focus/clear"); renderHome(); return; }
      if(act==="addGratHome"){ const inp=document.getElementById("homeGrat"); const t=(inp&&inp.value||"").trim(); if(!t) return toast("اكتب نعمة"); await api("POST","/gratitude",{text:t}); if(inp) inp.value=""; toast("أضفناها للامتنان 🌿"); return; }

      // ---- phase 5: connection ----
      if(act==="setMood"){ await api("PUT","/mood",{value:node.dataset.v}); renderConnect(); return; }
      if(act==="addWish"){ const t=(document.getElementById("wText").value||"").trim(); if(!t) return toast("اكتب الأمنية"); await api("POST","/wishes",{text:t}); renderConnect(); return; }
      if(act==="toggleWish"){ await api("POST","/wishes/"+node.dataset.id+"/toggle"); renderConnect(); return; }
      if(act==="delWish"){ await api("POST","/wishes/"+node.dataset.id+"/delete"); renderConnect(); return; }
      if(act==="addGrat"){ const t=(document.getElementById("gText").value||"").trim(); if(!t) return toast("اكتب امتنانك"); await api("POST","/gratitude",{text:t}); renderConnect(); return; }
      if(act==="delGrat"){ await api("POST","/gratitude/"+node.dataset.id+"/delete"); renderConnect(); return; }
      if(act==="addCapsule"){ const c=(document.getElementById("capContent").value||"").trim(); if(!c) return toast("اكتب رسالتك"); const d=(document.getElementById("capDate").value||"").trim(); await api("POST","/capsules",{content:c,openDate:d||null}); toast("خُتمت الرسالة"); renderConnect(); return; }
      if(act==="addSafe"){ const topic=(document.getElementById("safeTopic").value||"").trim(); if(!topic) return toast("اكتب الموضوع"); await api("POST","/safespace",{topic,feeling:(document.getElementById("safeFeel").value||"").trim(),need:(document.getElementById("safeNeed").value||"").trim()}); toast("أُضيف للصندوق"); renderConnect(); return; }
      if(act==="safeAddressed"){ await api("POST","/safespace/"+node.dataset.id+"/addressed"); renderConnect(); return; }
      if(act==="seedCurriculum"){ const r=await api("POST","/journey/seed"); toast(r.already? "المنهج مستورد بالفعل" : "تم استيراد "+r.seeded+" موردًا"); renderJourneys(); return; }

      // ---- notes ----
      if(act==="saveSharedNote"){ await api("PUT","/resources/"+S.resourceId+"/notes",{scope:"shared",content:document.getElementById("sharedNote").value}); toast("حُفظت الملاحظة المشتركة"); return; }
      if(act==="savePrivateNote"){ await api("PUT","/resources/"+S.resourceId+"/notes",{scope:"private",content:document.getElementById("privNote").value}); toast("حُفظت ملاحظتك الخاصة"); return; }

      // ---- review a decision ----
      if(act==="reviewDec"){ await api("POST","/decisions/"+node.dataset.d+"/reviewed"); toast("سُجّلت المراجعة"); if(S.view==="resource") renderResource(); else renderDecisionLog(); return; }
      if(act==="tasks"){ S.view="tasks"; render(); return; }
      if(act==="budget"){ S.view="budget"; render(); return; }
      if(act==="shopping"){ S.view="shopping"; render(); return; }
      if(act==="settings"){ S.view="settings"; render(); return; }

      // ---- tasks ----
      if(act==="addTask"){
        const title=(document.getElementById("tTitle").value||"").trim(); if(!title) return toast("اكتب المهمة");
        const owner=(document.querySelector("#tOwner button.on")||{}).dataset?.own || "both";
        const due=(document.getElementById("tDue").value||"").trim();
        await api("POST","/tasks",{title,owner,due:due||null}); toast("أُضيفت المهمة"); renderTasks(); return;
      }
      if(act==="toggleTask"){ await api("POST","/tasks/"+node.dataset.id+"/toggle"); reloadTasks(); return; }
      if(act==="delTask"){ await api("POST","/tasks/"+node.dataset.id+"/delete"); reloadTasks(); return; }

      // ---- budget ----
      if(act==="addBudget"){
        const label=(document.getElementById("bLabel").value||"").trim(); if(!label) return toast("اكتب اسم البند");
        const cat=(document.getElementById("bCat").value||"").trim();
        const planned=parseFloat(document.getElementById("bPlanned").value)||0;
        await api("POST","/budget",{label,cat:cat||null,planned}); toast("أُضيف البند"); renderBudget(); return;
      }
      if(act==="payBudget"){ const amt=parseFloat(prompt("قيمة الدفعة:","0"))||0; if(!amt) return; await api("POST","/budget/"+node.dataset.id+"/pay",{amount:amt}); reloadBudget(); return; }
      if(act==="delBudget"){ await api("POST","/budget/"+node.dataset.id+"/delete"); reloadBudget(); return; }

      // ---- shopping ----
      if(act==="addShop"){ const text=(document.getElementById("sText").value||"").trim(); if(!text) return toast("اكتب الصنف"); await api("POST","/shopping",{text}); renderShopping(); return; }
      if(act==="toggleShop"){ await api("POST","/shopping/"+node.dataset.id+"/toggle"); reloadShopping(); return; }
      if(act==="delShop"){ await api("POST","/shopping/"+node.dataset.id+"/delete"); reloadShopping(); return; }

      // ---- settings: export ----
      if(act==="export"){
        toast("جاري التصدير…");
        const out={ exportedAt:new Date().toISOString() };
        const grab=async(k,path)=>{ try{ out[k]=await api("GET",path); }catch(e){ out[k]=[]; } };
        await Promise.all([grab("resources","/resources"),grab("decisions","/decisions"),grab("tasks","/tasks"),grab("budget","/budget"),grab("shopping","/shopping")]);
        const blob=new Blob([JSON.stringify(out,null,2)],{type:"application/json"});
        const link=document.createElement("a"); link.href=URL.createObjectURL(blob); link.download="sakan-export.json"; link.click(); URL.revokeObjectURL(link.href);
        toast("تم التصدير"); return;
      }
    }catch(e){
      if(e.code==="UNAUTHENTICATED"){ toast(errMsg(e)); return logout(); }
      toast(errMsg(e));
    }
  }

  // ---------- events ----------
  document.body.addEventListener("click",(ev)=>{
    const dw = ev.target.closest("[data-dw]");
    if(dw){ ev.preventDefault(); if(dw.dataset.dw==="open") openDrawer(); else closeDrawer(); return; }
    const ds = ev.target.closest("[data-dwsec]");
    if(ds){ ds.classList.toggle("collapsed"); const g=ds.nextElementSibling; if(g) g.classList.toggle("collapsed"); return; }
    const th = ev.target.closest("[data-set-theme]");
    if(th){ applyTheme(th.dataset.setTheme); return; }
    const a = ev.target.closest("[data-act]");
    if(a){ ev.preventDefault(); if(a.closest("#drawer")) closeDrawer(); return go(a.dataset.act, a); }
    const t = ev.target.closest("[data-tab]");
    if(t){ S.tab=t.dataset.tab; renderResource(); return; }
    const open = ev.target.closest("[data-open]");
    if(open){ location.href="resource.html?id="+encodeURIComponent(open.dataset.open)+"&tab=summary"; return; }
    const oq = ev.target.closest("[data-openq]");
    if(oq){ location.href="resource.html?id="+encodeURIComponent(oq.dataset.openq)+"&tab=discussion"; return; }
    const cat = ev.target.closest("[data-cat]");
    if(cat){ [...cat.parentElement.children].forEach(x=>x.classList.toggle("on", x===cat)); return; }
  });

  document.getElementById("foot").innerHTML = "سكن · مساحتنا إحنا الاتنين — خاصّة بطبيعتها، من غير مشاركة عامة.";
  render();
})();

