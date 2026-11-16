const test = require('node:test');
const assert = require('node:assert/strict');
const { providerForUser } = require('../src/services/provider-identity.service');

function models({ linked = null, user, candidates = [] }) {
  return {
    Provider: {
      async findOne() { return linked; },
      async findAll() { return candidates; }
    },
    User: { async findByPk() { return user; } }
  };
}

test('uses a direct provider user_id relationship when present', async () => {
  const direct = { id: 'provider-1', user_id: 'user-1', name_provider: 'Eco Travel' };
  assert.equal(await providerForUser('user-1', models({ linked: direct })), direct);
});

test('resolves a unique exact legacy company-name relationship for provider users', async () => {
  const legacy = { id: 'provider-legacy', name_provider: 'Eco Travel' };
  const result = await providerForUser('user-1', models({
    user: { id: 'user-1', role: 'provider', company_name: 'Eco Travel' },
    candidates: [legacy]
  }));
  assert.equal(result, legacy);
});

test('does not guess when the company name is missing, belongs to another role or is ambiguous', async () => {
  const one = { id: 'provider-1', name_provider: 'Eco Travel' };
  for (const user of [
    { id: 'user-1', role: 'traveler', company_name: 'Eco Travel' },
    { id: 'user-1', role: 'provider', company_name: '' },
    { id: 'user-1', role: 'provider', company_name: 'Eco Travel' }
  ]) {
    const candidates = user.company_name ? [one, { ...one, id: 'provider-2' }] : [one];
    assert.equal(await providerForUser('user-1', models({ user, candidates })), null);
  }
});

test('does not attach an exact name match already linked to a different user', async () => {
  const linkedToOther = { id: 'provider-1', user_id: 'user-2', name_provider: 'Eco Travel' };
  const result = await providerForUser('user-1', models({
    user: { id: 'user-1', role: 'provider', company_name: 'Eco Travel' },
    candidates: [linkedToOther]
  }));
  assert.equal(result, null);
});
