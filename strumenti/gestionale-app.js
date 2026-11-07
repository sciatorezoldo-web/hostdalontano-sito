(()=>{'use strict';
const BASE='https://kgbkevncksvpfgqsvoqg.supabase.co';
const KEY='sb_publishable_Ak6qpHDtfKvrC1VcFCUGtg_QlY-HRLX';
let bearer=null,clients=[],properties=[],fees=[],leads=[],propertyTools=[],guestShares=[],selectedOccupied=new Set();
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
function logout(message='Sessione terminata.'){const token=bearer;bearer=null;clients=[];properties=[];fees=[];leads=[];propertyTools=[];guestShares=[];selectedOccupied=new Set();el('password').value='';el('aiQuestion').value='';el('aiText').textContent='';el('aiResult').hidden=true;el('draftRecipient').value='';el('draftSubject').value='';el('draftBody').value='';el('emailPanel').hidden=true;el('shareUrl').value='';el('guidePreview').hidden=true;setVisible(false);el('loginMessage').textContent=message;if(token)fetch(BASE+'/auth/v1/logout',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+token}}).catch(()=>{})}
async function refresh(){
 [clients,properties,fees,leads,propertyTools,guestShares]=await Promise.all([
 call('/rest/v1/hdl_clients?select=id,full_name,email,phone,status,notes,created_at&order=created_at.desc&limit=500'),
 call('/rest/v1/hdl_properties?select=id,client_id,name,region,status,listing_url,pricing_plan,contract_start,created_at&order=created_at.desc&limit=500'),
 call('/rest/v1/hdl_compensi?select=id,property_id,period_start,period_end,payout_owner,cleaning_amount,fee_rate,fee_amount,status,paid_at&order=period_start.desc&limit=1000'),
 call('/rest/v1/hdl_leads?select=id,full_name,email,location,source,stage,next_follow_up,last_contact_at,notes,created_at&order=created_at.desc&limit=500'),
 call('/rest/v1/hdl_property_tools?select=property_id,checkin_time,checkout_time,parking,wifi_name,house_rules,waste_info,assistance_info,nightly_rate,sale_probability,occupied_dates&limit=500'),
 call('/rest/v1/hdl_guest_shares?select=property_id,share_token,is_published&limit=500')]);
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
function editProperty(p){openPanel('propertyPanel');el('propertyForm').reset();el('propertyId').value=p.id;el('propertyClient').value=p.client_id;el('propertyName').value=p.name;el('propertyRegion').value=p.region||'';el('propertyStatus').value=p.status;el('propertyLink').value=p.listing_url||'';el('propertyPricingPlan').value=p.pricing_plan||'standard';el('propertyContractStart').value=p.contract_start||'';togglePropertyContractDate();el('propertyHeading').textContent='Modifica immobile'}
function editFee(f){openPanel('feePanel');el('feeForm').reset();el('feeId').value=f.id;el('feeProperty').value=f.property_id;el('start').value=f.period_start;el('end').value=f.period_end;el('payout').value=f.payout_owner;el('cleaning').value=f.cleaning_amount;el('feeStatus').value=f.status;togglePaidAt();el('paidAt').value=f.paid_at||((f.status==='paid')?new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()):'');showEffectiveFee();el('feeHeading').textContent='Modifica compenso'}

