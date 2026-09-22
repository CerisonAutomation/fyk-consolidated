/**
 * Multi-Account Switch — 27.4
 * Swap between multiple accounts without full logout — token sets kept per account in secure storage.
 */

export type AccountTokenSet = {
  accountId: string;
  email: string;
  displayName: string;
  avatar?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  lastUsedAt: string;
};

export const MAX_ACCOUNTS = 5;

export function createTokenSet(accountId: string, email: string, displayName: string, accessToken: string, refreshToken: string): AccountTokenSet {
  return {
    accountId,
    email,
    displayName,
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    lastUsedAt: new Date().toISOString(),
  };
}

export function switchAccount(accounts: AccountTokenSet[], targetAccountId: string): { current: AccountTokenSet | null; updated: AccountTokenSet[] } {
  const target = accounts.find((a) => a.accountId === targetAccountId);
  if (!target) return { current: null, updated: accounts };

  const updated = accounts.map((a) => ({
    ...a,
    lastUsedAt: a.accountId === targetAccountId ? new Date().toISOString() : a.lastUsedAt,
  }));

  return { current: target, updated };
}

export function addAccount(accounts: AccountTokenSet[], newAccount: AccountTokenSet): { success: boolean; accounts: AccountTokenSet[]; error?: string } {
  if (accounts.length >= MAX_ACCOUNTS) {
    return { success: false, accounts, error: `Max ${MAX_ACCOUNTS} accounts` };
  }
  if (accounts.some((a) => a.accountId === newAccount.accountId)) {
    return { success: false, accounts, error: "Account already exists" };
  }
  return { success: true, accounts: [...accounts, newAccount] };
}

export function removeAccount(accounts: AccountTokenSet[], accountId: string): AccountTokenSet[] {
  return accounts.filter((a) => a.accountId !== accountId);
}

export function isTokenExpired(tokenSet: AccountTokenSet): boolean {
  return new Date(tokenSet.expiresAt).getTime() < Date.now();
}
