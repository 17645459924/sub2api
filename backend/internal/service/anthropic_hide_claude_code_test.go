package service

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func hideClaudeCodeTestAccount(enabled bool) *Account {
	return &Account{
		Platform: PlatformAnthropic,
		Type:     AccountTypeAPIKey,
		Extra:    map[string]any{"anthropic_hide_claude_code": enabled},
	}
}

func TestHideAnthropicClaudeCodeBodyArraySystem(t *testing.T) {
	body := []byte(`{"system":[{"type":"text","text":"x-anthropic-billing-header: cc_version=2.1.0; cc_entrypoint=cli;"},{"type":"text","text":"You are helpful."}],"messages":[]}`)
	got := hideAnthropicClaudeCodeBody(hideClaudeCodeTestAccount(true), body)
	require.Equal(t, int64(1), gjson.GetBytes(got, "system.#").Int())
	require.Equal(t, "You are helpful.", gjson.GetBytes(got, "system.0.text").String())

	untouched := hideAnthropicClaudeCodeBody(hideClaudeCodeTestAccount(false), body)
	require.Equal(t, body, untouched)
}

func TestHideAnthropicClaudeCodeBodyStringSystem(t *testing.T) {
	body := []byte(`{"system":"x-anthropic-billing-header: cc_version=2.1.0;\nKeep this","messages":[]}`)
	got := hideAnthropicClaudeCodeBody(hideClaudeCodeTestAccount(true), body)
	require.Equal(t, "Keep this", gjson.GetBytes(got, "system").String())

	only := []byte(`{"system":"x-anthropic-billing-header: cc_version=2.1.0;","messages":[]}`)
	got = hideAnthropicClaudeCodeBody(hideClaudeCodeTestAccount(true), only)
	require.False(t, gjson.GetBytes(got, "system").Exists())
}

func TestHideAnthropicClaudeCodeBodyRewritesIdentity(t *testing.T) {
	body := []byte(`{"system":[{"type":"text","text":"x-anthropic-billing-header: cc_version=2.1.0;"},{"type":"text","text":"You are Claude Code, Anthropic's official CLI for Claude."},{"type":"text","text":"You are a Claude agent, built on Anthropic's Claude Agent SDK."}],"messages":[]}`)
	got := hideAnthropicClaudeCodeBody(hideClaudeCodeTestAccount(true), body)
	require.Equal(t, int64(2), gjson.GetBytes(got, "system.#").Int())
	require.Equal(t, "You are Claude Code, the official CLI for Claude.", gjson.GetBytes(got, "system.0.text").String())
	require.Equal(t, "You are a Claude agent, built on the Claude Agent SDK.", gjson.GetBytes(got, "system.1.text").String())

	str := []byte(`{"system":"You are Claude Code, Anthropic's official CLI for Claude.\nMore.","messages":[]}`)
	got = hideAnthropicClaudeCodeBody(hideClaudeCodeTestAccount(true), str)
	require.Equal(t, "You are Claude Code, the official CLI for Claude.\nMore.", gjson.GetBytes(got, "system").String())

	untouched := hideAnthropicClaudeCodeBody(hideClaudeCodeTestAccount(false), body)
	require.Equal(t, body, untouched)
}

func TestHideAnthropicClaudeCodeHeaders(t *testing.T) {
	h := http.Header{}
	h.Set("anthropic-beta", "claude-code-20250219,interleaved-thinking-2025-05-14")
	h.Set("User-Agent", "claude-cli/2.1.0 (external, cli)")
	hideAnthropicClaudeCodeHeaders(hideClaudeCodeTestAccount(true), h)
	require.Equal(t, "interleaved-thinking-2025-05-14", h.Get("anthropic-beta"))
	require.Equal(t, anthropicHiddenClaudeCodeAgent, h.Get("User-Agent"))

	only := http.Header{}
	only.Set("anthropic-beta", "claude-code-20250219")
	hideAnthropicClaudeCodeHeaders(hideClaudeCodeTestAccount(true), only)
	require.Empty(t, only.Get("anthropic-beta"))

	keep := http.Header{}
	keep.Set("User-Agent", "claude-cli/2.1.0")
	hideAnthropicClaudeCodeHeaders(hideClaudeCodeTestAccount(false), keep)
	require.Equal(t, "claude-cli/2.1.0", keep.Get("User-Agent"))
}
