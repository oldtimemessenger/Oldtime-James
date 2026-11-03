-- Text metadata only: external-content FTS avoids storing a second full body in FTS.
CREATE TABLE discovery_documents (
  post_id TEXT PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  topic_text TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  pipeline_version TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX discovery_documents_version_idx ON discovery_documents(pipeline_version);
CREATE VIRTUAL TABLE discovery_fts USING fts5(
  body, topic_text, content='discovery_documents', content_rowid='rowid',
  tokenize='porter unicode61 remove_diacritics 2'
);
CREATE TRIGGER discovery_documents_insert AFTER INSERT ON discovery_documents BEGIN
  INSERT INTO discovery_fts(rowid,body,topic_text) VALUES(new.rowid,new.body,new.topic_text);
END;
CREATE TRIGGER discovery_documents_delete AFTER DELETE ON discovery_documents BEGIN
  INSERT INTO discovery_fts(discovery_fts,rowid,body,topic_text) VALUES('delete',old.rowid,old.body,old.topic_text);
END;
CREATE TRIGGER discovery_documents_update AFTER UPDATE ON discovery_documents BEGIN
  INSERT INTO discovery_fts(discovery_fts,rowid,body,topic_text) VALUES('delete',old.rowid,old.body,old.topic_text);
  INSERT INTO discovery_fts(rowid,body,topic_text) VALUES(new.rowid,new.body,new.topic_text);
END;
CREATE TABLE discovery_post_topics (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  confidence REAL NOT NULL CHECK(confidence>=0 AND confidence<=1),
  PRIMARY KEY(post_id,topic_id)
);
CREATE INDEX discovery_topics_topic_idx ON discovery_post_topics(topic_id,post_id);
CREATE TABLE discovery_topic_overrides (
  post_id TEXT PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  excluded_topics TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE discovery_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  hidden_topics TEXT NOT NULL DEFAULT '[]',
  personalize INTEGER NOT NULL DEFAULT 1 CHECK(personalize IN(0,1))
);
CREATE INDEX posts_discovery_public_idx ON posts(created_at DESC,id DESC) WHERE visibility='public';
CREATE INDEX users_discovery_username_idx ON users(username COLLATE NOCASE);

CREATE TRIGGER posts_discovery_insert AFTER INSERT ON posts WHEN new.visibility='public' BEGIN
  INSERT INTO discovery_documents(post_id,body) VALUES(new.id,new.text||' '||coalesce(json_extract(new.place,'$.label'),''));
END;
CREATE TRIGGER posts_discovery_update AFTER UPDATE OF text,place,visibility ON posts BEGIN
  DELETE FROM discovery_documents WHERE post_id=old.id;
  DELETE FROM discovery_post_topics WHERE post_id=old.id;
  INSERT INTO discovery_documents(post_id,body)
    SELECT new.id,new.text||' '||coalesce(json_extract(new.place,'$.label'),'') WHERE new.visibility='public';
END;
INSERT INTO discovery_documents(post_id,body)
  SELECT id,text||' '||coalesce(json_extract(place,'$.label'),'') FROM posts WHERE visibility='public';

-- Profiles are searchable by public identity only; account privacy is checked at read time.
CREATE VIRTUAL TABLE discovery_people_fts USING fts5(
  username,display_name,content='users',content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);
INSERT INTO discovery_people_fts(discovery_people_fts) VALUES('rebuild');
CREATE TRIGGER users_discovery_insert AFTER INSERT ON users BEGIN
  INSERT INTO discovery_people_fts(rowid,username,display_name) VALUES(new.rowid,new.username,new.display_name);
END;
CREATE TRIGGER users_discovery_delete AFTER DELETE ON users BEGIN
  INSERT INTO discovery_people_fts(discovery_people_fts,rowid,username,display_name)
    VALUES('delete',old.rowid,old.username,old.display_name);
END;
CREATE TRIGGER users_discovery_update AFTER UPDATE OF username,display_name ON users BEGIN
  INSERT INTO discovery_people_fts(discovery_people_fts,rowid,username,display_name)
    VALUES('delete',old.rowid,old.username,old.display_name);
  INSERT INTO discovery_people_fts(rowid,username,display_name) VALUES(new.rowid,new.username,new.display_name);
END;
