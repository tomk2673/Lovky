import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../app/chatgpt-auth";
import type {Lead,LeadRow} from "./lead-validation";
type Runtime={DB:D1Database;ADMIN_EMAIL?:string;COLLECTION_MODE?:string;OPERATOR_NAME?:string;OPERATOR_ICO?:string;OPERATOR_ADDRESS?:string;PRIVACY_EMAIL?:string;PARTNER_NAME?:string;PARTNER_ICO?:string;PARTNER_ADDRESS?:string;RETENTION_DAYS?:string;RATE_LIMIT_SECRET?:string};
export function runtime(){return env as unknown as Runtime;}
export function config(){
 const e=runtime();const fields={OPERATOR_NAME:e.OPERATOR_NAME,OPERATOR_ICO:e.OPERATOR_ICO,OPERATOR_ADDRESS:e.OPERATOR_ADDRESS,PRIVACY_EMAIL:e.PRIVACY_EMAIL,PARTNER_NAME:e.PARTNER_NAME,PARTNER_ICO:e.PARTNER_ICO,PARTNER_ADDRESS:e.PARTNER_ADDRESS,RETENTION_DAYS:e.RETENTION_DAYS,RATE_LIMIT_SECRET:e.RATE_LIMIT_SECRET};
 const missing=Object.entries(fields).filter(([,v])=>!v?.trim()).map(([k])=>k);
 if(e.RETENTION_DAYS&&(!/^\d+$/.test(e.RETENTION_DAYS)||+e.RETENTION_DAYS<1||+e.RETENTION_DAYS>365))missing.push("RETENTION_DAYS (1–365)");
 if(e.PRIVACY_EMAIL&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.PRIVACY_EMAIL))missing.push("PRIVACY_EMAIL (platný e-mail)");
 const live=e.COLLECTION_MODE==="live"&&missing.length===0;
 return {live,pilot:!live,requestedLive:e.COLLECTION_MODE==="live",missing,operator:e.OPERATOR_NAME||"",operatorIco:e.OPERATOR_ICO||"",operatorAddress:e.OPERATOR_ADDRESS||"",privacyEmail:e.PRIVACY_EMAIL||"",partner:e.PARTNER_NAME||"",partnerIco:e.PARTNER_ICO||"",partnerAddress:e.PARTNER_ADDRESS||"",retentionDays:Number(e.RETENTION_DAYS)||90};
}
export type PublicConfig=Pick<ReturnType<typeof config>,"pilot"|"operator"|"partner"|"privacyEmail"|"retentionDays">;
export function publicConfig():PublicConfig{const c=config();return {pilot:c.pilot,operator:c.operator,partner:c.partner,privacyEmail:c.privacyEmail,retentionDays:c.retentionDays};}
export async function adminIdentity(){const u=await getChatGPTUser();const a=runtime().ADMIN_EMAIL?.trim().toLowerCase();return u&&a&&u.email.toLowerCase()===a?u:null;}
export function json(body:unknown,status=200){return Response.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});}
export function checkOrigin(r:Request){return !!r.headers.get("origin")&&r.headers.get("origin")===new URL(r.url).origin&&r.headers.get("content-type")?.split(";")[0]==="application/json";}
export async function readJson(r:Request){
 if(!r.body)throw Error("empty");const reader=r.body.getReader();let length=0;const chunks:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>16_384){await reader.cancel();throw Error("too_large");}chunks.push(value);}
 const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}return JSON.parse(new TextDecoder().decode(bytes));
}
export async function sha(v:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v))),b=>b.toString(16).padStart(2,"0")).join("");}
export function deserialize(r:LeadRow):Lead{return {id:r.id,created_at:r.created_at,updated_at:r.updated_at,version:r.version,status:r.status,is_test:r.is_test,data:JSON.parse(r.data),note:r.note,expected_cents:r.expected_cents,paid_cents:r.paid_cents,consent_at:r.consent_at,privacy_version:r.privacy_version,recipient:JSON.parse(r.recipient_snapshot)};}
export async function purgeExpired(){const c=config();await runtime().DB.prepare("DELETE FROM leads WHERE created_at < ?").bind(Date.now()-c.retentionDays*86_400_000).run();await runtime().DB.prepare("DELETE FROM rate_limits WHERE expires_at < ?").bind(Date.now()).run();}
