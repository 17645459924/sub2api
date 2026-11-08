package service

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/tidwall/gjson"
)

const openAIQuotaObservationMaxAge = 5 * time.Minute

// OpenAIQuotaObservation is a measured main Codex window, never a usage estimate.
// Kept separate from /wham/usage so consumers can disclose the source and age.
type OpenAIQuotaObservation struct {
	AccountScope       string  `json:"account_scope,omitempty"`
	UsedPercent        float64 `json:"used_percent"`
	UtilizationUnknown bool    `json:"utilization_unknown,omitempty"`
	LimitWindowSeconds int64   `json:"limit_window_seconds"`
	ResetAfterSeconds  int64   `json:"reset_after_seconds"`
	ResetAt            int64   `json:"reset_at"`
	SampledAt          int64   `json:"sampled_at"`
	Source             string  `json:"source"`
}

var codexObservation5hThrottle = newAccountWriteThrottle(30 * time.Second)
var codexObservation7dThrottle = newAccountWriteThrottle(30 * time.Second)

func quotaObservationKey(seconds int64) string {
	switch seconds {
	case 18000:
		return "codex_observed_5h"
	case 604800:
		return "codex_observed_7d"
	}
	return ""
}

func validQuotaObservation(o OpenAIQuotaObservation, now time.Time) bool {
	return quotaObservationKey(o.LimitWindowSeconds) != "" && !o.UtilizationUnknown &&
		!math.IsNaN(o.UsedPercent) && !math.IsInf(o.UsedPercent, 0) && o.UsedPercent >= 0 && o.UsedPercent <= 100 &&
		o.ResetAt > now.Unix() && o.SampledAt > 0 && o.SampledAt <= now.Unix()+5 &&
		now.Unix()-o.SampledAt <= int64(openAIQuotaObservationMaxAge/time.Second) &&
		(o.Source == "response_headers" || o.Source == "websocket")
}

func observedOpenAIQuotaWindows(account *Account, now time.Time) []OpenAIQuotaObservation {
	if account == nil || !account.IsOpenAIOAuth() || account.IsShadow() {
		return nil
	}
	var result []OpenAIQuotaObservation
	for _, seconds := range []int64{18000, 604800} {
		raw := account.Extra[quotaObservationKey(seconds)]
		if raw == nil {
			continue
		}
		body, err := json.Marshal(raw)
		if err != nil {
			continue
		}
		var observation OpenAIQuotaObservation
		var presence struct {
			UsedPercent *float64 `json:"used_percent"`
		}
		if json.Unmarshal(body, &presence) != nil || presence.UsedPercent == nil || json.Unmarshal(body, &observation) != nil || observation.AccountScope != codexQuotaAccountScope(account) || observation.LimitWindowSeconds != seconds || !validQuotaObservation(observation, now) {
			continue
		}
		result = append(result, observation)
	}
	return result
}

func quotaObservationsFromHeaders(headers http.Header, now time.Time, source string) []OpenAIQuotaObservation {
	var result []OpenAIQuotaObservation
	active := headers.Get("X-Codex-Active-Limit")
	if active != "" && active != "codex" {
		return nil
	} // Spark is a separate entitlement.
	for _, slot := range []string{"primary", "secondary"} {
		prefix := "X-Codex-" + slot + "-"
		used, err := strconv.ParseFloat(headers.Get(prefix+"Used-Percent"), 64)
		if err != nil {
			continue
		}
		minutes, err := strconv.ParseInt(headers.Get(prefix+"Window-Minutes"), 10, 64)
		if err != nil || (minutes != 300 && minutes != 10080) {
			continue
		}
		resetAt, _ := strconv.ParseInt(headers.Get(prefix+"Reset-At"), 10, 64)
		if resetAt <= 0 {
			after, err := strconv.ParseInt(headers.Get(prefix+"Reset-After-Seconds"), 10, 64)
			if err != nil || after < 0 || after > minutes*60 {
				continue
			}
			resetAt = now.Unix() + after
		}
		o := OpenAIQuotaObservation{UsedPercent: used, LimitWindowSeconds: minutes * 60, ResetAt: resetAt, ResetAfterSeconds: resetAt - now.Unix(), SampledAt: now.Unix(), Source: source}
		if validQuotaObservation(o, now) {
			result = append(result, o)
		}
	}
	return result
}

