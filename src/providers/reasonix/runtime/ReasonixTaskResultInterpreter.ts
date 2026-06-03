import type { ProviderTaskResultInterpreter, ProviderTaskTerminalStatus } from '../../../core/providers/types';

type JsonRecord = Record<string, unknown>;

const AGENT_ID_KEYS = ['agent_id', 'agentId', 'run_id', 'runId'];
const RESULT_KEYS = ['result', 'output', 'final_result', 'finalResult', 'content', 'text'];
const STATUS_KEYS = ['retrieval_status', 'status', 'state'];

export class ReasonixTaskResultInterpreter implements ProviderTaskResultInterpreter {
  hasAsyncLaunchMarker(toolUseResult: unknown): boolean {
    const record = this.asRecord(toolUseResult);
    if (!record) {
      return false;
    }

    if (this.extractAgentId(toolUseResult)) {
      const status = this.findStringValue(record, STATUS_KEYS);
      return !this.isTerminalStatus(status);
    }

    return false;
  }

  extractAgentId(toolUseResult: unknown): string | null {
    const record = this.asRecord(toolUseResult);
    if (!record) {
      return this.extractAgentIdFromString(this.toPayloadString(toolUseResult));
    }

    return this.findAgentId(record)
      ?? this.extractAgentIdFromString(this.toPayloadString(toolUseResult));
  }

  extractStructuredResult(toolUseResult: unknown): string | null {
    const record = this.asRecord(toolUseResult);
    if (!record) {
      const payload = this.toPayloadString(toolUseResult);
      return this.extractTaggedOrJsonResult(payload);
    }

    const result = this.findResult(record);
    if (result) {
      return result;
    }

    return this.extractTaggedOrJsonResult(this.toPayloadString(toolUseResult));
  }

  resolveTerminalStatus(
    toolUseResult: unknown,
    fallbackStatus: ProviderTaskTerminalStatus,
  ): ProviderTaskTerminalStatus {
    const record = this.asRecord(toolUseResult);
    const status = record ? this.findStringValue(record, STATUS_KEYS) : null;
    const normalized = status?.trim().toLowerCase();

    if (normalized === 'error' || normalized === 'failed' || normalized === 'failure') {
      return 'error';
    }
    if (normalized === 'completed' || normalized === 'complete' || normalized === 'success' || normalized === 'succeeded') {
      return 'completed';
    }

    const payload = this.toPayloadString(toolUseResult);
    const taggedStatus = this.extractTagValue(payload, 'retrieval_status')
      ?? this.extractTagValue(payload, 'status');
    const taggedNormalized = taggedStatus?.trim().toLowerCase();
    if (taggedNormalized === 'error' || taggedNormalized === 'failed' || taggedNormalized === 'failure') {
      return 'error';
    }
    if (
      taggedNormalized === 'completed'
      || taggedNormalized === 'complete'
      || taggedNormalized === 'success'
      || taggedNormalized === 'succeeded'
    ) {
      return 'completed';
    }

    return fallbackStatus;
  }

