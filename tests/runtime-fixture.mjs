export const state={headers:new Headers()};
export const env={};
export async function headers(){return state.headers;}
export function redirect(url){throw new Error("Redirect: "+url);}
