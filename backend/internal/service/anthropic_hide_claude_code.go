package service

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

const (
	anthropicClaudeCodeBetaToken   = "claude-code-20250219"
	anthropicBillingHeaderPrefix   = "x-anthropic-billing-header:"
	anthropicHiddenClaudeCodeAgent = "ai-sdk/anthropic"
)

// IsAnthropicClaudeCodeIdentityHidden applies only to Anthropic API key accounts.
// Some keys are rejected upstream with a misleading "credit balance" error when the
// request looks like Claude Code traffic.
func (a *Account) IsAnthropicClaudeCodeIdentityHidden() bool {
	if a == nil || a.Platform != PlatformAnthropic || a.Type != AccountTypeAPIKey {
		return false
	}
	hidden, _ := a.Extra["anthropic_hide_claude_code"].(bool)
	return hidden
}

// hideAnthropicClaudeCodeBody drops the Claude Code billing marker from the system prompt.
func hideAnthropicClaudeCodeBody(account *Account, body []byte) []byte {
	if !account.IsAnthropicClaudeCodeIdentityHidden() {
		return body
	}
	system := gjson.GetBytes(body, "system")
	switch {
	case system.IsArray():
		items := system.Array()
		for i := len(items) - 1; i >= 0; i-- {
			text := strings.TrimSpace(items[i].Get("text").String())
			if !strings.HasPrefix(strings.ToLower(text), anthropicBillingHeaderPrefix) {
				continue
			}
			if next, err := sjson.DeleteBytes(body, "system."+strconv.Itoa(i)); err == nil {
				body = next
			}
		}
	case system.Type == gjson.String:
		text := system.String()
		if strings.HasPrefix(strings.ToLower(strings.TrimSpace(text)), anthropicBillingHeaderPrefix) {
			rest := ""
			if idx := strings.Index(text, "\n"); idx >= 0 {
				rest = strings.TrimLeft(text[idx+1:], "\r\n")
			}
			if rest == "" {
				if next, err := sjson.DeleteBytes(body, "system"); err == nil {
					body = next
				}
			} else if next, err := sjson.SetBytes(body, "system", rest); err == nil {
				body = next
			}
		}
	}
	return rewriteClaudeCodeSystemIdentity(body)
}

var claudeCodeIdentityReplacer = strings.NewReplacer(
	"Anthropic's official CLI for Claude", "the official CLI for Claude",
	"Anthropic's Claude Agent SDK", "the Claude Agent SDK",
)

// rewriteClaudeCodeSystemIdentity rewords the fixed Claude Code identity sentences
// that upstream matches on, in every system text block.
func rewriteClaudeCodeSystemIdentity(body []byte) []byte {
	system := gjson.GetBytes(body, "system")
	switch {
	case system.IsArray():
		for i, item := range system.Array() {
			text := item.Get("text").String()
			if replaced := claudeCodeIdentityReplacer.Replace(text); replaced != text {
				if next, err := sjson.SetBytes(body, "system."+strconv.Itoa(i)+".text", replaced); err == nil {
					body = next
				}
			}
		}
	case system.Type == gjson.String:
		text := system.String()
		if replaced := claudeCodeIdentityReplacer.Replace(text); replaced != text {
			if next, err := sjson.SetBytes(body, "system", replaced); err == nil {
				body = next
			}
		}
	}
	return body
}

// hideAnthropicClaudeCodeHeaders removes the Claude Code beta token and CLI user agent.
func hideAnthropicClaudeCodeHeaders(account *Account, h http.Header) {
	if !account.IsAnthropicClaudeCodeIdentityHidden() || h == nil {
		return
	}
	for key, values := range h {
		switch strings.ToLower(key) {
		case "anthropic-beta":
			joined := stripBetaTokens(strings.Join(values, ","), []string{anthropicClaudeCodeBetaToken})
			if strings.TrimSpace(joined) == "" {
				delete(h, key)
			} else {
				h[key] = []string{joined}
			}
		case "user-agent":
			for _, v := range values {
				lower := strings.ToLower(v)
				if strings.Contains(lower, "claude-cli") || strings.Contains(lower, "claude-code") {
					h[key] = []string{anthropicHiddenClaudeCodeAgent}
					break
				}
			}
		}
	}
}