  extractTagValue(payload: string, tagName: string): string | null {
    const escapedName = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`<${escapedName}\\b[^>]*>([\\s\\S]*?)<\\/${escapedName}>`, 'i');
    const match = payload.match(pattern);
    const value = match?.[1]?.trim();
    return value || null;
  }

  private asRecord(value: unknown): JsonRecord | null {
    const unwrapped = this.unwrapTextEnvelope(value);
    if (!unwrapped) {
      return null;
    }

    if (typeof unwrapped === 'object' && !Array.isArray(unwrapped)) {
      return unwrapped as JsonRecord;
    }

    if (typeof unwrapped !== 'string') {
      return null;
    }

    try {
      const parsed = JSON.parse(unwrapped);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as JsonRecord
        : null;
    } catch {
      return null;
    }
  }

  private unwrapTextEnvelope(value: unknown): unknown {
    if (Array.isArray(value)) {
      const textBlock = value.find((entry) => (
        entry
        && typeof entry === 'object'
        && typeof (entry as JsonRecord).text === 'string'
      ));
      return textBlock ? (textBlock as JsonRecord).text : value;
    }

    if (
      value
      && typeof value === 'object'
      && !Array.isArray(value)
      && typeof (value as JsonRecord).text === 'string'
    ) {
      return (value as JsonRecord).text;
    }

    return value;
  }

  private findAgentId(record: JsonRecord): string | null {
    const direct = this.findStringValue(record, AGENT_ID_KEYS);
    if (direct) {
      return direct;
    }

    for (const key of ['data', 'task']) {
      const nested = record[key];
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        const nestedAgentId = this.findAgentId(nested as JsonRecord);
        if (nestedAgentId) {
          return nestedAgentId;
        }
      }
    }

    return null;
  }

  private findResult(record: JsonRecord): string | null {
    const direct = this.findStringValue(record, RESULT_KEYS);
    if (direct) {
      return this.extractTaggedOrJsonResult(direct) ?? direct;
    }

    const task = record.task;
    if (task && typeof task === 'object' && !Array.isArray(task)) {
      const taskResult = this.findResult(task as JsonRecord);
      if (taskResult) {
        return taskResult;
      }
    }

    const agents = record.agents;
    if (agents && typeof agents === 'object' && !Array.isArray(agents)) {
      for (const value of Object.values(agents as JsonRecord)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const agentResult = this.findResult(value as JsonRecord);
          if (agentResult) {
            return agentResult;
          }
        }
      }
    }

    return null;
  }

  private findStringValue(record: JsonRecord, keys: string[]): string | null {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return null;
  }

  private extractTaggedOrJsonResult(payload: string): string | null {
    if (!payload.trim()) {
      return null;
    }

    const taggedResult = this.extractTagValue(payload, 'result');
    if (taggedResult) {
      return taggedResult;
    }

    const output = this.extractTagValue(payload, 'output');
    if (output) {
      return this.extractTaggedOrJsonResult(output) ?? output;
    }

    try {
      const parsed = JSON.parse(payload);
      const record = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as JsonRecord
        : null;
      return record ? this.findResult(record) : null;
    } catch {
      return null;
    }
  }

  private extractAgentIdFromString(payload: string): string | null {
    const patterns = [
      /"agent_id"\s*:\s*"([^"]+)"/i,
      /"agentId"\s*:\s*"([^"]+)"/i,
      /"run_id"\s*:\s*"([^"]+)"/i,
      /"runId"\s*:\s*"([^"]+)"/i,
      /\bagent_id\s*[=:]\s*"?([a-zA-Z0-9_-]+)"?/i,
      /\bagentId\s*[=:]\s*"?([a-zA-Z0-9_-]+)"?/i,
      /\brun_id\s*[=:]\s*"?([a-zA-Z0-9_-]+)"?/i,
      /\brunId\s*[=:]\s*"?([a-zA-Z0-9_-]+)"?/i,
    ];

    for (const pattern of patterns) {
      const match = payload.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }

    return null;
  }

  private toPayloadString(value: unknown): string {
    const unwrapped = this.unwrapTextEnvelope(value);
    if (typeof unwrapped === 'string') {
      return unwrapped;
    }
    if (unwrapped === null || unwrapped === undefined) {
      return '';
    }

    try {
      return JSON.stringify(unwrapped);
    } catch {
      return String(unwrapped);
    }
  }

  private isTerminalStatus(status: string | null): boolean {
    if (!status) {
      return false;
    }

    const normalized = status.trim().toLowerCase();
    return normalized === 'completed'
      || normalized === 'complete'
      || normalized === 'success'
      || normalized === 'succeeded'
      || normalized === 'error'
      || normalized === 'failed'
      || normalized === 'failure';
  }
}
