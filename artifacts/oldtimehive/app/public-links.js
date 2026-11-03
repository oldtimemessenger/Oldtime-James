// The owner's existing Cloudflare custom domain; this does not use Replit Publish.
export const PUBLIC_SITE_ORIGIN="https://heyoldtime.com";
export function postPublicLink(id,comment=""){
 const url=new URL(`/p/${encodeURIComponent(id)}`,PUBLIC_SITE_ORIGIN);
 if(comment)url.searchParams.set("comment",comment);
 return url;
}
export function placePublicLink(place){
 const url=new URL(`/place/${encodeURIComponent(place.id)}`,PUBLIC_SITE_ORIGIN);
 if(place.label)url.searchParams.set("label",place.label);
 return url;
}
