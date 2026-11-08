package service

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

type refreshClaudeUsageFetcher struct {
	ClaudeUsageFetcher
	calls int
	usage *ClaudeUsageResponse
	err   error
}

type refreshUsageRepo struct {
	sessionWindowSyncRepo
	account *Account
}

func (r *refreshUsageRepo) GetByIDs(context.Context, []int64) ([]*Account, error) {
	return []*Account{r.account}, nil
}

func (f *refreshClaudeUsageFetcher) FetchUsageWithOptions(context.Context, *ClaudeUsageFetchOptions) (*ClaudeUsageResponse, error) {
	f.calls++
	return f.usage, f.err
}

func TestAccountUsageService_ForcedClaudeRefreshBypassesSuccessCache(t *testing.T) {
	account := &Account{
		ID: 98601, Platform: PlatformAnthropic, Type: AccountTypeOAuth,
		Credentials: map[string]any{"access_token": "test-token"},
	}
	reset := time.Now().Add(time.Hour).UTC().Format(time.RFC3339)
	fetcher := &refreshClaudeUsageFetcher{usage: &ClaudeUsageResponse{
		FiveHour: ClaudeUsageWindow{Utilization: 27, ResetsAt: reset},
		SevenDay: ClaudeUsageWindow{Utilization: 48, ResetsAt: reset},
	}}
	cache := NewUsageCache()
	cache.apiCache.Store(account.ID, &apiUsageCache{response: &ClaudeUsageResponse{
		FiveHour: ClaudeUsageWindow{Utilization: 12, ResetsAt: reset},
		SevenDay: ClaudeUsageWindow{Utilization: 34, ResetsAt: reset},
	}, timestamp: time.Now()})
	svc := &AccountUsageService{
		accountRepo: &sessionWindowSyncRepo{}, usageLogRepo: &usageBatchLogRepoStub{},
		usageFetcher: fetcher, cache: cache,
	}
	old, err := svc.GetUsageForAccount(context.Background(), account)
	require.NoError(t, err)
	require.Equal(t, 34.0, old.SevenDay.Utilization)
	require.Zero(t, fetcher.calls)

	fresh, err := svc.GetUsageForAccount(context.Background(), account, true)
	require.NoError(t, err)
	require.Equal(t, 1, fetcher.calls)
	require.Equal(t, 27.0, fresh.FiveHour.Utilization)
	require.Equal(t, 48.0, fresh.SevenDay.Utilization)

	// A normal read now receives the new cached result, without another fetch.
	fresh, err = svc.GetUsageForAccount(context.Background(), account)
	require.NoError(t, err)
	require.Equal(t, 48.0, fresh.SevenDay.Utilization)
	require.Equal(t, 1, fetcher.calls)

	// Forced refresh still respects the short error cache to avoid retry storms.
	upstreamError := errors.New("upstream returned 429")
	cache.apiCache.Store(account.ID, &apiUsageCache{err: upstreamError, timestamp: time.Now()})
	_, err = svc.GetUsageForAccount(context.Background(), account, true)
	require.ErrorIs(t, err, upstreamError)
	require.Equal(t, 1, fetcher.calls)
}

func TestAccountUsageService_SetupTokenPassiveReadKeepsSevenDaySample(t *testing.T) {
	account := &Account{
		ID: 98602, Platform: PlatformAnthropic, Type: AccountTypeSetupToken,
		Extra: map[string]any{
			"passive_usage_7d_utilization": 0.56,
			"passive_usage_7d_reset":       time.Now().Add(time.Hour).Unix(),
		},
	}
	svc := &AccountUsageService{cache: NewUsageCache(), usageLogRepo: &usageBatchLogRepoStub{}}
	usage, err := svc.getPassiveUsageForAccount(context.Background(), account)
	require.NoError(t, err)
	require.Equal(t, "passive", usage.Source)
	require.NotNil(t, usage.SevenDay)
	require.InDelta(t, 56, usage.SevenDay.Utilization, 0.001)
}

