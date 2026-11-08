const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const M=require('../../backend/src/transport/models');
const S=require('../../backend/src/transport/service');
const {User}=require('../../backend/src/models');
const jwt=require('../../backend/node_modules/jsonwebtoken');
const {JWT_SECRET}=require('../../backend/src/middlewares/auth.middleware');
(async()=>{
 const uid=`shared-rental-check-${Date.now()}`,artifacts=path.resolve(__dirname,'../../tmp/transport-unified');
 fs.mkdirSync(artifacts,{recursive:true});let browser,created=false;
 try{
  await M.store.authenticate();
  const user={id:uid,username:uid,fullname:'Transport verification',email:`${uid}@greensteps.invalid`,role:'traveler'};
  await User.create({...user,password_hash:'disabled-test-account'});created=true;
  const token=jwt.sign({id:uid,role:'traveler'},JWT_SECRET,{expiresIn:'15m'});
  browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:1536,height:1024}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({user,token})=>{localStorage.setItem('greensteps_user',JSON.stringify(user));localStorage.setItem('greensteps_token',token);},{user,token});
  async function mobile(name,main){
   await page.setViewportSize({width:390,height:844});
   await page.locator('.bus-booking').scrollIntoViewIfNeeded();
   const layout=await page.evaluate(main=>{const box=s=>document.querySelector(s).getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,infoBottom:box(main).bottom,bookingTop:box('.bus-booking').top,bookingBottom:box('.bus-booking').bottom,policiesTop:box('.bus-policies').top};},main);
   assert.equal(layout.overflow,false);assert.ok(layout.bookingTop>=layout.infoBottom);assert.ok(layout.policiesTop>=layout.bookingBottom);
   await page.screenshot({path:path.join(artifacts,`${name}-mobile.png`),fullPage:true});
   await page.setViewportSize({width:1536,height:1024});
  }
  // Shared: same route/gallery/selection layout as bus, using real legacy stops.
  await page.goto('http://localhost:4200/transport?type=shared&passengers=2');
  await page.locator('.transport-card button').first().click();await page.locator('.bus-heading h1').waitFor();
  assert.match(await page.locator('.bus-subtitle').innerText(),/Xe ghép/);
  assert.equal(await page.locator('.stop-timeline li').count(),2);
  assert.ok(await page.inputValue('#bus-pickup'));assert.ok(await page.inputValue('#bus-dropoff'));
  await page.locator('.bus-gallery button').first().click();assert.equal(await page.locator('dialog').evaluate(d=>d.open),true);await page.keyboard.press('Escape');
  await page.screenshot({path:path.join(artifacts,'shared-desktop.png'),fullPage:true});
  await mobile('shared','.route-card');
  await page.locator('input[name=busTerms]').check();await page.locator('.bus-continue').click();
  await page.waitForURL(/\/booking\/payment\?transportBookingId=/);await page.locator('.payment-summary .payment-tour-name').waitFor();
  let bookings=await M.col('bookings').find({user_id:uid}).toArray();assert.equal(bookings.length,1);const shared=bookings[0];
  assert.equal(shared.booking_type,'shared');assert.equal(shared.passenger_count,2);assert.ok(shared.pickup_stop_id);assert.ok(shared.dropoff_stop_id);
  assert.ok((await page.locator('.payment-summary').innerText()).includes(shared.pickup_stop.name));
  await S.changeStatus(String(shared._id),{id:uid},'CANCELLED');
  // Rental: preserve server quote, deposit separation and exact edited interval.
  const start=new Date(Date.now()+12*86400000),end=new Date(+start+86400000);
  const day=d=>d.toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
  const pickup=`${day(start)}T08:00:00+07:00`,returned=`${day(end)}T09:00:00+07:00`;
  const query=new URLSearchParams({type:'rental',vehicleType:'car',sortBy:'price',pickupDate:pickup,returnDate:returned});
  await page.goto('http://localhost:4200/transport?'+query);
  await page.locator('.transport-card button').first().click();await page.locator('.rental-information').waitFor();
  assert.equal(await page.locator('.bus-gallery.single-image button').count(),1);
  assert.equal(await page.locator('.bus-continue').isDisabled(),true);
  await page.locator('input[name=rentalTerms]').check();
  await page.locator('input[name=returnTime]').fill('10:00');
  assert.equal(await page.locator('input[name=rentalTerms]').isChecked(),false);
  assert.equal(await page.locator('.bus-continue').isDisabled(),true);
  assert.match(await page.locator('.booking-total').innerText(),/Chưa tính/);
  await page.getByRole('button',{name:'Kiểm tra xe và tính giá',exact:true}).click();
  await page.locator('.rental-booking .selected-duration').waitFor();
  assert.match(await page.locator('.selected-duration').innerText(),/26 giờ thuê/);
  await page.locator('#rental-distance').fill('30');await page.getByRole('button',{name:'Tính phát thải',exact:true}).click();
  await page.locator('.emissions-result').waitFor();
  await page.screenshot({path:path.join(artifacts,'rental-desktop.png'),fullPage:true});
  await mobile('rental','.rental-information');
  await page.locator('input[name=rentalTerms]').check();
  const requestPromise=page.waitForRequest(r=>r.method()==='POST'&&r.url().endsWith('/api/transport/bookings'));
  await page.locator('.bus-continue').click();const body=(await requestPromise).postDataJSON();
  assert.equal(body.rental_start,pickup);assert.equal(body.rental_end,`${day(end)}T10:00:00+07:00`);
  await page.waitForURL(/\/booking\/payment\?transportBookingId=/);await page.locator('.payment-summary .payment-tour-name').waitFor();
  const rental=await M.col('bookings').findOne({user_id:uid,booking_type:'rental'});
  assert.ok(rental);assert.equal(+rental.service_end-+rental.service_start,26*3600000);assert.ok(rental.deposit>0);
  await page.reload();await page.locator('#acceptedTermsCheck').waitFor();
  assert.equal(await M.col('bookings').countDocuments({user_id:uid,booking_type:'rental'}),1);
  await page.locator('#acceptedTermsCheck').check();await page.locator('.payment-continue-desktop').click();
  await page.waitForURL(/\/booking\/confirm\?transportBookingId=/);await page.locator('.confirm-status-text').waitFor();
  assert.equal((await M.col('bookings').findOne({_id:rental._id})).payment_status,'SIMULATED_PAID');
  assert.deepEqual(errors,[]);console.log('PASS: shared route/default stops/gallery/checkout; rental date edits/quote/availability/deposit/emissions/checkout/reload/payment; desktop and mobile for both.');
  console.log(`Screenshots: ${artifacts}`);
 }finally{
  if(browser)await browser.close();
  if(created){for(const b of await M.col('bookings').find({user_id:uid}).toArray())if(M.active.includes(b.booking_status))await S.changeStatus(String(b._id),{id:uid},'CANCELLED');await M.col('bookings').deleteMany({user_id:uid});await User.collection.deleteOne({id:uid});}
  await M.store.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
