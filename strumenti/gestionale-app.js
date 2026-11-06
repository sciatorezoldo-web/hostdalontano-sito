(()=>{'use strict';
const BASE='https://kgbkevncksvpfgqsvoqg.supabase.co';
const KEY='sb_publishable_Ak6qpHDtfKvrC1VcFCUGtg_QlY-HRLX';
let bearer=null,clients=[],properties=[],fees=[];
const el=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(n)||0);
const status=(msg,type='')=>{el('status').textContent=msg;el('status').dataset.type=type};
const euroValue=s=>Number(String(s).replace(',','.'));
async function call(path,{method='GET',body}={}){
 const h={'apikey':KEY,'Content-Type':'application/json',...(bearer?{'Authorization':'Bearer '+bearer}:{})};
 if(method!=='GET')h.Prefer='return=representation';
 const res=await fetch(BASE+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 const data=await res.json().catch(()=>null);
 if(!res.ok)throw Error(data?.message||data?.msg||data?.error_description||data?.error||'Errore HTTP '+res.status);
 return data;
}
function addCell(row,value){const td=document.createElement('td');td.textContent=String(value??'—');row.append(td)}
function addButton(row,label,fn,style=''){const td=document.createElement('td'),b=document.createElement('button');b.type='button';b.textContent=label;b.className='mini '+style;b.addEventListener('click',fn);td.append(b);row.append(td)}
function empty(tbody,columns){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=columns;td.textContent='Nessun dato ancora inserito';td.className='muted';tr.append(td);tbody.append(tr)}
function option(select,value,label){let o=document.createElement('option');o.value=value;o.textContent=label;select.append(o)}
function formData(form){return Object.fromEntries(new FormData(form).entries())}
function setVisible(yes){el('signInBox').hidden=yes;el('adminBox').hidden=!yes}
function logout(message='Sessione terminata.'){const token=bearer;bearer=null;clients=[];properties=[];fees=[];el('password').value='';setVisible(false);el('loginMessage').textContent=message;if(token)fetch(BASE+'/auth/v1/logout',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+token}}).catch(()=>{})}
async function refresh(){
 [clients,properties,fees]=await Promise.all([
 call('/rest/v1/hdl_clients?select=id,full_name,email,phone,status,notes,created_at&order=created_at.desc&limit=500'),
 call('/rest/v1/hdl_properties?select=id,client_id,name,region,status,listing_url,created_at&order=created_at.desc&limit=500'),
 call('/rest/v1/hdl_compensi?select=id,property_id,period_start,period_end,payout_owner,cleaning_amount,fee_rate,fee_amount,status,paid_at&order=period_start.desc&limit=1000')]);
 render();
}
function render(){
 el('clientsCount').textContent=clients.length;
 el('propertiesCount').textContent=properties.length;
 el('totalFees').textContent=money(fees.reduce((s,f)=>s+Number(f.fee_amount),0));
 el('pendingFees').textContent=money(fees.filter(f=>f.status!=='paid').reduce((s,f)=>s+Number(f.fee_amount),0));
 const owner=el('propertyClient'),prop=el('feeProperty');owner.replaceChildren();prop.replaceChildren();
 option(owner,'','Seleziona un cliente');option(prop,'','Seleziona una proprietà');
 for(const c of clients)option(owner,c.id,c.full_name);
 for(const p of properties)option(prop,p.id,p.name+' · '+(clients.find(c=>c.id===p.client_id)?.full_name||'Cliente'));
 const ct=el('clientsRows');ct.replaceChildren();
 for(const c of clients){const tr=document.createElement('tr');addCell(tr,c.full_name);addCell(tr,c.email||'—');addCell(tr,c.status);addButton(tr,'Modifica',()=>editClient(c));ct.append(tr)}if(!clients.length)empty(ct,4);
 const pt=el('propertiesRows');pt.replaceChildren();
 for(const p of properties){const tr=document.createElement('tr');addCell(tr,p.name);addCell(tr,clients.find(c=>c.id===p.client_id)?.full_name||'—');addCell(tr,p.region||'—');addButton(tr,'Modifica',()=>editProperty(p));pt.append(tr)}if(!properties.length)empty(pt,4);
 const ft=el('feeRows');ft.replaceChildren();
 for(const f of fees){const tr=document.createElement('tr');addCell(tr,properties.find(p=>p.id===f.property_id)?.name||'—');addCell(tr,f.period_start+' → '+f.period_end);addCell(tr,money(f.fee_amount));addCell(tr,({'pending':'Da fatturare','invoiced':'Fatturato','paid':'Incassato'})[f.status]||f.status);addButton(tr,'Modifica',()=>editFee(f));ft.append(tr)}if(!fees.length)empty(ft,5);
}
function openPanel(id){document.querySelectorAll('[data-panel]').forEach(x=>x.hidden=x.id!==id);document.querySelectorAll('[data-open]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.open===id)));el('editor').scrollIntoView({behavior:'smooth',block:'start'})}
function editClient(c){openPanel('clientPanel');el('clientForm').reset();el('clientId').value=c.id;el('clientName').value=c.full_name;el('clientEmail').value=c.email||'';el('clientPhone').value=c.phone||'';el('clientStatus').value=c.status;el('clientNotes').value=c.notes||'';el('clientHeading').textContent='Modifica cliente'}
function editProperty(p){openPanel('propertyPanel');el('propertyForm').reset();el('propertyId').value=p.id;el('propertyClient').value=p.client_id;el('propertyName').value=p.name;el('propertyRegion').value=p.region||'';el('propertyStatus').value=p.status;el('propertyLink').value=p.listing_url||'';el('propertyHeading').textContent='Modifica immobile'}
function editFee(f){openPanel('feePanel');el('feeForm').reset();el('feeId').value=f.id;el('feeProperty').value=f.property_id;el('start').value=f.period_start;el('end').value=f.period_end;el('payout').value=f.payout_owner;el('cleaning').value=f.cleaning_amount;el('feeRate').value=String(Number(f.fee_rate));el('feeStatus').value=f.status;el('feeHeading').textContent='Modifica compenso'}
document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.open;openPanel(id);const form=el(id).querySelector('form');form.reset();form.querySelector('input[type=hidden]').value='';el(({clientPanel:'clientHeading',propertyPanel:'propertyHeading',feePanel:'feeHeading'})[id]).textContent=({clientPanel:'Nuovo cliente',propertyPanel:'Nuovo immobile',feePanel:'Nuovo compenso'})[id]}));
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
el('logout').addEventListener('click',()=>logout());
async function saveRecord(form,table,idField,payload){
 const id=el(idField).value;
 await call('/rest/v1/'+table+(id?'?id=eq.'+encodeURIComponent(id):''),{method:id?'PATCH':'POST',body:payload});
 form.reset();el(idField).value='';await refresh();status('Dati salvati correttamente.','ok');
}
function guard(form,fn){form.addEventListener('submit',async event=>{event.preventDefault();const btn=form.querySelector('[type=submit]');btn.disabled=true;try{await fn()}catch(error){status('Impossibile salvare: '+error.message,'error')}finally{btn.disabled=false}})}
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
el('refresh').addEventListener('click',async()=>{try{await refresh();status('Dati aggiornati.','ok')}catch(err){status(err.message,'error')}});
setVisible(false);
})();