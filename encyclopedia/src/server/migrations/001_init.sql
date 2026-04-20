CREATE TABLE projects (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  title      TEXT NOT NULL,
  subtitle   TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE words (
  id              INTEGER PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  word            TEXT NOT NULL,
  pronunciation   TEXT,
  part_of_speech  TEXT CHECK (part_of_speech IS NULL OR json_valid(part_of_speech)),
  cefr_level      TEXT,
  forms           TEXT,
  image           TEXT,
  audio           TEXT CHECK (audio IS NULL OR json_valid(audio)),
  meta            TEXT CHECK (meta  IS NULL OR json_valid(meta)),
  UNIQUE (project_id, word COLLATE NOCASE)
);
CREATE INDEX idx_words_project_word ON words(project_id, word COLLATE NOCASE);
CREATE INDEX idx_words_project_cefr ON words(project_id, cefr_level);

CREATE TABLE word_translations (
  word_id        INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  lang           TEXT NOT NULL,
  definitions    TEXT CHECK (definitions   IS NULL OR json_valid(definitions)),
  main_examples  TEXT CHECK (main_examples IS NULL OR json_valid(main_examples)),
  usage_note     TEXT,
  comparisons    TEXT CHECK (comparisons   IS NULL OR json_valid(comparisons)),
  collocations   TEXT CHECK (collocations  IS NULL OR json_valid(collocations)),
  idioms         TEXT CHECK (idioms        IS NULL OR json_valid(idioms)),
  related_forms  TEXT CHECK (related_forms IS NULL OR json_valid(related_forms)),
  word_history   TEXT,
  context_story  TEXT,
  PRIMARY KEY (word_id, lang)
);
