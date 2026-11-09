//go:build unit

package service

import (
	"context"
	"io"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestAnthropicTemperatureForwarding(t *testing.T) {
	for _, passthrough := range []bool{false, true} {
		for _, stream := range []bool{false, true} {
			for _, tc := range []struct {
				name        string
				setting     any
				platform    string
				accountType string
				removed     bool
			}{
				{"enabled", true, PlatformAnthropic, AccountTypeAPIKey, true},
				{"disabled", false, PlatformAnthropic, AccountTypeAPIKey, false},
				{"missing", nil, PlatformAnthropic, AccountTypeAPIKey, false},
				{"invalid", "true", PlatformAnthropic, AccountTypeAPIKey, false},
				{"other platform", true, PlatformOpenAI, AccountTypeAPIKey, false},
			} {
				t.Run(tc.name+strconv.FormatBool(passthrough)+strconv.FormatBool(stream), func(t *testing.T) {
					account := newAnthropicAPIKeyAccountForTest()
					account.Platform = tc.platform
					account.Type = tc.accountType
					account.Extra = map[string]any{"anthropic_disable_temperature": tc.setting}
					svc := &GatewayService{cfg: messagesClampTestConfig()}
					c := newMessagesClampTestContext(t)
					body := []byte(`{"model":"claude-opus-5-5","temperature":1,"max_tokens":1024,"stream":` + strconv.FormatBool(stream) + `,"messages":[{"role":"user","content":"hi"}],"metadata":{"temperature":"keep"}}`)
					var wire []byte
					var requestBody io.ReadCloser
					if passthrough {
						req, sent, err := svc.buildUpstreamRequestAnthropicAPIKeyPassthrough(context.Background(), c, account, body, "test-key")
						require.NoError(t, err)
						wire, requestBody = sent, req.Body
					} else {
						req, sent, err := svc.buildUpstreamRequest(context.Background(), c, account, body, "test-key", "apikey", "claude-opus-5-5", stream, false)
						require.NoError(t, err)
						wire, requestBody = sent, req.Body
					}
					actual, err := io.ReadAll(requestBody)
					require.NoError(t, err)
					require.Equal(t, wire, actual)
					require.Equal(t, !tc.removed, gjson.GetBytes(actual, "temperature").Exists())
					require.Equal(t, "keep", gjson.GetBytes(actual, "metadata.temperature").String())
					require.Equal(t, "hi", gjson.GetBytes(actual, "messages.0.content").String())
					require.Equal(t, stream, gjson.GetBytes(actual, "stream").Bool())
				})
			}
		}
	}
}

func TestAnthropicTemperatureAccountConnection(t *testing.T) {
	for _, disabled := range []bool{false, true} {
		t.Run(strconv.FormatBool(disabled), func(t *testing.T) {
			account := newAnthropicAPIKeyAccountForTest()
			account.Extra = map[string]any{"anthropic_disable_temperature": disabled}
			svc, upstream := adaptiveCNAccountTestService(account, adaptiveCNAnthropicTestResponse())
			c, _ := newTestContext()
			require.NoError(t, svc.testClaudeAccountConnection(c, account, "claude-opus-5-5"))
			require.Len(t, upstream.bodies, 1)
			require.Equal(t, !disabled, gjson.GetBytes(upstream.bodies[0], "temperature").Exists())
			require.Equal(t, "claude-opus-5-5", gjson.GetBytes(upstream.bodies[0], "model").String())
			require.Equal(t, account.GetCredential("api_key"), upstream.requests[0].Header.Get("x-api-key"))
			if isOfficialAnthropicAPIKeyAccount(account) {
				require.NotContains(t, upstream.requests[0].Header.Get("anthropic-beta"), "claude-code")
				require.Empty(t, upstream.requests[0].Header.Get("x-app"))
				require.False(t, gjson.GetBytes(upstream.bodies[0], "system").Exists())
			}
		})
	}
}

func TestAnthropicTemperatureScope(t *testing.T) {
	var missing *Account
	require.False(t, missing.IsAnthropicTemperatureDisabled())
	account := &Account{Platform: PlatformAnthropic, Type: AccountTypeOAuth, Extra: map[string]any{"anthropic_disable_temperature": true}}
	require.False(t, account.IsAnthropicTemperatureDisabled())
	account.Type = AccountTypeAPIKey
	account.Extra = nil
	require.False(t, account.IsAnthropicTemperatureDisabled())
}
