import {csvCell,type LeadRow} from "../../../../lib/lead-validation";
import {adminIdentity,deserialize,json,purgeExpired,runtime} from "../../../../lib/server";
export async function GET(r:Request){
 if(!await adminIdentity())return json({error:"Přístup pouze pro správce."},403);
 try{
  await purgeExpired();const u=new URL(r.url),status=u.searchParams.get("status")||"",q=(u.searchParams.get("q")||"").trim().slice(0,100);
  const page=Math.max(0,Math.min(10000,Number(u.searchParams.get("page"))||0)),where=["1=1"],values:(string|number)[]=[];
  if(status){where.push("status=?");values.push(status);}
  if(q){where.push("(json_extract(data,'$.company') LIKE ? OR json_extract(data,'$.ico') LIKE ? OR json_extract(data,'$.name') LIKE ? OR json_extract(data,'$.phone') LIKE ?)");const term="%"+q+"%";values.push(term,term,term,term);}
  const db=runtime().DB,csv=u.searchParams.get("format")==="csv",limit=csv?1000:50;
  const rows=await db.prepare("SELECT * FROM leads WHERE "+where.join(" AND ")+" ORDER BY created_at DESC LIMIT ? OFFSET ?").bind(...values,limit,csv?0:Math.floor(page)*50).all<LeadRow>();
  const items=(rows.results||[]).map(deserialize);
  if(csv){
   const header=["ID","Přijato","Test","Firma","IČO","Částka Kč","Účel","Nemovitost","Odhad Kč","Zástava","Termín","Kontakt","Telefon","Email","Stav","Souhlas","Verze informací","Partner"];
   const lines=items.map(l=>[l.id,new Date(l.created_at).toISOString(),l.is_test?"ANO":"NE",l.data.company,l.data.ico,l.data.amount,l.data.purpose,l.data.property,l.data.propertyValue,l.data.lien,l.data.urgency,l.data.name,l.data.phone,l.data.email,l.status,new Date(l.consent_at).toISOString(),l.privacy_version,l.recipient.partner]);
   return new Response("\uFEFF"+[header,...lines].map(r=>r.map(csvCell).join(";")).join("\r\n"),{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":'attachment; filename="lovky-poptavky.csv"',"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
  }
  const count=await db.prepare("SELECT count(*) AS n FROM leads WHERE "+where.join(" AND ")).bind(...values).first<{n:number}>();
  const totals=await db.prepare("SELECT count(*) AS total,sum(CASE WHEN status='new' THEN 1 ELSE 0 END) AS fresh,sum(CASE WHEN status='handed_over' THEN 1 ELSE 0 END) AS handed,sum(CASE WHEN is_test=0 THEN expected_cents ELSE 0 END) AS expected,sum(CASE WHEN is_test=0 THEN paid_cents ELSE 0 END) AS paid FROM leads").first();
  return json({items,total:count?.n||0,totals,page});
 }catch{return json({error:"Přehled se nepodařilo načíst. Zkuste to znovu."},503);}
}
