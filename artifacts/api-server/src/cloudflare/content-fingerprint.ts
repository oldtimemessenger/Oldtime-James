import { createHash } from "node:crypto";
export const meaningful=(text:string)=>text.trim().length>=20&&text.trim().split(/\s+/).length>=3;
export const textFingerprint=(text:string)=>createHash("sha256").update(text.trim().replace(/\s+/g," ").toLowerCase()).digest("hex");