func TestAccountUsageService_ForcedBatchRefreshQueriesClaudeOAuth(t *testing.T) {
	account := &Account{
		ID: 98604, Platform: PlatformAnthropic, Type: AccountTypeOAuth,
		Credentials: map[string]any{"access_token": "test-token"},
		Extra:       map[string]any{"passive_usage_7d_utilization": 0.34},
	}
	reset := time.Now().Add(time.Hour).UTC().Format(time.RFC3339)
	fetcher := &refreshClaudeUsageFetcher{usage: &ClaudeUsageResponse{
		FiveHour: ClaudeUsageWindow{Utilization: 27, ResetsAt: reset},
		SevenDay: ClaudeUsageWindow{Utilization: 48, ResetsAt: reset},
	}}
	svc := &AccountUsageService{
		accountRepo: &refreshUsageRepo{account: account}, usageLogRepo: &usageBatchLogRepoStub{},
		usageFetcher: fetcher, cache: NewUsageCache(),
	}
	usage, failures, err := svc.GetUsageBatch(context.Background(), []int64{account.ID}, false)
	require.NoError(t, err)
	require.Empty(t, failures)
	require.Equal(t, "passive", usage[account.ID].Source)
	require.Zero(t, fetcher.calls)

	usage, failures, err = svc.GetUsageBatch(context.Background(), []int64{account.ID}, true)
	require.NoError(t, err)
	require.Empty(t, failures)
	require.Equal(t, 1, fetcher.calls)
	require.Equal(t, 27.0, usage[account.ID].FiveHour.Utilization)
	require.Equal(t, 48.0, usage[account.ID].SevenDay.Utilization)
}

func TestAccountUsageService_ExplicitOpenAIRefreshReadsQuotaEndpoint(t *testing.T) {
	for _, status := range []int{http.StatusOK, http.StatusTooManyRequests} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			account := &Account{
				ID: 98603, Platform: PlatformOpenAI, Type: AccountTypeOAuth,
				Credentials: map[string]any{"chatgpt_account_id": "quota-test"},
				Extra: map[string]any{
					"codex_5h_used_percent": 12.0,
					"codex_5h_reset_at":     time.Now().Add(time.Hour).Format(time.RFC3339),
					"codex_7d_used_percent": 34.0,
					"codex_7d_reset_at":     time.Now().Add(24 * time.Hour).Format(time.RFC3339),
				},
			}
			repo := &sparkShadowUsageTestRepo{accounts: map[int64]*Account{account.ID: account}}
			cache := &stubQuotaTokenCache{tokens: map[string]string{OpenAITokenCacheKey(account): "fake-access-token"}}
			tokens := NewOpenAITokenProvider(repo, cache, nil)
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// Quota refresh must never send a model inference or reset request.
				if r.Method != http.MethodGet {
					t.Errorf("quota refresh sent unexpected method %s", r.Method)
				}
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(status)
				if status != http.StatusOK {
					_, _ = w.Write([]byte(`{"error":"try later"}`))
					return
				}
				_ = json.NewEncoder(w).Encode(OpenAIQuotaUsage{RateLimit: &OpenAIRateLimit{
					PrimaryWindow:   &OpenAIRateLimitWindow{UsedPercent: 27, ResetAfterSeconds: 3600, LimitWindowSeconds: 18000},
					SecondaryWindow: &OpenAIRateLimitWindow{UsedPercent: 48, ResetAfterSeconds: 86400, LimitWindowSeconds: 604800},
				}})
			}))
			defer srv.Close()
			svc := &AccountUsageService{accountRepo: repo, cache: NewUsageCache(),
				openAIQuotaService: NewOpenAIQuotaService(repo, nil, tokens, newQuotaRedirectingFactory(srv), nil)}
			usage, err := svc.getOpenAIUsage(context.Background(), account, true)
			require.NoError(t, err)
			if status == http.StatusOK {
				require.Empty(t, usage.Error)
				require.Equal(t, 27.0, usage.FiveHour.Utilization)
				require.Equal(t, 48.0, usage.SevenDay.Utilization)
			} else {
				require.NotEmpty(t, usage.Error)
				require.Equal(t, 34.0, usage.SevenDay.Utilization)
			}
		})
	}
}
