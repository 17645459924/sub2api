package repository

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"

	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

type ClaudeUsageServiceSuite struct {
	suite.Suite
	srv     *httptest.Server
	fetcher *claudeUsageService
}

func (s *ClaudeUsageServiceSuite) TearDownTest() {
	if s.srv != nil {
		s.srv.Close()
		s.srv = nil
	}
}

// usageRequestCapture holds captured request data for assertions in the main goroutine.
type usageRequestCapture struct {
	authorization string
	anthropicBeta string
	userAgent     string
	method        string
}

func (s *ClaudeUsageServiceSuite) TestFetchUsage_Success() {
	var captured usageRequestCapture

	s.srv = newLocalTestServer(s.T(), http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		captured.authorization = r.Header.Get("Authorization")
		captured.anthropicBeta = r.Header.Get("anthropic-beta")
		captured.userAgent = r.Header.Get("User-Agent")
		captured.method = r.Method

		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{
  "five_hour": {"utilization": 12.5, "resets_at": "2025-01-01T00:00:00Z"},
  "seven_day": {"utilization": 34.0, "resets_at": "2025-01-08T00:00:00Z"},
  "seven_day_sonnet": {"utilization": 56.0, "resets_at": "2025-01-08T00:00:00Z"}
}`)
	}))

	s.fetcher = &claudeUsageService{
		usageURL:          s.srv.URL,
		allowPrivateHosts: true,
	}

	resp, err := s.fetcher.FetchUsage(context.Background(), "at", "")
	require.NoError(s.T(), err, "FetchUsage")
	require.Equal(s.T(), 12.5, resp.FiveHour.Utilization, "FiveHour utilization mismatch")
	require.Equal(s.T(), 34.0, resp.SevenDay.Utilization, "SevenDay utilization mismatch")
	require.Equal(s.T(), 56.0, resp.SevenDaySonnet.Utilization, "SevenDaySonnet utilization mismatch")

	// Assertions on captured request data
	require.Equal(s.T(), "Bearer at", captured.authorization, "Authorization header mismatch")
	require.Equal(s.T(), "oauth-2025-04-20", captured.anthropicBeta, "anthropic-beta header mismatch")
	require.Equal(s.T(), "claude-cli/2.1.280 (external, cli)", captured.userAgent)
	require.Equal(s.T(), http.MethodGet, captured.method)
	require.Equal(s.T(), "https://api.anthropic.com/api/oauth/usage?cedar_ember=1&skip_spend=1", defaultClaudeUsageURL)
}

func (s *ClaudeUsageServiceSuite) TestFetchUsage_NonOK() {
	s.srv = newLocalTestServer(s.T(), http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = io.WriteString(w, "nope")
	}))

	s.fetcher = &claudeUsageService{
		usageURL:          s.srv.URL,
		allowPrivateHosts: true,
	}

	_, err := s.fetcher.FetchUsage(context.Background(), "at", "")
	require.Error(s.T(), err)
	require.ErrorContains(s.T(), err, "status 401")
	require.ErrorContains(s.T(), err, "nope")
}

func (s *ClaudeUsageServiceSuite) TestFetchUsage_ProfileScopeRequired() {
	s.srv = newLocalTestServer(s.T(), http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, _ = io.WriteString(w, `{"type":"error","error":{"type":"permission_error","message":"OAuth token does not meet scope requirement user:profile"}}`)
	}))
	s.fetcher = &claudeUsageService{usageURL: s.srv.URL, allowPrivateHosts: true}
	resp, err := s.fetcher.FetchUsage(context.Background(), "test-token", "")
	require.Nil(s.T(), resp)
	require.Equal(s.T(), http.StatusForbidden, infraerrors.Code(err))
	require.Equal(s.T(), "CLAUDE_USAGE_PROFILE_SCOPE_REQUIRED", infraerrors.Reason(err))
	require.ErrorContains(s.T(), err, "Reauthorize")
	require.NotContains(s.T(), err.Error(), "test-token")
}

func (s *ClaudeUsageServiceSuite) TestFetchUsage_BadJSON() {
	s.srv = newLocalTestServer(s.T(), http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, "not-json")
	}))

	s.fetcher = &claudeUsageService{
		usageURL:          s.srv.URL,
		allowPrivateHosts: true,
	}

	_, err := s.fetcher.FetchUsage(context.Background(), "at", "")
	require.Error(s.T(), err)
	require.ErrorContains(s.T(), err, "decode response failed")
}

func (s *ClaudeUsageServiceSuite) TestFetchUsage_ContextCancel() {
	s.srv = newLocalTestServer(s.T(), http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Never respond - simulate slow server
		<-r.Context().Done()
	}))

	s.fetcher = &claudeUsageService{
		usageURL:          s.srv.URL,
		allowPrivateHosts: true,
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	_, err := s.fetcher.FetchUsage(ctx, "at", "")
	require.Error(s.T(), err, "expected error for cancelled context")
}

func (s *ClaudeUsageServiceSuite) TestFetchUsage_InvalidProxyReturnsError() {
	s.fetcher = &claudeUsageService{
		usageURL:          "http://example.com",
		allowPrivateHosts: true,
	}

	_, err := s.fetcher.FetchUsage(context.Background(), "at", "://bad-proxy-url")
	require.Error(s.T(), err)
	require.ErrorContains(s.T(), err, "create http client failed")
}

func TestClaudeUsageServiceSuite(t *testing.T) {
	suite.Run(t, new(ClaudeUsageServiceSuite))
}
