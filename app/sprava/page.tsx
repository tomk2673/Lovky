import { adminIdentity, config } from "../../lib/server";
import { requireChatGPTUser } from "../chatgpt-auth";
import Dashboard from "./dashboard";
export const dynamic="force-dynamic";
export default async function AdminPage(){
 await requireChatGPTUser("/sprava");
 if(!await adminIdentity())return <main className="access-denied container"><a href="/" className="brand">LOVKY<span>↗</span></a><h1>Přístup jen pro správce.</h1><p>Tento účet nemá oprávnění k přehledu poptávek.</p><a className="button" href="/">Zpět na web</a></main>;
 const c=config();return <Dashboard pilot={c.pilot} missing={c.missing} partner={c.partner}/>;
}
