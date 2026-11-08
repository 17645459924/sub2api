package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	coderws "github.com/coder/websocket"
	"github.com/stretchr/testify/require"
)

func TestCodexQuotaObservation_Parser(t *testing.T) {
	now := time.Now()
	body := []byte(`{"type":"codex.rate_limits","rate_limits":{"primary":{"used_percent":29,"window_minutes":10080,"reset_after_seconds":20000},"secondary":{"used_percent":0,"window_minutes":300,"reset_after_seconds":1200}},"additional_rate_limits":{"Spark":{"primary":{"used_percent":99,"window_minutes":300,"reset_after_seconds":200}}}}`)
	observations := parseCodexQuotaEvent(body, now)
	require.Len(t, observations, 2)
	require.Equal(t, int64(604800), observations[0].LimitWindowSeconds)
	require.Equal(t, 29.0, observations[0].UsedPercent)
	require.Equal(t, int64(18000), observations[1].LimitWindowSeconds)
	require.Zero(t, observations[1].UsedPercent, "an explicit zero is a measurement")
	require.Equal(t, now.Unix()+1200, observations[1].ResetAt)
	for _, raw := range []string{
		`{}`, `{"type":"response.output_text.delta","delta":"codex.rate_limits"}`,
		`{"type":"codex.rate_limits","rate_limits":{"primary":{"window_minutes":300,"reset_after_seconds":1200}}}`,
		`{"type":"codex.rate_limits","rate_limits":{"primary":{"used_percent":null,"window_minutes":300,"reset_after_seconds":1200}}}`,
		`{"type":"codex.rate_limits","rate_limits":{"primary":{"used_percent":-1,"window_minutes":300,"reset_after_seconds":1200}}}`,
		`{"type":"codex.rate_limits","rate_limits":{"primary":{"used_percent":101,"window_minutes":300,"reset_after_seconds":1200}}}`,
		`{"type":"codex.rate_limits","rate_limits":{"primary":{"used_percent":42,"window_minutes":1440,"reset_after_seconds":1200}}}`,
		`{"type":"codex.rate_limits","metered_limit_name":"codex_bengalfox","rate_limits":{"primary":{"used_percent":42,"window_minutes":300,"reset_after_seconds":1200}}}`,
	} {
		require.Empty(t, parseCodexQuotaEvent([]byte(raw), now), raw)
	}
	camel := parseCodexQuotaEvent([]byte(fmt.Sprintf(`{"type":"codex.rate_limits","rateLimit":{"primary":{"usedPercent":12,"windowMinutes":300,"resetAt":%d}}}`, now.Unix()+600)), now)
	require.Len(t, camel, 1)
	require.Equal(t, 12.0, camel[0].UsedPercent)
	errors := parseCodexQuotaEvent([]byte(`{"type":"error","headers":{"x-codex-primary-used-percent":"100","x-codex-primary-window-minutes":"300","x-codex-primary-reset-after-seconds":"600","Set-Cookie":"private"}}`), now)
	require.Len(t, errors, 1)
	encoded, err := json.Marshal(errors)
	require.NoError(t, err)
	require.NotContains(t, string(encoded), "private")
}

func TestCodexQuotaObservation_AbsoluteHeaderReset(t *testing.T) {
	now := time.Now()
	headers := make(http.Header)
	headers.Set("X-Codex-Primary-Used-Percent", "42")
	headers.Set("X-Codex-Primary-Window-Minutes", "300")
	headers.Set("X-Codex-Primary-Reset-At", fmt.Sprint(now.Unix()+1200))
	snapshot := ParseCodexRateLimitHeaders(headers)
	require.NotNil(t, snapshot)
	observations := quotaObservationsFromSnapshot(snapshot, now)
	require.Len(t, observations, 1)
	require.Equal(t, now.Unix()+1200, observations[0].ResetAt)
	require.Equal(t, "response_headers", observations[0].Source)
}

func observationAccount(id int64, sample OpenAIQuotaObservation) *Account {
	return &Account{ID: id, Platform: PlatformOpenAI, Type: AccountTypeOAuth, Credentials: map[string]any{"chatgpt_account_id": "workspace-test"}, Extra: map[string]any{quotaObservationKey(sample.LimitWindowSeconds): sample}}
}

