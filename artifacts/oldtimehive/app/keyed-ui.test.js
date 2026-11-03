import test from "node:test";
import assert from "node:assert/strict";
import {reconcileChildren} from "./keyed-ui.js";
class Node {
  constructor(tag, attrs = {}, children = []) {
    this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attrs = new Map(Object.entries(attrs));
    this.childNodes = []; for (const child of children) this.insertBefore(child, null);
  }
  get attributes() { return [...this.attrs].map(([name,value]) => ({name,value})); }
  hasAttribute(name) { return this.attrs.has(name); }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  setAttribute(name,value) { this.attrs.set(name,value); }
  removeAttribute(name) { this.attrs.delete(name); }
  get firstChild() { return this.childNodes[0] || null; }
  get nextSibling() { const list = this.parentNode?.childNodes || []; return list[list.indexOf(this)+1] || null; }
  matches(selector) { return selector.split(",").includes(this.tagName.toLowerCase()); }
  remove() { if (this.parentNode) this.parentNode.childNodes.splice(this.parentNode.childNodes.indexOf(this),1); this.parentNode = null; }
  insertBefore(node,cursor) { node.remove(); const index = cursor ? this.childNodes.indexOf(cursor) : this.childNodes.length; this.childNodes.splice(index,0,node); node.parentNode = this; }
  cloneNode() { return new Node(this.tagName,Object.fromEntries(this.attrs),this.childNodes.map(child=>child.cloneNode(true))); }
}
test("inbox reorder retains each conversation node instead of replacing the list", () => {
  const a = new Node("div",{"data-inbox-row":"a"}), b = new Node("div",{"data-inbox-row":"b"});
  const root = new Node("section",{},[a,b]);
  const incoming = new Node("section",{},[new Node("div",{"data-inbox-row":"b"}),new Node("div",{"data-inbox-row":"a"})]);
  reconcileChildren(root,incoming);
  assert.equal(root.childNodes[0],b); assert.equal(root.childNodes[1],a);
});
test("thread refresh keeps the input, its draft and existing video decoder", () => {
  const input = new Node("input",{id:"msg"}); input.value = "Unsent draft";
  const video = new Node("video",{"data-local-media":"oldtime-media:one",src:"blob:resolved"}); video.currentTime = 7;
  const row = new Node("div",{"data-message-key":"one"},[video]);
  const root = new Node("section",{},[row,input]);
  reconcileChildren(root,new Node("section",{},[
    new Node("div",{"data-message-key":"one"},[new Node("video",{"data-local-media":"oldtime-media:one"})]),
    new Node("input",{id:"msg"}),new Node("div",{"data-message-key":"two"})
  ]));
  assert.equal(root.childNodes[0],row); assert.equal(root.childNodes[1],input);
  assert.equal(input.value,"Unsent draft"); assert.equal(row.firstChild,video);
  assert.equal(video.currentTime,7); assert.equal(video.getAttribute("src"),"blob:resolved");
});
test("a removed message does not replace neighboring messages", () => {
  const a = new Node("div",{"data-message-key":"a"}), b = new Node("div",{"data-message-key":"b"});
  const root = new Node("section",{},[a,b]);
  reconcileChildren(root,new Node("section",{},[new Node("div",{"data-message-key":"b"})]));
  assert.deepEqual(root.childNodes,[b]); assert.equal(a.parentNode,null);
});
test("avatar and title buttons sharing a conversation action both survive refresh", () => {
  const avatar = new Node("button",{"data-cv":"group",class:"avatar"});
  const title = new Node("button",{"data-cv":"group",class:"title"});
  const root = new Node("div",{},[avatar,title]);
  reconcileChildren(root,new Node("div",{},[new Node("button",{"data-cv":"group",class:"avatar"}),new Node("button",{"data-cv":"group",class:"title"})]));
  assert.deepEqual(root.childNodes,[avatar,title]);
});
