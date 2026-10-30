import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  DEFAULT_LDAP_CONFIG,
  mergeLdapConnectionConfig,
  resolveLdapBindPassword,
} from '@/lib/dg/ldap-config';

const settings = {
  ldapUrl: 'ldaps://dc.example.local:636',
  ldapBindDn: 'CN=svc,DC=example,DC=local',
  ldapBaseDn: 'OU=Users,DC=example,DC=local',
  ldapUserFilter: DEFAULT_LDAP_CONFIG.userFilter,
  ldapDefaultRole: 'MANAGER' as const,
  ldapTlsRejectUnauthorized: true,
};

describe('ldap config', () => {
  afterEach(() => {
    delete process.env.LDAP_BIND_PASSWORD;
  });

  it('uses explicit bind password when provided', () => {
    assert.equal(resolveLdapBindPassword(' secret '), 'secret');
  });

  it('falls back to LDAP_BIND_PASSWORD when bind password is empty', () => {
    process.env.LDAP_BIND_PASSWORD = 'from-env';
    assert.equal(resolveLdapBindPassword(''), 'from-env');
    assert.equal(resolveLdapBindPassword(undefined), 'from-env');
  });

  it('merges ldap overrides with platform settings', () => {
    const config = mergeLdapConnectionConfig(settings, {
      bindPassword: 'pw',
      url: 'ldaps://override.local:636',
    });

    assert.equal(config.url, 'ldaps://override.local:636');
    assert.equal(config.bindDn, settings.ldapBindDn);
    assert.equal(config.baseDn, settings.ldapBaseDn);
    assert.equal(config.bindPassword, 'pw');
    assert.equal(config.userFilter, settings.ldapUserFilter);
  });

  it('uses settings when ldap body is omitted', () => {
    process.env.LDAP_BIND_PASSWORD = 'env-password';
    const config = mergeLdapConnectionConfig(settings);

    assert.equal(config.url, settings.ldapUrl);
    assert.equal(config.bindPassword, 'env-password');
    assert.equal(config.defaultRole, 'MANAGER');
  });
});
