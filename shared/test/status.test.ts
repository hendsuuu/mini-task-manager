import { describe, expect, it } from 'vitest';
import { classifyTransition, isTaskStatus, nextStatus } from '../src';

describe('status flow', () => {
  it('moves one step at a time and stops at done', () => {
    expect(nextStatus('to_do')).toBe('pending');
    expect(nextStatus('pending')).toBe('in_progress');
    expect(nextStatus('in_progress')).toBe('done');
    expect(nextStatus('done')).toBeNull();
  });

  it('classifies transitions', () => {
    expect(classifyTransition('pending', 'pending')).toBe('unchanged');
    expect(classifyTransition('to_do', 'pending')).toBe('allowed');
    expect(classifyTransition('to_do', 'in_progress')).toBe('not_allowed'); // skip
    expect(classifyTransition('in_progress', 'pending')).toBe('not_allowed'); // backwards
    expect(classifyTransition('done', 'to_do')).toBe('not_allowed'); // after done
  });

  it('recognises valid status values only', () => {
    expect(isTaskStatus('in_progress')).toBe(true);
    expect(isTaskStatus('IN_PROGRESS')).toBe(false);
    expect(isTaskStatus(undefined)).toBe(false);
  });
});
