import { describe, expect, it } from 'vitest';
import { assessConfiguredWriteCapability, GitHubWriteCapabilityPolicy } from './githubWriteCapability';
import { computeCredentialIdentifier } from '../_core/auth';

const repository = 'Aayushashsahu/sentinelforge-incident-fixture';
const contents = { repository, capability: 'contents:write' as const };
const pullRequests = { repository, capability: 'pull_requests:write' as const };

describe('configured fixture GitHub write-capability policy', () => {
  const token = 'dummy-token';
  const expectedIdentifier = computeCredentialIdentifier(token);

  it('permits only an exact configured contents-write guard while keeping effective authority unverified', () => {
    const policy = new GitHubWriteCapabilityPolicy(expectedIdentifier, [contents, pullRequests]);
    expect(() => policy.verify({ repository, capability: 'contents:write', method: 'POST', endpoint: '/git/refs' }, token)).not.toThrow();
    expect(assessConfiguredWriteCapability([contents, pullRequests], repository, 'contents:write')).toEqual({ configured: 'VERIFIED', effective: 'UNVERIFIED', fullPermissionManifest: 'UNVERIFIABLE' });
  });

  it('permits only an exact configured pull-request-write guard', () => {
    const policy = new GitHubWriteCapabilityPolicy(expectedIdentifier, [contents, pullRequests]);
    expect(() => policy.verify({ repository, capability: 'pull_requests:write', method: 'POST', endpoint: '/pulls' }, token)).not.toThrow();
  });

  it('blocks missing configuration', () => {
    const policy = new GitHubWriteCapabilityPolicy(expectedIdentifier, []);
    expect(() => policy.verify({ repository, capability: 'contents:write', method: 'POST', endpoint: '/git/refs' }, token)).toThrow('MISSING_CONFIGURATION');
  });

  it('blocks read-only configuration', () => {
    const policy = new GitHubWriteCapabilityPolicy(expectedIdentifier, [{ repository, capability: 'contents:read' }]);
    expect(() => policy.verify({ repository, capability: 'contents:write', method: 'POST', endpoint: '/git/refs' }, token)).toThrow('MISSING_CONFIGURATION');
  });

  it('blocks wrong repository', () => {
    const policy = new GitHubWriteCapabilityPolicy(expectedIdentifier, [contents]);
    expect(() => policy.verify({ repository: 'Aayushashsahu/other', capability: 'contents:write', method: 'POST', endpoint: '/git/refs' }, token)).toThrow('REPOSITORY_MISMATCH');
  });

  it('blocks mismatched operation capability', () => {
    const policy = new GitHubWriteCapabilityPolicy(expectedIdentifier, [contents]);
    expect(() => policy.verify({ repository, capability: 'pull_requests:write', method: 'POST', endpoint: '/pulls' }, token)).toThrow('MISSING_CONFIGURATION');
  });

  it('blocks credential mismatch', () => {
    const policy = new GitHubWriteCapabilityPolicy(expectedIdentifier, [contents]);
    expect(() => policy.verify({ repository, capability: 'contents:write', method: 'POST', endpoint: '/git/refs' }, 'wrong-token')).toThrow('CREDENTIAL_MISMATCH');
  });
});
