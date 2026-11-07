(()=>{'use strict';
const BASE='https://kgbkevncksvpfgqsvoqg.supabase.co';
const KEY='sb_publishable_Ak6qpHDtfKvrC1VcFCUGtg_QlY-HRLX';
let bearer=null,clients=[],properties=[],fees=[],leads=[],propertyTools=[],selectedOccupied=new Set();
const el=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(n)||0);
const status=(msg,type='')=>{el('status').textContent=msg;el('status').dataset.type=type};
const euroValue=s=>Number(String(s).replace(',','.'));
async function call(path,{method='GET',body,prefer}={}){
 const h={'apikey':KEY,'Content-Type':'application/json',...(bearer?{'Authorization':'Bearer '+bearer}:{})};
 if(method!=='GET')h.Prefer=prefer||'return=representation';
 const res=await fetch(BASE+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 const data=await res.json().catch(()=>null);
 if(!res.ok){if(res.status===401&&bearer)throw Error('Sessione scaduta. Esci e accedi nuovamente.');throw Error(data?.message||data?.msg||data?.error_description||data?.error||'Errore HTTP '+res.status)}
 return data;
}
function addCell(row,value){const td=document.createElement('td');td.textContent=String(value??'—');row.append(td)}
function addButton(row,label,fn,style=''){const td=document.createElement('td'),b=document.createElement('button');b.type='button';b.textContent=label;b.className='mini '+style;b.addEventListener('click',fn);td.append(b);row.append(td)}
function empty(tbody,columns){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=columns;td.textContent='Nessun dato ancora inserito';td.className='muted';tr.append(td);tbody.append(tr)}
function option(select,value,label){let o=document.createElement('option');o.value=value;o.textContent=label;select.append(o)}
function formData(form){return Object.fromEntries(new FormData(form).entries())}
function setVisible(yes){el('signInBox').hidden=yes;el('adminBox').hidden=!yes}
function logout(message='Sessione terminata.'){const token=bearer;bearer=null;clients=[];properties=[];fees=[];leads=[];propertyTools=[];selectedOccupied=new Set();el('password').value='';setVisible(false);el('loginMessage').textContent=message;if(token)fetch(BASE+'/auth/v1/logout',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+token}}).catch(()=>{})}
async function refresh(){
 [clients,properties,fees,leads,propertyTools]=await Promise.all([
 call('/rest/v1/hdl_clients?select=id,full_name,email,phone,status,notes,created_at&order=created_at.desc&limit=500'),
 call('/rest/v1/hdl_properties?select=id,client_id,name,region,status,listing_url,created_at&order=created_at.desc&limit=500'),
 call('/rest/v1/hdl_compensi?select=id,property_id,period_start,period_end,payout_owner,cleaning_amount,fee_rate,fee_amount,status,paid_at&order=period_start.desc&limit=1000'),
 call('/rest/v1/hdl_leads?select=id,full_name,email,location,source,stage,next_follow_up,last_contact_at,notes,created_at&order=created_at.desc&limit=500'),
 call('/rest/v1/hdl_property_tools?select=property_id,checkin_time,checkout_time,parking,wifi_name,house_rules,waste_info,assistance_info,nightly_rate,sale_probability,occupied_dates&limit=500')]);
 render();
}
function chartNode(tag,cls,textValue){
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(textValue!==undefined)node.textContent=String(textValue);
 return node;
}
function renderCharts(){
 const months=[],now=new Date();
 for(let n=5;n>=0;n--){
  const dt=new Date(now.getFullYear(),now.getMonth()-n,1);
  const code=String(dt.getFullYear())+'-'+String(dt.getMonth()+1).padStart(2,'0');
  months.push({code,name:new Intl.DateTimeFormat('it-IT',{month:'short'}).format(dt),paid:0,pending:0});
 }
 for(const fee of fees){
  const m=months.find(m=>m.code===String(fee.period_start||'').slice(0,7));
  if(!m)continue;
  const value=Number(fee.fee_amount)||0;
  if(fee.status==='paid')m.paid+=value;
  else m.pending+=value;
 }
 const chart=el('monthlyChart');chart.replaceChildren();
 const hasFees=months.some(m=>m.paid+m.pending>0);
 el('monthlyEmpty').hidden=hasFees;
 chart.hidden=!hasFees;
 if(hasFees){
  const max=Math.max(...months.map(m=>m.paid+m.pending),1);
  const descriptions=[];
  for(const m of months){
   const col=chartNode('div','monthColumn');
   const total=m.paid+m.pending;
   col.append(chartNode('div','monthValue',total?money(total):'—'));
   const bars=chartNode('div','monthBars');
   for(const [value,cls,label] of [[m.paid,'bar','Incassato'],[m.pending,'bar pending','Da incassare']]){
    const bar=chartNode('div',cls);
    bar.style.height=value>0?Math.max(3,Math.round(value/max*140))+'px':'0px';
    bar.title=label+': '+money(value);
    bars.append(bar);
   }
   col.append(bars,chartNode('div','monthLabel',m.name));
   chart.append(col);
   descriptions.push(m.name+': incassati '+money(m.paid)+', da incassare '+money(m.pending));
  }
  chart.setAttribute('aria-label',descriptions.join('; '));
 }
 const stages=[
 ['new','Nuovi'],['contacted','Contattati'],['analysis_sent','Analisi inviata'],
 ['negotiating','In trattativa'],['won','Diventati clienti'],['lost','Non interessati']
 ];
 const container=el('stageChart');container.replaceChildren();
 el('stageEmpty').hidden=leads.length>0;
 container.hidden=leads.length===0;
 if(leads.length){
  const max=Math.max(...stages.map(([key])=>leads.filter(l=>l.stage===key).length),1);
  const descriptions=[];
  for(const [key,label] of stages){
   const count=leads.filter(l=>l.stage===key).length;
   const row=chartNode('div','stageRow');
   const name=chartNode('span','',label);
   const track=chartNode('div','stageTrack');
   const fill=chartNode('div','stageFill');
   fill.style.width=(count/max*100)+'%';
   track.append(fill);
   row.append(name,track,chartNode('strong','',count));
   container.append(row);
   descriptions.push(label+': '+count);
  }
  container.setAttribute('aria-label',descriptions.join('; '));
 }
}
function render(){
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const openLeads=leads.filter(l=>!['won','lost'].includes(l.stage));
 el('emptyGuide').hidden=leads.length>0||clients.length>0||properties.length>0;
 el('leadsCount').textContent=openLeads.length;
 el('dueCount').textContent=openLeads.filter(l=>l.next_follow_up&&l.next_follow_up<=today).length;
 const lt=el('leadsRows');lt.replaceChildren();
 const stageName={new:'Nuovo',contacted:'Contattato',analysis_sent:'Analisi inviata',negotiating:'In trattativa',won:'Diventato cliente',lost:'Non interessato'};
 const filter=el('leadFilter').value;
 const ordered=[...leads].sort((a,b)=>(a.next_follow_up||'9999-12-31').localeCompare(b.next_follow_up||'9999-12-31'));
 const selected=ordered.filter(l=>{
   const closed=['won','lost'].includes(l.stage);
   return filter==='all'||(filter==='open'&&!closed)||(filter==='closed'&&closed)||(filter==='due'&&!closed&&l.next_follow_up&&l.next_follow_up<=today);
 });
 for(const l of selected){
  const tr=document.createElement('tr');addCell(tr,l.full_name);addCell(tr,l.location||'—');addCell(tr,stageName[l.stage]||l.stage);
  const dateCell=document.createElement('td');dateCell.textContent=l.next_follow_up||'—';
  if(l.next_follow_up&&l.next_follow_up<=today&&!['won','lost'].includes(l.stage)){dateCell.style.color='#a23a32';dateCell.style.fontWeight='700'}
  tr.append(dateCell);
  addButton(tr,'Modifica',()=>editLead(l));
  if(l.email)addButton(tr,'Email',()=>prepareDraft(l));
  else addCell(tr,'');
  addButton(tr,'→ Cliente',()=>prefillClient(l));
  lt.append(tr);
 }if(!selected.length)empty(lt,7);
 el('clientsCount').textContent=clients.length;
 el('propertiesCount').textContent=properties.length;
 el('totalFees').textContent=money(fees.reduce((s,f)=>s+Number(f.fee_amount),0));
 el('pendingFees').textContent=money(fees.filter(f=>f.status!=='paid').reduce((s,f)=>s+Number(f.fee_amount),0));
 renderCharts();
 const owner=el('propertyClient'),prop=el('feeProperty'),toolSelect=el('toolsProperty'),toolId=toolSelect.value;owner.replaceChildren();prop.replaceChildren();toolSelect.replaceChildren();
 option(toolSelect,'','Seleziona un immobile');
 el('toolsSummary').textContent=properties.length?properties.length+' immobile/i registrato/i · '+propertyTools.length+' scheda/e Concierge e Radar salvata/e.':'Nessun immobile ancora registrato. Crea prima un cliente e il suo immobile.';
 option(owner,'','Seleziona un cliente');option(prop,'','Seleziona una proprietà');
 for(const c of clients)option(owner,c.id,c.full_name);
 for(const p of properties){const label=p.name+' · '+(clients.find(c=>c.id===p.client_id)?.full_name||'Cliente');option(prop,p.id,label);option(toolSelect,p.id,label)}
 if(properties.some(p=>p.id===toolId))toolSelect.value=toolId;
 if(el('toolsPanel').hidden===false)loadPropertyTools();
 const ct=el('clientsRows');ct.replaceChildren();
 for(const c of clients){const tr=document.createElement('tr');addCell(tr,c.full_name);addCell(tr,c.email||'—');addCell(tr,c.status);addButton(tr,'Modifica',()=>editClient(c));ct.append(tr)}if(!clients.length)empty(ct,4);
 const pt=el('propertiesRows');pt.replaceChildren();
 for(const p of properties){const tr=document.createElement('tr');addCell(tr,p.name);addCell(tr,clients.find(c=>c.id===p.client_id)?.full_name||'—');addCell(tr,p.region||'—');addButton(tr,'Modifica',()=>editProperty(p));pt.append(tr)}if(!properties.length)empty(pt,4);
 const ft=el('feeRows');ft.replaceChildren();
 for(const f of fees){const tr=document.createElement('tr');addCell(tr,properties.find(p=>p.id===f.property_id)?.name||'—');addCell(tr,f.period_start+' → '+f.period_end);addCell(tr,money(f.fee_amount));addCell(tr,({'pending':'Da fatturare','invoiced':'Fatturato','paid':'Incassato'})[f.status]||f.status);addButton(tr,'Modifica',()=>editFee(f));ft.append(tr)}if(!fees.length)empty(ft,5);
}
function openPanel(id){document.querySelectorAll('[data-panel]').forEach(x=>x.hidden=x.id!==id);document.querySelectorAll('[data-open]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.open===id)));el('editor').scrollIntoView({behavior:'smooth',block:'start'})}
function prefillClient(l){
 const match=clients.find(c=>(l.email&&c.email&&c.email.toLowerCase()===l.email.toLowerCase())||c.full_name.trim().toLowerCase()===l.full_name.trim().toLowerCase());
 if(match){editClient(match);status('Esiste già un cliente con questo nome o email: controlla la sua scheda.','error');return}
 openPanel('clientPanel');el('clientForm').reset();el('clientId').value='';
 el('clientName').value=l.full_name;el('clientEmail').value=l.email||'';
 el('clientStatus').value='active';el('clientNotes').value='Primo contatto registrato nel percorso Potenziali clienti.';
 el('clientHeading').textContent='Nuovo cliente da '+l.full_name;
 status('Scheda precompilata. Controlla i dati e premi «Salva cliente». Non è stato ancora salvato nulla.');
}
function prepareDraft(l){
 if(!l.email)return status('Manca l’email del proprietario. Aggiungila nella sua scheda.','error');
 const isFollowup=['contacted','analysis_sent','negotiating'].includes(l.stage);
 const subject=isFollowup?'Un aggiornamento sulla tua casa vacanza · Host da Lontano':'La tua casa vacanza · Host da Lontano';
 const firstName=l.full_name.trim().split(/\s+/)[0]||'';
 const greeting='Buongiorno '+firstName+',';
 const common='\\n\\nUn saluto,\\nGiuseppe\\nHost da Lontano\\nhttps://hostdalontano.com';
 const body=isFollowup
  ?greeting+'\\n\\nTi scrivo per sapere se hai avuto modo di valutare le informazioni che ci siamo scambiati sulla gestione online della tua casa vacanza.\\n\\nSe hai domande o vuoi approfondire qualche punto, rispondimi pure a questa email.'+common
  :greeting+'\\n\\ngrazie per l’interesse verso Host da Lontano. Per una prima analisi gratuita della tua casa vacanza, puoi inviarmi il link dell’annuncio (se già online) e indicarmi in quale zona si trova l’immobile.\\n\\nTi risponderò via email con una prima valutazione.'+common;
 el('draftRecipient').value=l.email;el('draftSubject').value=subject;
 el('draftBody').value=body.replaceAll('\\n','\n');
 el('emailPanel').hidden=false;el('emailPanel').scrollIntoView({behavior:'smooth',block:'start'});
}
function editLead(l){openPanel('leadPanel');el('leadForm').reset();el('leadId').value=l.id;el('leadName').value=l.full_name;el('leadEmail').value=l.email||'';el('leadLocation').value=l.location||'';el('leadSource').value=l.source;el('leadStage').value=l.stage;el('leadFollowUp').value=l.next_follow_up||'';el('leadLastContact').value=l.last_contact_at||'';el('leadNotes').value=l.notes||'';el('leadHeading').textContent='Modifica contatto'}
function editClient(c){openPanel('clientPanel');el('clientForm').reset();el('clientId').value=c.id;el('clientName').value=c.full_name;el('clientEmail').value=c.email||'';el('clientPhone').value=c.phone||'';el('clientStatus').value=c.status;el('clientNotes').value=c.notes||'';el('clientHeading').textContent='Modifica cliente'}
function editProperty(p){openPanel('propertyPanel');el('propertyForm').reset();el('propertyId').value=p.id;el('propertyClient').value=p.client_id;el('propertyName').value=p.name;el('propertyRegion').value=p.region||'';el('propertyStatus').value=p.status;el('propertyLink').value=p.listing_url||'';el('propertyHeading').textContent='Modifica immobile'}
function editFee(f){openPanel('feePanel');el('feeForm').reset();el('feeId').value=f.id;el('feeProperty').value=f.property_id;el('start').value=f.period_start;el('end').value=f.period_end;el('payout').value=f.payout_owner;el('cleaning').value=f.cleaning_amount;el('feeRate').value=String(Number(f.fee_rate));el('feeStatus').value=f.status;el('feeHeading').textContent='Modifica compenso'}
document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.open;openPanel(id);if(id==='toolsPanel'){loadPropertyTools();return}const form=el(id).querySelector('form');form.reset();form.querySelector('input[type=hidden]').value='';el(({leadPanel:'leadHeading',clientPanel:'clientHeading',propertyPanel:'propertyHeading',feePanel:'feeHeading'})[id]).textContent=({leadPanel:'Nuovo contatto interessato',clientPanel:'Nuovo cliente',propertyPanel:'Nuovo immobile',feePanel:'Nuovo compenso'})[id]}));
el('loginForm').addEventListener('submit',async event=>{
 event.preventDefault();el('loginMessage').textContent='Verifico l’accesso…';const b=el('loginButton');b.disabled=true;
 try{
  const email=el('email').value.trim(),password=el('password').value;
  const login=await call('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
  bearer=login.access_token;el('password').value='';
  const approved=await call('/rest/v1/hdl_admin_accounts?select=user_id&limit=1');
  if(!approved.length){logout('Account verificato ma non ancora autorizzato al gestionale.');return}
  setVisible(true);el('who').textContent=login.user?.email||email;
  await refresh();status('Accesso effettuato. I dati vengono caricati dal database privato.','ok');
 }catch(error){logout('Accesso non riuscito: '+error.message)}finally{b.disabled=false}
});
el('testConnection').addEventListener('click',async()=>{const result=el('connectionResult');result.textContent='Controllo connessione in corso…';try{const controller=new AbortController();const timeout=Promise.race([fetch(BASE+'/auth/v1/health',{headers:{apikey:KEY},signal:controller.signal,cache:'no-store'}),new Promise((_,reject)=>setTimeout(()=>{controller.abort();reject(Error('Connessione scaduta'))},9000))]);const response=await timeout;result.textContent=response.ok?'Collegamento Supabase raggiungibile. Ora prova ad accedere.':'Servizio di autenticazione raggiunto, risposta HTTP '+response.status+'.';}catch(err){result.textContent='Non riesco a raggiungere Supabase da questo browser. Verifica la connessione o eventuali blocchi del browser. Dettaglio: '+err.message}});
function csvCell(v){
 const raw=String(v??'');
 const safe=/^\s*[=+@-]/.test(raw)?"'"+raw:raw;
 return '"'+safe.replace(/"/g,'""')+'"';
}
function exportContacts(){
 if(!leads.length){status('Non ci sono contatti da esportare.','error');return}
 const cols=['full_name','email','location','source','stage','next_follow_up','last_contact_at','notes'];
 const text=String.fromCharCode(0xFEFF)+[cols.join(';'),...leads.map(l=>cols.map(k=>csvCell(l[k])).join(';'))].join(String.fromCharCode(13,10));
 const blob=new Blob([text],{type:'text/csv;charset=utf-8;'});
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download='host-da-lontano-contatti.csv';
 document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 status('Esportazione dei contatti preparata. Il file contiene dati personali: conservalo in modo sicuro.','ok');
}
el('exportLeads').addEventListener('click',exportContacts);
el('leadFilter').addEventListener('change',render);
el('openDraftEmail').addEventListener('click',()=>{
 const email=el('draftRecipient').value.trim(),sub=el('draftSubject').value.trim(),body=el('draftBody').value;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){status('L’indirizzo del destinatario non è valido.','error');return}
 window.location.href='mailto:'+email+'?subject='+encodeURIComponent(sub)+'&body='+encodeURIComponent(body);
 status('È stata preparata l’email. Ricorda di premere Invia nel programma di posta.');
});
el('copyDraftEmail').addEventListener('click',async()=>{
 const content=['A: '+el('draftRecipient').value,'Oggetto: '+el('draftSubject').value,'',el('draftBody').value].join(String.fromCharCode(10));
 try{await navigator.clipboard.writeText(content);status('Bozza copiata.','ok')}
 catch{el('draftBody').focus();el('draftBody').select();status('Seleziona e copia il testo della bozza.','error')}
});
el('closeDraftEmail').addEventListener('click',()=>{el('emailPanel').hidden=true;el('draftBody').value='';});
el('logout').addEventListener('click',()=>logout());
async function saveRecord(form,table,idField,payload){
 const id=el(idField).value;
 const saved=await call('/rest/v1/'+table+(id?'?id=eq.'+encodeURIComponent(id):''),{method:id?'PATCH':'POST',body:payload});
 if(!Array.isArray(saved)||saved.length!==1)throw Error('Il database non ha confermato il salvataggio. Aggiorna i dati e riprova.');
 form.reset();el(idField).value='';await refresh();status('Dati salvati correttamente.','ok');
}
function guard(form,fn){form.addEventListener('submit',async event=>{event.preventDefault();const btn=form.querySelector('[type=submit]');btn.disabled=true;try{await fn()}catch(error){status('Impossibile salvare: '+error.message,'error')}finally{btn.disabled=false}})}
guard(el('leadForm'),async()=>{
 const f=formData(el('leadForm'));if(!f.full_name?.trim())throw Error('Inserisci un nome.');
 await saveRecord(el('leadForm'),'hdl_leads','leadId',{full_name:f.full_name.trim(),email:f.email?.trim()||null,location:f.location?.trim()||null,source:f.source,stage:f.stage,next_follow_up:f.next_follow_up||null,last_contact_at:f.last_contact_at||null,notes:f.notes?.trim()||null});
});
guard(el('clientForm'),async()=>{
 const f=formData(el('clientForm'));if(!f.full_name?.trim())throw Error('Inserisci il nome del cliente.');
 await saveRecord(el('clientForm'),'hdl_clients','clientId',{full_name:f.full_name.trim(),email:f.email?.trim()||null,phone:f.phone?.trim()||null,status:f.status,notes:f.notes?.trim()||null});
});
guard(el('propertyForm'),async()=>{
 const f=formData(el('propertyForm'));if(!f.client_id||!f.name?.trim())throw Error('Seleziona il cliente e scrivi il nome della proprietà.');
 await saveRecord(el('propertyForm'),'hdl_properties','propertyId',{client_id:f.client_id,name:f.name.trim(),region:f.region?.trim()||null,listing_url:f.listing_url?.trim()||null,status:f.status});
});
guard(el('feeForm'),async()=>{
 const f=formData(el('feeForm')),p=euroValue(f.payout_owner),c=euroValue(f.cleaning_amount),rate=euroValue(f.fee_rate);
 if(!f.property_id)throw Error('Seleziona la proprietà.');
 if(!f.period_start||!f.period_end||f.period_start>f.period_end)throw Error('Controlla le date.');
 if(!Number.isFinite(p)||!Number.isFinite(c)||p<0||c<0||c>p)throw Error('Le pulizie non possono superare l’importo del proprietario.');
 await saveRecord(el('feeForm'),'hdl_compensi','feeId',{property_id:f.property_id,period_start:f.period_start,period_end:f.period_end,payout_owner:p,cleaning_amount:c,fee_rate:rate,status:f.status,paid_at:f.status==='paid'?new Date().toISOString().slice(0,10):null});
});

function localDate(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function nextDates(){const d=new Date();d.setHours(12,0,0,0);return Array.from({length:28},(_,i)=>{const x=new Date(d);x.setDate(d.getDate()+i);return x})}
function loadPropertyTools(){
 el('guidePreview').hidden=true;
 const propertyId=el('toolsProperty').value;
 const form=el('toolsForm');form.hidden=!propertyId;
 if(!propertyId){el('toolsRadarSummary').textContent='Seleziona prima un immobile.';return}
 const t=propertyTools.find(x=>x.property_id===propertyId)||{};
 el('toolCheckin').value=String(t.checkin_time||'16:00').slice(0,5);
 el('toolCheckout').value=String(t.checkout_time||'10:00').slice(0,5);
 el('toolParking').value=t.parking||'';
 el('toolWifi').value=t.wifi_name||'';
 el('toolRules').value=t.house_rules||'';
 el('toolWaste').value=t.waste_info||'';
 el('toolHelp').value=t.assistance_info||'';
 el('toolRate').value=String(t.nightly_rate??130);
 el('toolConversion').value=String(t.sale_probability??25);
 selectedOccupied=new Set(t.occupied_dates||[]);
 renderPrivateCalendar();
}
function previewGuestGuide(){
 const id=el('toolsProperty').value,p=properties.find(p=>p.id===id);
 if(!p){status('Seleziona prima un immobile.','error');return}
 const fields=[
 ['previewTitle',p.name],['previewArea',p.region||''],
 ['previewIn',el('toolCheckin').value||'Da confermare'],
 ['previewOut',el('toolCheckout').value||'Da confermare'],
 ['previewParking',el('toolParking').value.trim()||'Da comunicare'],
 ['previewWifi',el('toolWifi').value.trim()||'Da comunicare'],
 ['previewRules',el('toolRules').value.trim()||'Da comunicare'],
 ['previewWaste',el('toolWaste').value.trim()||'Da comunicare'],
 ['previewHelp',el('toolHelp').value.trim()||'Da comunicare']
 ];
 for(const [id,value] of fields)el(id).textContent=value;
 el('guidePreview').hidden=false;
 el('guidePreview').scrollIntoView({behavior:'smooth',block:'start'});
}
el('previewGuide').addEventListener('click',previewGuestGuide);
el('closeGuidePreview').addEventListener('click',()=>el('guidePreview').hidden=true);

function renderPrivateCalendar(){
 const calendar=el('toolsCalendar');calendar.replaceChildren();
 const dates=nextDates();const labelFormat=new Intl.DateTimeFormat('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
 for(const d of dates){
  const key=localDate(d),b=document.createElement('button');b.type='button';b.className='privateDay';
  const short=document.createElement('small');short.textContent=new Intl.DateTimeFormat('it-IT',{weekday:'short'}).format(d);
  const num=document.createElement('span');num.textContent=String(d.getDate());
  b.append(short,num);
  b.setAttribute('aria-pressed',String(selectedOccupied.has(key)));
  b.setAttribute('aria-label',labelFormat.format(d)+' · '+(selectedOccupied.has(key)?'occupato':'libero'));
  b.addEventListener('click',()=>{if(selectedOccupied.has(key))selectedOccupied.delete(key);else selectedOccupied.add(key);renderPrivateCalendar()});
  calendar.append(b);
 }
 const occupied=dates.filter(d=>selectedOccupied.has(localDate(d))).length,free=28-occupied;
 const rate=Number(el('toolRate').value),probability=Number(el('toolConversion').value);
 const estimate=free*(Number.isFinite(rate)?rate:0)*(Number.isFinite(probability)?probability:0)/100;
 el('toolsRadarSummary').textContent='Libere: '+free+' · Occupate: '+occupied+' · Ricavo lordo aggiuntivo ipotetico: '+money(estimate)+'.';
}
el('toolsProperty').addEventListener('change',loadPropertyTools);
el('toolRate').addEventListener('input',renderPrivateCalendar);
el('toolConversion').addEventListener('input',renderPrivateCalendar);
el('resetTools').addEventListener('click',loadPropertyTools);
el('toolsForm').addEventListener('submit',async event=>{
 event.preventDefault();const id=el('toolsProperty').value,btn=el('saveTools');
 if(!properties.some(x=>x.id===id)){status('Seleziona un immobile valido.','error');return}
 const rate=Number(el('toolRate').value),prob=Number(el('toolConversion').value);
 if(!Number.isFinite(rate)||rate<0||rate>10000||!Number.isFinite(prob)||prob<0||prob>100){status('Controlla tariffa e percentuale.','error');return}
 const payload={
  property_id:id,checkin_time:el('toolCheckin').value,checkout_time:el('toolCheckout').value,
  parking:el('toolParking').value.trim(),wifi_name:el('toolWifi').value.trim(),
  house_rules:el('toolRules').value.trim(),waste_info:el('toolWaste').value.trim(),
  assistance_info:el('toolHelp').value.trim(),nightly_rate:rate,sale_probability:prob,
  occupied_dates:[...selectedOccupied].sort(),updated_at:new Date().toISOString()
 };
 btn.disabled=true;
 try{
  const saved=await call('/rest/v1/hdl_property_tools?on_conflict=property_id',{method:'POST',body:payload,prefer:'resolution=merge-duplicates,return=representation'});
  if(!Array.isArray(saved)||saved.length!==1)throw Error('Il database non ha confermato le impostazioni.');
  await refresh();el('toolsProperty').value=id;loadPropertyTools();status('Concierge e Radar salvati per questo immobile.','ok');
 }catch(error){status('Errore salvataggio strumenti: '+error.message,'error')}
 finally{btn.disabled=false}
});

el('refresh').addEventListener('click',async()=>{try{await refresh();status('Dati aggiornati.','ok')}catch(err){status(err.message,'error')}});
setVisible(false);
})();