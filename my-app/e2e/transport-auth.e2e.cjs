const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {User}=require('../../backend/src/models');
const M=require('../../backend/src/transport/models');
const S=require('../../backend/src/transport/service');
const jwt=require('../../backend/node_modules/jsonwebtoken');
const {JWT_SECRET}=require('../../backend/src/middlewares/auth.middleware');
(async()=>{
 const uid='transport-ui-'+Date.now(),createdPartner='Transport UI '+uid;
 let browser;const user={id:uid,username:uid,fullname:'Transport verification',email:uid+'@greensteps.invalid',role:'admin'};
 try{
  await M.store.authenticate();await User.create({...user,password_hash:'disabled-test-account'});
  const token=jwt.sign({id:uid,role:'admin'},JWT_SECRET,{expiresIn:'10m'});
  browser=await chromium.launch({headless:true,channel:'chrome'});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[],realPayments=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().includes('img.vietqr.io') || (r.method()==='POST' && /\/api\/(wallet|bookings)(\/|$)/.test(r.url())))realPayments.push(r.url());});
  await page.addInitScript(({user,token})=>{localStorage.setItem('greensteps_user',JSON.stringify(user));localStorage.setItem('greensteps_token',token);},{user,token});
  if(process.env.TRANSPORT_E2E_API)await page.route('**/api/transport/**',async route=>{const url=route.request().url().replace('http://localhost:5055/api/transport',process.env.TRANSPORT_E2E_API);await route.fulfill({response:await route.fetch({url})});});
  await page.goto('http://localhost:4200/transport?type=shared');await page.locator('.transport-card button').first().waitFor();await page.locator('.transport-card button').first().click();await page.locator('.bus-booking').waitFor();
  await page.locator('input[name=seats]').fill('2');await page.locator('input[name=busTerms]').check();await page.locator('.bus-booking button[type=submit]').click();await page.waitForURL(/\/booking\/payment\?transportBookingId=/);
  await page.locator('.payment-shell .payment-tour-name').waitFor().catch(async error=>{
   console.log('Checkout diagnostics:',JSON.stringify({url:page.url(),errors,body:(await page.locator('body').innerText()).slice(0,1800)}));
   await page.screenshot({path:require('node:path').resolve(__dirname,'../../tmp/transport-artifacts/payment-error.png'),fullPage:true});
   throw error;
  });
  assert.match(await page.locator('.payment-shell .payment-tour-name').innerText(),/Xe chia sẻ/);
  assert.match(await page.locator('.payment-summary').innerText(),/140.000|140,000|140\s000/);
  await page.reload();await page.locator('#acceptedTermsCheck').waitFor();
  assert.equal(await M.col('bookings').countDocuments({user_id:uid}),1,'Reload must not create another reservation');
  await page.locator('#acceptedTermsCheck').check();await page.locator('.payment-continue-desktop').click();
  await page.waitForURL(/\/booking\/confirm\?transportBookingId=/);await page.locator('.confirm-status-text').waitFor();
  assert.match(await page.locator('.confirm-status-text').innerText(),/Đã hoàn tất thanh toán nội bộ/);
  await page.screenshot({path:require('node:path').resolve(__dirname,'../../tmp/transport-artifacts/payment-confirmation.png'),fullPage:true});
  await page.reload();await page.locator('.confirm-status-text').waitFor();
  assert.equal((await M.col('bookings').findOne({user_id:uid})).payment_status,'SIMULATED_PAID');
  await page.goto('http://localhost:4200/profile?section=tickets');await page.locator('.transport-bookings article').first().waitFor();
  const card=page.locator('.transport-bookings article').first();assert.match(await card.innerText(),/2 khách/);
  await card.getByRole('button',{name:'Hủy đặt chỗ',exact:true}).click();await card.getByRole('button',{name:'Xác nhận hủy',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.transport-bookings article')?.textContent.includes('Đã hủy'));
  await page.goto('http://localhost:4200/admin/transport');await page.locator('tbody tr').first().waitFor();await page.locator('.toolbar>button').click();await page.locator('.editor label').filter({hasText:/^Tên/}).locator('input').fill(createdPartner);await page.locator('.editor button[type=submit],.editor button.primary').first().click();await page.locator('.message').waitFor();
  const partner=await M.col('partners').findOne({name:createdPartner});assert.ok(partner,'Admin form must save MongoDB partner');
  assert.deepEqual(errors,[]);assert.deepEqual(realPayments,[]);console.log('PASS: existing service payment page, server fare, reload recovery, automatic confirmation, account listing, cancellation, admin form, no real payment requests/page errors.');
 }finally{
  if(browser)await browser.close();
  const bookings=await M.col('bookings').find({user_id:uid}).toArray();for(const b of bookings)if(M.active.includes(b.booking_status))await S.changeStatus(String(b._id),{id:uid},'CANCELLED');
  await M.col('bookings').deleteMany({user_id:uid});await M.col('partners').deleteMany({name:createdPartner,is_seed_data:true});await User.collection.deleteOne({id:uid});await M.store.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});

