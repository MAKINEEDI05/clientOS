import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMemoryTags,
  readTag,
  projectScopeTagGroups,
  clientScopeTagGroups,
  TagPrefix,
} from '../hindsight/tags.js';
import { bankIdForClient, slugify } from '../utils/slug.js';

describe('memory tags', () => {
  test('a project-scoped memory carries client, project, type and scope tags', () => {
    const tags = buildMemoryTags({
      clientSlug: 'vive-studio',
      projectSlug: 'premium-website-redesign',
      memoryType: 'rejection',
      scope: 'project',
      sourceLabelSlug: 'revision-3',
    });
    assert.ok(tags.includes('client:vive-studio'));
    assert.ok(tags.includes('project:premium-website-redesign'));
    assert.ok(tags.includes('type:rejection'));
    assert.ok(tags.includes('scope:project'));
    assert.ok(tags.includes('source:revision-3'));
  });

  test('a CLIENT-scoped memory deliberately omits the project tag', () => {
    // Otherwise it would be filtered out when another project is in context.
    const tags = buildMemoryTags({
      clientSlug: 'vive-studio',
      projectSlug: 'premium-website-redesign',
      memoryType: 'preference',
      scope: 'client',
    });
    assert.ok(!tags.some((t) => t.startsWith(TagPrefix.project)), 'client scope must not be project-bound');
    assert.ok(tags.includes('scope:client'));
  });

  test('a FUTURE-scoped memory also omits the project tag', () => {
    const tags = buildMemoryTags({
      clientSlug: 'vive-studio',
      projectSlug: 'premium-website-redesign',
      memoryType: 'preference',
      scope: 'future',
    });
    assert.ok(!tags.some((t) => t.startsWith(TagPrefix.project)));
  });

  test('tags are deduplicated', () => {
    const tags = buildMemoryTags({
      clientSlug: 'c',
      projectSlug: 'p',
      memoryType: 'preference',
      scope: 'project',
      extra: ['type:preference', 'scope:project'],
    });
    assert.equal(new Set(tags).size, tags.length);
  });

  test('readTag extracts a namespaced value', () => {
    assert.equal(readTag(['type:approval', 'scope:client'], TagPrefix.type), 'approval');
    assert.equal(readTag(['type:approval'], TagPrefix.scope), null);
    assert.equal(readTag(null, TagPrefix.type), null);
  });
});

describe('recall scoping filters', () => {
  test('project recall matches this project OR client-wide OR future scope', () => {
    const groups = projectScopeTagGroups('premium-website-redesign');
    assert.equal(groups.length, 1);
    const or = groups[0]?.or;
    assert.ok(Array.isArray(or));
    assert.equal(or?.length, 3);
    assert.deepEqual(or?.map((g) => g.tags[0]), [
      'project:premium-website-redesign',
      'scope:client',
      'scope:future',
    ]);
  });

  test('every project filter uses any_strict, so UNTAGGED memories cannot leak in', () => {
    // The SDK default `any` also returns untagged memories — that would cross
    // project boundaries, so _strict is mandatory here.
    const or = projectScopeTagGroups('p')[0]?.or ?? [];
    for (const group of or) {
      assert.equal(group.match, 'any_strict');
    }
  });

  test('client recall is strictly scoped to the client tag', () => {
    const groups = clientScopeTagGroups('vive-studio');
    assert.deepEqual(groups, [{ tags: ['client:vive-studio'], match: 'any_strict' }]);
  });
});

describe('slug and bank id', () => {
  test('one bank per client, derived from the slug', () => {
    assert.equal(bankIdForClient('vive-studio'), 'client-vive-studio');
  });

  test('slugify produces ids safe for Hindsight path segments and tags', () => {
    assert.equal(slugify('Revision #3'), 'revision-3');
    assert.equal(slugify('Design Review #1'), 'design-review-1');
    assert.equal(slugify('Vive Studio'), 'vive-studio');
    assert.equal(slugify('  Héllo—Wörld!  '), 'hello-world');
  });

  test('slugify strips characters that could break a tag or path', () => {
    const s = slugify('a/b\\c:d?e#f');
    assert.match(s, /^[a-z0-9-]+$/);
  });

  test('two different clients never share a bank id', () => {
    assert.notEqual(bankIdForClient(slugify('Vive Studio')), bankIdForClient(slugify('Northwind Labs')));
  });
});