function togglePropertyContractDate(){
 const launch=el('propertyPricingPlan').value==='launch';
 el('propertyStartBox').hidden=!launch;
 el('propertyContractStart').required=launch;
 if(!launch)el('propertyContractStart').value='';
}
el('propertyPricingPlan').addEventListener('change',togglePropertyContractDate);
function addMonthsDateString(ymd,months){
 const parts=ymd.split('-').map(Number);
 if(parts.length!==3||parts.some(x=>!Number.isInteger(x)))return null;
 const monthStart=new Date(Date.UTC(parts[0],parts[1]-1+months,1));
 const monthEnd=new Date(Date.UTC(monthStart.getUTCFullYear(),monthStart.getUTCMonth()+1,0)).getUTCDate();
 monthStart.setUTCDate(Math.min(parts[2],monthEnd));
 if(Number.isNaN(monthStart.getTime()))return null;
 return monthStart.toISOString().slice(0,10);
}
function effectiveFee(propertyId,start,end){
 const p=properties.find(x=>x.id===propertyId);
 if(!p)return {error:'Seleziona un immobile registrato.'};
 if(!start||!end||start>end)return {error:'Inserisci un periodo valido.'};
 if(p.pricing_plan==='special20')return {rate:0.20,label:'20% · accordo particolare'};
 if(p.pricing_plan==='launch'){
  if(!p.contract_start)return {error:'Manca la data di inizio dell’accordo promozionale nella scheda dell’immobile.'};
  if(start<p.contract_start)return {error:'Il periodo precede l’inizio dell’accordo promozionale.'};
  const cutoff=addMonthsDateString(p.contract_start,3);
  if(!cutoff)return {error:'Data promozionale non valida.'};
  if(start<cutoff&&end>=cutoff)return {error:'Il periodo attraversa il cambio tariffa del '+cutoff+'. Crea due compensi separati: uno fino al giorno prima e uno dal '+cutoff+'.'};
  if(start<cutoff)return {rate:0.15,label:'15% · lancio fino al '+cutoff+' escluso'};
  return {rate:0.18,label:'18% · promozione terminata dal '+cutoff};
 }
 return {rate:0.18,label:'18% · gestione ordinaria'};
}
function togglePaidAt(){
 const paid=el('feeStatus').value==='paid';
 el('paidAtBox').hidden=!paid;
 el('paidAt').required=paid;
 if(!paid)el('paidAt').value='';
 else if(!el('paidAt').value)el('paidAt').value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
el('feeStatus').addEventListener('change',togglePaidAt);
function showEffectiveFee(){
 const result=effectiveFee(el('feeProperty').value,el('start').value,el('end').value);
 el('feeRate').value=result.rate!==undefined?Math.round(result.rate*100)+'%':'—';
 el('feeRateExplain').textContent=result.error||result.label+'. Aliquota confermata dal database al salvataggio.';
 el('feeRateExplain').style.color=result.error?'#a23a32':'';
}
for(const id of ['feeProperty','start','end'])el(id).addEventListener('change',showEffectiveFee);

document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.open;openPanel(id);if(id==='toolsPanel'){loadPropertyTools();return}const form=el(id).querySelector('form');form.reset();form.querySelector('input[type=hidden]').value='';if(id==='propertyPanel')togglePropertyContractDate();if(id==='feePanel'){showEffectiveFee();togglePaidAt();}el(({leadPanel:'leadHeading',clientPanel:'clientHeading',propertyPanel:'propertyHeading',feePanel:'feeHeading'})[id]).textContent=({leadPanel:'Nuovo contatto interessato',clientPanel:'Nuovo cliente',propertyPanel:'Nuovo immobile',feePanel:'Nuovo compenso'})[id]}));
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
 if(!['standard','launch','special20'].includes(f.pricing_plan))throw Error('Piano tariffario non valido.');
 if(f.pricing_plan==='launch'&&!f.contract_start)throw Error('Inserisci la data di inizio della promozione.');
 await saveRecord(el('propertyForm'),'hdl_properties','propertyId',{client_id:f.client_id,name:f.name.trim(),region:f.region?.trim()||null,listing_url:f.listing_url?.trim()||null,status:f.status,pricing_plan:f.pricing_plan,contract_start:f.pricing_plan==='launch'?f.contract_start:null});
});
guard(el('feeForm'),async()=>{
 const f=formData(el('feeForm')),p=euroValue(f.payout_owner),c=euroValue(f.cleaning_amount);
 if(!f.property_id)throw Error('Seleziona la proprietà.');
 if(!f.period_start||!f.period_end||f.period_start>f.period_end)throw Error('Controlla le date.');
 if(!Number.isFinite(p)||!Number.isFinite(c)||p<0||c<0||c>p)throw Error('Le pulizie non possono superare l’importo del proprietario.');
 const result=effectiveFee(f.property_id,f.period_start,f.period_end);
 if(result.error)throw Error(result.error);
 if(f.status==='paid'&&!/^\d{4}-\d{2}-\d{2}$/.test(f.paid_at||''))throw Error('Indica la data reale di incasso.');
 await saveRecord(el('feeForm'),'hdl_compensi','feeId',{property_id:f.property_id,period_start:f.period_start,period_end:f.period_end,payout_owner:p,cleaning_amount:c,status:f.status,paid_at:f.status==='paid'?f.paid_at:null});
});

