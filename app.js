/* سكن — وحدة مشتركة لكل الصفحات
   التخزين هنا localStorage (بديل تجريبي عن Firestore). في الإنتاج:
   - state.*           → Firestore collections تحت couples/{coupleId}/...
   - canReveal         → يُفرض في firestore.rules على السيرفر
   - me / partner      → auth.currentUser بدل المبدّل
*/
const USERS={m:"مصطفى",d:"ضحى"};
const STATUS={new:"لم يبدأ",watching:"قيد المشاهدة",done:"مكتمل"};
const QUESTIONS=[
  {id:"v1",cat:"دينية",q:"إيه الطقوس الدينية اللي نفسك تكون ثابتة في بيتنا؟"},
  {id:"v2",cat:"دينية",q:"لو اختلفنا في فهم مسألة شرعية، نرجع لمين أو لإيه؟"},
  {id:"m1",cat:"مالية",q:"حساب مشترك ولا منفصل ولا مزيج؟ وإزاي نقسّم المصاريف؟"},
  {id:"m2",cat:"مالية",q:"إيه هدفنا المالي لأول سنتين؟"},
  {id:"f1",cat:"أسرية",q:"إيه الحدود الصحية في علاقتنا بأهلنا؟"},
  {id:"a1",cat:"أهداف",q:"لو جالي عرض شغل في مدينة تانية، نتعامل مع القرار إزاي؟"},
  {id:"x1",cat:"خلافات",q:"لما نتخانق، إيه اللي محتاج كل واحد يسمعه عشان يهدا؟"},
];
const DEFAULT_STATE={
  resources:[
    {id:"r1",icon:"🎥",title:"محاضرة: أسس التفاهم الزوجي",url:"https://example.com/lec1",desc:"مدخل لمهارات الإنصات وإدارة التوقعات بين الزوجين.",sharedNote:""},
    {id:"r2",icon:"📖",title:"كتاب: فقه الأسرة المسلمة (مقتطف)",url:"https://example.com/book1",desc:"فصل في الحقوق والواجبات المتبادلة.",sharedNote:""},
  ],
  progress:{}, privateNotes:{}, summaries:{}, answers:{}, discussed:{}, decisions:[],
  tasks:[], budget:[], shopping:[],
};
// ----- التخزين -----
let state, me;
function load(){try{state=JSON.parse(localStorage.getItem("sakan_state"))||structuredClone(DEFAULT_STATE)}catch(e){state=structuredClone(DEFAULT_STATE)}for(const k in DEFAULT_STATE){if(!(k in state))state[k]=structuredClone(DEFAULT_STATE[k])}me=localStorage.getItem("sakan_me")||"m"}
function save(){try{localStorage.setItem("sakan_state",JSON.stringify(state))}catch(e){}}
function setMe(u){me=u;try{localStorage.setItem("sakan_me",u)}catch(e){}}
// ----- أدوات -----
const esc=s=>(s||"").replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const partner=()=>me==="m"?"d":"m";
const prog=(id,u)=>(state.progress[id]||{})[u]||"new";
const pNote=(id,u)=>(state.privateNotes[id]||{})[u]||"";
const myAns=q=>(state.answers[q]||{})[me];
const aAns=q=>(state.answers[q]||{})[partner()];
const canReveal=q=>!!myAns(q)&&!!aAns(q);
const greet=()=>{const h=new Date().getHours();return h<5?"ليلة هادئة":h<12?"صباح الخير":h<17?"أهلًا":h<22?"مساء الخير":"ليلة هادئة"};
const qp=k=>new URLSearchParams(location.search).get(k);
// ----- الهيدر والتنقّل (روابط صفحات حقيقية) -----
const NAV=[["home.html","الرئيسية"],["library.html","المكتبة"],["tasks.html","المهام"],["budget.html","الميزانية"],["shopping.html","المشتريات"],["dialogue.html","الحوار"],["decisions.html","القرارات"],["settings.html","الإعدادات"]];
function chrome(active){
  const links=NAV.map(([h,l])=>`<a href="${h}" ${location.pathname.endsWith(h)?'aria-current="page"':''}>${l}</a>`).join("");
  return `<header class="bar"><div class="bar-in">
    <a class="brand" href="home.html">سَكَن<span>.</span></a>
    <div class="seg" id="who" title="الطرف الحالي (في الإنتاج يُحدّد بحسابك)">
      <button data-user="m" aria-pressed="${me==='m'}">مصطفى</button>
      <button data-user="d" aria-pressed="${me==='d'}">ضحى</button></div>
    <div class="seg theme-sw" id="themesw">
      <button data-theme="light" title="فاتح">☀️</button>
      <button data-theme="dark" title="داكن">🌙</button>
      <button data-theme="oled" title="OLED">⚫</button></div>
  </div></header>
  <div class="wrap"><nav class="pages">${links}</nav><main id="view"></main></div>`;
}
function mountChrome(active){document.getElementById("app").innerHTML=chrome(active);
  document.getElementById("themesw").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;document.documentElement.setAttribute("data-theme",b.dataset.theme);try{localStorage.setItem("sakan_theme",b.dataset.theme)}catch(e){}});
  document.getElementById("who").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;setMe(b.dataset.user);[...document.getElementById("who").children].forEach(x=>x.setAttribute("aria-pressed",x.dataset.user===me));window.__rerender&&window.__rerender()});
}
const V=()=>document.getElementById("view");
function flash(btn,msg){const o=btn.textContent;btn.textContent=msg;btn.disabled=true;setTimeout(()=>{btn.textContent=o;btn.disabled=false},900)}

