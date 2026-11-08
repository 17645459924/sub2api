package service

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"time"
)

const claudeObservationMaxAge = 5 * time.Minute

// A window is saved independently, so a weekly response cannot renew a 5h sample.
type claudeQuotaObservation struct {
	Scope         string     `json:"scope"`
	Utilization   *float64   `json:"utilization,omitempty"`
	ResetsAt      *time.Time `json:"resets_at,omitempty"`
	SampledAt     int64      `json:"sampled_at"`
	Source        string     `json:"source"`
	NotApplicable bool       `json:"not_applicable,omitempty"`
}

func claudeObservationScope(account *Account) string {
	// Never persist the credential. A changed credential invalidates saved readings.
	return fmt.Sprintf("%x", sha256.Sum256([]byte(fmt.Sprintf("%d:%s", account.ID, account.GetCredential("access_token")))))
}

func claudeWindowPointers(usage *UsageInfo) map[string]**UsageProgress {
	return map[string]**UsageProgress{"five_hour": &usage.FiveHour, "seven_day": &usage.SevenDay,
		"seven_day_sonnet": &usage.SevenDaySonnet, "seven_day_overage_included": &usage.SevenDayFable}
}

func validClaudeObservation(o claudeQuotaObservation, now time.Time) bool {
	if o.SampledAt <= 0 || o.SampledAt > now.Unix()+5 || now.Unix()-o.SampledAt > int64(claudeObservationMaxAge/time.Second) {
		return false
	}
	if o.Source != "quota_api" && o.Source != "response_headers" {
		return false
	}
	if o.NotApplicable {
		return o.Source == "quota_api" && o.Utilization == nil
	}
	if o.Utilization == nil || math.IsNaN(*o.Utilization) || math.IsInf(*o.Utilization, 0) || *o.Utilization < 0 {
		return false
	}
	if o.ResetsAt != nil {
		return o.ResetsAt.After(now)
	}
	return o.Source == "quota_api"
}

func claudeHeaderObservations(account *Account, headers http.Header, now time.Time) map[string]any {
	updates := make(map[string]any)
	if !supportsAnthropicPassiveUsage(account) {
		return updates
	}
	for suffix, name := range map[string]string{"5h": "five_hour", "7d": "seven_day", "7d_oi": "seven_day_overage_included"} {
		prefix := "anthropic-ratelimit-unified-" + suffix
		if headers.Get(prefix+"-utilization") == "" && headers.Get(prefix+"-reset") == "" {
			continue
		}
		// An incomplete new reading must not be combined with a previous
		// window's reset or an estimated session boundary to invent a measurement.
		updates["claude_quota_"+name] = claudeQuotaObservation{Scope: claudeObservationScope(account), SampledAt: now.Unix(), Source: "response_headers"}
		util, ok := sampledUtilization(headers.Get(prefix + "-utilization"))
		reset, err := strconv.ParseInt(headers.Get(prefix+"-reset"), 10, 64)
		if !ok || err != nil {
			continue
		}
		if reset > 1e11 {
			reset /= 1000
		}
		percent, resetAt := util*100, time.Unix(reset, 0)
		o := claudeQuotaObservation{Scope: claudeObservationScope(account), Utilization: &percent,
			ResetsAt: &resetAt, SampledAt: now.Unix(), Source: "response_headers"}
		if validClaudeObservation(o, now) {
			updates["claude_quota_"+name] = o
		}
	}
	return updates
}

func claudeActiveObservations(account *Account, usage *UsageInfo) map[string]any {
	updates := make(map[string]any)
	if !supportsAnthropicPassiveUsage(account) || usage.UpdatedAt == nil {
		return updates
	}
	for name, ptr := range claudeWindowPointers(usage) {
		p := *ptr
		if p == nil || (p.UtilizationUnknown && !p.NotApplicable) {
			continue
		}
		o := claudeQuotaObservation{Scope: claudeObservationScope(account), ResetsAt: p.ResetsAt,
			SampledAt: usage.UpdatedAt.Unix(), Source: "quota_api", NotApplicable: p.NotApplicable}
		if !p.NotApplicable {
			value := p.Utilization
			o.Utilization = &value
		}
		updates["claude_quota_"+name] = o
	}
	return updates
}

// Active official windows take precedence, including a real zero or explicit null.
// Passive reads must not resurrect old legacy values when a new sample expires.
func applyClaudeObservations(usage *UsageInfo, account *Account, active *ClaudeUsageResponse, now time.Time) {
	for name, ptr := range claudeWindowPointers(usage) {
		if active != nil && (active.NullWindows[name] || (*ptr != nil && !(*ptr).UtilizationUnknown)) {
			continue
		}
		raw, exists := account.Extra["claude_quota_"+name]
		if !exists || raw == nil {
			continue
		}
		body, err := json.Marshal(raw)
		var o claudeQuotaObservation
		if err != nil || json.Unmarshal(body, &o) != nil || o.Scope != claudeObservationScope(account) || !validClaudeObservation(o, now) {
			if active == nil {
				*ptr = &UsageProgress{UtilizationUnknown: true}
			}
			continue
		}
		p := &UsageProgress{UtilizationUnknown: o.NotApplicable, NotApplicable: o.NotApplicable,
			MeasurementSource: o.Source, SampledAt: o.SampledAt, ResetsAt: o.ResetsAt}
		if o.Utilization != nil {
			p.Utilization = *o.Utilization
		}
		if o.ResetsAt != nil {
			p.RemainingSeconds = max(0, int(o.ResetsAt.Sub(now).Seconds()))
		}
		*ptr = p
		if active == nil && (usage.UpdatedAt == nil || usage.UpdatedAt.Unix() < o.SampledAt) {
			stamp := time.Unix(o.SampledAt, 0)
			usage.UpdatedAt = &stamp
		}
	}
}
