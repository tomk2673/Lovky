import {publicConfig} from "../lib/server";import Landing from "./landing";
export const dynamic="force-dynamic";export default function Page(){return <Landing config={publicConfig()}/>;}
