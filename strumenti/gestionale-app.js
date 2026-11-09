(()=>{'use strict';
if(window.top!==window.self){document.documentElement.textContent='';try{window.top.location.href=window.self.location.href}catch(e){}return}
const BASE='https://kgbkevncksvpfgqsvoqg.supabase.co';
const KEY='sb_publishable_Ak6qpHDtfKvrC1VcFCUGtg_QlY-HRLX';
let icalReady=false,bearer=null,refreshToken=null,expiresAt=0,renewing=null,toolsDirty=false,clients=[],properties=[],fees=[],leads=[],propertyTools=[],guestShares=[],siteProjects=[],selectedOccupied=new Set();
const el=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(n)||0);
const status=(msg,type='')=>{el('status').textContent=msg;el('status').dataset.type=type};
const euroValue=s=>Number(String(s).replace(',','.'));
// Rinnovo della sessione: i token restano solo in memoria; un'unica richiesta di rinnovo alla volta, perché Supabase ruota i refresh token.
function storeSession(data){bearer=data.access_token;refreshToken=data.refresh_token||null;expiresAt=Date.now()+(Number(data.expires_in)||3600)*1000}
function renewSession(){
 if(!refreshToken)return Promise.resolve(false);
 if(!renewing)renewing=(async()=>{
  try{
   const res=await fetch(BASE+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:refreshToken}),cache:'no-store'});
   const data=await res.json().catch(()=>null);
   if(!res.ok||!data?.access_token)return false;
   storeSession(data);return true;
  }catch{return false}
 })().finally(()=>{renewing=null});
 return renewing;
}
async function ensureFreshSession(){if(bearer&&refreshToken&&Date.now()>expiresAt-120000)await renewSession()}
async function call(path,{method='GET',body,prefer}={},retried=false){
 await ensureFreshSession();
 const h={'apikey':KEY,'Content-Type':'application/json',...(bearer?{'Authorization':'Bearer '+bearer}:{})};
 if(method!=='GET')h.Prefer=prefer||'return=representation';
 const res=await fetch(BASE+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 const data=await res.json().catch(()=>null);
 if(!res.ok){if(res.status===401&&bearer&&!retried&&await renewSession())return call(path,{method,body,prefer},true);if(res.status===401&&bearer){logout('Sessione scaduta: accedi di nuovo.');throw Error('Sessione scaduta: accedi di nuovo.')}throw Error(data?.message||data?.msg||data?.error_description||data?.error||'Errore HTTP '+res.status)}
 return data;
}
function addCell(row,value){const td=document.createElement('td');td.textContent=String(value??'—');row.append(td)}
function addButton(row,label,fn,style=''){const td=document.createElement('td'),b=document.createElement('button');b.type='button';b.textContent=label;b.className='mini '+style;b.addEventListener('click',fn);td.append(b);row.append(td)}
function empty(tbody,columns){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=columns;td.textContent='Nessun dato ancora inserito';td.className='muted';tr.append(td);tbody.append(tr)}
function option(select,value,label){let o=document.createElement('option');o.value=value;o.textContent=label;select.append(o)}
function formData(form){return Object.fromEntries(new FormData(form).entries())}
function setVisible(yes){el('signInBox').hidden=yes;el('adminBox').hidden=!yes}
function logout(message='Sessione terminata.'){const token=bearer;bearer=null;refreshToken=null;expiresAt=0;toolsDirty=false;clients=[];properties=[];fees=[];leads=[];propertyTools=[];guestShares=[];siteProjects=[];selectedOccupied=new Set();el('password').value='';el('aiQuestion').value='';el('aiText').textContent='';el('aiResult').hidden=true;el('draftRecipient').value='';el('draftSubject').value='';el('draftBody').value='';el('emailPanel').hidden=true;el('shareUrl').value='';el('guidePreview').hidden=true;el('toolIcalAirbnb').value='';el('toolIcalBooking').value='';el('icalStatus').textContent='';el('icalBox').hidden=true;icalReady=false;
 // Clear private data from the DOM, not just from the in-memory arrays.
 const admin=el('adminBox');
 admin.querySelectorAll('tbody').forEach(node=>node.replaceChildren());
 admin.querySelectorAll('td').forEach(node=>node.textContent='');
 admin.querySelectorAll('input:not([type=checkbox]), textarea').forEach(node=>{node.value=''});
 admin.querySelectorAll('select').forEach(node=>{if(['toolsProperty','propertyClient','feeProperty'].includes(node.id))node.replaceChildren()});
 for(const id of ['previewTitle','previewArea','previewIn','previewOut','previewParking','previewWifi','previewRules','previewWaste','previewHelp','aiText','aiStatus','shareState','toolsRadarSummary','toolsSummary'])el(id).textContent='';
 el('toolsCalendar').replaceChildren();el('monthlyChart').replaceChildren();
 el('totalFees').textContent='—';el('pendingFees').textContent='—';
 el('clientsCount').textContent='—';el('propertiesCount').textContent='—';el('leadsCount').textContent='—';el('dueCount').textContent='—';
 setVisible(false);el('loginMessage').textContent=message;if(token)fetch(BASE+'/auth/v1/logout',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+token}}).catch(()=>{})}