// ========================= الصفحات =========================
function renderHome(){
  const qTurn=QUESTIONS.filter(x=>!myAns(x.id));
  const rTurn=state.resources.filter(r=>prog(r.id,me)!=="done");
  const weekly=QUESTIONS[new Date().getDate()%QUESTIONS.length];
  let loops="";
  if(qTurn.length)loops+=`<a class="card click" href="dialogue.html#${qTurn[0].id}" style="display:block;text-decoration:none;color:inherit"><span class="pill ready">سؤال مستني دورك</span><p class="q" style="margin-top:10px">${esc(qTurn[0].q)}</p><div class="row"><span class="pill wait">${esc(qTurn[0].cat)}</span><span class="act primary sm">جاوب</span></div></a>`;
  if(rTurn.length)loops+=`<a class="card click" href="resource.html?id=${rTurn[0].id}" style="display:block;text-decoration:none;color:inherit"><span class="pill mine">مادة لسه ما خلّصتهاش</span><p class="q" style="margin-top:10px">${esc(rTurn[0].icon||"📄")} ${esc(rTurn[0].title)}</p><div class="row"><span class="pill wait">${esc(STATUS[prog(rTurn[0].id,me)])}</span><span class="act primary sm">افتح</span></div></a>`;
  if(!loops)loops=`<div class="empty"><b>مفيش حلقات مفتوحة 🌿</b>إنت متابع كل حاجة من ناحيتك.</div>`;
  V().innerHTML=`<h1 class="page">${greet()} يا ${USERS[me]}</h1>
    <p class="lede">ده اللي مستني دورك — سكن بيجيبلك المهم، ما بيدفعش عليك إشعارات.</p>${loops}
    <div class="cat">سؤال للنقاش</div>
    <a class="card click" href="dialogue.html#${weekly.id}" style="display:block;text-decoration:none;color:inherit"><p class="q">${esc(weekly.q)}</p><div class="row"><span class="pill wait">${esc(weekly.cat)}</span><span class="act ghost sm">للحوار</span></div></a>`;
}
function renderLibrary(){
  const items=state.resources.map(r=>`<a class="card click" href="resource.html?id=${r.id}" style="display:block;text-decoration:none;color:inherit">
    <p class="q" style="margin-bottom:8px">${esc(r.icon||"📄")} ${esc(r.title)}</p>
    <p class="lede" style="margin:0 0 6px">${esc(r.desc)}</p>
    <div class="ticks"><span class="tick">${USERS.m}: <b>${esc(STATUS[prog(r.id,'m')])}</b></span><span class="tick">${USERS.d}: <b>${esc(STATUS[prog(r.id,'d')])}</b></span></div></a>`).join("");
  V().innerHTML=`<h1 class="page">المكتبة</h1><p class="lede">الموارد اللي بتتعلّموا منها سوا. الحالة بتتسجّل لكل واحد لوحده.</p>
    <div class="row" style="margin-bottom:14px"><span></span><button class="act gold sm" id="add-res">+ أضف مورد</button></div>
    ${items||'<div class="empty"><b>المكتبة فاضية</b>أضف أول مورد.</div>'}`;
  document.getElementById("add-res").addEventListener("click",()=>{const t=prompt("عنوان المورد:");if(!t)return;const url=prompt("الرابط:","https://")||"";const desc=prompt("وصف مختصر:")||"";const type=(prompt("النوع: محاضرة / كتاب / بودكاست / مقال","محاضرة")||"").trim();const icon={"محاضرة":"🎥","كتاب":"📖","بودكاست":"🎙️","مقال":"📄"}[type]||"📄";state.resources.push({id:"r"+Date.now(),icon,title:t.trim(),url:url.trim(),desc:desc.trim(),sharedNote:""});save();renderLibrary()});
}
function renderResource(){
  const id=qp("id");const r=state.resources.find(x=>x.id===id);
  if(!r){V().innerHTML=`<a class="back" href="library.html">← المكتبة</a><div class="empty"><b>المورد مش موجود</b></div>`;return}
  const st=prog(id,me);
  const sum=state.summaries[id]?`<p class="lede" style="margin-top:8px">${esc(state.summaries[id])}</p>`:`<div class="note">الملخّص يتولّد بالـ AI من الباك-إند. زر تجريبي للعرض.</div><button class="act ghost sm" id="gen-sum" style="margin-top:8px">ولّد ملخّص وأسئلة (تجريبي)</button>`;
  V().innerHTML=`<a class="back" href="library.html">← المكتبة</a>
    <h1 class="page">${esc(r.icon||"📄")} ${esc(r.title)}</h1>
    <p class="lede">${esc(r.desc)} · <a class="link" href="${esc(r.url)}" target="_blank" rel="noopener">افتح المصدر ↗</a></p>
    <div class="cat">حالتك</div><div class="status-seg" id="st">${Object.keys(STATUS).map(k=>`<button data-st="${k}" aria-pressed="${st===k}">${STATUS[k]}</button>`).join("")}</div>
    <div class="cat">ملخّص ذكي</div><div class="card">${sum}</div>
    <div class="cat">ملاحظات مشتركة</div><div class="card"><textarea id="shared" placeholder="ملاحظة يشوفها الطرفان.">${esc(r.sharedNote)}</textarea><div class="row" style="margin-top:8px"><span></span><button class="act primary sm" id="save-shared">احفظ المشتركة</button></div></div>
    <div class="cat">ملاحظاتك الخاصة</div><div class="card"><textarea id="priv" placeholder="تظهر لك وحدك يا ${USERS[me]}.">${esc(pNote(id,me))}</textarea><div class="row" style="margin-top:8px"><span></span><button class="act primary sm" id="save-priv">احفظ الخاصة</button></div></div>`;
  document.getElementById("st").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;(state.progress[id]=state.progress[id]||{})[me]=b.dataset.st;save();renderResource()});
  const gs=document.getElementById("gen-sum");gs&&gs.addEventListener("click",()=>{state.summaries[id]="ملخّص تجريبي: النقاط الأساسية للمصدر تليها أسئلة مقترحة للنقاش. (يُستبدل بمخرجات الـ AI.)";save();renderResource()});
  document.getElementById("save-shared").addEventListener("click",e=>{r.sharedNote=document.getElementById("shared").value.trim();save();flash(e.target,"اتحفظت")});
  document.getElementById("save-priv").addEventListener("click",e=>{(state.privateNotes[id]=state.privateNotes[id]||{})[me]=document.getElementById("priv").value.trim();save();flash(e.target,"اتحفظت")});
}
let activeQ=null,hashDone=false;
function renderDialogue(){
  if(!hashDone){hashDone=true;if(location.hash)activeQ=location.hash.slice(1)}
  const byCat={};QUESTIONS.forEach(x=>(byCat[x.cat]=byCat[x.cat]||[]).push(x));
  let html=`<h1 class="page">مركز الحوار</h1><p class="lede">كل واحد يجاوب لوحده. الإجابتين تظهروا سوا بس لما تكونوا جاوبتوا الاتنين، وبعدها تحوّلوا الاتفاق لقرار.</p>`;
  for(const c in byCat){html+=`<div class="cat">${esc(c)}</div>`;byCat[c].forEach(x=>html+=qCard(x))}
  V().innerHTML=html;
}
function qCard(x){
  const rv=canReveal(x.id),open=activeQ===x.id;let pill;
  if(rv)pill=`<span class="pill done">✓ اتكشفت</span>`;else if(myAns(x.id))pill=`<span class="pill wait">مستني ${USERS[partner()]}</span>`;else if(aAns(x.id))pill=`<span class="pill ready">دورك تجاوب</span>`;else pill=`<span class="pill wait">مستني الاتنين</span>`;
  let body;
  if(rv){body=`<div class="reveal"><div class="ans"><p class="who">${USERS.m}</p><p class="txt">${esc(state.answers[x.id].m)}</p></div><div class="ans"><p class="who">${USERS.d}</p><p class="txt">${esc(state.answers[x.id].d)}</p></div></div>
    <div class="row" style="margin-top:13px">${state.discussed[x.id]?'<span class="pill done">تمت المناقشة</span>':`<button class="act ghost sm" data-disc="${x.id}">تمت المناقشة شفهيًا</button>`}<button class="act gold sm" data-decide="${x.id}">حوّلوا الاتفاق لقرار</button></div>`;}
  else if(open){body=`<div class="answer-box"><textarea id="ta-${x.id}" placeholder="إجابتك خاصة، ومش هتظهر لـ${USERS[partner()]} غير لما يجاوب.">${esc(myAns(x.id)||"")}</textarea><div class="row" style="margin-top:10px"><button class="act ghost sm" data-cancel="1">إلغاء</button><button class="act primary sm" data-save="${x.id}">احفظ إجابتي</button></div></div>`;}
  else{body=`<div class="row"><span></span><button class="act primary sm" data-answer="${x.id}">${myAns(x.id)?"عدّل إجابتك":"جاوب"}</button></div>`;}
  return `<div class="card"><p class="q">${esc(x.q)}</p><div class="row" style="margin-bottom:${open||rv?'4px':'0'}">${pill}<span></span></div>${body}</div>`;
}
function wireDialogue(){
  V().addEventListener("click",e=>{const t=e.target.closest("button");if(!t)return;
    if(t.dataset.answer){activeQ=t.dataset.answer;renderDialogue();setTimeout(()=>document.getElementById("ta-"+activeQ)?.focus(),0)}
    if(t.dataset.cancel){activeQ=null;renderDialogue()}
    if(t.dataset.save){const id=t.dataset.save,val=document.getElementById("ta-"+id).value.trim();if(!val){document.getElementById("ta-"+id).focus();return}(state.answers[id]=state.answers[id]||{})[me]=val;save();activeQ=null;renderDialogue()}
    if(t.dataset.disc){state.discussed[t.dataset.disc]=true;save();renderDialogue()}
    if(t.dataset.decide){const q=QUESTIONS.find(z=>z.id===t.dataset.decide);const text=prompt(`القرار اللي اتفقتوا عليه بخصوص:\n«${q.q}»`);if(!text||!text.trim())return;const owner=prompt("مين المسؤول؟ (مصطفى / ضحى / الاتنين)","الاتنين")||"الاتنين";state.decisions.unshift({id:"d"+Date.now(),qId:q.id,qText:q.q,text:text.trim(),owner:owner.trim(),done:false});save();location.href="decisions.html"}
  });
}
let decFilter="all";
function renderDecisions(){
  let list=state.decisions;if(decFilter==="open")list=list.filter(d=>!d.done);if(decFilter==="done")list=list.filter(d=>d.done);
  const filt=`<div class="seg" id="decfilter" style="margin-bottom:16px">${[["all","الكل"],["open","قيد التنفيذ"],["done","تم"]].map(([k,l])=>`<button data-f="${k}" aria-pressed="${decFilter===k}">${l}</button>`).join("")}</div>`;
  const body=list.length?list.map(d=>`<div class="card"><p class="lede" style="margin:0 0 6px">من حوار: ${esc(d.qText)}</p><p class="q" style="margin:0 0 10px">${esc(d.text)}</p>
    <div class="row"><label class="row" style="gap:9px;cursor:pointer"><input type="checkbox" class="chk" data-done="${d.id}" ${d.done?"checked":""}><span class="pill ${d.done?'done':'mine'}">${d.done?'تم':'قيد التنفيذ'}</span></label><span class="pill wait">المسؤول: ${esc(d.owner)}</span></div></div>`).join(""):`<div class="empty"><b>لسه مفيش قرارات</b>حوّل أي حوار مكتمل لقرار من مركز الحوار.</div>`;
  V().innerHTML=`<h1 class="page">سجل القرارات</h1><p class="lede">القرار أهم من الملاحظة. ده اللي اتفقتوا عليه فعلًا.</p>${filt}${body}`;
  document.getElementById("decfilter").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;decFilter=b.dataset.f;renderDecisions()});
  V().querySelectorAll("input[data-done]").forEach(c=>c.addEventListener("change",()=>{const d=state.decisions.find(x=>x.id===c.dataset.done);if(d)d.done=c.checked;save();renderDecisions()}));
}
function renderSettings(){
  V().innerHTML=`<h1 class="page">الإعدادات</h1><p class="lede">الخصوصية أولًا. بياناتكوا ملككوا.</p>
    <div class="cat">بياناتك</div><div class="card"><p class="lede" style="margin:0 0 10px">صدّر كل بياناتكوا في ملف JSON واحد.</p><button class="act primary sm" id="export">صدّر بياناتي (JSON)</button></div>
    <div class="cat">الحساب</div><div class="card"><div class="note">تغيير كلمة المرور وحذف الحساب عبر Firebase Auth في الإنتاج.</div><div class="row" style="margin-top:10px"><button class="act ghost sm" disabled>تغيير كلمة المرور</button><button class="act ghost sm" disabled>حذف الحساب وبياناته</button></div></div>
    <div class="cat">تجريبي</div><div class="card"><button class="act ghost sm" id="reset">تصفير بيانات العرض</button></div>`;
  document.getElementById("export").addEventListener("click",()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="sakan-export.json";a.click();URL.revokeObjectURL(a.href)});
  document.getElementById("reset").addEventListener("click",()=>{if(confirm("تصفير بيانات العرض؟")){state=structuredClone(DEFAULT_STATE);save();renderSettings()}});
}

