const areas=new Set(["country","state","region","county","city","town","village","hamlet","suburb","neighbourhood","continent","island","municipality","administrative"]);
const venues=new Set(["restaurant","cafe","fast food","bar","pub","biergarten","bakery","ice cream","park","garden","nature reserve","playground","beach","attraction","museum","gallery","viewpoint","hotel","hostel","motel","zoo","aquarium","theme park","water park","stadium","sports centre","cinema","theatre","mall","supermarket","convenience","clothes","clothing","books","gift","department store","beauty","hairdresser"]);
export function canRatePlace(place:{source?:string;category?:string;kind?:string}) {
 const category=String(place.category||"").toLowerCase().replaceAll("_"," ");
 return place.source==="osm"&&!areas.has(category)&&place.kind!=="area"&&(place.kind==="venue"||venues.has(category));
}
