package hotmoney

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
)

const sessionSchema = `
CREATE TABLE IF NOT EXISTS hotmoney_sessions (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	title TEXT NOT NULL,
	preview TEXT NOT NULL DEFAULT '',
	messages_json TEXT NOT NULL,
	html_report TEXT NOT NULL DEFAULT '',
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hotmoney_sessions_user ON hotmoney_sessions(user_id, updated_at DESC);
`

// ChatMessage is a persisted hotmoney chat turn.
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// SessionSummary is a list-row view of a saved session.
type SessionSummary struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Preview   string    `json:"preview"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// Session is a full saved hotmoney chat session.
type Session struct {
	ID         string        `json:"id"`
	UserID     string        `json:"userId"`
	Title      string        `json:"title"`
	Preview    string        `json:"preview"`
	Messages   []ChatMessage `json:"messages"`
	HTMLReport string        `json:"htmlReport"`
	CreatedAt  time.Time     `json:"createdAt"`
	UpdatedAt  time.Time     `json:"updatedAt"`
}

// SaveSessionInput upserts a session for a user.
type SaveSessionInput struct {
	ID         string
	Title      string
	Messages   []ChatMessage
	HTMLReport string
}

// SessionStore persists hotmoney chat sessions in SQLite.
type SessionStore struct {
	db *sql.DB
}

// OpenSessionStore opens (or creates) hotmoney.db and runs migrations.
func OpenSessionStore(dbPath string) (*SessionStore, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, err
	}
	if _, err := db.Exec(sessionSchema); err != nil {
		db.Close()
		return nil, err
	}
	return &SessionStore{db: db}, nil
}

func (s *SessionStore) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	return s.db.Close()
}

// ListSessions returns recent sessions for a user.
func (s *SessionStore) ListSessions(ctx context.Context, userID string, limit int) ([]SessionSummary, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, title, preview, updated_at FROM hotmoney_sessions
		 WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?`,
		userID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []SessionSummary
	for rows.Next() {
		var sum SessionSummary
		var updated int64
		if err := rows.Scan(&sum.ID, &sum.Title, &sum.Preview, &updated); err != nil {
			return nil, err
		}
		sum.UpdatedAt = time.Unix(updated, 0)
		out = append(out, sum)
	}
	return out, rows.Err()
}

// GetSession loads a session scoped to userID.
func (s *SessionStore) GetSession(ctx context.Context, userID, id string) (*Session, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT id, user_id, title, preview, messages_json, html_report, created_at, updated_at
		 FROM hotmoney_sessions WHERE id = ? AND user_id = ?`,
		id, userID,
	)
	var sess Session
	var messagesJSON string
	var created, updated int64
	if err := row.Scan(&sess.ID, &sess.UserID, &sess.Title, &sess.Preview, &messagesJSON, &sess.HTMLReport, &created, &updated); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("session not found")
		}
		return nil, err
	}
	if err := json.Unmarshal([]byte(messagesJSON), &sess.Messages); err != nil {
		return nil, err
	}
	sess.CreatedAt = time.Unix(created, 0)
	sess.UpdatedAt = time.Unix(updated, 0)
	sess.Preview = sess.Preview
	return &sess, nil
}

// SaveSession upserts a session for userID.
func (s *SessionStore) SaveSession(ctx context.Context, userID string, in SaveSessionInput) (*Session, error) {
	if len(in.Messages) == 0 {
		return nil, fmt.Errorf("messages required")
	}
	id := strings.TrimSpace(in.ID)
	if id == "" {
		id = uuid.New().String()
	}
	title := strings.TrimSpace(in.Title)
	if title == "" {
		title = deriveSessionTitle(in.Messages)
	}
	preview := derivePreview(in.Messages, in.HTMLReport)
	now := time.Now().Unix()

	messagesJSON, err := json.Marshal(in.Messages)
	if err != nil {
		return nil, err
	}

	var createdAt int64
	err = s.db.QueryRowContext(ctx, `SELECT created_at FROM hotmoney_sessions WHERE id = ? AND user_id = ?`, id, userID).Scan(&createdAt)
	if err == sql.ErrNoRows {
		createdAt = now
		_, err = s.db.ExecContext(ctx,
			`INSERT INTO hotmoney_sessions (id, user_id, title, preview, messages_json, html_report, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			id, userID, title, preview, string(messagesJSON), in.HTMLReport, createdAt, now,
		)
	} else if err != nil {
		return nil, err
	} else {
		_, err = s.db.ExecContext(ctx,
			`UPDATE hotmoney_sessions SET title = ?, preview = ?, messages_json = ?, html_report = ?, updated_at = ?
			 WHERE id = ? AND user_id = ?`,
			title, preview, string(messagesJSON), in.HTMLReport, now, id, userID,
		)
	}
	if err != nil {
		return nil, err
	}
	return s.GetSession(ctx, userID, id)
}

// DeleteSession removes a session for userID.
func (s *SessionStore) DeleteSession(ctx context.Context, userID, id string) error {
	res, err := s.db.ExecContext(ctx,
		`DELETE FROM hotmoney_sessions WHERE id = ? AND user_id = ?`, id, userID,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("session not found")
	}
	return nil
}

func deriveSessionTitle(msgs []ChatMessage) string {
	for _, m := range msgs {
		if m.Role != "user" {
			continue
		}
		text := strings.TrimSpace(m.Content)
		if text == "" {
			continue
		}
		runes := []rune(text)
		if len(runes) > 40 {
			return string(runes[:40]) + "…"
		}
		return text
	}
	return "游资看盘会话"
}

func derivePreview(msgs []ChatMessage, htmlReport string) string {
	for i := len(msgs) - 1; i >= 0; i-- {
		if msgs[i].Role != "assistant" {
			continue
		}
		text := strings.TrimSpace(msgs[i].Content)
		if text == "" && htmlReport != "" {
			text = htmlReport
		}
		text = strings.ReplaceAll(text, "\n", " ")
		runes := []rune(text)
		if len(runes) > 120 {
			return string(runes[:120]) + "…"
		}
		if text != "" {
			return text
		}
	}
	return ""
}
