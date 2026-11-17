const electron=require('electron'),Module=require('node:module'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const directory=process.env.GESTORFX_INSTALL_TEST_DIRECTORY;
assert.ok(directory&&path.basename(directory).startsWith('test-installation-'));
fs.mkdirSync(path.join(directory,'profile'),{recursive:true});electron.app.setPath('userData',path.join(directory,'profile'));
electron.app.disableHardwareAcceleration();
process.env.GESTORFX_FRESH_INSTALL='0';process.env.GESTORFX_DATABASE_PATH=path.join(directory,'database.sqlite');
delete process.env.GESTORFX_SERVER_MODE;delete process.env.GESTORFX_API_URL;
fs.writeFileSync(process.env.GESTORFX_DATABASE_PATH,'existing-data-sentinel');
let win,released=false,registered=false;
const db={bakery:{authorizeChannel:()=>{},enabled:()=>false},getInstallationState:()=>({completed:true}),
 getCompanySettings:()=>({company_name:'Negocio existente',company_phone:'123',business_type_id:1}),getBusinessTypes:()=>[{id:1,name:'Panadería'}]};
const licensing={checkStatus:async()=>{released=true;},getLicenseState:()=>({valid:!released,payload:{kind:'standalone'},stored:{remoteStatus:released?'released':'active',customerRegistered:registered,customerId:registered?'customer':null}}),
 activate:async()=>{released=false;return{success:true,kind:'standalone'};},
 registerCustomer:async(dir,customer)=>{assert.equal(customer.business_name,'Negocio existente');assert.equal(customer.business_type,'Panadería');registered=true;}};
class HiddenWindow extends electron.BrowserWindow{constructor(options){super({...options,show:false,webPreferences:{...options.webPreferences,offscreen:true,backgroundThrottling:false}});win=this;}}
const load=Module._load;
Module._load=function(name,parent,...args){
 if(name==='electron')return{...electron,BrowserWindow:HiddenWindow};
 if(parent?.filename===path.resolve(__dirname,'../src/index.js')){
  if(name==='./database')return db;if(name==='./cashRegister')return{};if(name==='./licensing')return licensing;
 }
 return load.call(this,name,parent,...args);
};
require('../src/index.js');
electron.app.whenReady().then(async()=>{
 try{
  const until=async fn=>{for(let i=0;i<250;i++){if(await fn())return;await new Promise(r=>setTimeout(r,30));}throw Error('UI timeout');};
  const js=code=>win.webContents.executeJavaScript(code);
  await until(()=>win&&!win.webContents.isLoading()&&js('Boolean(document.getElementById("license-alert")?.textContent.includes("desactivada"))'));
  assert.ok(win.webContents.getURL().endsWith('/setup.html'));
  assert.equal((await js('window.api.getInstallationState()')).completed,false);
  assert.equal((await js('window.api.getLicenseState()')).deactivated,true);
  assert.equal(await js('window.api.getCompanySettings().then(()=>"allowed",error=>error.message)'),"Error invoking remote method 'get-company-settings': Error: Esta licencia fue desactivada. Solicite un nuevo código de activación.");
  await js('document.getElementById("activation-code").value="GFX-AAAA-BBBB-CCCC-DDDD";document.getElementById("setup-next").click()');
  await until(()=>!win.webContents.isLoading()&&win.webContents.getURL().endsWith('/login.html'));
  assert.equal(registered,true,'Recover customer from configured local business after activating');
  assert.equal(fs.readFileSync(process.env.GESTORFX_DATABASE_PATH,'utf8'),'existing-data-sentinel');
  console.log('OK UI licencia: desactivación muestra reactivación, bloquea operaciones y vuelve al login conservando negocio y datos.');
  electron.app.exit(0);
 }catch(e){console.error(e);electron.app.exit(1);}
});
