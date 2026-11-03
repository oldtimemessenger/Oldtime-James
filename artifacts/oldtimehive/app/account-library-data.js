// Private account tools use the authenticated API, never a browser-only store.
export function createAccountLibraryData({ api, request }) {
  const owner = api.cloudAccountId();
  const check = () => {
    if (!owner || api.cloudAccountId() !== owner) throw new Error("Your account changed. Open this page again.");
  };
  const state = async () => { check(); const value=await api.loadCloudAccountState(); check(); return value; };
  const write = async patch => { check(); await api.updateCloudAccountState(patch,{patchOnly:true}); check(); };
  const posts = result => ({...result,posts:api.cacheCloudExplorePosts(result.posts)});
  return {
    async saved({filter="all",offset=0,limit=18}={}) {
      check(); const value=await request(`/api/account/library/saved?filter=${encodeURIComponent(filter)}&offset=${offset}&limit=${limit}`);check();return posts(value);
    },
    async audio() { check();const value=await request("/api/sounds/library");check();return value; },
    async collections() {
      const value=await state();
      return {collections:(value.savedCollections||[]).map(c=>({...c,title:c.name}))};
    },
    async saveCollection({id,title,postIds}) {
      const value=await state(),collections=value.savedCollections||[];
      const old=collections.find(c=>c.id===id);
      if(!old&&collections.length>=200)throw new Error("You can keep up to 200 collections.");
      const collection={id:old?.id||crypto.randomUUID(),name:String(title||"").trim(),postIds:[...new Set(postIds??old?.postIds??[])],createdAt:old?.createdAt||Date.now()};
      if(!collection.name||collection.name.length>60)throw new Error("Use a collection name between 1 and 60 characters.");
      await write({savedCollections:old?collections.map(c=>c.id===old.id?collection:c):[collection,...collections]});
      return {collection:{...collection,title:collection.name}};
    },
    async deleteCollection(id) {const value=await state();await write({savedCollections:(value.savedCollections||[]).filter(c=>c.id!==id)});},
    async archive({type="stories",offset=0,limit=18}={}) {
      check();
      const value=await request(`/api/${type==="stories"?"stories/archived":"posts/archived"}?offset=${offset}&limit=${limit}`);
      check();return type==="stories"?value:posts(value);
    },
    async preferences() {
      const value=await state();
      return {autoArchiveStories:value.archivePreferences?.autoArchiveStories!==false,allowPostArchive:value.archivePreferences?.allowPostArchive!==false};
    },
    async updatePreferences(patch) {
      const current=await this.preferences(),next={...current,...patch};
      await write({archivePreferences:next});return next;
    },
  };
}
