const escape=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
export function shareMetadata(data,url) {
 const image=new URL(data.imagePath||"/app-icon-512.png",url).href;
 return `<title>${escape(data.title)} · Oldtime</title><meta name="description" content="${escape(data.description)}">
 <link rel="canonical" href="${escape(url.href)}"><meta property="og:type" content="website">
 <meta property="og:site_name" content="Oldtime"><meta property="og:title" content="${escape(data.title)}">
 <meta property="og:description" content="${escape(data.description)}"><meta property="og:url" content="${escape(url.href)}">
 <meta property="og:image" content="${escape(image)}"><meta name="twitter:card" content="summary_large_image">
 <meta name="twitter:title" content="${escape(data.title)}"><meta name="twitter:description" content="${escape(data.description)}">
 <meta name="twitter:image" content="${escape(image)}">`;
}
export function sharePage(data,url) {
 const app=new URL("/",url);
 if(data.postId)app.searchParams.set("post",data.postId);
 if(data.placeId){app.searchParams.set("place",data.placeId);app.searchParams.set("label",data.title);}
 if(url.searchParams.has("comment"))app.searchParams.set("comment",url.searchParams.get("comment"));
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
 ${shareMetadata(data,url)}<style>*{box-sizing:border-box}body{margin:0;background:#fff;color:#17191c;font:16px system-ui,-apple-system,sans-serif}
 main{max-width:560px;margin:auto;padding:24px 20px}header{display:flex;align-items:center;gap:10px;font-weight:700}header img{width:40px;height:40px}
 .cover{display:block;width:100%;max-height:60vh;object-fit:contain;border-radius:20px;background:#f3f4f6;margin:24px 0}
 h1{font-size:25px;line-height:1.2;overflow-wrap:anywhere}p{line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
 .open{display:block;padding:15px 20px;background:#1855d1;color:white;text-decoration:none;text-align:center;border-radius:14px;font-weight:600}
 footer{margin-top:24px;font-size:13px;color:#666}footer a{color:inherit}</style></head><body><main>
 <header><img src="/app-icon-512.png" alt="">Oldtime</header><img class="cover" src="${escape(new URL(data.imagePath||"/app-icon-512.png",url).href)}" alt="">
 <h1>${escape(data.title)}</h1><p>${escape(data.description)}</p><a class="open" href="${escape(app.href)}">Open in Oldtime</a>
 ${data.placeId?'<footer>Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a></footer>':""}
 </main></body></html>`;
}
export async function onRequest(context) {
 const url=new URL(context.request.url),match=/^\/(p|place)\/([^/]+)\/?$/.exec(url.pathname);
 if(!match)return context.next();
 let id;try{id=decodeURIComponent(match[2]);}catch{return new Response("This link isn’t available.",{status:404});}
 if(!context.env.OLDTIME_API?.fetch)return new Response("This preview isn’t available right now. Please try again.",{status:503});
 const apiUrl=new URL("/api/public/share",url);apiUrl.searchParams.set(match[1]==="p"?"post":"place",id);
 if(url.searchParams.has("label"))apiUrl.searchParams.set("label",url.searchParams.get("label"));
 try{
  const response=await context.env.OLDTIME_API.fetch(new Request(apiUrl,{headers:{accept:"application/json"}}));
  if(!response.ok)return new Response("This post or place isn’t available.",{status:response.status===404?404:503,headers:{"content-type":"text/plain; charset=utf-8","cache-control":"no-store"}});
  return new Response(sharePage(await response.json(),url),{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
 }catch(error){console.error("Share page unavailable",error);return new Response("This preview couldn’t load. Please try again.",{status:503});}
}
