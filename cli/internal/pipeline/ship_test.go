package pipeline

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/example/devscope-cli/internal/api"
)

type mockSubmitter struct {
	result *api.SubmitResult
	calls  int
}

func (m *mockSubmitter) SubmitSession(payload *api.SessionPayload) *api.SubmitResult {
	m.calls++
	return m.result
}

func TestShipSession_Success(t *testing.T) {
	queueDir := t.TempDir()
	submitter := &mockSubmitter{
		result: &api.SubmitResult{Accepted: true},
	}
	payload := &api.SessionPayload{SessionID: "test-success"}

	err := ShipSession(submitter, queueDir, payload)
	if err != nil {
		t.Fatalf("ShipSession unexpected error: %v", err)
	}

	queueFiles, _ := os.ReadDir(queueDir)
	if len(queueFiles) != 0 {
		t.Errorf("expected 0 queued files on success, got %d", len(queueFiles))
	}
}

func TestShipSession_RetriableQueuesFile(t *testing.T) {
	queueDir := t.TempDir()
	submitter := &mockSubmitter{
		result: &api.SubmitResult{
			Accepted:  false,
			Retriable: true,
			Err:       errors.New("500 internal server error simulated"),
		},
	}
	payload := &api.SessionPayload{SessionID: "test-offline"}

	err := ShipSession(submitter, queueDir, payload)
	if err != nil {
		t.Fatalf("ShipSession expected to swallow error and successfully queue, got: %v", err)
	}

	queueFiles, _ := os.ReadDir(queueDir)
	if len(queueFiles) != 1 {
		t.Errorf("expected 1 queued file, got %d", len(queueFiles))
	}
	if queueFiles[0].Name() != "test-offline.json" {
		t.Errorf("unexpected queued file name: %s", queueFiles[0].Name())
	}
}

func TestShipSession_TerminalFailsInstantly(t *testing.T) {
	queueDir := t.TempDir()
	submitter := &mockSubmitter{
		result: &api.SubmitResult{
			Accepted:  false,
			Retriable: false,
			Err:       errors.New("401 unauthorized"),
		},
	}
	payload := &api.SessionPayload{SessionID: "test-unauth"}

	err := ShipSession(submitter, queueDir, payload)
	if err == nil {
		t.Fatal("ShipSession expected terminal auth error, got nil")
	}

	queueFiles, _ := os.ReadDir(queueDir)
	if len(queueFiles) != 0 {
		t.Errorf("terminal errors should not be queued, got %d queued files", len(queueFiles))
	}
}

func TestDrainQueue(t *testing.T) {
	queueDir := t.TempDir()
	
	// Create two fake queue files
	os.WriteFile(filepath.Join(queueDir, "sess-1.json"), []byte(`{"session_id": "sess-1"}`), 0600)
	os.WriteFile(filepath.Join(queueDir, "sess-2.json"), []byte(`{"session_id": "sess-2"}`), 0600)

	submitter := &mockSubmitter{
		result: &api.SubmitResult{Accepted: true},
	}

	shipped, failed := DrainQueue(submitter, queueDir)

	if shipped != 2 {
		t.Errorf("expected 2 shipped payloads, got %d", shipped)
	}
	if failed != 0 {
		t.Errorf("expected 0 failed payloads, got %d", failed)
	}
	
	queueFiles, _ := os.ReadDir(queueDir)
	if len(queueFiles) != 0 {
		t.Errorf("successful drain should delete payloads, %d remained", len(queueFiles))
	}
}

func TestDrainQueue_RetriableBailsEarly(t *testing.T) {
	queueDir := t.TempDir()
	os.WriteFile(filepath.Join(queueDir, "sess-1.json"), []byte(`{"session_id": "sess-1"}`), 0600)
	os.WriteFile(filepath.Join(queueDir, "sess-2.json"), []byte(`{"session_id": "sess-2"}`), 0600)

	// Simulate network out
	submitter := &mockSubmitter{
		result: &api.SubmitResult{Retriable: true},
	}

	shipped, failed := DrainQueue(submitter, queueDir)

	if shipped != 0 {
		t.Errorf("expected 0 shipping success, got %d", shipped)
	}
	if failed != 1 {
		t.Errorf("expected ONLY 1 failure before breaking loop, got %d", failed)
	}
	
	queueFiles, _ := os.ReadDir(queueDir)
	if len(queueFiles) != 2 {
		t.Errorf("retriable errors must retain files, expected 2, got %d", len(queueFiles))
	}
}
