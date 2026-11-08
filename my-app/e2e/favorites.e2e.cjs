// Favorites requests use the real MongoDB API; surrounding account/catalog
// fixtures isolate the browser check from payments, email and other features.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const express=require('../../backend/node_modules/express');
const jwt=require('../../backend/node_modules/jsonwebtoken');
const {randomUUID}=require('node:crypto');
const {store,User,Favorite,GreenService,Schedule,ScheduleSample,ScheduleCustom}=require('../../backend/src/models');
const F=require('../../backend/src/services/favorites.service');
const apiApp=require('../../backend/src/app');
const {JWT_SECRET}=require('../../backend/src/middlewares/auth.middleware');
(async()=>{
 const tag='fav-ui-'+randomUUID(),users=[],fixtures=[];let browser,apiServer,webServer;
 const image='/image/greensteps/da-lat/da-lat-ho-xuan-huong-01.jpg';
 const serviceId='srv_'+tag,tourId='tour_'+tag,itineraryId='iti_'+tag;
 async function fixture(model,values){fixtures.push([model,values.id]);return model.create(values);}
 try{
  await F.ensureSchema();
  for(let i=0;i<2;i++){
   const user={id:tag+'-'+i,username:tag+'-'+i,fullname:'Favorites verification '+i,email:tag+'-'+i+'@greensteps.invalid',role:'traveler'};
   await User.create({...user,password_hash:'disabled-favorites-ui'});
   users.push({user,token:jwt.sign({id:user.id,role:'traveler'},JWT_SECRET,{expiresIn:'10m'})});
  }
  await fixture(GreenService,{id:serviceId,name_service:'Favorite test service',type:'stay',destination:'Da Lat',cost:200000,image_url:image,status:'active',current_data:{}});
  await fixture(Schedule,{id:tourId,tour_name:'Favorite test tour',destination:'Da Lat',days:2,image_url:image});
  await fixture(ScheduleSample,{id:tourId,cost:500000});
  await fixture(Schedule,{id:itineraryId,tour_name:'Favorite test itinerary',destination:'Hoi An',days:3,image_url:image});
  await fixture(ScheduleCustom,{id:itineraryId,user_id:users[0].user.id,total_cost:600000});
  apiServer=apiApp.listen(0,'127.0.0.1');await new Promise(resolve=>apiServer.once('listening',resolve));
  const apiBase=`http://127.0.0.1:${apiServer.address().port}`;
  const web=express(),root=path.resolve(__dirname,'../dist/my-app/browser');
  web.use(express.static(root));web.use((req,res)=>res.sendFile(path.join(root,'index.html')));
  webServer=web.listen(0,'127.0.0.1');await new Promise(resolve=>webServer.once('listening',resolve));
  const base=`http://127.0.0.1:${webServer.address().port}`;
  const serviceDto={id:serviceId,name:'Favorite test service',name_service:'Favorite test service',type:'stay',destination:'Da Lat',cost:200000,image_url:image,status:'active',current_data:{}};
  const tourDto={id:tourId,title:'Favorite test tour',destination:'Da Lat',days:2,cost:500000,image,gallery:[image],data:[[],[]]};
  const itineraryDto={id:itineraryId,name:'Favorite test itinerary',destination:'Hoi An',days:3,totalCost:600000,daysData:[[],[],[]],status:'draft',imageUrl:image};
  browser=await chromium.launch({headless:true,channel:'chrome'});
  const context=await browser.newContext({viewport:{width:1440,height:1050}});let active=users[0];
  await context.addInitScript(initial=>{if(!localStorage.getItem('greensteps_user')){localStorage.setItem('greensteps_user',JSON.stringify(initial.user));localStorage.setItem('greensteps_token',initial.token);}},users[0]);
  const errors=[];
  async function routing(route){
   const url=new URL(route.request().url()),p=url.pathname;
   if(p.startsWith('/api/favorites')){await route.fulfill({response:await route.fetch({url:apiBase+p+url.search})});return;}
   let json=[];
   if(p==='/api/services'||p.startsWith('/api/services/recommendations'))json=[serviceDto];
   else if(p==='/api/services/'+serviceId)json=serviceDto;
   else if(p==='/api/tours')json=[tourDto];
   else if(p==='/api/tours/'+tourId)json=tourDto;
   else if(p.startsWith('/api/itineraries/user/'))json=active.user.id===users[0].user.id?[itineraryDto]:[];
   else if(p==='/api/auth/profile/'+active.user.id)json={success:true,user:active.user};
   else if(p.includes('/wallet/'))json={registered:false,balance:0,green_points:0,transactions:[]};
   await route.fulfill({json});
  }
  await context.route('**/api/**',routing);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const saved=name=>page.getByRole('button',{name:'Bỏ yêu thích '+name,exact:true});
  await page.goto(base+'/services?type=stay');
  await page.getByRole('button',{name:'Yêu thích Favorite test service',exact:true}).click();await saved('Favorite test service').waitFor();
  assert.match(page.url(),/\/services/,'Clicking a card heart must not open the card');
  await page.reload();await saved('Favorite test service').waitFor();
  await page.goto(base+'/tours');await page.getByRole('button',{name:'Yêu thích Favorite test tour',exact:true}).click();await saved('Favorite test tour').waitFor();
  await page.goto(base+'/schedule');await page.getByRole('button',{name:'Yêu thích Favorite test itinerary',exact:true}).click();await saved('Favorite test itinerary').waitFor();
  await page.goto(base+'/profile?section=favorites');
  await page.waitForFunction(()=>document.querySelectorAll('.favorite-card').length===3);
  assert.equal(await Favorite.collection.countDocuments({user_id:active.user.id}),3);
  await page.getByRole('button',{name:/^Tour 1$/}).click();assert.equal(await page.locator('.favorite-card').count(),1);
  await page.getByRole('button',{name:/^Dịch vụ 1$/}).click();assert.equal(await page.locator('.favorite-card').count(),1);
  await page.getByRole('button',{name:/^Lịch trình 1$/}).click();assert.equal(await page.locator('.favorite-card').count(),1);
  await page.getByRole('button',{name:/^Tất cả 3$/}).click();
  await page.getByRole('textbox',{name:'Tìm trong yêu thích'}).fill('itinerary');assert.equal(await page.locator('.favorite-card').count(),1);
  await page.getByRole('textbox',{name:'Tìm trong yêu thích'}).fill('');
  const artifacts=path.resolve(__dirname,'../../tmp/favorites-artifacts');fs.mkdirSync(artifacts,{recursive:true});
  await page.screenshot({path:path.join(artifacts,'favorites-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(artifacts,'favorites-mobile.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.setViewportSize({width:1440,height:1050});
  await page.locator('.favorite-card').filter({hasText:'Favorite test service'}).getByRole('link',{name:'Xem chi tiết'}).click();await saved('Favorite test service').waitFor();
  await saved('Favorite test service').click();await page.getByRole('button',{name:'Yêu thích Favorite test service',exact:true}).waitFor();
  await ScheduleSample.collection.deleteOne({id:tourId});
  await page.goto(base+'/profile?section=favorites');await page.locator('.favorite-unavailable').waitFor();
  await saved('Favorite test tour').click();await page.waitForFunction(()=>document.querySelectorAll('.favorite-card').length===1);
  active=users[1];await page.evaluate(next=>{localStorage.setItem('greensteps_user',JSON.stringify(next.user));localStorage.setItem('greensteps_token',next.token);},active);
  await page.goto(base+'/profile?section=favorites');await page.getByRole('heading',{name:'Chưa có địa điểm yêu thích',exact:true}).waitFor();
  assert.equal(await page.locator('.favorite-card').count(),0);assert.equal(await Favorite.collection.countDocuments({user_id:users[0].user.id}),1);
  assert.deepEqual(errors,[]);
  console.log('PASS: service/tour/itinerary hearts persist in MongoDB, reload, profile filters/search, detail synchronization, mobile width, deleted target removal and account isolation.');
 }finally{
  if(browser)await browser.close();
  if(apiServer)await new Promise(resolve=>apiServer.close(resolve));if(webServer)await new Promise(resolve=>webServer.close(resolve));
  await Favorite.collection.deleteMany({user_id:{$in:users.map(u=>u.user.id)}});
  for(const [model,id] of fixtures.reverse())await model.collection.deleteOne({id});
  for(const {user} of users)await User.collection.deleteOne({id:user.id});await store.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
