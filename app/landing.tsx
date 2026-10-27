"use client";
import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, Check, CheckCheck, ChevronLeft, FileText, Landmark, LockKeyhole, MoveUpRight } from "lucide-react";
import { entities, purposes, properties, urgencies, TEST_CONTACT, PRIVACY_VERSION, leadSchema, parseWholeMoney, formatMoney } from "../lib/lead-validation";
import type { PublicConfig } from "../lib/server";
import { createRequestKey } from "../lib/request-key";

type Fields={entity:string;company:string;ico:string;amount:string;purpose:string;property:string;propertyValue:string;lien:string;urgency:string;name:string;phone:string;email:string;businessPurpose:boolean;consent:boolean;website:string};
const base:Fields={entity:"s.r.o.",company:"",ico:"",amount:"",purpose:"",property:"",propertyValue:"",lien:"Nevím",urgency:"Do 30 dnů",name:"",phone:"",email:"",businessPurpose:false,consent:false,website:""};
const steps=["Vaše podnikání","Možné zajištění","Kontakt a odeslání"];
export default function Landing({config}:{config:PublicConfig}){
 const [data,setData]=useState<Fields>(()=>({...base,...(config.pilot?TEST_CONTACT:{})}));
 const [step,setStep]=useState(0),[error,setError]=useState(""),[busy,setBusy]=useState(false),[receipt,setReceipt]=useState("");
 const formTop=useRef<HTMLDivElement>(null),requestKey=useRef<string|null>(null);
 const set=(key:keyof Fields,value:string|boolean)=>{setData(old=>({...old,[key]:value}));setError("");};
 function move(next:number){setStep(next);setError("");formTop.current?.scrollIntoView({behavior:"smooth",block:"start"});}
 function validateStep(){
  if(step===0){if(!data.company.trim()||!/^\d{8}$/.test(data.ico))return "Doplňte název firmy a osmimístné IČO.";
   if(!parseWholeMoney(data.amount))return "Zadejte částku v celých Kč, například 3 500 000.";
   if(!data.purpose)return "Vyberte, na co finance potřebujete.";
   if(!data.businessPurpose)return "Potvrďte, že financování potřebujete pro podnikání.";}
  if(step===1){if(!data.property)return "Vyberte typ nemovitosti, která může sloužit jako zajištění.";
   if(data.propertyValue&&!parseWholeMoney(data.propertyValue))return "Odhad hodnoty zadejte v celých Kč, nebo pole nechte prázdné.";}
  return "";
 }
 async function submit(e:FormEvent){
  e.preventDefault();const message=validateStep();if(message){setError(message);return;}
  if(step<2){move(step+1);return;}
  const input={...data,amount:parseWholeMoney(data.amount),propertyValue:parseWholeMoney(data.propertyValue),privacyVersion:PRIVACY_VERSION,isTest:config.pilot};
  if(!leadSchema.safeParse(input).success){setError("Zkontrolujte jméno, telefon, e-mail a potvrzení před odesláním.");return;}
  setBusy(true);setError("");
  try{requestKey.current??=createRequestKey();const r=await fetch("/api/leads",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":requestKey.current},body:JSON.stringify(input)});
   const result=await r.json() as {id:string;error?:string};if(!r.ok)throw Error(result.error||"Poptávku se nepodařilo uložit.");
   setReceipt(result.id);formTop.current?.scrollIntoView({behavior:"smooth",block:"start"});
  }catch(e){setError(e instanceof Error?e.message:"Připojení se přerušilo. Zkuste odeslání znovu.");}
  finally{setBusy(false);}
 }
 function reset(){setReceipt("");setStep(0);setData({...base,...(config.pilot?TEST_CONTACT:{})});requestKey.current=null;setError("");}
 return <>
  <div className="pilot-bar">{config.pilot?<><span className="status-dot"/>Soukromý pilot <span className="pilot-divider">/</span> Vyzkoušejte průchod s modelovými kontakty.</>:<>Podnikatelské financování se zajištěním nemovitosti</>}</div>
  <header className="site-header"><div className="container nav-inner"><a href="/" className="brand" aria-label="LOVKY úvod">LOVKY<span>↗</span></a><nav aria-label="Hlavní navigace"><a href="#jak">Jak to funguje</a><a href="#otazky">Otázky</a><a href="#poptavka" className="button button-small">Nezávazná poptávka <ArrowUpRight size={16}/></a></nav></div></header>
  <main>
   <section className="hero"><div className="container hero-grid">
    <div className="hero-copy"><p className="eyebrow"><span/> PRO PODNIKATELE, KTEŘÍ CHTĚJÍ JÍT DÁL</p><h1>Prostor pro váš<br/><em>další krok.</em></h1><p className="hero-description">Máte plán. Potřebujete financování. Popište nám svou situaci a připravte přehlednou poptávku pro financujícího partnera.</p><a href="#poptavka" className="button button-gold">Popsat svou situaci <ArrowUpRight size={20}/></a><div className="hero-facts"><span><Check size={15}/> Pro OSVČ a firmy</span><span><Check size={15}/> Bez nahrávání dokladů</span></div><p className="hero-fine">Financování pro skutečný podnikatelský účel, se zajištěním nemovitostí.</p></div>
    <div className="request-visual" aria-label="Modelový příklad přehledu poptávky"><div className="visual-back"/><div className="request-paper">
     <div className="paper-top"><span className="paper-mark">L↗</span><span>MODELOVÝ PŘÍKLAD</span><MoveUpRight size={22}/></div>
     <p className="paper-label">PROSTOR PRO ROZVOJ</p><div className="paper-amount">3 500 000<span>Kč</span></div><div className="paper-line"/>
     <dl className="paper-data"><div><dt>Účel financování</dt><dd>Rozvoj podnikání</dd></div><div><dt>Možné zajištění</dt><dd>Komerční nemovitost</dd></div><div><dt>Další krok</dt><dd>Rozhovor s partnerem</dd></div></dl>
     <div className="paper-bottom"><span><CheckCheck size={17}/> Přehledná poptávka</span><span>01 — 03</span></div>
    </div><div className="visual-caption"><span className="tiny-line"/>JASNÝ ZAČÁTEK. INFORMOVANÉ ROZHODNUTÍ.</div></div>
   </div><div className="hero-bottom container"><span>VAŠE PODNIKÁNÍ. VAŠE DALŠÍ KAPITOLA.</span><a href="#jak">Začněme od základu <span>↓</span></a></div></section>

   <section className="how section-pad" id="jak"><div className="container"><div className="section-heading"><p className="eyebrow dark-eyebrow">JEDEN KONTAKT. JASNÝ POSTUP.</p><h2>Od vaší situace<br/>k dalšímu kroku.</h2><p>Žádné složité žádosti na začátku. Nejdřív základní informace, potom konkrétní rozhovor.</p></div>
    <div className="process-grid">
     <article><span className="process-number">01</span><FileText size={25}/><h3>Popíšete, co potřebujete.</h3><p>Podnikání, potřebnou částku a nemovitost, která může sloužit jako zajištění.</p></article>
     <article><span className="process-number">02</span><CheckCheck size={25}/><h3>Vznikne jedna poptávka.</h3><p>Informace se uloží do přehledu. Před odesláním uvidíte, komu je předáváte.</p></article>
     <article><span className="process-number">03</span><Landmark size={25}/><h3>Možnosti projde partner.</h3><p>Financující partner řeší posouzení, doklady i případnou nabídku. Podmínky určuje individuálně.</p></article>
    </div>
   </div></section>

   <section id="poptavka" className="assessment section-pad"><div className="container assessment-grid"><div className="assessment-copy"><p className="eyebrow dark-eyebrow">NEZÁVAZNÁ POPTÁVKA</p><h2>Začněte tím, <br/>co máte v plánu.</h2><p>Vyplňte základní údaje. Odeslání poptávky je zdarma a nezavazuje vás k uzavření smlouvy.</p><div className="calm-note"><LockKeyhole size={20}/><p>Údaje slouží k vyřízení této poptávky. Marketingový odběr při odeslání nevzniká.</p></div><div className="scope-note"><span>PRO KOHO</span><p>OSVČ a firmy s podnikatelským účelem a možností zajištění nemovitostí.</p></div><p className="fineprint">Odeslání není schválením úvěru ani příslibem financování. Pokud má úvěr sloužit soukromým potřebám, tato služba pro něj není určena.</p></div>
    <div className="form-shell" ref={formTop}>
    {receipt?<div className="receipt" role="status"><span className="receipt-icon"><CheckCheck size={30}/></span><p className="eyebrow dark-eyebrow">{config.pilot?"TEST PROŠEL":"PŘIJATO"}</p><h3>{config.pilot?"Testovací poptávka je uložená.":"Vaši poptávku jsme přijali."}</h3><p>{config.pilot?"Najdete ji ve svém přehledu poptávek. Zkuste změnit stav a zaevidovat provizi.":"Poptávka je připravena k vyřízení. O případných možnostech vás bude kontaktovat uvedený partner."}</p><div className="reference"><span>Číslo poptávky</span><code>{receipt}</code></div>{config.pilot&&<a className="button" href="/sprava">Otevřít přehled <ArrowUpRight size={18}/></a>}<button className="text-button" onClick={reset}>Vyplnit další poptávku</button></div>:
     <form onSubmit={submit} noValidate><div className="form-progress" aria-label={"Krok "+(step+1)+" ze 3"}>{steps.map((s,i)=><div className={i<=step?"current":""} key={s}><span>{i<step?<Check size={13}/>:i+1}</span><b>{s}</b></div>)}</div><div className="form-content"><div className="form-title"><span>0{step+1} / 03</span><h3>{steps[step]}</h3></div>
      {config.pilot&&<p className="form-pilot"><span className="status-dot"/>Modelové kontakty jsou předvyplněné. Částku a situaci můžete změnit.</p>}
      {step===0&&<div className="fields">
       <label>Forma podnikání<select value={data.entity} onChange={e=>set("entity",e.target.value)}>{entities.map(v=><option key={v}>{v}</option>)}</select></label>
       <label>Firma / jméno podnikatele<input autoComplete="organization" value={data.company} readOnly={config.pilot} maxLength={160} onChange={e=>set("company",e.target.value)} placeholder="Název vaší firmy"/></label>
       <div className="field-row"><label>IČO<input inputMode="numeric" value={data.ico} readOnly={config.pilot} maxLength={8} onChange={e=>set("ico",e.target.value)} placeholder="8 číslic"/></label><label>Potřebná částka v Kč<input inputMode="numeric" value={data.amount} onChange={e=>set("amount",e.target.value)} placeholder="Např. 3 500 000"/></label></div>
       <label>Na co finance potřebujete?<select value={data.purpose} onChange={e=>set("purpose",e.target.value)}><option value="">Vyberte účel</option>{purposes.map(v=><option key={v}>{v}</option>)}</select></label>
       <label className="checkbox-label"><input type="checkbox" checked={data.businessPurpose} onChange={e=>set("businessPurpose",e.target.checked)}/><span>Finance potřebuji výhradně pro své podnikání.</span></label>
      </div>}
      {step===1&&<div className="fields">
       <fieldset><legend>Jakou nemovitostí můžete financování zajistit?</legend><div className="choice-grid">{properties.map(v=><button type="button" key={v} aria-pressed={data.property===v} className={data.property===v?"choice selected":"choice"} onClick={()=>set("property",v)}>{v}{data.property===v&&<Check size={15}/>}</button>)}</div></fieldset>
       <label>Odhad hodnoty nemovitosti v Kč <span className="optional">nepovinné</span><input inputMode="numeric" value={data.propertyValue} onChange={e=>set("propertyValue",e.target.value)} placeholder="Např. 8 000 000"/><small>Stačí hrubý odhad. Znalecký posudek teď nepotřebujete.</small></label>
       <div className="field-row"><label>Je již zastavená?<select value={data.lien} onChange={e=>set("lien",e.target.value)}>{["Nevím","Ano","Ne"].map(v=><option key={v}>{v}</option>)}</select></label><label>Kdy finance potřebujete?<select value={data.urgency} onChange={e=>set("urgency",e.target.value)}>{urgencies.map(v=><option key={v}>{v}</option>)}</select></label></div>
      </div>}
      {step===2&&<div className="fields">
       <div className="review-box"><div><span>{data.company}</span><b>{formatMoney(parseWholeMoney(data.amount)||0)}</b></div><p>{data.purpose} · {data.property}</p><button type="button" onClick={()=>move(0)}>Upravit údaje</button></div>
       <label>Kontaktní osoba<input autoComplete="name" value={data.name} readOnly={config.pilot} maxLength={120} onChange={e=>set("name",e.target.value)} placeholder="Jméno a příjmení"/></label>
       <div className="field-row"><label>Telefon<input type="tel" autoComplete="tel" value={data.phone} readOnly={config.pilot} maxLength={30} onChange={e=>set("phone",e.target.value)} placeholder="+420 777 123 456"/></label><label>E-mail <span className="optional">nepovinné</span><input type="email" autoComplete="email" value={data.email} readOnly={config.pilot} maxLength={254} onChange={e=>set("email",e.target.value)} placeholder="vas@email.cz"/></label></div>
       {!config.pilot&&<p className="recipient">Provozovatel: <strong>{config.operator}</strong><br/>Příjemce poptávky: <strong>{config.partner}</strong></p>}
       <label className="checkbox-label"><input type="checkbox" checked={data.consent} onChange={e=>set("consent",e.target.checked)}/><span>{config.pilot?"Ukládám modelovou poptávku do soukromého pilotu.":<>Souhlasím se zpracováním uvedených údajů provozovatelem {config.operator} a předáním společnosti {config.partner} k vyřízení mé poptávky.</>} <a href="/ochrana-udaju" target="_blank" rel="noopener">Informace o zpracování údajů <ArrowUpRight size={12}/></a></span></label>
      </div>}
      <div className="honeypot" aria-hidden="true"><label>Váš web<input value={data.website} tabIndex={-1} autoComplete="off" onChange={e=>set("website",e.target.value)}/></label></div>
      {error&&<p className="error-box" role="alert">{error}</p>}
      <div className="form-actions">{step>0?<button type="button" className="text-button" disabled={busy} onClick={()=>move(step-1)}><ChevronLeft size={16}/> Zpět</button>:<span className="small-muted">3 jednoduché kroky</span>}<button type="submit" className="button" disabled={busy}>{busy?"Ukládám…":step<2?"Pokračovat":config.pilot?"Uložit testovací poptávku":"Odeslat nezávaznou poptávku"}{!busy&&<ArrowRight size={17}/>}</button></div>
      <p className="form-footnote"><LockKeyhole size={12}/> Přehled si před odesláním zkontrolujete.</p>
     </div></form>}
    </div>
   </div></section>

   <section id="otazky" className="faq-section section-pad"><div className="container faq-grid"><div className="section-heading"><p className="eyebrow dark-eyebrow">DOBRÉ VĚDĚT</p><h2>Jasno před <br/>prvním krokem.</h2></div><div className="faq-list">
    {[["Kdo rozhoduje o financování?","Financující partner. LOVKY shromažďuje nezávaznou poptávku a předává základní informace. Konečné posouzení, případné doklady i konkrétní podmínky řeší partner."],["Musím teď nahrávat doklady?","Ne. Na začátku stačí popsat situaci a uvést kontakt. Citlivé dokumenty do formuláře nevkládejte. Pokud je partner potřebuje, domluví s vámi jejich předání."],["Co když už je nemovitost zastavená?","Uveďte to v poptávce. Samotné vyplnění formuláře neříká, zda bude financování možné. Další okolnosti projde financující partner."],["Je služba i pro soukromé půjčky?","Tento formulář je určen výhradně k financování skutečného podnikatelského účelu. Soukromý účel se nestává podnikatelským jen uvedením IČO."],["Zavazuji se odesláním ke smlouvě?","Ne. Odeslání poptávky je nezávazné a zdarma. Případné financování a jeho náklady se řídí až konkrétní nabídkou a smlouvou s partnerem."]].map(([q,a])=><details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}
   </div></div></section>
  </main>
  <footer className="site-footer"><div className="container footer-top"><div><a href="/" className="brand">LOVKY<span>↗</span></a><p>Prostor pro další krok vašeho podnikání.</p></div><div className="footer-links"><a href="/ochrana-udaju">Ochrana údajů</a><a href="/podminky">Podmínky a provozovatel</a><a href="/sprava">Správa poptávek <ArrowUpRight size={13}/></a></div></div><div className="container footer-bottom"><span>{config.pilot?"Soukromý pilot · pouze modelové kontakty":config.operator}</span><span>Financování posuzuje financující partner.</span></div></footer>
 </>;
}
