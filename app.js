const uid=()=>crypto.randomUUID();
const pages=[...document.querySelectorAll('.page')];
const $=id=>document.getElementById(id);
let pestMap={};
function go(id){pages.forEach(x=>x.classList.toggle('active',x.id===id));if(id==='inspection'){loadProperties();loadPests()}if(id==='records')renderRecords();if(id==='settings')loadSettings()}
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));document.querySelectorAll('.back').forEach(b=>b.onclick=()=>go('home'));
function fmtDate(v){if(!v)return 'nunca';try{return new Date(v).toLocaleString('pt-BR')}catch{return v}}
async function dashboard(){const [ps,pests,q,meta]=await Promise.all([all('properties'),all('pests'),all('queue'),getOne('meta','bootstrap')]);$('pending').textContent=q.length+' pendentes';$('summary').innerHTML=`<b>${navigator.onLine?'🟢 Online':'🔴 Offline'}</b><br>${ps.length} propriedades disponíveis offline<br>${pests.length} pragas disponíveis offline<br>${q.length} registro(s) aguardando envio<br><small>Última atualização dos cadastros: ${fmtDate(meta?.at)}</small>`}
function network(){$('net').textContent=navigator.onLine?'🟢 online':'🔴 offline';dashboard()}addEventListener('online',network);addEventListener('offline',network);
function loadSettings(){$('apiUrl').value=APP_CONFIG.API_URL;$('apiToken').value=APP_CONFIG.API_TOKEN}
$('settingsForm').onsubmit=e=>{e.preventDefault();let url=$('apiUrl').value.trim().replace(/\/+$/,'');if(!url.endsWith('/exec'))return alert('A URL precisa terminar em /exec.');APP_CONFIG.save(url,$('apiToken').value);alert('Configuração salva neste dispositivo.');go('home')};
$('testApiBtn').onclick=async()=>{if(!$('apiUrl').value||!$('apiToken').value)return alert('Informe URL e token.');APP_CONFIG.save($('apiUrl').value.trim().replace(/\/+$/,''),$('apiToken').value);try{const r=await fetch(`${APP_CONFIG.API_URL}?action=pests&token=${encodeURIComponent(APP_CONFIG.API_TOKEN)}`);const a=await r.json();if(!a.ok)throw new Error(a.message||'Falha');alert(`Conexão OK. ${a.data?.length||0} pragas recebidas.`)}catch(e){alert('Falha na conexão: '+e.message)}};
$('gpsBtn').onclick=()=>navigator.geolocation.getCurrentPosition(p=>$('gps').value=`${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}`,e=>alert('Não foi possível obter o GPS: '+e.message),{enableHighAccuracy:true});
$('propertyForm').onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));const id=uid();const rec={id,ID_Propriedade:id.slice(0,8),...data,UUID:id,Data_Criacao:new Date().toISOString(),Data_Sincronizacao:'',Status_Registro:'PENDENTE',Versao:1,_source:'local'};await put('properties',rec);await put('queue',{id,type:'property',recordId:id,createdAt:new Date().toISOString(),attempts:0});e.target.reset();await dashboard();alert('Propriedade salva neste aparelho.');go('home')};
async function loadProperties(){

  const ps = await all('properties');

  const select = $('propertySelect');

  select.innerHTML =
    '<option value="">Selecione…</option>';

  ps.sort((a,b)=>
    String(a.Nome_Propriedade || '')
      .localeCompare(
        String(b.Nome_Propriedade || '')
      )
  );

  ps.forEach(p => {

    const option = new Option(
      `${p.Nome_Propriedade || p.ID_Propriedade} — ${p.Produtor_Responsável || ''}`,
      p.ID_Propriedade
    );

    select.add(option);
  });


  // Quando selecionar uma propriedade,
  // carrega somente as culturas cadastradas nela.
  select.onchange = async () => {

    const selectedId = select.value;

    const box = $('cultureOptions');

    box.innerHTML = '';

    if (!selectedId) {
      box.innerHTML =
        '<small>Selecione primeiro uma propriedade.</small>';
      return;
    }


    const propriedades =
      await all('properties');

    const propriedade =
      propriedades.find(p =>
        String(p.ID_Propriedade) ===
        String(selectedId)
      );


    if (!propriedade) {
      box.innerHTML =
        '<small>Propriedade não encontrada.</small>';
      return;
    }


    const culturas =
      String(
        propriedade.Culturas_Cultivadas || ''
      )
      .split(/[,;]+/)
      .map(c => c.trim())
      .filter(Boolean);


    if (!culturas.length) {
      box.innerHTML =
        '<small>Esta propriedade não possui culturas cadastradas.</small>';
      return;
    }


    // Remove duplicidades.
    const culturasUnicas =
      [...new Set(culturas)];


    culturasUnicas.forEach(cultura => {

      const label =
        document.createElement('label');

      label.className =
        'check-option';


      const checkbox =
        document.createElement('input');

      checkbox.type =
        'checkbox';

      checkbox.name =
        'Cultura_Afetada';

      checkbox.value =
        cultura;


      label.appendChild(checkbox);

      label.appendChild(
        document.createTextNode(
          ' ' + cultura
        )
      );

      box.appendChild(label);
    });

  };

}
async function loadPests(){const pests=await all('pests');pestMap={};$('pestSelect').innerHTML='<option value="">Selecione…</option>';pests.sort((a,b)=>String(a.Nome_Da_Praga).localeCompare(String(b.Nome_Da_Praga))).forEach(p=>{pestMap[p.Nome_Da_Praga]=p['Legislação']||'';$('pestSelect').add(new Option(p.Nome_Da_Praga,p.Nome_Da_Praga))});$('pestSelect').onchange=()=>$('legislation').value=pestMap[$('pestSelect').value]||''}
$('inspectionForm').onsubmit=async e=>{e.preventDefault();const fd = new FormData(e.target);
const data = {};

for (const [k,v] of fd) {

  if (
    k !== 'Foto_Evidenciada' &&
    k !== 'Cultura_Afetada'
  ) {
    data[k] = v;
  }

}

data.Cultura_Afetada =
  fd.getAll('Cultura_Afetada').join(', ');
const file=fd.get('Foto_Evidenciada');const id=uid();const rec={id,ID_Fiscalização:'TF_'+id.slice(0,8),...data,Foto_Evidenciada:file&&file.size?file:null,UUID:id,Data_Hora:new Date().toISOString(),Data_Criacao:new Date().toISOString(),Data_Sincronizacao:'',Status_Registro:'PENDENTE',Versao:1,_source:'local'};await put('inspections',rec);await put('queue',{id,type:'inspection',recordId:id,createdAt:new Date().toISOString(),attempts:0});e.target.reset();$('legislation').value='';await dashboard();alert('Fiscalização salva offline.');go('home')};
async function renderRecords(){const ps=await all('properties'),ins=await all('inspections');$('recordList').innerHTML=[...ins.map(x=>`<div class='card ${x.Status_Registro==='SINCRONIZADO'?'synced':''}'><b>${x.ID_Fiscalização}</b><br>${x.Praga_Alvo||'Sem praga'} · ${fmtDate(x.Data_Hora)}<br><small>${x.Status_Registro||'CADASTRO CENTRAL'}</small></div>`),...ps.map(x=>`<div class='card ${x.Status_Registro==='SINCRONIZADO'?'synced':''}'><b>${x.Nome_Propriedade||x.ID_Propriedade}</b><br>${x.Produtor_Responsável||''}<br><small>${x.Status_Registro||'CADASTRO CENTRAL'}</small></div>`)].join('')||'<p>Nenhum registro local.</p>'}
function blobToDataURL(blob){return new Promise((ok,fail)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>fail(r.error);r.readAsDataURL(blob)})}
async function serializableRecord(rec){const copy={...rec};delete copy.id;delete copy._source;if(copy.Foto_Evidenciada instanceof Blob)copy.Foto_Evidenciada=await blobToDataURL(copy.Foto_Evidenciada);else if(!String(copy.Foto_Evidenciada||'').startsWith('data:'))copy.Foto_Evidenciada=null;return copy}
async function bootstrap(){const res=await fetch(`${APP_CONFIG.API_URL}?action=bootstrap&token=${encodeURIComponent(APP_CONFIG.API_TOKEN)}`);const ans=await res.json();if(!ans.ok)throw new Error(ans.message||'Falha no bootstrap');const pendingProps=new Set((await all('queue')).filter(x=>x.type==='property').map(x=>x.recordId));for(const p of ans.data.propriedades||[]){const existing=(await all('properties')).find(x=>String(x.ID_Propriedade)===String(p.ID_Propriedade));if(existing&&pendingProps.has(existing.id))continue;await put('properties',{...p,id:existing?.id||`central:${p.ID_Propriedade}`,_source:'central'})}await clearStore('pests');for(const p of ans.data.pragas||[])await put('pests',{...p,id:p.Nome_Da_Praga});await put('meta',{id:'bootstrap',at:ans.generatedAt||new Date().toISOString(),version:ans.version});}
async function syncAll(){if(!navigator.onLine)return alert('Sem internet. Os dados continuam salvos neste aparelho.');if(!APP_CONFIG.API_URL||!APP_CONFIG.API_TOKEN){go('settings');return alert('Configure primeiro a URL da API e o token.')}const btn=$('syncBtn');btn.disabled=true;const old=btn.textContent;let ok=0,fail=0;try{const q=(await all('queue')).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));for(const item of q){const store=item.type==='property'?'properties':'inspections';const rec=await getOne(store,item.recordId);if(!rec){await remove('queue',item.id);continue}rec.Status_Registro='SINCRONIZANDO';await put(store,rec);try{const payload={token:APP_CONFIG.API_TOKEN,type:item.type,record:await serializableRecord(rec)};const res=await fetch(APP_CONFIG.API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});const ans=await res.json();if(!ans.ok)throw new Error(ans.message||'Servidor recusou o registro');rec.Status_Registro='SINCRONIZADO';

if(item.type==='property' && ans.id){
  rec.ID_Propriedade=ans.id;
}

if(item.type==='inspection' && ans.id){
  rec.ID_Fiscalização=ans.id;
}

if(item.type==='inspection' && ans.propertyId){
  rec.ID_Propriedade=ans.propertyId;
}

rec.Data_Sincronizacao=ans.syncedAt||new Date().toISOString();if(ans.photoUrl)rec.Foto_URL=ans.photoUrl;await put(store,rec);await remove('queue',item.id);ok++}catch(err){rec.Status_Registro='PENDENTE';await put(store,rec);item.attempts=(item.attempts||0)+1;item.lastError=String(err.message||err);await put('queue',item);fail++}}await bootstrap();await loadPests();await dashboard();alert(`Sincronização concluída. ${ok} envio(s) confirmado(s), ${fail} com erro. Cadastros offline atualizados.`)}catch(e){alert('Falha na sincronização: '+e.message)}finally{btn.disabled=false;btn.textContent=old}}
$('syncBtn').onclick=syncAll;
if('serviceWorker'in navigator)navigator.serviceWorker.register('service-worker.js');network();loadPests();