func TestCodexQuotaObservation_ValidityAndAccountIsolation(t *testing.T) {
	now := time.Now()
	original := OpenAIQuotaObservation{UsedPercent: 42, LimitWindowSeconds: 18000, ResetAt: now.Unix() + 1200, SampledAt: now.Unix(), Source: "websocket", AccountScope: "workspace-test"}
	require.Len(t, observedOpenAIQuotaWindows(observationAccount(900001, original), now), 1)
	for _, mutate := range []func(*OpenAIQuotaObservation){
		func(o *OpenAIQuotaObservation) { o.SampledAt = now.Add(-6 * time.Minute).Unix() },
		func(o *OpenAIQuotaObservation) { o.ResetAt = now.Unix() - 1 },
		func(o *OpenAIQuotaObservation) { o.SampledAt = now.Add(time.Minute).Unix() },
		func(o *OpenAIQuotaObservation) { o.Source = "estimated" },
		func(o *OpenAIQuotaObservation) { o.AccountScope = "different-workspace" },
	} {
		o := original
		mutate(&o)
		require.Empty(t, observedOpenAIQuotaWindows(observationAccount(900001, o), now))
	}
	shadow := observationAccount(900001, original)
	parent := int64(22)
	shadow.ParentAccountID = &parent
	require.Empty(t, observedOpenAIQuotaWindows(shadow, now))
	missing := observationAccount(900001, original)
	missing.Extra["codex_observed_5h"] = map[string]any{"sampled_at": now.Unix(), "reset_at": now.Unix() + 1200, "limit_window_seconds": 18000, "source": "websocket", "account_scope": "workspace-test"}
	require.Empty(t, observedOpenAIQuotaWindows(missing, now), "missing percentage is not zero")
}

func TestCodexQuotaObservation_QueryPreservesOfficialPayloadAndAddsTrafficSample(t *testing.T) {
	now := time.Now()
	sample := OpenAIQuotaObservation{UsedPercent: 42, LimitWindowSeconds: 18000, ResetAt: now.Unix() + 1200, SampledAt: now.Unix(), Source: "websocket", AccountScope: "workspace-test"}
	account := observationAccount(900002, sample)
	repo := &stubQuotaAccountRepo{accounts: map[int64]*Account{account.ID: account}}
	tokens := &stubQuotaTokenCache{tokens: map[string]string{OpenAITokenCacheKey(account): "test-token"}}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NotEmpty(t, r.Header.Get("Chatgpt-Account-Id"))
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/backend-api/wham/usage" {
			fmt.Fprint(w, `{"account_id":"workspace-test","rate_limit":{"primary_window":{"used_percent":29,"limit_window_seconds":604800},"secondary_window":null}}`)
		} else {
			fmt.Fprint(w, `{"available_count":2,"credits":[]}`)
		}
	}))
	defer srv.Close()
	service := NewOpenAIQuotaService(repo, nil, NewOpenAITokenProvider(repo, tokens, nil), newQuotaRedirectingFactory(srv), nil)
	usage, err := service.QueryUsage(context.Background(), account.ID)
	require.NoError(t, err)
	require.Nil(t, usage.RateLimit.SecondaryWindow)
	require.Equal(t, int64(604800), usage.RateLimit.PrimaryWindow.LimitWindowSeconds)
	require.Len(t, usage.ObservedWindows, 1)
	require.Equal(t, 42.0, usage.ObservedWindows[0].UsedPercent)
	require.Equal(t, "websocket", usage.ObservedWindows[0].Source)
	require.Equal(t, 2, usage.RateLimitResetCredits.AvailableCount)
	require.Zero(t, repo.extraUpdateCalls, "query must not consume or write anything")
	other := observationAccount(900003, sample)
	other.Credentials["chatgpt_account_id"] = "wrong-workspace"
	repo.accounts[other.ID] = other
	tokens.tokens[OpenAITokenCacheKey(other)] = "test-token"
	// The same upstream response cannot be silently attributed to another workspace.
	_, err = service.QueryUsage(context.Background(), other.ID)
	require.Error(t, err)
	require.Contains(t, err.Error(), "does not match")
}

