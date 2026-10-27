import { z } from "zod";
export const entities=["OSVČ","s.r.o.","a.s.","Jiný podnikatelský subjekt"] as const;
export const purposes=["Provozní kapitál","Investice a rozvoj","Podnikatelská nemovitost","Refinancování podnikatelských závazků"] as const;
export const properties=["Byt","Rodinný dům","Komerční nemovitost","Pozemek","Jiná nemovitost"] as const;
export const urgencies=["Co nejdříve","Do 30 dnů","Do 3 měsíců","Zjišťuji možnosti"] as const;
export const statuses=["new","contacted","handed_over","won","closed"] as const;
export const statusLabels:Record<string,string>={new:"Nová",contacted:"Řeší se",handed_over:"Předána",won:"Realizována",closed:"Uzavřena"};
export const TEST_CONTACT={company:"Modelová firma s.r.o.",ico:"00000019",name:"Testovací žadatel",phone:"+420000000000",email:"test@example.invalid"};
export const PRIVACY_VERSION="2026-10-26.1";
const money=z.number().int().min(1,"Zadejte kladnou částku.").max(1_000_000_000);
export const leadSchema=z.object({
 entity:z.enum(entities),company:z.string().trim().min(2).max(160),ico:z.string().regex(/^\d{8}$/,"IČO musí mít 8 číslic."),
 amount:money,purpose:z.enum(purposes),property:z.enum(properties),propertyValue:money.nullable(),lien:z.enum(["Ano","Ne","Nevím"]),urgency:z.enum(urgencies),
 name:z.string().trim().min(2).max(120),phone:z.string().trim().max(30).regex(/^\+?[\d\s()-]{9,25}$/).refine(v=>{const n=v.replace(/\D/g,"").length;return n>=9&&n<=15;},"Zkontrolujte telefon."),
 email:z.union([z.literal(""),z.string().trim().email().max(254)]),businessPurpose:z.literal(true),consent:z.literal(true),
 privacyVersion:z.literal(PRIVACY_VERSION),isTest:z.boolean(),website:z.string().max(0)
}).strict();
export type LeadInput=z.infer<typeof leadSchema>;
export type LeadData=Omit<LeadInput,"website">;
export type LeadRow={id:string;created_at:number;updated_at:number;version:number;status:string;is_test:number;data:string;note:string;expected_cents:number;paid_cents:number;consent_at:number;privacy_version:string;recipient_snapshot:string};
export type Lead=Omit<LeadRow,"data"|"recipient_snapshot">&{data:LeadData;recipient:{operator:string;partner:string}};
export const updateSchema=z.object({version:z.number().int().min(1),status:z.enum(statuses),note:z.string().trim().max(2000),expectedCents:z.number().int().min(0).max(100_000_000),paidCents:z.number().int().min(0).max(100_000_000)}).strict();
export function parseWholeMoney(value:string):number|null { const clean=value.replace(/[\s\u00a0\u202f]/g,"");if(!/^\d{1,10}$/.test(clean))return null;const n=Number(clean);return Number.isSafeInteger(n)&&n>0&&n<=1_000_000_000?n:null; }
export function parseCents(value:string):number|null { const clean=value.replace(/[\s\u00a0\u202f]/g,"").replace(",",".");if(!/^\d{1,7}(\.\d{1,2})?$/.test(clean))return null;const n=Math.round(Number(clean)*100);return n<=100_000_000?n:null; }
export function csvCell(value:unknown){let s=String(value??"");if(/^[\s]*[=+\-@]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
export const formatMoney=(n:number)=>new Intl.NumberFormat("cs-CZ",{style:"currency",currency:"CZK",minimumFractionDigits:0,maximumFractionDigits:2}).format(n);