function localDate(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function nextDates(){const d=new Date();d.setHours(12,0,0,0);return Array.from({length:28},(_,i)=>{const x=new Date(d);x.setDate(d.getDate()+i);return x})}

function clearAiDraft(){
 el('aiResult').hidden=true;
 el('aiText').textContent='';
 el('aiStatus').textContent='Usa solo dati della proprietà già salvati. Nessun messaggio inviato o tariffa modificata.';
}
async function runClaude(mode){
 const id=el('toolsProperty').value,concierge=mode==='concierge',btn=el(concierge?'aiConcierge':'aiRadar');
 if(!bearer){el('aiStatus').textContent='Sessione non disponibile: accedi nuovamente.';return}
 if(!properties.some(x=>x.id===id)){el('aiStatus').textContent='Seleziona un immobile.';return}
 if(!propertyTools.some(x=>x.property_id===id)){el('aiStatus').textContent='Salva prima Concierge e Radar per questo immobile.';return}
 const question=el('aiQuestion').value.trim();
 if(concierge&&question.length<2){el('aiStatus').textContent='Scrivi prima la domanda dell’ospite.';el('aiQuestion').focus();return}
 // Restrict this first release to drafting. No model-initiated mutations or guest messages.
 el('aiResult').hidden=true;
 el('aiStatus').textContent='Controllo accesso e collegamento Claude…';
 el('aiConcierge').disabled=true;el('aiRadar').disabled=true;
 try{
  const response=await fetch(BASE+'/functions/v1/hdl-claude-assistant',{
   method:'POST',
   headers:{'Content-Type':'application/json',apikey:KEY,Authorization:'Bearer '+bearer},
   body:JSON.stringify({mode,property_id:id,question:concierge?question:undefined,language:el('aiLanguage').value}),
   cache:'no-store'
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw Error(data?.error||'Errore HTTP '+response.status);
  if(typeof data?.answer!=='string'||!data.answer.trim())throw Error('Nessun testo ricevuto.');
  if(el('toolsProperty').value!==id){el('aiStatus').textContent='La proprietà è cambiata: risposta scartata per sicurezza.';return}
  el('aiText').textContent=data.answer;
  el('aiResult').hidden=false;
  el('aiStatus').textContent='Bozza generata. Verifica i contenuti: non è stato inviato nulla.';
 }catch(err){el('aiStatus').textContent='Claude: '+err.message}
 finally{el('aiConcierge').disabled=false;el('aiRadar').disabled=false}
}
el('aiConcierge').addEventListener('click',()=>runClaude('concierge'));
el('aiRadar').addEventListener('click',()=>runClaude('radar'));
el('aiCopy').addEventListener('click',async()=>{
 const text=el('aiText').textContent;if(!text)return;
 try{await navigator.clipboard.writeText(text);el('aiStatus').textContent='Bozza copiata. Rileggila prima di inviarla.'}
 catch{el('aiStatus').textContent='Copia automatica non disponibile: seleziona il testo manualmente.'}
});

function loadPropertyTools(){
 clearAiDraft();
 el('guidePreview').hidden=true;
 updateShareView();
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

function shareForCurrentProperty(){
 return guestShares.find(x=>x.property_id===el('toolsProperty').value);
}
function shareLink(share){
 return share?'https://hostdalontano.com/strumenti/guida.html?t='+encodeURIComponent(share.share_token):'';
}
function updateShareView(){
 const propertyId=el('toolsProperty').value,exists=properties.some(p=>p.id===propertyId),share=shareForCurrentProperty();
 el('shareUrl').value=shareLink(share);
 el('shareState').textContent=!exists?'Seleziona prima un immobile.':!share?'Non hai creato un link per questa proprietà.':share.is_published?'Guida attiva. Chi conosce il link può leggerla.':'Guida disattivata. Il link non mostra le informazioni.';
 el('createShare').disabled=!exists||!!share;
 el('publishShare').disabled=!share||share.is_published;
 el('disableShare').disabled=!share||!share.is_published;
 el('copyShare').disabled=!share;
 el('openShare').disabled=!share;
 el('rotateShare').disabled=!share;
}
async function reloadGuestShares(){
 guestShares=await call('/rest/v1/hdl_guest_shares?select=property_id,share_token,is_published&limit=500');
 updateShareView();
}
async function shareAction(action){
 const id=el('toolsProperty').value,existing=shareForCurrentProperty();
 if(!properties.some(p=>p.id===id))throw Error('Seleziona prima un immobile.');
 if(action==='create'){
  if(existing)return;
  const saved=await call('/rest/v1/hdl_guest_shares',{method:'POST',body:{property_id:id,is_published:false}});
  if(!Array.isArray(saved)||saved.length!==1)throw Error('Creazione del link non confermata.');
 }
 if(action==='publish'){
  if(!existing||existing.is_published)return;
  if(!propertyTools.some(p=>p.property_id===id))throw Error('Salva prima la guida Concierge di questo immobile.');
  if(!window.confirm('Pubblicare questa guida? Chi ha il link potrà leggere orari, Wi-Fi (nome rete), parcheggio, regole, rifiuti e assistenza. Controlla di non avere inserito dati riservati.'))return;
  const saved=await call('/rest/v1/hdl_guest_shares?property_id=eq.'+encodeURIComponent(id),{method:'PATCH',body:{is_published:true,updated_at:new Date().toISOString()}});
  if(!Array.isArray(saved)||saved.length!==1)throw Error('Attivazione non confermata.');
 }
 if(action==='disable'){
  if(!existing||!existing.is_published)return;
  const saved=await call('/rest/v1/hdl_guest_shares?property_id=eq.'+encodeURIComponent(id),{method:'PATCH',body:{is_published:false,updated_at:new Date().toISOString()}});
  if(!Array.isArray(saved)||saved.length!==1)throw Error('Disattivazione non confermata.');
 }
 if(action==='rotate'){
  if(!existing)return;
  if(!window.confirm('Sostituire il link? Quello precedente smetterà subito di funzionare. La guida resterà nello stato attuale (attiva o disattivata).'))return;
  if(!crypto?.randomUUID)throw Error('Il browser non supporta la creazione sicura di un nuovo link.');
  const saved=await call('/rest/v1/hdl_guest_shares?property_id=eq.'+encodeURIComponent(id),{method:'PATCH',body:{share_token:crypto.randomUUID(),updated_at:new Date().toISOString()}});
  if(!Array.isArray(saved)||saved.length!==1)throw Error('Sostituzione non confermata.');
 }
 await reloadGuestShares();
 status(action==='create'?'Link creato ma non pubblicato.':action==='publish'?'Guida pubblicata: puoi condividere il link.':action==='disable'?'Guida disattivata.':'Link precedente revocato e sostituito.','ok');
}
for(const [name,action] of [['createShare','create'],['publishShare','publish'],['disableShare','disable'],['rotateShare','rotate']]){
 el(name).addEventListener('click',async()=>{
  const b=el(name);b.disabled=true;
  try{await shareAction(action)}catch(err){status('Condivisione: '+err.message,'error');updateShareView()}finally{updateShareView()}
 });
}
el('copyShare').addEventListener('click',async()=>{
 const url=el('shareUrl').value;if(!url)return;
 try{await navigator.clipboard.writeText(url);status('Link copiato. Condividilo solo con gli ospiti interessati.','ok')}
 catch{el('shareUrl').focus();el('shareUrl').select();status('Seleziona e copia il link.','error')}
});
el('openShare').addEventListener('click',()=>{const url=el('shareUrl').value;if(url)window.open(url,'_blank','noopener,noreferrer')});

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