func TestCodexQuotaObservation_HeaderThenWebsocketDoesNotDropFiveHourWindow(t *testing.T) {
	repo := &snapshotUpdateAccountRepo{updateExtraCalls: make(chan map[string]any, 4)}
	service := &OpenAIGatewayService{accountRepo: repo, codexSnapshotThrottle: newAccountWriteThrottle(time.Hour)}
	account := &Account{ID: 900004, Platform: PlatformOpenAI, Type: AccountTypeOAuth, Credentials: map[string]any{"chatgpt_account_id": "workspace-test"}}
	headers := make(http.Header)
	headers.Set("X-Codex-Primary-Used-Percent", "29")
	headers.Set("X-Codex-Primary-Window-Minutes", "10080")
	headers.Set("X-Codex-Primary-Reset-After-Seconds", "20000")
	service.updateCodexUsageSnapshotFromAccountHeaders(context.Background(), account, headers)
	select {
	case updates := <-repo.updateExtraCalls:
		require.Contains(t, updates, "codex_observed_7d")
	case <-time.After(2 * time.Second):
		t.Fatal("missing header capture")
	}
	service.observeCodexQuotaEvent(account, []byte(`{"type":"codex.rate_limits","rate_limits":{"primary":{"used_percent":42,"window_minutes":300,"reset_after_seconds":1200}}}`))
	select {
	case updates := <-repo.updateExtraCalls:
		require.Contains(t, updates, "codex_observed_5h")
		require.NotContains(t, updates, "codex_observed_7d")
		sample, ok := updates["codex_observed_5h"].(OpenAIQuotaObservation)
		require.True(t, ok, "expected a quota observation")
		require.Equal(t, 42.0, sample.UsedPercent)
		require.Equal(t, "workspace-test", sample.AccountScope)
	case <-time.After(2 * time.Second):
		t.Fatal("5h event was lost behind the 7d header throttle")
	}
}

func TestCodexQuotaObservation_WebsocketIngressIntegration(t *testing.T) {
	for index, mode := range []string{OpenAIWSIngressModePassthrough, OpenAIWSIngressModeCtxPool} {
		t.Run(mode, func(t *testing.T) {
			controlCtx, cancel := context.WithCancelCause(context.Background())
			upstream := newStagedPassthroughConn()
			cfg := passthroughLifecycleConfig()
			cfg.Gateway.OpenAIWS.OAuthEnabled = true
			cfg.Gateway.OpenAIWS.ReadTimeoutSeconds = 3
			account := passthroughLifecycleAccount()
			account.ID = 900100 + int64(index)
			account.Type = AccountTypeOAuth
			account.Credentials = map[string]any{"chatgpt_account_id": "workspace-test", "access_token": "test-token"}
			account.Extra = map[string]any{"openai_oauth_responses_websockets_v2_mode": mode}
			repo := &snapshotUpdateAccountRepo{updateExtraCalls: make(chan map[string]any, 4)}
			service := newPassthroughLifecycleService(cfg, upstream)
			service.accountRepo = repo
			pool := newOpenAIWSConnPool(cfg)
			pool.setClientDialerForTest(&stagedPassthroughDialer{conn: &observationStagedConn{upstream}})
			service.openaiWSPool = pool
			server, _ := startPassthroughLifecycleServer(t, controlCtx, service, account)
			defer server.Close()
			defer cancel(context.Canceled)
			client := dialPassthroughLifecycleClient(t, server)
			defer func() { _ = client.CloseNow() }()
			requirePassthroughUpstreamWrite(t, upstream, 2*time.Second)
			event := `{"type":"codex.rate_limits","rate_limits":{"primary":{"used_percent":42,"window_minutes":300,"reset_after_seconds":1200}}}`
			upstream.Send(event)
			// Observation does not consume, suppress or rewrite the upstream frame.
			payload, err := readPassthroughLifecycleFrame(t, client, 2*time.Second)
			require.NoError(t, err)
			require.JSONEq(t, event, string(payload))
			select {
			case updates := <-repo.updateExtraCalls:
				sample, ok := updates["codex_observed_5h"].(OpenAIQuotaObservation)
				require.True(t, ok, "expected a quota observation")
				require.Equal(t, 42.0, sample.UsedPercent)
				require.Equal(t, "websocket", sample.Source)
				require.Equal(t, "workspace-test", sample.AccountScope)
			case <-time.After(2 * time.Second):
				t.Fatal("quota event not persisted by websocket ingress")
			}
		})
	}
}

type observationStagedConn struct{ *stagedPassthroughConn }

func (c *observationStagedConn) WriteJSON(ctx context.Context, value any) error {
	payload, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return c.WriteFrame(ctx, coderws.MessageText, payload)
}
