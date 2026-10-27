import {updateSchema,type LeadRow} from "../../../../../lib/lead-validation";
import {adminIdentity,checkOrigin,deserialize,json,readJson,runtime} from "../../../../../lib/server";
type Context={params:Promise<{id:string}>};
export async function GET(_r:Request,ctx:Context){
 if(!await adminIdentity())return json({error:"Přístup pouze pro správce."},403);const {id}=await ctx.params;
 try{const row=await runtime().DB.prepare("SELECT * FROM leads WHERE id=?").bind(id).first<LeadRow>();if(!row)return json({error:"Poptávka nenalezena."},404);
 const events=await runtime().DB.prepare("SELECT id,created_at,action,detail FROM lead_events WHERE lead_id=? ORDER BY created_at DESC,id DESC LIMIT 100").bind(id).all();return json({lead:deserialize(row),events:events.results});
 }catch{return json({error:"Detail se nepodařilo načíst."},503);}
}
export async function PATCH(r:Request,ctx:Context){
 const user=await adminIdentity();if(!user)return json({error:"Přístup pouze pro správce."},403);if(!checkOrigin(r))return json({error:"Neplatný původ požadavku."},403);
 let raw;try{raw=await readJson(r);}catch{return json({error:"Neplatné údaje."},400);}const p=updateSchema.safeParse(raw);if(!p.success)return json({error:"Zkontrolujte stav, poznámku a částky."},400);
 const {id}=await ctx.params,v=p.data;
 try{const row=await runtime().DB.prepare("UPDATE leads SET status=?,note=?,expected_cents=?,paid_cents=?,updated_at=?,version=version+1,actor=? WHERE id=? AND version=? RETURNING *").bind(v.status,v.note,v.expectedCents,v.paidCents,Date.now(),user.userId,id,v.version).first<LeadRow>();
 return row?json({lead:deserialize(row)}):json({error:"Poptávka se mezitím změnila. Obnovte detail a zkuste to znovu."},409);
 }catch{return json({error:"Změnu se nepodařilo uložit."},503);}
}
export async function DELETE(r:Request,ctx:Context){
 if(!await adminIdentity())return json({error:"Přístup pouze pro správce."},403);if(!checkOrigin(r))return json({error:"Neplatný původ požadavku."},403);
 let raw;try{raw=await readJson(r);}catch{return json({error:"Neplatné údaje."},400);}if(!raw||!Number.isInteger(raw.version))return json({error:"Chybí verze záznamu."},400);
 const {id}=await ctx.params;try{const row=await runtime().DB.prepare("DELETE FROM leads WHERE id=? AND version=? RETURNING id").bind(id,raw.version).first();return row?json({deleted:true}):json({error:"Záznam se mezitím změnil. Obnovte přehled."},409);}catch{return json({error:"Záznam se nepodařilo smazat."},503);}
}
