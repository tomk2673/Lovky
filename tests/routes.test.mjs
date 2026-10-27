import test, {before, beforeEach, afterEach} from "node:test";
import assert from "node:assert/strict";
import {readFileSync, mkdirSync, writeFileSync} from "node:fs";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import {DatabaseSync} from "node:sqlite";
import {env,state} from "./runtime-fixture.mjs";
import {TEST_CONTACT,PRIVACY_VERSION} from "../lib/lead-validation.ts";

const require=createRequire(import.meta.url);
let esbuild;try{esbuild=require("esbuild");}catch{esbuild=require("../node_modules/.pnpm/node_modules/esbuild");}
const fixture=fileURLToPath(new URL("./runtime-fixture.mjs",import.meta.url));
let submit,list,detail,db;
before(async()=>{
 mkdirSync(new URL("../work",import.meta.url),{recursive:true});
 async function load(entry,name){
  const result=await esbuild.build({entryPoints:[entry],bundle:true,write:false,format:"esm",platform:"node",target:"node24",plugins:[{name:"test-runtime",setup(build){build.onResolve({filter:/^(cloudflare:workers|next\/headers|next\/navigation)$/},()=>({path:fixture,external:true}));}}]});
  const target=new URL("../work/"+name+".mjs",import.meta.url);writeFileSync(target,result.outputFiles[0].text);return import(target.href);
 }
 submit=await load("app/api/leads/route.ts","test-submit");
 list=await load("app/api/admin/leads/route.ts","test-list");
 detail=await load("app/api/admin/leads/[id]/route.ts","test-detail");
});
beforeEach(()=>{
 db=new DatabaseSync(":memory:");db.exec("PRAGMA foreign_keys=ON");db.exec(readFileSync(new URL("../drizzle/0000_goofy_baron_strucker.sql",import.meta.url),"utf8"));
 for(const k of Object.keys(env))delete env[k];
 env.COLLECTION_MODE="pilot";env.ADMIN_EMAIL="owner@example.invalid";env.RATE_LIMIT_SECRET="fixture-only";
 function statement(sql,params=[]){return {
  bind(...values){return statement(sql,values);},
  async first(){return db.prepare(sql).get(...params)||null;},
  async all(){return {results:db.prepare(sql).all(...params),success:true};},
  async run(){const result=db.prepare(sql).run(...params);return {success:true,meta:{changes:result.changes}};}
 };}
 env.DB={prepare:sql=>statement(sql)};
 state.headers=new Headers();
});
afterEach(()=>db.close());
const origin="https://lovky.example";
const valid=()=>({...TEST_CONTACT,entity:"s.r.o.",amount:3500000,purpose:"Provozní kapitál",property:"Komerční nemovitost",propertyValue:null,lien:"Nevím",urgency:"Do 30 dnů",businessPurpose:true,consent:true,privacyVersion:PRIVACY_VERSION,isTest:true,website:""});
function req(path,method="GET",body,headers={}){return new Request(origin+path,{method,headers:{"Content-Type":"application/json",Origin:origin,...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});}
function owner(){state.headers=new Headers({"oai-authenticated-user-id":"owner-id","oai-authenticated-user-email":"owner@example.invalid"});}
async function create(data=valid(),key=crypto.randomUUID()){const r=await submit.POST(req("/api/leads","POST",data,{"Idempotency-Key":key}));assert.equal(r.status,201,await r.clone().text());return {key,...await r.json()};}

test("public form validates origin, consent, consumer purpose and pilot identities",async()=>{
 for(const headers of [{Origin:"https://elsewhere.example"},{Origin:""}])assert.equal((await submit.POST(req("/api/leads","POST",valid(),headers))).status,403);
 for(const change of [{consent:false},{businessPurpose:false},{name:"Jiný fiktivní kontakt"},{isTest:false},{status:"won"},{website:"bot"}])assert.equal((await submit.POST(req("/api/leads","POST",{...valid(),...change},{"Idempotency-Key":crypto.randomUUID()}))).status,400);
 assert.equal(db.prepare("SELECT count(*) n FROM leads").get().n,0);
});

test("repeated and concurrent delivery creates one lead and one audit event",async()=>{
 const data=valid(),key=crypto.randomUUID();
 const responses=await Promise.all(Array.from({length:4},()=>submit.POST(req("/api/leads","POST",data,{"Idempotency-Key":key}))));
 const bodies=await Promise.all(responses.map(r=>r.json()));assert.equal(new Set(bodies.map(b=>b.id)).size,1);
 assert.ok(responses.every(r=>r.status===200||r.status===201));
 assert.equal(db.prepare("SELECT count(*) n FROM leads").get().n,1);assert.equal(db.prepare("SELECT count(*) n FROM lead_events").get().n,1);
 const changed=await submit.POST(req("/api/leads","POST",{...data,amount:123456},{"Idempotency-Key":key}));assert.equal(changed.status,409);
});

test("private lead data and exports reject anonymous and other identities",async()=>{
 const l=await create();
 assert.equal((await list.GET(req("/api/admin/leads"))).status,403);
 assert.equal((await detail.GET(req("/api/admin/leads/"+l.id),{params:Promise.resolve({id:l.id})})).status,403);
 state.headers=new Headers({"oai-authenticated-user-id":"other-id","oai-authenticated-user-email":"other@example.invalid"});
 assert.equal((await list.GET(req("/api/admin/leads?format=csv"))).status,403);
 owner();const r=await list.GET(req("/api/admin/leads"));assert.equal(r.status,200);assert.match(r.headers.get("cache-control"),/no-store/);
 const body=await r.json();assert.equal(body.items.length,1);
 for(const field of ["request_key","payload_hash","actor","recipient_snapshot"])assert.equal(field in body.items[0],false);
});

test("owner can update a lead atomically, while a stale update loses safely",async()=>{
 const l=await create();owner();const ctx={params:Promise.resolve({id:l.id})};
 const update={version:1,status:"handed_over",note:"Fiktivní test předání",expectedCents:150050,paidCents:0};
 assert.equal((await detail.PATCH(req("/api/admin/leads/"+l.id,"PATCH",update,{Origin:"https://elsewhere.example"}),ctx)).status,403);
 assert.equal((await detail.PATCH(req("/api/admin/leads/"+l.id,"PATCH",update),ctx)).status,200);
 assert.equal((await detail.PATCH(req("/api/admin/leads/"+l.id,"PATCH",{...update,status:"closed"}),ctx)).status,409);
 const result=await (await detail.GET(req("/api/admin/leads/"+l.id),ctx)).json();
 assert.equal(result.lead.status,"handed_over");assert.equal(result.lead.expected_cents,150050);assert.equal(result.events.length,2);
 const listing=await (await list.GET(req("/api/admin/leads?status=handed_over&q=Modelov"))).json();assert.equal(listing.total,1);assert.equal(listing.totals.expected,0);
});

test("CSV exports the filtered contacts without internal notes or commission",async()=>{
 const l=await create();owner();const ctx={params:Promise.resolve({id:l.id})};
 await detail.PATCH(req("/api/admin/leads/"+l.id,"PATCH",{version:1,status:"contacted",note:"PRIVATE-NOTE",expectedCents:123456,paidCents:0}),ctx);
 const r=await list.GET(req("/api/admin/leads?format=csv&status=contacted"));const csv=await r.text();
 assert.equal(r.status,200);assert.match(r.headers.get("content-type"),/text\/csv/);assert.ok(csv.includes(TEST_CONTACT.company));assert.ok(!csv.includes("PRIVATE-NOTE"));assert.ok(!csv.includes("123456"));assert.ok(csv.includes("'+420000000000"));
});

test("oversized requests and excessive new submissions are rejected",async()=>{
 const huge=new Request(origin+"/api/leads",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({x:"x".repeat(17000)})});
 assert.equal((await submit.POST(huge)).status,400);
 for(let i=0;i<12;i++)await create();
 assert.equal((await submit.POST(req("/api/leads","POST",valid(),{"Idempotency-Key":crypto.randomUUID()}))).status,429);
});

test("live collection stays closed until the required identities exist",async()=>{
 env.COLLECTION_MODE="live";
 assert.equal((await submit.POST(req("/api/leads","POST",valid(),{"Idempotency-Key":crypto.randomUUID()}))).status,503);
 assert.equal(db.prepare("SELECT count(*) n FROM leads").get().n,0);
});

test("deletion checks the version and removes associated history",async()=>{
 const l=await create();owner();const ctx={params:Promise.resolve({id:l.id})};
 assert.equal((await detail.DELETE(req("/api/admin/leads/"+l.id,"DELETE",{version:2}),ctx)).status,409);
 assert.equal((await detail.DELETE(req("/api/admin/leads/"+l.id,"DELETE",{version:1}),ctx)).status,200);
 assert.equal(db.prepare("SELECT count(*) n FROM leads").get().n,0);assert.equal(db.prepare("SELECT count(*) n FROM lead_events").get().n,0);
});
