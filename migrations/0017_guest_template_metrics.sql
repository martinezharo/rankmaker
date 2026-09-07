-- Metadata only: no local template titles, options, content, IPs or user ids.
CREATE TABLE guest_template_metrics (
  local_id TEXT PRIMARY KEY,
  origin TEXT NOT NULL CHECK (origin IN ('new', 'recovered')),
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  first_played_at TEXT,
  converted_at TEXT,
  -- Retained after deletion so an import never becomes a second creation.
  imported_template_id TEXT
);
CREATE INDEX idx_guest_metrics_seen ON guest_template_metrics(first_seen_at);
CREATE INDEX idx_guest_metrics_converted ON guest_template_metrics(converted_at);
CREATE INDEX idx_guest_metrics_imported ON guest_template_metrics(imported_template_id);

CREATE TABLE measurement_metadata (
  name TEXT PRIMARY KEY,
  started_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO measurement_metadata(name) VALUES ('guest_templates');
