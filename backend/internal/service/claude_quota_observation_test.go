package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func claudeObservationAccount() *Account {
	return &Account{ID: 77101, Platform: PlatformAnthropic, Type: AccountTypeSetupToken,
		Credentials: map[string]any{"access_token": "test-inference-only"}, Extra: map[string]any{}}
}

func TestClaudeQuotaObservation_WeeklyWithout5hStatus(t *testing.T) {
	a := claudeObservationAccount()
	headers := make(http.Header)
	headers.Set("anthropic-ratelimit-unified-7d-utilization", "0.96")
	headers.Set("anthropic-ratelimit-unified-7d-reset", fmt.Sprint(time.Now().Add(24*time.Hour).Unix()))
	repo := &sessionWindowMockRepo{}
	newRateLimitServiceForTest(repo).UpdateSessionWindow(context.Background(), a, headers)
	require.Empty(t, repo.sessionWindowCalls, "no invented 5h session")
	require.Len(t, repo.updateExtraCalls, 1)
	a.Extra = repo.updateExtraCalls[0].Updates
	usage := &UsageInfo{}
	applyClaudeObservations(usage, a, nil, time.Now())
	require.Nil(t, usage.FiveHour)
	require.NotNil(t, usage.SevenDay)
	require.Equal(t, 96.0, usage.SevenDay.Utilization)
	require.Equal(t, "response_headers", usage.SevenDay.MeasurementSource)
	require.False(t, usage.SevenDay.UtilizationUnknown)
}

func TestClaudeQuotaObservation_NullVsMissingAndZero(t *testing.T) {
	now := time.Now()
	for _, tc := range []struct {
		body            string
		absent, unknown bool
	}{
		{`{"five_hour":null,"seven_day":{"utilization":29}}`, true, true},
		{`{"seven_day":{"utilization":29}}`, false, true},
		{`{"five_hour":{}}`, false, true},
		{`{"five_hour":{"utilization":0}}`, false, false},
	} {
		var response ClaudeUsageResponse
		require.NoError(t, json.Unmarshal([]byte(tc.body), &response))
		usage := (&AccountUsageService{}).buildUsageInfo(&response, &now)
		require.Equal(t, tc.absent, usage.FiveHour.NotApplicable, tc.body)
		require.Equal(t, tc.unknown, usage.FiveHour.UtilizationUnknown, tc.body)
	}
}

func TestClaudeQuotaObservation_WeeklyOnlyOfficialQuery(t *testing.T) {
	var response ClaudeUsageResponse
	require.NoError(t, json.Unmarshal([]byte(`{"five_hour":null,"seven_day":{"utilization":29}}`), &response))
	repo := &sessionWindowSyncRepo{}
	svc := &AccountUsageService{accountRepo: repo, usageLogRepo: &usageBatchLogRepoStub{},
		usageFetcher: &refreshClaudeUsageFetcher{usage: &response}, cache: NewUsageCache()}
	usage, err := svc.GetUsageForAccount(context.Background(), claudeObservationAccount(), true)
	require.NoError(t, err)
	require.Empty(t, usage.Error)
	require.True(t, usage.FiveHour.NotApplicable)
	require.Nil(t, usage.FiveHour.WindowStats, "do not attach an invented quota window to an absent limit")
	require.Equal(t, 29.0, usage.SevenDay.Utilization)
	require.Len(t, repo.extraUpdates, 1)
	require.Contains(t, repo.extraUpdates[0], "claude_quota_five_hour")
}

func TestClaudeQuotaObservation_ActivePriorityAndPersistence(t *testing.T) {
	now := time.Now()
	a := claudeObservationAccount()
	headers := make(http.Header)
	headers.Set("anthropic-ratelimit-unified-5h-utilization", "0.42")
	headers.Set("anthropic-ratelimit-unified-5h-reset", fmt.Sprint(now.Add(time.Hour).Unix()))
	a.Extra = claudeHeaderObservations(a, headers, now)
	for _, body := range []string{`{"five_hour":null}`, `{"five_hour":{"utilization":0}}`, `{}`} {
		var response ClaudeUsageResponse
		require.NoError(t, json.Unmarshal([]byte(body), &response))
		usage := (&AccountUsageService{}).buildUsageInfo(&response, &now)
		applyClaudeObservations(usage, a, &response, now)
		switch body {
		case `{"five_hour":null}`:
			require.True(t, usage.FiveHour.NotApplicable)
			copy := *a
			copy.Extra = claudeActiveObservations(a, usage)
			passive := &UsageInfo{}
			applyClaudeObservations(passive, &copy, nil, now)
			require.True(t, passive.FiveHour.NotApplicable)
		case `{}`:
			require.Equal(t, 42.0, usage.FiveHour.Utilization)
			require.Equal(t, "response_headers", usage.FiveHour.MeasurementSource)
		default:
			require.Zero(t, usage.FiveHour.Utilization)
			require.False(t, usage.FiveHour.UtilizationUnknown)
		}
	}
}

func TestClaudeQuotaObservation_FreshnessIdentityAndIncompleteHeaders(t *testing.T) {
	now := time.Now()
	a := claudeObservationAccount()
	headers := make(http.Header)
	headers.Set("anthropic-ratelimit-unified-5h-utilization", "0")
	headers.Set("anthropic-ratelimit-unified-5h-reset", fmt.Sprint(now.Add(time.Hour).Unix()))
	a.Extra = claudeHeaderObservations(a, headers, now)
	usage := &UsageInfo{}
	applyClaudeObservations(usage, a, nil, now)
	require.False(t, usage.FiveHour.UtilizationUnknown)
	require.Zero(t, usage.FiveHour.Utilization)
	applyClaudeObservations(usage, a, nil, now.Add(6*time.Minute))
	require.True(t, usage.FiveHour.UtilizationUnknown)
	a.ID++
	applyClaudeObservations(usage, a, nil, now)
	require.True(t, usage.FiveHour.UtilizationUnknown, "another account cannot use this sample")
	a.ID--
	a.Credentials["access_token"] = "replacement-token"
	applyClaudeObservations(usage, a, nil, now)
	require.True(t, usage.FiveHour.UtilizationUnknown, "replaced credential cannot use this sample")
	for _, raw := range []string{"NaN", "-1", "0.6"} {
		headers.Set("anthropic-ratelimit-unified-5h-utilization", raw)
		headers.Del("anthropic-ratelimit-unified-5h-reset")
		a.Extra = claudeHeaderObservations(a, headers, now)
		applyClaudeObservations(usage, a, nil, now)
		require.True(t, usage.FiveHour.UtilizationUnknown, "no measured reset; must not reuse predicted session")
	}
}
