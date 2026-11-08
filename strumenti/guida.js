(function(){
'use strict';
if(window.top!==window.self){document.documentElement.textContent='';return}
var base='https://kgbkevncksvpfgqsvoqg.supabase.co';
var apiKey='sb_publishable_Ak6qpHDtfKvrC1VcFCUGtg_QlY-HRLX';
var token=new URLSearchParams(window.location.search).get('t')||'';
var uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var el=function(id){return document.getElementById(id)};
var missing=function(){el('loading').hidden=true;el('unavailable').hidden=false;el('guide').hidden=true};
if(!uuid.test(token)){missing();return}
fetch(base+'/rest/v1/rpc/hdl_read_guest_guide',{
 method:'POST',headers:{'apikey':apiKey,'Content-Type':'application/json'},
 body:JSON.stringify({guide_token:token}),cache:'no-store',referrerPolicy:'no-referrer'
}).then(function(response){if(!response.ok)throw Error('Guida non disponibile');return response.json()})
.then(function(list){
 if(!Array.isArray(list)||list.length!==1){missing();return}
 var g=list[0];
 var mapping={title:g.guest_name,area:g.guest_area,checkin:g.check_in,checkout:g.check_out,parking:g.guest_parking,wifi:g.guest_wifi,rules:g.guest_rules,waste:g.guest_waste,assistance:g.guest_assistance};
 Object.keys(mapping).forEach(function(id){el(id).textContent=mapping[id]||'Informazione da confermare con la struttura'});
 document.title=(g.guest_name||'Guida ospiti')+' · Host da Lontano';
 el('loading').hidden=true;el('guide').hidden=false;
}).catch(missing);
el('printGuide').addEventListener('click',function(){window.print()});
})();
