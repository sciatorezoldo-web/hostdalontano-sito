(function(){
'use strict';
if(window.top!==window.self){document.documentElement.textContent='';return}
var base='https://kgbkevncksvpfgqsvoqg.supabase.co';
var apiKey='sb_publishable_Ak6qpHDtfKvrC1VcFCUGtg_QlY-HRLX';
var params=new URLSearchParams(window.location.search);
var token=params.get('t')||'';
var uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var el=function(id){return document.getElementById(id)};

var T={
 it:{eyebrow:'Benvenuti · Guida digitale',loading:'Caricamento della guida…',unavailable:'Questa guida non è disponibile. Il link potrebbe essere stato disattivato o sostituito. Per informazioni, contatta il referente della struttura attraverso il canale concordato nella prenotazione.',arrival:'Arrivo e partenza',directions:'Come arrivare',maps:'Apri la mappa',parking:'Parcheggio',wifi:'Wi-Fi · nome rete',wifiNote:'Per la password fai riferimento alle istruzioni comunicate dalla struttura.',rules:'Regole della casa',waste:'Rifiuti e raccolta differenziata',tips:'Consigli sulla zona',departure:'Prima di partire',emergency:'Numeri utili ed emergenze',emergencyNote:'In caso di emergenza chiama il 112, numero unico europeo.',assistance:'Assistenza',disclaimer:'Le informazioni sono fornite dal gestore della struttura. In caso di emergenza, usa i numeri di emergenza locali e le indicazioni ufficiali.',print:'Stampa o salva questa guida',footer:'Host da Lontano · Guida accessibile soltanto tramite link attivo',missing:'Informazione da confermare con la struttura',fallback:'Alcune informazioni sono disponibili solo in italiano.',title:'Guida ospiti'},
 en:{eyebrow:'Welcome · Digital guide',loading:'Loading the guide…',unavailable:'This guide is not available. The link may have been deactivated or replaced. For information, contact the property through the channel agreed in your booking.',arrival:'Arrival and departure',directions:'How to get here',maps:'Open the map',parking:'Parking',wifi:'Wi-Fi · network name',wifiNote:'For the password, please follow the instructions provided by the property.',rules:'House rules',waste:'Rubbish and recycling',tips:'Tips for the area',departure:'Before you leave',emergency:'Useful numbers and emergencies',emergencyNote:'In an emergency call 112, the European emergency number.',assistance:'Assistance',disclaimer:'This information is provided by the property manager. In an emergency, use local emergency numbers and follow official instructions.',print:'Print or save this guide',footer:'Host da Lontano · Guide available only through an active link',missing:'To be confirmed with the property',fallback:'Some information is only available in Italian.',title:'Guest guide'},
 de:{eyebrow:'Willkommen · Digitaler Gästeführer',loading:'Gästeführer wird geladen…',unavailable:'Dieser Gästeführer ist nicht verfügbar. Der Link wurde möglicherweise deaktiviert oder ersetzt. Bitte kontaktieren Sie die Unterkunft über den in der Buchung vereinbarten Kanal.',arrival:'Anreise und Abreise',directions:'Anfahrt',maps:'Karte öffnen',parking:'Parken',wifi:'WLAN · Netzwerkname',wifiNote:'Das Passwort finden Sie in den Hinweisen der Unterkunft.',rules:'Hausregeln',waste:'Müll und Mülltrennung',tips:'Tipps für die Umgebung',departure:'Vor der Abreise',emergency:'Wichtige Nummern und Notfälle',emergencyNote:'Im Notfall wählen Sie 112, die europäische Notrufnummer.',assistance:'Hilfe',disclaimer:'Die Informationen stammen von der Verwaltung der Unterkunft. Im Notfall nutzen Sie die örtlichen Notrufnummern und folgen Sie den offiziellen Anweisungen.',print:'Gästeführer drucken oder speichern',footer:'Host da Lontano · Nur über einen aktiven Link zugänglich',missing:'Bitte bei der Unterkunft erfragen',fallback:'Einige Informationen sind nur auf Italienisch verfügbar.',title:'Gästeführer'}
};
var LANGS=['it','en','de'];
var guessed=(navigator.language||'it').slice(0,2).toLowerCase();
var lang=LANGS.indexOf(params.get('lang'))>=0?params.get('lang'):LANGS.indexOf(guessed)>=0?guessed:'en';
var guide=null;

function text(v){return typeof v==='string'?v.trim():''}
// Italian base fields come from the original columns; the rest from guide_extra[lang].
function field(key,baseValue){
 var extra=(guide&&guide.guest_extra&&typeof guide.guest_extra==='object')?guide.guest_extra:{};
 var local=extra[lang]&&typeof extra[lang]==='object'?text(extra[lang][key]):'';
 if(local)return {value:local,fallback:false};
 var it=lang==='it'?'':(extra.it&&typeof extra.it==='object'?text(extra.it[key]):'');
 var original=text(baseValue)||it||(extra.it&&typeof extra.it==='object'?text(extra.it[key]):'');
 return {value:original,fallback:lang!=='it'&&!!original};
}
function applyLabels(){
 var t=T[lang];document.documentElement.lang=lang;
 document.querySelectorAll('[data-i18n]').forEach(function(n){var k=n.getAttribute('data-i18n');if(t[k])n.textContent=t[k]});
 document.querySelectorAll('[data-lang]').forEach(function(b){b.setAttribute('aria-pressed',String(b.getAttribute('data-lang')===lang))});
}
function render(){
 applyLabels();
 if(!guide)return;
 var t=T[lang],usedFallback=false;
 el('title').textContent=text(guide.guest_name)||t.title;
 el('area').textContent=text(guide.guest_area);
 el('checkin').textContent=text(guide.check_in)||'—';
 el('checkout').textContent=text(guide.check_out)||'—';
 el('wifi').textContent=text(guide.guest_wifi)||t.missing;
 var sections=[
  ['parking','parking',guide.guest_parking,'boxParking',true],
  ['rules','rules',guide.guest_rules,'boxRules',true],
  ['waste','waste',guide.guest_waste,'boxWaste',true],
  ['assistance','assistance',guide.guest_assistance,'boxAssistance',true],
  ['directions','directions','','boxDirections',false],
  ['tips','tips','','boxTips',false],
  ['departure','departure','','boxDeparture',false],
  ['emergency','emergency','','boxEmergency',false]
 ];
 sections.forEach(function(s){
  var f=field(s[1],s[2]);
  if(f.fallback)usedFallback=true;
  el(s[0]).textContent=f.value||(s[4]?t.missing:'');
  // Optional new sections are hidden when empty; emergency always shows the 112 note.
  el(s[3]).hidden=!f.value&&!s[4]&&s[0]!=='emergency'&&!(s[0]==='directions'&&mapsUrl());
 });
 var m=mapsUrl();el('mapsBox').hidden=!m;if(m)el('mapsLink').href=m;
 el('langNote').hidden=!usedFallback;el('langNote').textContent=t.fallback;
 document.title=(text(guide.guest_name)||t.title)+' · Host da Lontano';
}
function mapsUrl(){
 var u=guide&&text(guide.guest_maps_url);
 if(!u)return '';
 try{var parsed=new URL(u);return parsed.protocol==='https:'?parsed.href:''}catch(e){return ''}
}
function missing(){applyLabels();el('loading').hidden=true;el('unavailable').hidden=false;el('guide').hidden=true}

document.querySelectorAll('[data-lang]').forEach(function(b){b.addEventListener('click',function(){
 lang=b.getAttribute('data-lang');
 render();
})});
el('printGuide').addEventListener('click',function(){window.print()});
applyLabels();
if(!uuid.test(token)){missing();return}

function load(fn){
 return fetch(base+'/rest/v1/rpc/'+fn,{
  method:'POST',headers:{'apikey':apiKey,'Content-Type':'application/json'},
  body:JSON.stringify({guide_token:token}),cache:'no-store',referrerPolicy:'no-referrer'
 });
}
// The v2 reader adds map and translations; if it is not installed yet, use the original one.
load('hdl_read_guest_guide_v2').then(function(r){return r.status===404?load('hdl_read_guest_guide'):r})
.then(function(response){if(!response.ok)throw Error('Guida non disponibile');return response.json()})
.then(function(list){
 if(!Array.isArray(list)||list.length!==1||!list[0]||typeof list[0]!=='object'){missing();return}
 guide=list[0];
 el('loading').hidden=true;el('guide').hidden=false;
 render();
}).catch(missing);
})();
