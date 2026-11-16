const { User, Provider } = require('../models');

/**
 * Resolve the provider record associated with an authenticated provider user.
 * Older provider data sometimes has no Provider.user_id even though the user's
 * company_name exactly matches a unique Provider.name_provider. Only accept
 * that exact, unambiguous legacy relationship; never resolve by fuzzy name.
 */
async function providerForUser(userId, models = { User, Provider }) {
  const linked = await models.Provider.findOne({ where: { user_id: userId } });
  if (linked) return linked;

  const user = await models.User.findByPk(userId, {
    attributes: ['id', 'role', 'company_name']
  });
  if (user?.role !== 'provider' || typeof user.company_name !== 'string' || !user.company_name.trim()) {
    return null;
  }

  const candidates = await models.Provider.findAll({
    where: { name_provider: user.company_name }
  });
  if (candidates.length !== 1) return null;
  const candidate = candidates[0];
  if (candidate.name_provider !== user.company_name ||
      (candidate.user_id && candidate.user_id !== userId)) return null;
  return candidate;
}

module.exports = { providerForUser };
