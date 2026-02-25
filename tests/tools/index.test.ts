import { describe, it, expect } from 'vitest';
import { parseArgs } from '../../tools/index.js';

describe('parseArgs', () => {
  it('parses valid --owner, --repo, --ref flags', () => {
    const result = parseArgs(['--owner=org', '--repo=midas', '--ref=abc123']);
    expect(result).toEqual({ owner: 'org', repo: 'midas', ref: 'abc123' });
  });

  it('throws when --owner is missing', () => {
    expect(() => parseArgs(['--repo=midas', '--ref=abc123'])).toThrow();
  });

  it('throws when --repo is missing', () => {
    expect(() => parseArgs(['--owner=org', '--ref=abc123'])).toThrow();
  });

  it('throws when --ref is missing', () => {
    expect(() => parseArgs(['--owner=org', '--repo=midas'])).toThrow();
  });
});
