import type { ProviderCapabilities } from '../../core/providers/types';

export const REASONIX_PROVIDER_CAPABILITIES: Readonly<ProviderCapabilities> = Object.freeze({
  providerId: 'reasonix',
  supportsPersistentRuntime: false,  // Reasonix uses library API, not persistent process
  supportsNativeHistory: true,       // JSONL session storage
  supportsPlanMode: true,            // registerPlanTool()
  supportsRewind: false,             // Not in scope for v1
  supportsFork: false,               // Not in scope for v1
  supportsProviderCommands: true,    // Static Reasonix command catalog
  supportsImageAttachments: false,   // Reasonix chat messages are text-only for now
  supportsInstructionMode: true,     // Instruction refinement
  supportsMcpTools: true,            // McpClient
  supportsTurnSteer: true,           // CacheFirstLoop.steer()
  reasoningControl: 'effort',        // DeepSeek uses reasoning_effort
  planPathPrefix: '/.reasonix/plans/',
});
