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
  const _hasToken = !!localStorage.getItem("sakan_token");
  const _hasPin   = !!localStorage.getItem(PIN_KEY);
  const _initView = !_hasToken ? "onboarding" : (_hasPin ? "pinlock" : "home");

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
    S.view="onboarding"; closeDrawer(); render();
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
