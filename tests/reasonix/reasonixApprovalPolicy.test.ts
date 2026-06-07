import {
  buildCommandApprovalOptions,
  buildPathApprovalOptions,
  normalizeReasonixPermissionMode,
  resolveReasonixApprovalDecision,
  shouldBypassReasonixApprovals,
} from '../../src/providers/reasonix/runtime/reasonixApprovalPolicy';

describe('reasonixApprovalPolicy', () => {
  test('normalizes unknown permission mode to review/normal', () => {
    expect(normalizeReasonixPermissionMode('unexpected')).toBe('normal');
  });

  test('bypasses approvals in yolo mode', () => {
    expect(shouldBypassReasonixApprovals('yolo')).toBe(true);
    expect(
      resolveReasonixApprovalDecision(
        'yolo',
        'deny',
        'run_command',
        { command: 'npm test' },
      ),
    ).toEqual({ type: 'run_once' });
  });

  test('command approvals never persist always-allow prefixes', () => {
    expect(
      resolveReasonixApprovalDecision(
        'normal',
        'allow-always',
        'run_command',
        { command: 'rm -rf tmp' },
      ),
    ).toEqual({ type: 'run_once' });
  });

  test('path approvals only persist always-allow for readable prefixes', () => {
    expect(
      resolveReasonixApprovalDecision(
        'normal',
        'allow-always',
        'path_access',
        {
          path: 'C:/vault/docs/note.md',
          intent: 'read',
          toolName: 'read_file',
          sandboxRoot: 'C:/vault',
          allowPrefix: 'C:/vault/docs',
        },
      ),
    ).toEqual({ type: 'always_allow', prefix: 'C:/vault/docs' });

    expect(
      resolveReasonixApprovalDecision(
        'normal',
        'allow-always',
        'path_access',
        {
          path: 'C:/vault/docs/note.md',
          intent: 'write',
          toolName: 'write_file',
          sandboxRoot: 'C:/vault',
          allowPrefix: 'C:/vault/docs',
        },
      ),
    ).toEqual({ type: 'run_once' });
  });

  test('command approval options remove always-allow in review and plan modes', () => {
    const normal = buildCommandApprovalOptions('normal', 'run_command', {
      command: 'npm test',
      cwd: 'C:/vault',
      timeoutSec: 30,
    });
    const plan = buildCommandApprovalOptions('plan', 'run_background', {
      command: 'npm run dev',
      cwd: 'C:/vault',
      waitSec: 5,
    });

    expect(normal.decisionOptions?.map((option) => option.label)).toEqual([
      'Allow once',
      'Deny',
    ]);
    expect(plan.decisionReason).toContain('Plan mode');
  });

  test('path approval options expose persistent allow only for read access', () => {
    const readOptions = buildPathApprovalOptions('normal', {
      path: 'C:/vault/docs/note.md',
      intent: 'read',
      toolName: 'read_file',
      sandboxRoot: 'C:/vault',
      allowPrefix: 'C:/vault/docs',
    });
    const writeOptions = buildPathApprovalOptions('normal', {
      path: 'C:/vault/docs/note.md',
      intent: 'write',
      toolName: 'write_file',
      sandboxRoot: 'C:/vault',
      allowPrefix: 'C:/vault/docs',
    });

    expect(readOptions.decisionOptions?.map((option) => option.label)).toEqual([
      'Allow once',
      'Always allow root',
      'Deny',
    ]);
    expect(writeOptions.decisionOptions?.map((option) => option.label)).toEqual([
      'Allow once',
      'Deny',
    ]);
    expect(writeOptions.decisionReason).toContain('Always allow is disabled');
  });
});
