package service

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"
)

func TestClaudeUsageMeasurement_OfficialWindowPresence(t *testing.T) {
	service := &AccountUsageService{}
	for _, tc := range []struct {
		name, body string
		unknown    bool
	}{
		{"missing", `{}`, true},
		{"null window", `{"five_hour":null}`, true},
		{"missing utilization", `{"five_hour":{"resets_at":"2099-01-01T00:00:00Z"}}`, true},
		{"null utilization", `{"five_hour":{"utilization":null}}`, true},
		{"measured zero", `{"five_hour":{"utilization":0}}`, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var response ClaudeUsageResponse
			if err := json.Unmarshal([]byte(tc.body), &response); err != nil {
				t.Fatal(err)
			}
			progress := service.buildUsageInfo(&response, nil).FiveHour
			if progress.UtilizationUnknown != tc.unknown {
				t.Fatalf("unexpected progress: %+v", progress)
			}
		})
	}
	var response ClaudeUsageResponse
	if err := json.Unmarshal([]byte(`{"seven_day":{"utilization":0}}`), &response); err != nil {
		t.Fatal(err)
	}
	usage := service.buildUsageInfo(&response, nil)
	if usage.SevenDay == nil || usage.SevenDay.UtilizationUnknown || usage.SevenDay.Utilization != 0 {
		t.Fatal("explicit 7d zero was dropped")
	}
}

func TestClaudeUsageMeasurement_SetupTokenUpstreamFailureDoesNotPretendToRefresh(t *testing.T) {
	for _, status := range []string{"401", "403", "429"} {
		t.Run(status, func(t *testing.T) {
			upstreamErr := errors.New("upstream returned " + status)
			fetcher := &refreshClaudeUsageFetcher{err: upstreamErr}
			service := &AccountUsageService{usageFetcher: fetcher, cache: NewUsageCache()}
			account := &Account{ID: 98702, Platform: PlatformAnthropic, Type: AccountTypeSetupToken,
				Credentials: map[string]any{"access_token": "test-token"},
				Extra:       map[string]any{"passive_usage_7d_utilization": 0.15}}
			usage, err := service.GetUsageForAccount(context.Background(), account, true)
			if !errors.Is(err, upstreamErr) || usage != nil || fetcher.calls != 1 {
				t.Fatalf("expected actual upstream failure, got usage=%+v err=%v", usage, err)
			}
		})
	}
}

func TestClaudeUsageMeasurement_SetupTokenWithoutProfileCanQueryOfficialUsage(t *testing.T) {
	reset := time.Now().Add(time.Hour).UTC().Format(time.RFC3339)
	fetcher := &refreshClaudeUsageFetcher{usage: &ClaudeUsageResponse{
		FiveHour: ClaudeUsageWindow{Utilization: 73, ResetsAt: reset},
	}}
	service := &AccountUsageService{accountRepo: &sessionWindowSyncRepo{}, usageLogRepo: &usageBatchLogRepoStub{}, usageFetcher: fetcher, cache: NewUsageCache()}
	account := &Account{ID: 98701, Platform: PlatformAnthropic, Type: AccountTypeSetupToken,
		Credentials: map[string]any{"access_token": "test-token", "scope": "user:inference"}}
	usage, err := service.GetUsageForAccount(context.Background(), account, true)
	if err != nil {
		t.Fatal(err)
	}
	if fetcher.calls != 1 || usage.FiveHour.Utilization != 73 || usage.Source != "active" {
		t.Fatalf("expected official quota query: %+v", usage)
	}
}

func TestClaudeUsageMeasurement_NoStatusEstimates(t *testing.T) {
	future := time.Now().Add(time.Hour)
	service := &AccountUsageService{}
	for _, status := range []string{"allowed", "allowed_warning", "rejected"} {
		t.Run(status, func(t *testing.T) {
			progress := service.estimateSetupTokenUsage(&Account{SessionWindowEnd: &future, SessionWindowStatus: status}).FiveHour
			if !progress.UtilizationUnknown {
				t.Fatal("scheduling status is not a quota measurement")
			}
		})
	}
	if !service.estimateSetupTokenUsage(&Account{}).FiveHour.UtilizationUnknown {
		t.Fatal("missing window is unknown")
	}
	for _, raw := range []any{float64(0), json.Number("0"), "0"} {
		progress := service.estimateSetupTokenUsage(&Account{SessionWindowEnd: &future, Extra: map[string]any{"session_window_utilization": raw}}).FiveHour
		if progress.UtilizationUnknown || progress.Utilization != 0 {
			t.Fatal("an explicit upstream zero must remain a known zero")
		}
	}
}

func TestClaudeUsageMeasurement_PassiveWindows(t *testing.T) {
	future := time.Now().Add(time.Hour).Unix()
	for _, tc := range []struct {
		name    string
		raw     any
		reset   int64
		unknown bool
	}{
		{"genuine zero", 0.0, future, false},
		{"missing utilization", nil, future, true},
		{"expired sample", 0.96, time.Now().Add(-time.Hour).Unix(), true},
		{"invalid sample", "NaN", future, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			progress := buildPassiveUsageWindow(map[string]any{"util": tc.raw, "reset": tc.reset}, "util", "reset")
			if progress == nil || progress.UtilizationUnknown != tc.unknown {
				t.Fatalf("unexpected measurement state: %+v", progress)
			}
		})
	}
}

func TestOpenAIUsageMeasurement_WindowPresence(t *testing.T) {
	for _, tc := range []struct {
		body    string
		unknown bool
	}{
		{`{"limit_window_seconds":18000}`, true},
		{`{"limit_window_seconds":18000,"used_percent":null}`, true},
		{`{"limit_window_seconds":18000,"used_percent":0}`, false},
		{`{"limit_window_seconds":18000,"used_percent":71}`, false},
	} {
		var window OpenAIRateLimitWindow
		if err := json.Unmarshal([]byte(tc.body), &window); err != nil {
			t.Fatal(err)
		}
		if window.UtilizationUnknown != tc.unknown {
			t.Fatalf("incorrect presence for %s: %+v", tc.body, window)
		}
		updates := buildOpenAIAutoResetUsageUpdates(&OpenAIQuotaUsage{RateLimit: &OpenAIRateLimit{PrimaryWindow: &window}}, time.Now())
		_, hasPercent := updates["codex_5h_used_percent"]
		if hasPercent == tc.unknown {
			t.Fatalf("unknown quota must not be persisted as zero: %+v", updates)
		}
	}
}

func TestOpenAIUsageMeasurement_LocalStatisticsAreNotQuota(t *testing.T) {
	service := &AccountUsageService{usageLogRepo: &usageBatchLogRepoStub{}}
	usage, err := service.getOpenAIUsage(context.Background(), &Account{ID: 98711}, false)
	if err != nil {
		t.Fatal(err)
	}
	if usage.FiveHour == nil || !usage.FiveHour.UtilizationUnknown || usage.SevenDay == nil || !usage.SevenDay.UtilizationUnknown {
		t.Fatalf("local stats must not fabricate quota: %+v", usage)
	}
}

func TestOpenAIUsageMeasurement_MonthlyIsNotWeekly(t *testing.T) {
	updates := buildOpenAIAutoResetUsageUpdates(&OpenAIQuotaUsage{RateLimit: &OpenAIRateLimit{PrimaryWindow: &OpenAIRateLimitWindow{UsedPercent: 71, LimitWindowSeconds: 30 * 86400}}}, time.Now())
	if _, ok := updates["codex_7d_used_percent"]; ok {
		t.Fatalf("monthly quota must not be saved as weekly: %+v", updates)
	}
}
