import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync,readdirSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {bannedPublicTerms,publicErrorMessage,publicNotice} from "../../../lib/public-copy/index.js";
const require=createRequire(new URL("../../api-server/package.json",import.meta.url)),ts=require("typescript");
const root=fileURLToPath(new URL("../../../",import.meta.url));
const walk=folder=>readdirSync(folder,{withFileTypes:true}).flatMap(entry=>{
 const full=path.join(folder,entry.name);
 return entry.isDirectory()?walk(full):/\.(js|ts|tsx)$/.test(entry.name)&&!/\.(test|integration)\./.test(entry.name)?[full]:[];
});
export function publicStrings(file) {
 const source=ts.createSourceFile(file,readFileSync(file,"utf8"),ts.ScriptTarget.Latest,true);
 const found=[];
 function visit(node){
  if(ts.isStringLiteralLike(node)||ts.isTemplateExpression(node)){
   const text=ts.isTemplateExpression(node)?node.head.text+node.templateSpans.map(s=>s.literal.text).join(" "):node.text;
   const parent=node.parent;
   const html=/<(?:div|button|section|span|p|h[1-6]|a|input|label|small|strong|textarea)\b/i.test(text);
   const property=ts.isPropertyAssignment(parent)&&/^(error|message|title|label|description|placeholder|emptyText|helpText)$/.test(parent.name.getText(source).replaceAll(/["']/g,""));
   const assignment=ts.isBinaryExpression(parent)&&parent.right===node&&/\.(textContent|placeholder|innerHTML|title)$/.test(parent.left.getText(source));
   const call=ts.isCallExpression(parent)&&/^(toast|alert|confirm|prompt)$/.test(parent.expression.getText(source));
   const apiError=ts.isNewExpression(parent)&&/ApiError$/.test(parent.expression.getText(source))&&parent.arguments?.[1]===node;
   if(html||property||assignment||call||apiError){
    const visible=html?text.replace(/<[^>]*>/g," ")+[...text.matchAll(/(?:aria-label|placeholder|title)="([^"]*)"/g)].map(m=>m[1]).join(" "):text;
    if(bannedPublicTerms.test(visible))found.push({file:path.relative(root,file),line:source.getLineAndCharacterOfPosition(node.pos).line+1,text:text.replace(/\s+/g," ").slice(0,600)});
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(source);return found;
}
test("no banned or internal terms appear in static user-facing app or API copy",()=>{
 const violations=[...walk(path.join(root,"artifacts/oldtimehive/app")),...walk(path.join(root,"artifacts/api-server/src"))]
  .flatMap(publicStrings);
 assert.deepEqual(violations,[],JSON.stringify(violations,null,2));
});
test("technical server errors are friendly while authored content is not rewritten",()=>{
 assert.equal(publicErrorMessage(new Error("D1_ERROR: internal query")),"Something went wrong. Please try again.");
 assert.equal(publicNotice("TypeError: Cannot read properties"),"Something went wrong. Please try again.");
 assert.equal(publicNotice("Following Engine"),"Following Engine");
 assert.equal(publicErrorMessage("Please choose a place."),"Please choose a place.");
});