// The iCal columns exist only after supabase/proposte/radar-calendari-ical.sql has been run.
const TOOLS_COLUMNS='property_id,checkin_time,checkout_time,parking,wifi_name,house_rules,waste_info,assistance_info,nightly_rate,sale_probability,occupied_dates';
async function loadToolsRows(){
 try{const rows=await call('/rest/v1/hdl_property_tools?select='+TOOLS_COLUMNS+',ical_airbnb,ical_booking&limit=500');icalReady=true;return rows}
 catch(error){if(!bearer)throw error;icalReady=false;return call('/rest/v1/hdl_property_tools?select='+TOOLS_COLUMNS+'&limit=500')}
}
const ICAL_RULES={airbnb:/^https:\/\/(www\.)?airbnb\.[a-z.]{2,8}\//i,booking:/^https:\/\/([a-z0-9-]+\.)*booking\.com\//i};
function icalValue(id,source){const v=el(id).value.trim();if(!v)return null;if(v.length>1000||!ICAL_RULES[source].test(v))throw Error('Il link calendario '+(source==='airbnb'?'Airbnb':'Booking')+' non sembra corretto: copia il link iCal (.ics) dal portale.');return v}
async function syncCalendars(){
 const id=el('toolsProperty').value,btn=el('icalSync'),out=el('icalStatus');
 if(!icalReady){out.textContent='Prima esegui il file SQL dei calendari in Supabase.';return}
 if(!properties.some(x=>x.id===id)){out.textContent='Seleziona un immobile.';return}
 const saved=propertyTools.find(x=>x.property_id===id)||{};
 if((saved.ical_airbnb||'')!==el('toolIcalAirbnb').value.trim()||(saved.ical_booking||'')!==el('toolIcalBooking').value.trim()){out.textContent='Salva prima i link dei calendari con «Salva Concierge e Radar».';return}
 if(!saved.ical_airbnb&&!saved.ical_booking){out.textContent='Inserisci e salva almeno un link calendario.';return}
 btn.disabled=true;out.textContent='Lettura dei calendari in corso…';
 try{
  await ensureFreshSession();
  const response=await fetch(BASE+'/functions/v1/hdl-ical-sync',{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY,Authorization:'Bearer '+bearer},body:JSON.stringify({property_id:id}),cache:'no-store'});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw Error(data?.error||'Errore HTTP '+response.status+(response.status===404?' (funzione non ancora pubblicata in Supabase)':''));
  if(el('toolsProperty').value!==id)return;
  const names={airbnb:'Airbnb',booking:'Booking'};
  const report=Object.entries(data.sources||{}).map(([k,v])=>names[k]+': '+(v.ok?'letto':'errore, '+v.error)).join(' · ');
  if(!data.ok){out.textContent='Calendario NON aggiornato. '+report;return}
  const days=new Set(nextDates().map(localDate)),busy=new Set(Array.isArray(data.busy)?data.busy:[]);
  for(const day of days){if(busy.has(day))selectedOccupied.add(day);else selectedOccupied.delete(day)}
  toolsDirty=true;renderPrivateCalendar();
  out.textContent='Calendario aggiornato dai portali ('+report+'). Controlla le date e premi «Salva Concierge e Radar».';
 }catch(err){out.textContent='Calendari: '+err.message}
 finally{btn.disabled=false}
}
el('icalSync').addEventListener('click',syncCalendars);
async function refresh(){
 [clients,properties,fees,leads,propertyTools,guestShares,siteProjects]=await Promise.all([
 call('/rest/v1/hdl_clients?select=id,full_name,email,phone,status,notes,created_at&order=created_at.desc&limit=500'),
 call('/rest/v1/hdl_properties?select=id,client_id,name,region,status,listing_url,pricing_plan,contract_start,created_at&order=created_at.desc&limit=500'),
 call('/rest/v1/hdl_compensi?select=id,property_id,period_start,period_end,payout_owner,cleaning_amount,fee_rate,fee_amount,status,paid_at&order=period_start.desc&limit=1000'),
 call('/rest/v1/hdl_leads?select=id,full_name,email,location,source,stage,interest,next_follow_up,last_contact_at,notes,created_at&order=created_at.desc&limit=500'),
 loadToolsRows(),
 call('/rest/v1/hdl_guest_shares?select=property_id,share_token,is_published&limit=500'),
 call('/rest/v1/hdl_site_projects?select=*&order=created_at.desc&limit=500')]);
 render();
 const full=[[clients,500,'clienti'],[properties,500,'immobili'],[fees,1000,'compensi'],[leads,500,'contatti']].filter(([list,max])=>list.length>=max).map(([,max,name])=>name+' (max '+max+')');
 if(full.length)status('Attenzione: è stato raggiunto il limite di righe caricate per '+full.join(', ')+'. Alcuni dati potrebbero non essere mostrati.','error');
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
   return filter==='all'||(filter==='site'&&['sito','entrambi'].includes(l.interest))||(filter==='open'&&!closed)||(filter==='closed'&&closed)||(filter==='due'&&!closed&&l.next_follow_up&&l.next_follow_up<=today);
 });
 for(const l of selected){
  const tr=document.createElement('tr');addCell(tr,l.full_name);if(['sito','entrambi'].includes(l.interest)){const tag=document.createElement('span');tag.className='tagSite';tag.textContent=l.interest==='sito'?'Sito':'Sito + gestione';tr.lastChild.append(tag)}addCell(tr,l.location||'—');addCell(tr,stageName[l.stage]||l.stage);
  const dateCell=document.createElement('td');dateCell.textContent=l.next_follow_up||'—';
  if(l.next_follow_up&&l.next_follow_up<=today&&!['won','lost'].includes(l.stage)){dateCell.style.color='#a23a32';dateCell.style.fontWeight='700'}
  tr.append(dateCell);
  addButton(tr,'Modifica',()=>editLead(l));
  if(l.email)addButton(tr,'Email',()=>prepareDraft(l));
  else addCell(tr,'');
  if(['sito','entrambi'].includes(l.interest))addButton(tr,'→ Sito',()=>prefillSite(l));else addButton(tr,'→ Cliente',()=>prefillClient(l));
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
 if(el('toolsPanel').hidden===false&&!toolsDirty)loadPropertyTools();
 const ct=el('clientsRows');ct.replaceChildren();
 for(const c of clients){const tr=document.createElement('tr');addCell(tr,c.full_name);addCell(tr,c.email||'—');addCell(tr,c.status);addButton(tr,'Modifica',()=>editClient(c));ct.append(tr)}if(!clients.length)empty(ct,4);
 const pt=el('propertiesRows');pt.replaceChildren();
 for(const p of properties){const tr=document.createElement('tr');addCell(tr,p.name);addCell(tr,clients.find(c=>c.id===p.client_id)?.full_name||'—');addCell(tr,p.region||'—');addButton(tr,'Modifica',()=>editProperty(p));pt.append(tr)}if(!properties.length)empty(pt,4);
 const ft=el('feeRows');ft.replaceChildren();
 for(const f of fees){const tr=document.createElement('tr');addCell(tr,properties.find(p=>p.id===f.property_id)?.name||'—');addCell(tr,f.period_start+' → '+f.period_end);addCell(tr,money(f.fee_amount));addCell(tr,({'pending':'Da fatturare','invoiced':'Fatturato','paid':'Incassato'})[f.status]||f.status);addButton(tr,'Modifica',()=>editFee(f));ft.append(tr)}if(!fees.length)empty(ft,5);
 renderSites(today);
}
const SITE_STAGES={richiesta:'Richiesta',materiali:'Attesa materiali',costruzione:'In costruzione',revisione:'In revisione',online:'Online',sospeso:'Sospeso'};
const SITE_MATERIALS=[['mat_foto','siteMatFoto'],['mat_testi','siteMatTesti'],['mat_regole','siteMatRegole'],['mat_logo','siteMatLogo'],['mat_dominio','siteMatDominio']];
const SITE_LANGS=[['it','siteLangIt'],['en','siteLangEn'],['de','siteLangDe']];
function addDays(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function renderSites(today){
 const sc=el('siteClient'),sp=el('siteProperty'),keepC=sc.value,keepP=sp.value;sc.replaceChildren();sp.replaceChildren();
 option(sc,'','Nessun cliente (ancora)');option(sp,'','Nessun immobile (ancora)');
 for(const c of clients)option(sc,c.id,c.full_name);
 for(const p of properties)option(sp,p.id,p.name);
 sc.value=clients.some(c=>c.id===keepC)?keepC:'';sp.value=properties.some(p=>p.id===keepP)?keepP:'';
 const building=siteProjects.filter(x=>x.stage==='costruzione').length,waiting=siteProjects.filter(x=>x.stage==='materiali').length;
 const renew=siteProjects.filter(x=>x.renewal_date&&x.renewal_date<=addDays(today,30));
 el('siteSummary').textContent=siteProjects.length?('In costruzione: '+building+' · In attesa di materiali: '+waiting+' · Rinnovi entro 30 giorni: '+renew.length+(renew.length?' ('+renew.map(x=>x.domain||x.title).join(', ')+')':'')):'Nessun sito ancora. Quando un proprietario chiede un sito, crea qui il progetto.';
 el('siteSummary').style.color=renew.length?'#a23a32':'';
 const rows=el('siteRows');rows.replaceChildren();
 for(const x of siteProjects){
  const tr=document.createElement('tr');addCell(tr,x.title);
  addCell(tr,clients.find(c=>c.id===x.client_id)?.full_name||'—');
  addCell(tr,SITE_STAGES[x.stage]||x.stage);
  addCell(tr,SITE_MATERIALS.filter(([k])=>x[k]).length+'/5');
  const due=document.createElement('td');due.textContent=x.due_date||'—';
  if(x.due_date&&x.due_date<today&&!['online','sospeso'].includes(x.stage)){due.style.color='#a23a32';due.style.fontWeight='700'}
  tr.append(due);addButton(tr,'Modifica',()=>editSite(x));rows.append(tr);
 }
 if(!siteProjects.length)empty(rows,6);
}
function editSite(x){
 openPanel('sitePanel');el('siteForm').reset();el('siteId').value=x.id;
 el('siteTitle').value=x.title;el('siteClient').value=x.client_id||'';el('siteProperty').value=x.property_id||'';el('siteStage').value=x.stage;
 for(const [k,id] of SITE_MATERIALS)el(id).checked=!!x[k];
 for(const [code,id] of SITE_LANGS)el(id).checked=(x.languages||[]).includes(code);
 el('siteDomain').value=x.domain||'';el('sitePreview').value=x.preview_url||'';el('siteUrl').value=x.site_url||'';
 el('sitePrice').value=x.price??'';el('sitePayment').value=x.payment_status||'da_pagare';
 el('siteRecurring').value=x.recurring_cost??'';el('siteRenewal').value=x.renewal_date||'';el('siteDue').value=x.due_date||'';el('siteNotes').value=x.notes||'';
 el('siteHeading').textContent='Modifica sito su misura';
}
function prefillSite(l){
 openPanel('sitePanel');el('siteForm').reset();el('siteId').value='';
 el('siteTitle').value='Sito per '+l.full_name+(l.location?' · '+l.location:'');
 const match=clients.find(c=>(l.email&&c.email&&c.email.toLowerCase()===l.email.toLowerCase())||c.full_name.trim().toLowerCase()===l.full_name.trim().toLowerCase());
 el('siteClient').value=match?match.id:'';
 el('siteNotes').value='Dal contatto: '+l.full_name+(l.email?' <'+l.email+'>':'')+(l.notes?'\n'+l.notes:'');
 el('siteHeading').textContent='Nuovo sito su misura';
 if(!match)status('Il progetto non è collegato a un cliente: puoi crearlo dopo l’accordo e collegarlo qui.','ok');
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
function editLead(l){openPanel('leadPanel');el('leadForm').reset();el('leadId').value=l.id;el('leadName').value=l.full_name;el('leadEmail').value=l.email||'';el('leadLocation').value=l.location||'';el('leadSource').value=l.source;el('leadInterest').value=l.interest||'gestione';el('leadStage').value=l.stage;el('leadFollowUp').value=l.next_follow_up||'';el('leadLastContact').value=l.last_contact_at||'';el('leadNotes').value=l.notes||'';el('leadHeading').textContent='Modifica contatto'}
function editClient(c){openPanel('clientPanel');el('clientForm').reset();el('clientId').value=c.id;el('clientName').value=c.full_name;el('clientEmail').value=c.email||'';el('clientPhone').value=c.phone||'';el('clientStatus').value=c.status;el('clientNotes').value=c.notes||'';el('clientHeading').textContent='Modifica cliente'}
function editProperty(p){openPanel('propertyPanel');el('propertyForm').reset();el('propertyId').value=p.id;el('propertyClient').value=p.client_id;el('propertyName').value=p.name;el('propertyRegion').value=p.region||'';el('propertyStatus').value=p.status;el('propertyLink').value=p.listing_url||'';el('propertyPricingPlan').value=p.pricing_plan||'standard';el('propertyContractStart').value=p.contract_start||'';togglePropertyContractDate();el('propertyHeading').textContent='Modifica immobile'}
function editFee(f){openPanel('feePanel');el('feeForm').reset();el('feeId').value=f.id;el('feeProperty').value=f.property_id;el('start').value=f.period_start;el('end').value=f.period_end;el('payout').value=f.payout_owner;el('cleaning').value=f.cleaning_amount;el('feeStatus').value=f.status;togglePaidAt();el('paidAt').value=f.paid_at||'';showEffectiveFee();el('feeHeading').textContent='Modifica compenso'}

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

document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.open;openPanel(id);if(id==='toolsPanel'){loadPropertyTools();return}const form=el(id).querySelector('form');form.reset();form.querySelector('input[type=hidden]').value='';if(id==='propertyPanel')togglePropertyContractDate();if(id==='feePanel'){showEffectiveFee();togglePaidAt();}el(({leadPanel:'leadHeading',clientPanel:'clientHeading',propertyPanel:'propertyHeading',feePanel:'feeHeading',sitePanel:'siteHeading'})[id]).textContent=({leadPanel:'Nuovo contatto interessato',clientPanel:'Nuovo cliente',propertyPanel:'Nuovo immobile',feePanel:'Nuovo compenso',sitePanel:'Nuovo sito su misura'})[id]}));
el('loginForm').addEventListener('submit',async event=>{
 event.preventDefault();el('loginMessage').textContent='Verifico l’accesso…';const b=el('loginButton');b.disabled=true;
 try{
  const email=el('email').value.trim(),password=el('password').value;
  const login=await call('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
  storeSession(login);el('password').value='';
  const approved=await call('/rest/v1/hdl_admin_accounts?select=user_id&limit=1');
  if(!approved.length){logout('Account verificato ma non ancora autorizzato al gestionale.');return}
  setVisible(true);el('who').textContent=login.user?.email||email;
  await refresh();status('Accesso effettuato. I dati vengono caricati dal database privato.','ok');
 }catch(error){logout('Accesso non riuscito: '+error.message)}finally{b.disabled=false}
});
el('testConnection').addEventListener('click',async()=>{const result=el('connectionResult');result.textContent='Controllo connessione in corso…';try{const controller=new AbortController();const timeout=Promise.race([fetch(BASE+'/auth/v1/health',{headers:{apikey:KEY},signal:controller.signal,cache:'no-store'}),new Promise((_,reject)=>setTimeout(()=>{controller.abort();reject(Error('Connessione scaduta'))},9000))]);const response=await timeout;result.textContent=response.ok?'Collegamento Supabase raggiungibile. Ora prova ad accedere.':'Servizio di autenticazione raggiunto, risposta HTTP '+response.status+'.';}catch(err){result.textContent='Non riesco a raggiungere Supabase da questo browser. Verifica la connessione o eventuali blocchi del browser. Dettaglio: '+err.message}});
function csvCell(v){
 const raw=String(v??'');
 const safe=/^[\t\r]|^\s*[=+@-]/.test(raw)?"'"+raw:raw;
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
// Full backup of everything loaded in the dashboard, as one JSON file kept by the owner.
function downloadBackup(){
 if(!bearer){status('Accedi prima di scaricare la copia di sicurezza.','error');return}
 const now=new Date();
 const stamp=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const data={formato:'host-da-lontano-backup',versione:1,creato_il:now.toISOString(),
  conteggi:{clienti:clients.length,immobili:properties.length,compensi:fees.length,contatti:leads.length,strumenti_immobili:propertyTools.length,guide_ospiti:guestShares.length,siti:siteProjects.length},
  hdl_clients:clients,hdl_properties:properties,hdl_compensi:fees,hdl_leads:leads,hdl_property_tools:propertyTools,hdl_guest_shares:guestShares,hdl_site_projects:siteProjects};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download='host-da-lontano-backup-'+stamp+'.json';
 document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 status('Copia di sicurezza scaricata. Contiene dati personali e i link delle guide: conservala in un posto privato, non condividerla.','ok');
}
el('backup').addEventListener('click',downloadBackup);
el('leadFilter').addEventListener('change',render);
el('openDraftEmail').addEventListener('click',()=>{
 const email=el('draftRecipient').value.trim(),sub=el('draftSubject').value.trim(),body=el('draftBody').value;
 if(!/^[^\s@?&#,;]+@[^\s@?&#,;]+\.[^\s@?&#,;]+$/.test(email)){status('L’indirizzo del destinatario non è valido.','error');return}
 window.location.href='mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent(sub)+'&body='+encodeURIComponent(body);
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
 await saveRecord(el('leadForm'),'hdl_leads','leadId',{full_name:f.full_name.trim(),email:f.email?.trim()||null,location:f.location?.trim()||null,source:f.source,stage:f.stage,interest:['gestione','sito','entrambi'].includes(f.interest)?f.interest:'gestione',next_follow_up:f.next_follow_up||null,last_contact_at:f.last_contact_at||null,notes:f.notes?.trim()||null});
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
guard(el('siteForm'),async()=>{
 const f=formData(el('siteForm'));if(!f.title?.trim())throw Error('Scrivi il nome del progetto.');
 const langs=SITE_LANGS.filter(([,id])=>el(id).checked).map(([code])=>code);if(!langs.length)throw Error('Scegli almeno una lingua.');
 const num=v=>{if(v===undefined||v==='')return null;const n=Number(v);if(!Number.isFinite(n)||n<0||n>100000)throw Error('Controlla gli importi.');return Math.round(n*100)/100};
 const url=v=>{v=(v||'').trim();if(!v)return null;if(!/^https?:\/\//i.test(v))throw Error('I link devono iniziare con https://');return v};
 if(!Object.keys(SITE_STAGES).includes(f.stage)||!['da_pagare','acconto','pagato'].includes(f.payment_status))throw Error('Valori non validi.');
 const payload={title:f.title.trim(),client_id:f.client_id||null,property_id:f.property_id||null,stage:f.stage,languages:langs,
  domain:f.domain?.trim().toLowerCase()||null,preview_url:url(f.preview_url),site_url:url(f.site_url),
  price:num(f.price),payment_status:f.payment_status,recurring_cost:num(f.recurring_cost),renewal_date:f.renewal_date||null,due_date:f.due_date||null,
  notes:f.notes?.trim()||null,updated_at:new Date().toISOString()};
 for(const [k,id] of SITE_MATERIALS)payload[k]=el(id).checked;
 await saveRecord(el('siteForm'),'hdl_site_projects','siteId',payload);
});
guard(el('feeForm'),async()=>{
 const f=formData(el('feeForm')),p=euroValue(f.payout_owner),c=euroValue(f.cleaning_amount);
 if(!f.property_id)throw Error('Seleziona la proprietà.');
 if(!f.period_start||!f.period_end||f.period_start>f.period_end)throw Error('Controlla le date.');
 if(!Number.isFinite(p)||p<=0)throw Error('Inserisci un importo per il proprietario maggiore di zero.');
 if(!Number.isFinite(c)||c<0)throw Error('L’importo delle pulizie non può essere negativo.');
 if(c>p)throw Error('Le pulizie non possono superare l’importo del proprietario.');
 const overlap=fees.find(x=>x.property_id===f.property_id&&String(x.id)!==String(f.id||el('feeId').value)&&x.period_start<=f.period_end&&x.period_end>=f.period_start);
 if(overlap)throw Error('Esiste già un compenso per questa proprietà nel periodo '+overlap.period_start+' – '+overlap.period_end+'.');
 const result=effectiveFee(f.property_id,f.period_start,f.period_end);
 if(result.error)throw Error(result.error);
 if(f.status==='paid'&&!/^\d{4}-\d{2}-\d{2}$/.test(f.paid_at||''))throw Error('Indica la data reale di incasso.');
 if(f.status==='paid'){const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());if(f.paid_at>today)throw Error('La data di incasso non può essere nel futuro.');if(f.paid_at<f.period_start)throw Error('La data di incasso non può essere prima dell’inizio del periodo.');}
 await saveRecord(el('feeForm'),'hdl_compensi','feeId',{property_id:f.property_id,period_start:f.period_start,period_end:f.period_end,payout_owner:p,cleaning_amount:c,status:f.status,paid_at:f.status==='paid'?f.paid_at:null});
});

// Radar dates follow the Italian calendar (Europe/Rome), the same as the server function.
function localDate(d){return [d.getUTCFullYear(),String(d.getUTCMonth()+1).padStart(2,'0'),String(d.getUTCDate()).padStart(2,'0')].join('-')}
function nextDates(){const p=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).split('-').map(Number);return Array.from({length:28},(_,i)=>new Date(Date.UTC(p[0],p[1]-1,p[2]+i,12)))}

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
  await ensureFreshSession();
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
 toolsDirty=false;
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
 el('toolIcalAirbnb').value=t.ical_airbnb||'';el('toolIcalBooking').value=t.ical_booking||'';el('icalStatus').textContent=icalReady?'':'Collegamento calendari non ancora attivo: serve il file SQL in Supabase.';el('icalBox').hidden=!icalReady;
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
 const dates=nextDates();const labelFormat=new Intl.DateTimeFormat('it-IT',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'});
 for(const d of dates){
  const key=localDate(d),b=document.createElement('button');b.type='button';b.className='privateDay';
  const short=document.createElement('small');short.textContent=new Intl.DateTimeFormat('it-IT',{timeZone:'UTC',weekday:'short'}).format(d);
  const num=document.createElement('span');num.textContent=String(d.getUTCDate());
  b.append(short,num);
  b.setAttribute('aria-pressed',String(selectedOccupied.has(key)));
  b.setAttribute('aria-label',labelFormat.format(d)+' · '+(selectedOccupied.has(key)?'occupato':'libero'));
  b.addEventListener('click',()=>{if(selectedOccupied.has(key))selectedOccupied.delete(key);else selectedOccupied.add(key);toolsDirty=true;renderPrivateCalendar()});
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
el('toolsForm').addEventListener('input',event=>{if(!event.target.closest('#sharePanel')&&event.target.id!=='aiQuestion'&&event.target.id!=='aiLanguage')toolsDirty=true});
// Invio in un campo di testo non deve salvare la scheda per errore (il modulo contiene anche link e sezione Claude).
el('toolsForm').addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.tagName==='INPUT')event.preventDefault()});
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
 if(icalReady){try{payload.ical_airbnb=icalValue('toolIcalAirbnb','airbnb');payload.ical_booking=icalValue('toolIcalBooking','booking')}catch(error){status(error.message,'error');return}}
 btn.disabled=true;
 try{
  const saved=await call('/rest/v1/hdl_property_tools?on_conflict=property_id',{method:'POST',body:payload,prefer:'resolution=merge-duplicates,return=representation'});
  if(!Array.isArray(saved)||saved.length!==1)throw Error('Il database non ha confermato le impostazioni.');
  toolsDirty=false;await refresh();el('toolsProperty').value=id;loadPropertyTools();status('Concierge e Radar salvati per questo immobile.','ok');
 }catch(error){status('Errore salvataggio strumenti: '+error.message,'error')}
 finally{btn.disabled=false}
});

el('refresh').addEventListener('click',async()=>{
 const btn=el('refresh'),label='Aggiorna dati';btn.disabled=true;btn.textContent='Aggiorno…';
 try{await refresh();const time=new Intl.DateTimeFormat('it-IT',{hour:'2-digit',minute:'2-digit'}).format(new Date());status('Dati aggiornati alle '+time+'.','ok');btn.textContent='Aggiornato ✓'}
 catch(err){status('Aggiornamento non riuscito: '+err.message,'error');btn.textContent='Errore, riprova';el('status').scrollIntoView({behavior:'smooth',block:'center'})}
 finally{btn.disabled=false;setTimeout(()=>{btn.textContent=label},2500)}
});
setVisible(false);
})();