import type { ApprovalCallbackOptions } from '../../../core/runtime/types';
import type { ApprovalDecision, PermissionMode } from '../../../core/types/settings';

export type ReasonixPermissionMode = PermissionMode;

export interface ReasonixCommandApprovalPayload {
  command: string;
  cwd?: string;
  timeoutSec?: number;
  waitSec?: number;
}

export interface ReasonixPathApprovalPayload {
  path: string;
  intent: 'read' | 'write';
  toolName: string;
  sandboxRoot: string;
  allowPrefix: string;
}

export type ReasonixGateDecision =
  | { type: 'run_once' }
  | { type: 'always_allow'; prefix: string }
  | { type: 'deny'; denyContext?: string };

export function normalizeReasonixPermissionMode(mode: unknown): ReasonixPermissionMode {
  if (mode === 'plan' || mode === 'normal' || mode === 'yolo') {
    return mode;
  }
  return 'normal';
}

export function shouldBypassReasonixApprovals(mode: ReasonixPermissionMode): boolean {
  return mode === 'yolo';
}

export function buildCommandApprovalOptions(
  mode: ReasonixPermissionMode,
  kind: 'run_command' | 'run_background',
  payload: ReasonixCommandApprovalPayload,
): ApprovalCallbackOptions {
  const cwd = payload.cwd?.trim();
  const timeoutLabel = kind === 'run_background'
    ? `Wait ${payload.waitSec ?? 0}s before detaching`
    : `Timeout ${payload.timeoutSec ?? 0}s`;

  return {
    decisionReason: [
      mode === 'plan'
        ? 'Plan mode still requires approval before executing shell commands.'
        : 'Review mode requires approval before executing shell commands.',
      cwd ? `Working directory: ${cwd}` : 'Working directory: current vault root',
      timeoutLabel,
    ].join('\n'),
    decisionOptions: [
      {
        label: 'Allow once',
        description: 'Run this command a single time for the current request.',
        value: 'allow-once',
        decision: 'allow',
      },
      {
        label: 'Deny',
        description: 'Block this command and keep the current conversation state.',
        value: 'deny',
        decision: 'deny',
      },
    ],
  };
}

export function buildPathApprovalOptions(
  mode: ReasonixPermissionMode,
  payload: ReasonixPathApprovalPayload,
): ApprovalCallbackOptions {
  const normalizedPrefix = payload.allowPrefix.trim();
  const canAlwaysAllow = payload.intent === 'read' && normalizedPrefix.length > 0;
  const decisionOptions: NonNullable<ApprovalCallbackOptions['decisionOptions']> = [
    {
      label: 'Allow once',
      description: `Grant ${payload.intent} access only for this tool call.`,
      value: 'allow-once',
      decision: 'allow',
    },
  ];

  if (canAlwaysAllow) {
    decisionOptions.push({
      label: 'Always allow root',
      description: `Persist read access for ${normalizedPrefix}.`,
      value: 'allow-always',
      decision: 'allow-always',
    });
  }

  decisionOptions.push({
    label: 'Deny',
    description: `Block ${payload.intent} access to ${payload.path}.`,
    value: 'deny',
    decision: 'deny',
  });

  return {
    decisionReason: [
      mode === 'plan'
        ? 'Plan mode still requires approval before accessing files.'
        : 'Review mode requires approval before accessing files.',
      `Sandbox root: ${payload.sandboxRoot}`,
      canAlwaysAllow
        ? `Always allow will persist read access for: ${normalizedPrefix}`
        : 'Always allow is disabled for this request.',
    ].join('\n'),
    blockedPath: payload.path,
    decisionOptions,
  };
}

export function resolveReasonixApprovalDecision(
  mode: ReasonixPermissionMode,
  decision: ApprovalDecision,
  kind: 'run_command' | 'run_background' | 'path_access',
  payload: ReasonixCommandApprovalPayload | ReasonixPathApprovalPayload,
): ReasonixGateDecision {
  if (shouldBypassReasonixApprovals(mode)) {
    return { type: 'run_once' };
  }

  if (decision === 'allow') {
    return { type: 'run_once' };
  }

  if (decision === 'allow-always') {
    if (kind === 'path_access') {
      const pathPayload = payload as ReasonixPathApprovalPayload;
      if (pathPayload.intent === 'read' && pathPayload.allowPrefix.trim()) {
        return { type: 'always_allow', prefix: pathPayload.allowPrefix };
      }
    }

    return { type: 'run_once' };
  }

  return { type: 'deny' };
}
