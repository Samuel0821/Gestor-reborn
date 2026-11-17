const electron=require('electron'),Module=require('node:module');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const directory=process.env.GESTORFX_INSTALL_TEST_DIRECTORY;
if(!directory||!path.basename(directory).startsWith('test-installation-'))throw Error('Missing isolated directory');
fs.mkdirSync(path.join(directory,'profile'),{recursive:true});electron.app.setPath('userData',path.join(directory,'profile'));
electron.app.disableHardwareAcceleration();
const resume=process.argv.includes('--resume'), bootstrap=process.argv.includes('--bootstrap');
process.env.GESTORFX_FRESH_INSTALL=resume||bootstrap?'0':'1';
delete process.env.GESTORFX_SERVER_MODE;delete process.env.GESTORFX_API_URL;
process.env.GESTORFX_DATABASE_PATH=path.join(directory,'database.sqlite');
if(resume||bootstrap)fs.writeFileSync(path.join(directory,'profile','gestorfx-network.json'),JSON.stringify({apiUrl:'https://gestor-station-test.local:47821'}));
let win,activated=resume,remoteLogins=0,serverReady=!bootstrap,serverActivated=false,localActivations=0;
const customerId='11111111-1111-4111-8111-111111111111';
const fakeLicensing={
 getLicenseState:(dir,kind)=>({valid:activated&&(!kind||kind==='station'),payload:activated?{kind:'station',cid:customerId}:null}),
 activate:async(dir,code,version,kind,context)=>{assert.equal(kind,'station');assert.equal(context.expectedCustomerId,customerId);assert.equal(code,'GFX-AAAA-BBBB-CCCC-DDDD');localActivations++;activated=true;return{success:true,kind:'station'};},
 registerCustomer:async()=>{}, checkStatus:async()=>{},
};
class HiddenWindow extends electron.BrowserWindow{constructor(options){super({...options,show:false,webPreferences:{...options.webPreferences,offscreen:true,backgroundThrottling:false}});win=this;}}
const load=Module._load;
Module._load=function(name,parent,...args){
 if(name==='electron')return{...electron,BrowserWindow:HiddenWindow};
 if(name==='./licensing'&&parent?.filename===path.resolve(__dirname,'../src/index.js'))return fakeLicensing;
 return load.call(this,name,parent,...args);
};
electron.app.whenReady().then(async()=>{
  electron.session.defaultSession.protocol.handle('https',async request=>{
   const url=new URL(request.url);const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
   if(url.hostname!=='gestor-station-test.local')return new Response('',{status:404});
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
   if(url.pathname==='/health')return new Response(JSON.stringify({service:'GestorFX',installationCompleted:serverReady,serverKind:serverReady?'server':null,customerId:serverReady?customerId:null}),{headers});
   if(url.pathname==='/rpc'){
    const body=await request.json();let result={};
    if(body.channel==='get-installation-state')result={completed:serverReady};
    if(body.channel==='get-license-state')result={activated:serverActivated,kind:serverActivated?'server':null,requiredKind:'server'};
    if(body.channel==='get-business-types')result=[{id:1,name:'Comercio'}];
    if(body.channel==='activate-license'){assert.equal(body.args[0].kind,'server');serverActivated=true;result={success:true,kind:'server'};}
    if(body.channel==='save-initial-setup'){serverReady=true;result={success:true};}
    if(body.channel==='login'){remoteLogins++;result={success:false,message:'Respuesta remota de prueba'};}
    return new Response(JSON.stringify({result}),{headers});
   }
   return new Response('{}',{headers});
  });
});
require('../src/index.js');
if(!resume&&!bootstrap)fs.writeFileSync(path.join(directory,'fresh-path.txt'),path.dirname(process.env.GESTORFX_DATABASE_PATH));
electron.app.whenReady().then(async()=>{
 try{
  const until=async fn=>{for(let i=0;i<250;i++){if(await fn())return;await new Promise(r=>setTimeout(r,30));}throw Error('Station UI timeout');};
  const js=code=>win.webContents.executeJavaScript(code);
  await until(()=>win&&!win.webContents.isLoading());
  if(!resume){
   await until(()=>js('Boolean(window.api && document.getElementById("installation-kind"))'));
   assert.deepEqual(await js('[...document.getElementById("installation-kind").options].map(o=>o.textContent)'),['Un solo computador','Servidor LAN','Estación LAN']);
   if(bootstrap){
    await until(()=>js('document.getElementById("business-type").options.length===1'));
    assert.equal(await js('document.getElementById("installation-kind").value'),'server');
    assert.equal(await js('document.getElementById("installation-kind").disabled'),true);
    await js('document.getElementById("activation-code").value="GFX-SERV-AAAA-BBBB-CCCC";document.getElementById("setup-next").click()');
    await until(()=>js('!document.querySelector("[data-step=\\"2\\"]").classList.contains("d-none")'));
    await js('document.getElementById("setup-next").click();document.getElementById("company-name").value="Negocio LAN de prueba";document.getElementById("setup-next").click();document.getElementById("setup-next").click();document.getElementById("admin-name").value="Administrador";document.getElementById("admin-username").value="admin";document.getElementById("admin-password").value="test123";document.getElementById("setup-next").click();document.getElementById("setup-next").click()');
    await until(()=>js('document.getElementById("setup-next").textContent==="Activar esta estación"'));
    assert.equal(localActivations,0,'Server setup must not activate the station');
    await js('document.getElementById("setup-next").click()');
    await until(()=>!win.webContents.isLoading()&&js('document.getElementById("installation-kind")?.value==="station"'));
   }else{
    await until(()=>js('document.getElementById("business-type").options.length>0'));
    await js('document.getElementById("installation-kind").value="station";document.getElementById("installation-kind").dispatchEvent(new Event("change"));');
   }
   assert.equal(await js('document.getElementById("station-fields").hidden'),false);
   assert.equal(await js('document.getElementById("setup-next").textContent'),'Activar y conectar');
   await js('document.getElementById("station-server-url").value="https://gestor-station-test.local:47821";document.getElementById("activation-code").value="GFX-AAAA-BBBB-CCCC-DDDD";document.getElementById("setup-next").click();');
  }
  await until(()=>win.webContents.getURL().endsWith('/login.html')&&!win.webContents.isLoading());
  assert.ok(activated);
  assert.equal(localActivations,resume?0:1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(electron.app.getPath('userData'),'gestorfx-network.json'),'utf8')).apiUrl,'https://gestor-station-test.local:47821');
  await js('document.getElementById("login-user").value="estacion";document.getElementById("login-pass").value="test123";document.getElementById("login-form").requestSubmit();');
  await until(()=>remoteLogins===1);
  await until(()=>js('document.getElementById("login-alert-msg").textContent.includes("Respuesta remota de prueba")'));
  console.log(`OK estación ${resume?'reconexión':bootstrap?'configuración inicial del servidor':'nueva'}: tres opciones, licencia local, conexión persistida y login remoto.`);
 }catch(e){console.error(e);if(win)console.error(await win.webContents.executeJavaScript('document.getElementById("license-alert")?.textContent'));process.exitCode=1;}
 finally{const code=process.exitCode||0;electron.session.defaultSession.protocol.unhandle('https');setTimeout(()=>{electron.app.exit(code);setTimeout(()=>process.exit(code),1000).unref();},100);}
});