// ========================= فيز 2: التنظيم العملي =========================
const OWNERS={m:"مصطفى",d:"ضحى",both:"الاتنين"};
const money=n=>(Number(n)||0).toLocaleString("ar-EG");

// ----- المهام / مخطّط الزفاف (مسؤول + تاريخ) -----
function renderTasks(){
  const items=state.tasks.length?state.tasks.map(t=>`<div class="card"><div class="row"><label class="row" style="gap:9px;cursor:pointer">
    <input type="checkbox" class="chk" data-tdone="${t.id}" ${t.done?"checked":""}>
    <span class="q" style="margin:0;${t.done?'text-decoration:line-through;opacity:.6':''}">${esc(t.title)}</span></label>
    <button class="act ghost sm" data-tdel="${t.id}">حذف</button></div>
    <div class="row" style="margin-top:8px"><span class="pill mine">المسؤول: ${esc(OWNERS[t.owner]||t.owner)}</span>${t.due?`<span class="pill wait">📅 ${esc(t.due)}</span>`:""}</div></div>`).join("")
    :`<div class="empty"><b>مفيش مهام</b>أضيفوا أول مهمة (حجز قاعة، فستان، دعوات…) بمسؤول وتاريخ.</div>`;
  V().innerHTML=`<h1 class="page">المهام ومخطّط الفرح</h1><p class="lede">مهام تتقسّم بينكوا بمسؤول وتاريخ — فريق واحد.</p>
    <div class="row" style="margin-bottom:14px"><span></span><button class="act gold sm" id="add-task">+ مهمة</button></div>${items}`;
  document.getElementById("add-task").addEventListener("click",()=>{const title=prompt("المهمة:");if(!title||!title.trim())return;const o=(prompt("المسؤول: مصطفى / ضحى / الاتنين","الاتنين")||"").trim();const owner={"مصطفى":"m","ضحى":"d","الاتنين":"both"}[o]||"both";const due=(prompt("تاريخ الاستحقاق (اختياري) مثل 2026-08-01:","")||"").trim();state.tasks.push({id:"t"+Date.now(),title:title.trim(),owner,due,done:false});save();renderTasks()});
  V().querySelectorAll("input[data-tdone]").forEach(c=>c.addEventListener("change",()=>{const t=state.tasks.find(x=>x.id===c.dataset.tdone);if(t)t.done=c.checked;save();renderTasks()}));
  V().querySelectorAll("[data-tdel]").forEach(b=>b.addEventListener("click",()=>{state.tasks=state.tasks.filter(x=>x.id!==b.dataset.tdel);save();renderTasks()}));
}

