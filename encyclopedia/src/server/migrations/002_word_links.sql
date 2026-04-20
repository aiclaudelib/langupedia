CREATE TABLE word_links (
  id                INTEGER PRIMARY KEY,
  project_id        TEXT NOT NULL,
  source_word_id    INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  lang              TEXT NOT NULL,
  target_word_lc    TEXT NOT NULL,
  target_word_id    INTEGER REFERENCES words(id) ON DELETE SET NULL,
  field             TEXT NOT NULL,
  display_text      TEXT
);
CREATE INDEX idx_links_source ON word_links(source_word_id);
CREATE INDEX idx_links_target ON word_links(target_word_id) WHERE target_word_id IS NOT NULL;
CREATE INDEX idx_links_unresolved ON word_links(project_id, target_word_lc) WHERE target_word_id IS NULL;
