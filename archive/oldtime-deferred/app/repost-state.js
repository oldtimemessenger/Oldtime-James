const isRecord=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);

// Online posts retain only a reference and the user's note, never a content snapshot.
export function getRepostView(post,db) {
  if(!post)return post;
  const entries=post.cloud&&isRecord(db.localRepostsByPost?.[post.id])?db.localRepostsByPost[post.id]:{};
  const notes={...(isRecord(post.repostNotes)?post.repostNotes:{})};
  const authors=new Set(Array.isArray(post.reposts)?post.reposts:[]);
  for(const [author,entry] of Object.entries(entries)){
    if(!isRecord(entry)||typeof entry.note!=="string")continue;
    authors.add(author);
    if(entry.note)notes[author]=entry.note.slice(0,140);
  }
  return {...post,reposts:[...authors],repostNotes:notes};
}

export function writeRepost(db,current,author,note="",remove=false) {
  if(!current?.id||!author)throw new Error("Post unavailable.");
  const text=String(note).trim().slice(0,140);
  if(current.cloud){
    const all=isRecord(db.localRepostsByPost)?db.localRepostsByPost:{};
    const entries=Object.fromEntries(Object.entries(isRecord(all[current.id])?all[current.id]:{}).filter(([id])=>id!==author));
    if(!remove)entries[author]={note:text,at:Date.now()};
    const next=Object.fromEntries(Object.entries(all).filter(([id])=>id!==current.id));
    if(Object.keys(entries).length)next[current.id]=entries;
    db.localRepostsByPost=next;
    return;
  }
  const post=db.posts.find(p=>p.id===current.id);
  if(!post)throw new Error("Post no longer available.");
  const ids=[...new Set(post.reposts||[])].filter(id=>id!==author);
  post.reposts=remove?ids:[...ids,author];
  const notes=Object.fromEntries(Object.entries(isRecord(post.repostNotes)?post.repostNotes:{}).filter(([id])=>id!==author));
  if(!remove&&text)notes[author]=text;
  post.repostNotes=notes;
}
