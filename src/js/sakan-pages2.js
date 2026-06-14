
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
  async function go(act, node){
    try{
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
        S.token=out.token; S.code=out.pairCode||null; S.name=out.displayName||null; S.email=email; save(); S.view="home"; render();
        toast("أهلًا بيك تاني 🌿"); return;
      }
      if(act==="create"){
        const name = (document.getElementById("nameC").value||"").trim();
        const email=(document.getElementById("emailC").value||"").trim();
        const pw=(document.getElementById("pwC").value||"");
        if(!email||!pw) return toast("اكتب الإيميل والباسوورد");
        const out = await api("POST","/pair",{ email, password:pw, displayName:name||"أنا" });
        S.token=out.token; S.code=out.pairCode; S.name=out.displayName||name; S.email=email; save(); S.view="home"; render();
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
        S.token=out.token; S.code=out.pairCode||null; S.name=out.displayName||name; S.email=email; save(); S.view="home"; render();
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
      if(act==="open" || node?.dataset.open){ S.resourceId=node.dataset.open; S.view="resource"; S.tab="summary"; render(); return; }

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
        S.pinStep="lock"; S.view="home"; render(); return;
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
    if(open){ S.resourceId=open.dataset.open; S.view="resource"; S.tab="summary"; render(); return; }
    const oq = ev.target.closest("[data-openq]");
    if(oq){ S.resourceId=oq.dataset.openq; S.view="resource"; S.tab="discussion"; render(); return; }
    const cat = ev.target.closest("[data-cat]");
    if(cat){ [...cat.parentElement.children].forEach(x=>x.classList.toggle("on", x===cat)); return; }
  });

  document.getElementById("foot").innerHTML = "سكن · مساحتنا إحنا الاتنين — خاصّة بطبيعتها، من غير مشاركة عامة.";
  render();
})();