// Parse only quota events (and quota headers carried in error frames). Token,
// prompt, cookie and additional feature fields never enter the saved snapshot.
func parseCodexQuotaEvent(payload []byte, now time.Time) []OpenAIQuotaObservation {
	kind := gjson.GetBytes(payload, "type").String()
	if kind != "codex.rate_limits" && kind != "error" {
		return nil
	}
	if !json.Valid(payload) {
		return nil
	}
	root := gjson.ParseBytes(payload)
	headers := make(http.Header)
	if kind == "error" {
		root.Get("headers").ForEach(func(key, value gjson.Result) bool {
			if strings.EqualFold(key.String(), "X-Codex-Active-Limit") {
				headers.Set("X-Codex-Active-Limit", value.String())
			}
			return true
		})
		for _, slot := range []string{"Primary", "Secondary"} {
			for _, field := range []string{"Used-Percent", "Window-Minutes", "Reset-After-Seconds", "Reset-At"} {
				name := "X-Codex-" + slot + "-" + field
				root.Get("headers").ForEach(func(key, value gjson.Result) bool {
					if http.CanonicalHeaderKey(key.String()) == http.CanonicalHeaderKey(name) {
						if value.IsArray() {
							values := value.Array()
							if len(values) == 0 {
								return true
							}
							value = values[0]
						}
						headers.Set(name, value.String())
					}
					return true
				})
			}
		}
	} else {
		first := func(obj gjson.Result, keys ...string) gjson.Result {
			for _, key := range keys {
				v := obj.Get(key)
				if v.Exists() && v.Type != gjson.Null {
					return v
				}
			}
			return gjson.Result{}
		}
		active := first(root, "metered_limit_name", "meteredLimitName", "limit_name", "limitName").String()
		if active != "" && active != "codex" {
			return nil
		}
		limits := first(root, "rate_limits", "rateLimit")
		for _, slot := range []string{"primary", "secondary"} {
			window := limits.Get(slot)
			for field, keys := range map[string][]string{
				"Used-Percent": {"used_percent", "usedPercent"}, "Window-Minutes": {"window_minutes", "windowMinutes"},
				"Reset-After-Seconds": {"reset_after_seconds", "resetAfterSeconds"}, "Reset-At": {"reset_at", "resetAt"},
			} {
				value := first(window, keys...)
				if value.Type == gjson.Number {
					headers.Set("X-Codex-"+slot+"-"+field, value.Raw)
				}
			}
		}
	}
	return quotaObservationsFromHeaders(headers, now, "websocket")
}

func codexQuotaObservationUpdates(accountID int64, observations []OpenAIQuotaObservation) map[string]any {
	now := time.Now()
	updates := make(map[string]any)
	for _, o := range observations {
		if !validQuotaObservation(o, now) {
			continue
		}
		throttle := codexObservation5hThrottle
		if o.LimitWindowSeconds == 604800 {
			throttle = codexObservation7dThrottle
		}
		if throttle.Allow(accountID, now) {
			updates[quotaObservationKey(o.LimitWindowSeconds)] = o
		}
	}
	return updates
}

func (s *OpenAIGatewayService) persistCodexQuotaObservations(accountID int64, observations []OpenAIQuotaObservation) {
	if s == nil || s.accountRepo == nil || accountID <= 0 || len(observations) == 0 {
		return
	}
	updates := codexQuotaObservationUpdates(accountID, observations)
	if len(updates) == 0 {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = s.accountRepo.UpdateExtra(ctx, accountID, updates)
	}()
}

