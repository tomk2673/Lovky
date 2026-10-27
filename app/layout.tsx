import type {Metadata} from "next";
import {config} from "../lib/server";
import "./globals.css";
export const dynamic="force-dynamic";
export function generateMetadata():Metadata{
 const c=config();
 return {title:"LOVKY · Podnikatelské financování",description:"Nezávazná poptávka podnikatelského financování se zajištěním nemovitosti.",robots:{index:!c.pilot,follow:!c.pilot},icons:{icon:"/favicon.svg"}};
}
export default function Layout({children}:{children:React.ReactNode}){return <html lang="cs"><body>{children}</body></html>;}
