import { chromium } from 'playwright';
import fs from 'node:fs';
const FIX='cypress/fixtures';
const rd=(p)=>JSON.parse(fs.readFileSync(`${FIX}/${p}`,'utf8'));
const admin=rd('keycloak/admin.json'),list=rd('lecturers/list.json'),detail=rd('lecturers/detail.json'),proj=rd('openstack-projects/single.json');
const ok=(b)=>({status:200,contentType:'application/json',body:JSON.stringify(b)});
const empty={success:true,data:[],errors:null,timestamp:'t',request_id:'t',pagination:{page:1,page_size:20,total_items:0,total_pages:1}};
const b=await chromium.launch({headless:true});
const ctx=await b.newContext({viewport:{width:1440,height:900}});
await ctx.addInitScript((s)=>{window.__CYPRESS_KEYCLOAK_STUB__=s;},admin);
let deleteCalled=false, getDetailCallsAfterDelete=0;
await ctx.route((u)=>String(u).includes('/api/v1/'),async(r)=>{
  const url=r.request().url(), method=r.request().method();
  if(/\/api\/v1\/lecturers\/[^/]+/.test(url)){
    if(method==='DELETE'){ deleteCalled=true; return r.fulfill({status:202,contentType:'application/json',body:JSON.stringify({success:true,data:{task_id:'task-abc12345',user_id:'lec-3',deployment_count:1,template_count:4},message:'enqueued'})}); }
    // GET detail: first call returns detail; after delete, simulate 404 (deleted)
    if(deleteCalled){ getDetailCallsAfterDelete++; return r.fulfill({status:404,contentType:'application/json',body:JSON.stringify({success:false,errors:['not found']})}); }
    return r.fulfill(ok(detail));
  }
  if(/\/api\/v1\/lecturers/.test(url))return r.fulfill(ok(list));
  if(/openstack-projects/.test(url))return r.fulfill(ok(proj));
  return r.fulfill(ok(empty));
});
const p=await ctx.newPage();
const logs=[];
p.on('console',m=>{ if(m.type()==='error') logs.push(m.text()); });
await p.goto('http://localhost:3000/admin/lecturers',{waitUntil:'domcontentloaded'});
await p.locator('h1').filter({hasText:'Dozenten-Verwaltung'}).first().waitFor({timeout:15000});
await p.getByText('Ramona Korten').first().click();
await p.locator('[role="dialog"]').first().waitFor({timeout:8000});
await p.waitForTimeout(500);
// Click "Account löschen"
await p.getByRole('button',{name:/Account löschen/}).first().click();
await p.waitForTimeout(500);
// Type the confirmation name
const input=p.getByRole('textbox').first();
await input.fill('Ramona Korten');
await p.waitForTimeout(300);
// Click final delete
await p.getByRole('button',{name:/Endgültig löschen/}).first().click();
// Wait for polling to detect 404 and success toast
await p.waitForTimeout(4000);
const toastText = await p.locator('[data-sonner-toast], .toaster, li').allTextContents().catch(()=>[]);
console.log(JSON.stringify({deleteCalled, getDetailCallsAfterDelete, consoleErrors:logs.slice(0,3), sawSuccessToast: toastText.some(t=>/gelöscht/i.test(t))}));
await p.screenshot({path:'cypress/shots/delete-flow-result.png',fullPage:false});
await ctx.close(); await b.close();