func (s *OpenAIGatewayService) observeCodexQuotaEvent(account *Account, payload []byte) {
	if account == nil || !account.IsOpenAIOAuth() || account.IsShadow() {
		return
	}
	observations := parseCodexQuotaEvent(payload, time.Now())
	for i := range observations {
		observations[i].AccountScope = codexQuotaAccountScope(account)
	}
	s.persistCodexQuotaObservations(account.ID, observations)
}

func quotaObservationsFromSnapshot(snapshot *OpenAICodexUsageSnapshot, now time.Time) []OpenAIQuotaObservation {
	headers := make(http.Header)
	headers.Set("X-Codex-Active-Limit", snapshot.ActiveLimit)
	for _, slot := range []struct {
		name           string
		used           *float64
		minutes, reset *int
		resetAt        *int64
	}{
		{"Primary", snapshot.PrimaryUsedPercent, snapshot.PrimaryWindowMinutes, snapshot.PrimaryResetAfterSeconds, snapshot.PrimaryResetAt},
		{"Secondary", snapshot.SecondaryUsedPercent, snapshot.SecondaryWindowMinutes, snapshot.SecondaryResetAfterSeconds, snapshot.SecondaryResetAt},
	} {
		if slot.used == nil || slot.minutes == nil || (slot.reset == nil && slot.resetAt == nil) {
			continue
		}
		prefix := "X-Codex-" + slot.name + "-"
		headers.Set(prefix+"Used-Percent", strconv.FormatFloat(*slot.used, 'f', -1, 64))
		headers.Set(prefix+"Window-Minutes", strconv.Itoa(*slot.minutes))
		if slot.reset != nil {
			headers.Set(prefix+"Reset-After-Seconds", strconv.Itoa(*slot.reset))
		}
		if slot.resetAt != nil {
			headers.Set(prefix+"Reset-At", strconv.FormatInt(*slot.resetAt, 10))
		}
	}
	observations := quotaObservationsFromHeaders(headers, codexSnapshotBaseTime(snapshot, now), "response_headers")
	for i := range observations {
		observations[i].AccountScope = snapshot.AccountScope
	}
	return observations
}

func applyObservedOpenAIUsage(usage *UsageInfo, account *Account, now time.Time) {
	for _, o := range observedOpenAIQuotaWindows(account, now) {
		// Prefer a newer active/snapshot reading when the same window is known.
		progress := &usage.FiveHour
		if o.LimitWindowSeconds == 604800 {
			progress = &usage.SevenDay
		}
		if *progress != nil && !(*progress).UtilizationUnknown {
			if stamp, err := parseTime(fmt.Sprint(account.Extra["codex_usage_updated_at"])); err == nil && stamp.Unix() >= o.SampledAt {
				continue
			}
		}
		reset := time.Unix(o.ResetAt, 0)
		*progress = &UsageProgress{Utilization: o.UsedPercent, ResetsAt: &reset, RemainingSeconds: int(o.ResetAt - now.Unix()), MeasurementSource: o.Source, SampledAt: o.SampledAt}
	}
}

func codexQuotaAccountScope(account *Account) string {
	if account == nil {
		return ""
	}
	scope := account.GetCredential("chatgpt_account_id")
	if scope == "" {
		scope = account.GetCredential("organization_id")
	}
	return strings.TrimSpace(scope)
}

func (s *OpenAIGatewayService) updateCodexUsageSnapshotForAccount(ctx context.Context, account *Account, snapshot *OpenAICodexUsageSnapshot) {
	if account == nil || !account.IsOpenAIOAuth() || account.IsShadow() || snapshot == nil {
		return
	}
	scoped := *snapshot
	scoped.AccountScope = codexQuotaAccountScope(account)
	s.updateCodexUsageSnapshot(ctx, account.ID, &scoped)
}

func (s *OpenAIGatewayService) updateCodexUsageSnapshotFromAccountHeaders(ctx context.Context, account *Account, headers http.Header) {
	if snapshot := ParseCodexRateLimitHeaders(headers); snapshot != nil {
		s.updateCodexUsageSnapshotForAccount(ctx, account, snapshot)
	}
}
