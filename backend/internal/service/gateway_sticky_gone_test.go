package service

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestStickyAccountGone(t *testing.T) {
	require.True(t, stickyAccountGone(nil, nil))
	require.True(t, stickyAccountGone(nil, ErrAccountNotFound))
	require.False(t, stickyAccountGone(nil, errors.New("db timeout")))
	require.False(t, stickyAccountGone(&Account{ID: 1}, nil))
}
