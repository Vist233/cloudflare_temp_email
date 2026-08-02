-- Stable OIDC subjects are the authority for federated tmpmail identities.
-- Email is intentionally not used as an ongoing identifier because it may change.
CREATE TABLE IF NOT EXISTS user_identities (
    id INTEGER PRIMARY KEY,
    provider TEXT NOT NULL,
    subject TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, subject),
    UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_identities_user_id ON user_identities(user_id);