// ----- الميزانية (مخطط/مدفوع/متبقّي) -----
function renderBudget(){
  const planned=state.budget.reduce((s,b)=>s+(+b.planned||0),0);
  const paid=state.budget.reduce((s,b)=>s+(+b.paid||0),0);
  const summary=`<div class="card"><div class="row"><span class="pill wait">المخطّط: ${money(planned)}</span><span class="pill mine">المدفوع: ${money(paid)}</span><span class="pill ${planned-paid<=0?'done':'ready'}">المتبقّي: ${money(planned-paid)}</span></div></div>`;
  const items=state.budget.length?state.budget.map(b=>{const rem=(+b.planned||0)-(+b.paid||0);return `<div class="card"><div class="row"><p class="q" style="margin:0">${esc(b.label)}</p><button class="act ghost sm" data-bdel="${b.id}">حذف</button></div>
    <div class="row" style="margin-top:8px">${b.cat?`<span class="pill wait">${esc(b.cat)}</span>`:""}<span class="pill mine">مدفوع ${money(b.paid)} / ${money(b.planned)}</span><span class="pill ${rem<=0?'done':'wait'}">${rem<=0?'مكتمل':'باقي '+money(rem)}</span></div>
    <div class="row" style="margin-top:8px"><span></span><button class="act primary sm" data-bpay="${b.id}">سجّل دفعة</button></div></div>`}).join("")
    :`<div class="empty"><b>مفيش بنود</b>أضيفوا بنود الميزانية (قاعة، جهاز، إيجار…) بمبلغ مخطّط.</div>`;
  V().innerHTML=`<h1 class="page">الميزانية المشتركة</h1><p class="lede">تتبّعوا فين رايحة الفلوس: مخطّط، مدفوع، ومتبقّي لكل بند.</p>
    <div class="row" style="margin-bottom:14px"><span></span><button class="act gold sm" id="add-budget">+ بند</button></div>${summary}<div class="cat">البنود</div>${items}`;
  document.getElementById("add-budget").addEventListener("click",()=>{const label=prompt("اسم البند:");if(!label||!label.trim())return;const cat=(prompt("الفئة (اختياري): فرح / جهاز / بيت / فواتير","")||"").trim();const planned=+prompt("المبلغ المخطّط:","0")||0;const paid=+prompt("المدفوع حتى الآن:","0")||0;state.budget.push({id:"b"+Date.now(),label:label.trim(),cat,planned,paid});save();renderBudget()});
  V().querySelectorAll("[data-bpay]").forEach(b=>b.addEventListener("click",()=>{const it=state.budget.find(x=>x.id===b.dataset.bpay);const add=+prompt(`دفعة جديدة لـ«${it.label}»:`,"0")||0;it.paid=(+it.paid||0)+add;save();renderBudget()}));
  V().querySelectorAll("[data-bdel]").forEach(b=>b.addEventListener("click",()=>{state.budget=state.budget.filter(x=>x.id!==b.dataset.bdel);save();renderBudget()}));
}

