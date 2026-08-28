-- One Click BP — schéma SQLite
-- Chaque projet appartient à un utilisateur ; aucune table ne permet à un
-- utilisateur d'atteindre les données d'un autre (toutes les requêtes de
-- l'application filtrent par user_id, voir server/services/projectService.js).

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_type TEXT NOT NULL CHECK(project_type IN ('nouvelle_entreprise','nouvelle_activite')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','generated')),
  current_step INTEGER NOT NULL DEFAULT 0,
  form_data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

CREATE TABLE IF NOT EXISTS balance_uploads (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  parse_status TEXT NOT NULL DEFAULT 'pending' CHECK(parse_status IN ('pending','ok','failed')),
  parse_error TEXT,
  analysis_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_balance_project ON balance_uploads(project_id);

CREATE TABLE IF NOT EXISTS generated_documents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  space TEXT NOT NULL CHECK(space IN ('entrepreneur','banque','aide')),
  doc_type TEXT NOT NULL CHECK(doc_type IN ('xlsx','pdf')),
  programme_id TEXT,
  label TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  langue TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_docs_project ON generated_documents(project_id);
