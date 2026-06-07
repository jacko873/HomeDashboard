// Package httpx contains small HTTP helpers shared by every API module:
// JSON responses, a uniform error envelope, and the middleware stack.
package httpx

import (
	"encoding/json"
	"net/http"
)

// JSON writes v as a JSON response with the given status code.
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// Error writes the uniform error envelope used by all API modules:
//
//	{"error": {"code": "unknown_player", "message": "..."}}
func Error(w http.ResponseWriter, status int, code, message string) {
	JSON(w, status, map[string]any{
		"error": map[string]string{"code": code, "message": message},
	})
}
