
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
      S.pinStep="lock"; S.view="home"; render(); return;
    }
    if(step==="lock"){
      if(pinCorrect(pin)){
        document.body.classList.remove("pre-auth");
        S.pinStep="lock"; S.view="home"; render(); return;
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
