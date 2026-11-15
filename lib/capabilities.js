// These are implemented capabilities, not the aspirational wire contract.
export const release = '0.1.0';
export function capabilities() {
  return {
    service: 'jarvis-gateway',
    release,
    phase: 'foundation',
    protocol_status: 'draft',
    capabilities: {
      health: true,
      public_status: true,
      pairing: false,
      authenticated_sessions: false,
      encrypted_relay: false,
      turn_submission: false,
      interruption_delivery: false,
      sentence_streaming: false,
      push_notifications: false
    },
    content_encryption: { required: true, available: false },
    ubuntu_bridge: { configured: false, status: 'not_connected' }
  };
}
