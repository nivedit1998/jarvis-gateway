// Public service capabilities only; paired device/home state is never exposed here.
export const release = '0.2.0';
export function capabilities() {
  const configured = Boolean(process.env.JARVIS_UPSTASH_REST_URL && process.env.JARVIS_UPSTASH_REST_TOKEN && process.env.JARVIS_BRIDGE_ID && process.env.JARVIS_BRIDGE_SIGNING_PUBLIC_KEY);
  return {
    service: 'jarvis-gateway', release, phase: configured ? 'encrypted-relay' : 'foundation', protocol_status: 'jarvis-e2e-v1',
    capabilities: { health:true, public_status:true, pairing:configured, authenticated_sessions:configured, encrypted_relay:configured,
      turn_submission:configured, interruption_delivery:configured, sentence_streaming:configured, push_notifications:false },
    content_encryption: {required:true,available:configured},
    ubuntu_bridge: {configured,status:configured?'private':'not_connected'}
  };
}
