package service

import "github.com/tidwall/sjson"

// IsAnthropicTemperatureDisabled applies only to Anthropic API key accounts.
// Missing or non-boolean settings preserve the upstream request unchanged.
func (a *Account) IsAnthropicTemperatureDisabled() bool {
	if a == nil || a.Platform != PlatformAnthropic || a.Type != AccountTypeAPIKey {
		return false
	}
	disabled, _ := a.Extra["anthropic_disable_temperature"].(bool)
	return disabled
}

// Remove only the top-level sampling parameter, preserving tool inputs and messages.
func stripAnthropicAccountTemperature(account *Account, body []byte) ([]byte, error) {
	if !account.IsAnthropicTemperatureDisabled() {
		return body, nil
	}
	return sjson.DeleteBytes(body, "temperature")
}
