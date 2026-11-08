require('../src/config/env');
const { col,init,store } = require('../src/transport/models');
const { ObjectId } = require('mongodb');
const { vehicleImages } = require('../src/transport/seed-images');
async function seed() {
 await init();
 const inserted={};
 async function put(name,key,data) {
  if(name==='trips'){const prior=await col(name).findOne({vehicle_id:data.vehicle_id,departure_time:data.departure_time,is_seed_data:true});if(prior)return prior;}
  const candidate={ _id:new ObjectId(),seed_key:`greensteps-transport-v1:${key}`,is_seed_data:true,...data,createdAt:new Date(),updatedAt:new Date() };
  const r=await col(name).updateOne({ seed_key:candidate.seed_key },{ $setOnInsert:candidate },{ upsert:true });
  inserted[name]=(inserted[name]||0)+r.upsertedCount;
  return col(name).findOne({ seed_key:candidate.seed_key });
 }
 const partners=[];
 for (const [i,name] of ['Lá Mây Mobility','Mộc Lộ Travel','Nắng Mai Transit','Suối Ngọc Move','Gió Đồi Shuttle','Vệt Lá Express','Đồi Mây Wheels','Hạt Nắng Journey'].entries()) partners.push(await put('partners',`partner-${i}`,{ name,logo:'/image/greensteps_logo_header.png',description:'Di chuyển theo lịch trình và thuê phương tiện cho hành trình của bạn.',phone:`DEV-${1000+i}`,email:`operations${i}@transport.greensteps.invalid`,status:'active',booking_mode:'internal',external_booking_url:'' }));
 const factors={ petrol:0.192,diesel:0.78,electric:0.082,human:0.008 };
 for (const [fuel,value] of Object.entries(factors)) await put('emission_factors',fuel,{ fuel_type:fuel,vehicle_kg_per_km:value,baseline_kg_per_km:0.192,scope:'Ước tính năng lượng vận hành và cung ứng năng lượng; không bao gồm sản xuất xe và hạ tầng.',source:'Bộ thông số kỹ thuật nội bộ GreenSteps v1; dùng để kiểm tra phép tính, không phải chứng nhận môi trường.' });
 const routes=[];
 for (const [i,r] of [['Đà Nẵng','Hội An',30,55],['Hội An','Đà Nẵng',30,55],['Đà Nẵng','Huế',95,130],['Đà Lạt','Nha Trang',135,180],['TP.HCM','Vũng Tàu',100,145]].entries()) routes.push(await put('routes',`route-${i}`,{ origin:r[0],destination:r[1],distance_km:r[2],estimated_duration:r[3],status:'active' }));
 const today=new Date(new Date().toLocaleDateString('en-CA',{ timeZone:'Asia/Ho_Chi_Minh' })+'T00:00:00+07:00');
 for (const type of ['shared','bus']) for (let i=0;i<20;i++) {
  const partner=partners[i%8],route=routes[i%5],capacity=type === 'shared' ? [7,9,16][i%3]:[16,29,34,45][i%4];
  const vehicle=await put('vehicles',`${type}-vehicle-${i}`,{ partner_id:partner._id,name:`${type === 'bus' ? 'Xe khách':'Xe chia sẻ'} ${capacity} chỗ ${i+1}`,vehicle_type:type === 'bus' ? 'coach':'minibus',transport_type:type,capacity,fuel_type:i%3 === 0 ? 'electric':type === 'bus' ? 'diesel':'petrol',amenities:['Điều hòa','Cổng sạc USB','Khoang hành lý'],images:vehicleImages(type,i),status:'active' });
  for (let day=1;day<=5;day++) {
   const departure=new Date(+today+day*86400000+(6+(Math.floor(i/5)*4))*3600000);
   await put('trips',`${type}-trip-${i}-${departure.toISOString().slice(0,10)}`,{ partner_id:partner._id,vehicle_id:vehicle._id,route_id:route._id,transport_type:type,departure_time:departure,arrival_time:new Date(+departure+route.estimated_duration*60000),total_seats:capacity,available_seats:i === 18 ? 0:Math.max(1,capacity-(i%5)),price_per_person:70000+(i%6)*25000,currency:'VND',allocated_passengers:type === 'bus' ? 12:4,status:i === 19 ? 'suspended':'active',pickup_point:`Điểm đón trung tâm ${route.origin}`,dropoff_point:`Điểm trả trung tâm ${route.destination}`,baggage_policy:'Một kiện hành lý tối đa 15 kg và một túi xách tay.',cancellation_hours:2 });
  }
 }
 const types=['car','electric_car','motorbike','electric_motorbike','bicycle','electric_bicycle'];
 for (let i=0;i<24;i++) {
  const type=types[i%6],partner=partners[i%8],fuel=type.startsWith('electric') ? 'electric':type === 'bicycle' ? 'human':'petrol';
  const vehicle=await put('vehicles',`rental-vehicle-${i}`,{ partner_id:partner._id,name:`${{car:'Ô tô tự lái',electric_car:'Ô tô điện',motorbike:'Xe máy',electric_motorbike:'Xe máy điện',bicycle:'Xe đạp',electric_bicycle:'Xe đạp điện'}[type]} ${i+1}`,vehicle_type:type,transport_type:'rental',capacity:type.includes('car') ? 5:type.includes('motorbike') ? 2:1,fuel_type:fuel,amenities:['Hỗ trợ nhận xe','Khóa an toàn'],images:vehicleImages('rental',i),status:'active' });
  await put('rentals',`rental-${i}`,{ partner_id:partner._id,vehicle_id:vehicle._id,pickup_location:['Đà Nẵng','Hội An','Đà Lạt','TP.HCM'][Math.floor(i/6)],price_per_hour:type.includes('car') ? 100000:15000+(i%3)*5000,price_per_day:type.includes('car') ? 700000:90000+(i%3)*30000,deposit:type.includes('car') ? 2000000:300000,rental_conditions:'Xuất trình giấy tờ tùy thân; giấy phép phù hợp khi thuê xe cơ giới. Nhận và trả đúng địa điểm; tiền cọc chưa được thu trực tuyến.',cancellation_hours:2,status:i === 23 ? 'suspended':'active' });
 }
 const totals={};for (const name of ['partners','vehicles','routes','trips','rentals','emission_factors']) totals[name]=await col(name).countDocuments({ is_seed_data:true });
 console.log(JSON.stringify({ inserted,totals,first_departure:new Date(+today+86400000).toISOString() },null,2));
 return totals;
}
if(require.main === module) seed().catch(e=>{ console.error('Transport seed failed:',e.message);process.exitCode=1; }).finally(()=>store.close());
module.exports={ seed };
