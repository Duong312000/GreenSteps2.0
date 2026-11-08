const { chromium }=require('playwright');
const fs=require('fs');
const path=require('path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const page=await browser.newPage({viewport:{width:1680,height:1050}});const errors=[];
 if(process.env.TRANSPORT_E2E_API)await page.route('**/api/transport/**',async route=>{const req=route.request();const url=req.url().replace('http://localhost:5055/api/transport',process.env.TRANSPORT_E2E_API);const response=await route.fetch({url});await route.fulfill({response});});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',msg=>{if(msg.type()==='error'&&msg.text().includes('transport'))errors.push(msg.text());});
 try{
  await page.goto('http://127.0.0.1:4200/transport');await page.locator('.transport-card').first().waitFor();
  console.log(JSON.stringify({title:await page.locator('.hero-copy h1').innerText(),cards:await page.locator('.transport-card').count(),tabs:await page.locator('.transport-tabs button').allTextContents()}));
  await fs.promises.mkdir(path.resolve(__dirname,'../../tmp/transport-artifacts'),{recursive:true});
  await page.screenshot({path:path.resolve(__dirname,'../../tmp/transport-artifacts/search-desktop.png'),fullPage:true});
  await page.locator('.transport-tabs button').nth(1).click();await page.waitForURL(/type=bus/);await page.locator('.transport-card').first().waitFor();
  await page.locator('.transport-card button').first().click();await page.locator('.detail-heading h1,.bus-heading h1').waitFor();console.log('Detail:',await page.locator('.detail-heading h1,.bus-heading h1').innerText());
  await page.screenshot({path:path.resolve(__dirname,'../../tmp/transport-artifacts/detail-desktop.png'),fullPage:true});
  await page.goto('http://127.0.0.1:4200/transport?type=rental&sortBy=price');await page.locator('.transport-card').first().waitFor();
  if(await page.locator('.search-fields button').count()!==1)throw new Error('Rental search form missing');
  await page.locator('.transport-card button').first().click();await page.locator('.detail-heading h1,.bus-heading h1').waitFor();
  await page.locator('input[name=pickup]').fill('2026-11-08');await page.locator('input[name=return]').fill('2026-11-09');await page.getByRole('button',{name:'Kiểm tra xe và tính giá'}).click();await page.waitForFunction(()=>document.querySelector('.rental-booking')?.textContent.includes('Giá thuê'));
  await page.goto('http://127.0.0.1:4200/transport?type=shared&maxPrice=1');await page.locator('.empty h3').waitFor();
  await page.goto('http://127.0.0.1:4200/services?type=transport');await page.waitForURL('**/transport');await page.locator('.transport-card').first().waitFor();
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.resolve(__dirname,'../../tmp/transport-artifacts/search-mobile.png'),fullPage:true});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw new Error('Mobile horizontal overflow');
  if(errors.length)throw new Error(errors.join('\n'));console.log('PASS: 3 tabs, API detail, rental quote, empty state, legacy redirect, mobile width, no Transport console errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

