import { describe, it, expect } from 'vitest';
import { normalizeStats } from '../utils/stats.js';

describe('normalizeStats', () => {
  it('maps snake_case CLI stats onto the camelCase shape the pipeline reads', () => {
    const raw = {
      total_prompts: 5,
      total_responses: 5,
      total_iterations: 5,
      total_tool_calls: 10,
      files_changed_count: 3,
      shell_commands_count: 1,
      avg_prompt_length: 15.5,
      avg_response_length: 250.2,
      file_types_touched: ['go', 'json'],
    };

    expect(normalizeStats(raw)).toEqual({
      totalPrompts: 5,
      totalResponses: 5,
      totalIterations: 5,
      totalToolCalls: 10,
      filesChangedCount: 3,
      shellCommandsCount: 1,
      avgPromptLength: 15.5,
      avgResponseLength: 250.2,
      fileTypesTouched: ['go', 'json'],
    });
  });

  it('defaults missing fields to 0 / []', () => {
    expect(normalizeStats({})).toEqual({
      totalPrompts: 0,
      totalResponses: 0,
      totalIterations: 0,
      totalToolCalls: 0,
      filesChangedCount: 0,
      shellCommandsCount: 0,
      avgPromptLength: 0,
      avgResponseLength: 0,
      fileTypesTouched: [],
    });
  });

  it('accepts already-camelCase input', () => {
    expect(normalizeStats({ totalPrompts: 7, fileTypesTouched: ['ts'] })).toMatchObject({
      totalPrompts: 7,
      fileTypesTouched: ['ts'],
    });
  });

  it('handles null / undefined / non-object input', () => {
    expect(normalizeStats(null).totalPrompts).toBe(0);
    expect(normalizeStats(undefined).fileTypesTouched).toEqual([]);
    expect(normalizeStats('nope').totalPrompts).toBe(0);
  });

  it('coerces numeric strings and drops non-string file types', () => {
    expect(
      normalizeStats({ total_prompts: '4', file_types_touched: ['go', 3, null] }),
    ).toMatchObject({ totalPrompts: 4, fileTypesTouched: ['go'] });
  });

  it('does not coerce booleans to numbers (true must not become 1)', () => {
    expect(normalizeStats({ total_prompts: true, total_iterations: false }))
      .toMatchObject({ totalPrompts: 0, totalIterations: 0 });
  });
});
