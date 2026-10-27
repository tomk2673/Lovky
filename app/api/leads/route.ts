import {leadSchema,PRIVACY_VERSION,TEST_CONTACT} from "../../../lib/lead-validation";
import {checkOrigin,config,json,readJson,runtime,sha} from "../../../lib/server";
export async function POST(r:Request){
 if(!checkOrigin(r))return json({error:"Požadavek musí přijít z formuláře LOVKY."},403);
 let raw;try{raw=await readJson(r);}catch{return json({error:"Neplatná nebo příliš velká poptávka."},400);}
 const parsed=leadSchema.safeParse(raw);if(!parsed.success)return json({error:"Zkontrolujte vyplněné údaje a potvrzení před odesláním."},400);
 const input=parsed.data,c=config();
 if(c.requestedLive&&!c.live)return json({error:"Příjem poptávek ještě není aktivní."},503);
 if(c.pilot&&(!input.isTest||Object.entries(TEST_CONTACT).some(([k,v])=>input[k as keyof typeof input]!==v)))return json({error:"Soukromý pilot přijímá pouze předvyplněné modelové kontakty."},400);
 if(c.live&&input.isTest)return json({error:"Pro testovací poptávky použijte soukromý pilot."},400);
 const key=r.headers.get("idempotency-key")||"";
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key))return json({error:"Obnovte formulář a zkuste odeslání znovu."},400);
 const {website:_honeypot,...data}=input,hash=await sha(JSON.stringify(data)),db=runtime().DB;
 try{
  const old=await db.prepare("SELECT id,payload_hash FROM leads WHERE request_key=?").bind(key).first<{id:string;payload_hash:string}>();
  if(old)return old.payload_hash===hash?json({id:old.id,isTest:c.pilot,duplicate:true}):json({error:"Odeslání už obsahuje jiná data. Obnovte formulář."},409);
  const now=Date.now(),rateKey=await sha((runtime().RATE_LIMIT_SECRET||"private-pilot")+":"+(r.headers.get("cf-connecting-ip")||"local")+":"+Math.floor(now/3_600_000));
  const rate=await db.prepare("INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count").bind(rateKey,now+3_600_000).first<{count:number}>();
  if(rate&&rate.count>12)return json({error:"Příliš mnoho pokusů. Zkuste to později."},429);
  const id="LVK-"+crypto.randomUUID();
  await db.prepare("INSERT INTO leads (id,request_key,payload_hash,created_at,updated_at,status,is_test,data,consent_at,privacy_version,recipient_snapshot,actor) VALUES (?,?,?,?,?,'new',?,?,?,?,?,'form')").bind(id,key,hash,now,now,c.pilot?1:0,JSON.stringify(data),now,PRIVACY_VERSION,JSON.stringify({operator:c.operator||"Soukromý pilot",operatorIco:c.operatorIco,partner:c.partner||"Testovací příjemce",partnerIco:c.partnerIco})).run();
  return json({id,isTest:c.pilot,duplicate:false},201);
 }catch{
  try{const old=await db.prepare("SELECT id,payload_hash FROM leads WHERE request_key=?").bind(key).first<{id:string;payload_hash:string}>();if(old?.payload_hash===hash)return json({id:old.id,isTest:c.pilot,duplicate:true});}catch{}
  return json({error:"Uložení se nepodařilo potvrdit. Zkuste odeslání znovu; stejný pokus se neuloží dvakrát."},503);
 }
}