// ----- المشتريات (قائمة حيّة) -----
function renderShopping(){
  const items=state.shopping.length?state.shopping.map(s=>`<div class="card" style="padding:12px 16px"><div class="row"><label class="row" style="gap:9px;cursor:pointer">
    <input type="checkbox" class="chk" data-sdone="${s.id}" ${s.done?"checked":""}>
    <span style="${s.done?'text-decoration:line-through;opacity:.6':''}">${esc(s.text)}</span></label>
    <button class="act ghost sm" data-sdel="${s.id}">حذف</button></div></div>`).join("")
    :`<div class="empty"><b>القائمة فاضية</b>أضيفوا اللي البيت محتاجه — وأول ما حد يشطب حاجة تظهر للطرف التاني.</div>`;
  const doneCount=state.shopping.filter(s=>s.done).length;
  V().innerHTML=`<h1 class="page">قائمة المشتريات</h1><p class="lede">قائمة حيّة للبيت. الشطب بيظهر للطرفين فورًا (في الإنتاج عبر Realtime).</p>
    <div class="row" style="margin-bottom:14px"><span></span><div class="row" style="gap:8px"><button class="act gold sm" id="add-shop">+ صنف</button>${doneCount?`<button class="act ghost sm" id="clear-shop">امسح المشطوب (${doneCount})</button>`:""}</div></div>${items}`;
  document.getElementById("add-shop").addEventListener("click",()=>{const text=prompt("الصنف (حليب، بيض، إصلاح سباكة…):");if(!text||!text.trim())return;state.shopping.push({id:"s"+Date.now(),text:text.trim(),done:false});save();renderShopping()});
  const cs=document.getElementById("clear-shop");cs&&cs.addEventListener("click",()=>{state.shopping=state.shopping.filter(s=>!s.done);save();renderShopping()});
  V().querySelectorAll("input[data-sdone]").forEach(c=>c.addEventListener("change",()=>{const s=state.shopping.find(x=>x.id===c.dataset.sdone);if(s)s.done=c.checked;save();renderShopping()}));
  V().querySelectorAll("[data-sdel]").forEach(b=>b.addEventListener("click",()=>{state.shopping=state.shopping.filter(x=>x.id!==b.dataset.sdel);save();renderShopping()}));
}
