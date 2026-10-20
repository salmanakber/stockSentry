export interface AdminStats {
  shops: {
    total: number;
    installed: number;
    uninstalled: number;
    byPlan: { planSlug: string; count: number }[];
  };
  incidents: { total: number; open: number };
  ai: {
    generated: number;
    failed: number;
    usedThisMonthAcrossShops: number;
  };
}

export interface AdminShop {
  id: string;
  shopDomain: string;
  installationStatus: string;
  planSlug: string;
  planId?: string | null;
  planAssignedByAdmin?: boolean;
  billingStatus: string;
  complimentary?: boolean;
  installedAt?: string | null;
  uninstalledAt?: string | null;
  aiReportsUsedMonth?: number;
}

export interface AdminPlan {
  slug: string;
  displayName: string;
  priceUsdMonthly: number;
  maxMonitoredItems: number;
  historyDays: number;
  maxOpenIncidents: number;
  aiReportsPerMonth: number;
  advancedRules: boolean;
  exportsEnabled: boolean;
  teamWorkflows: boolean;
  active?: boolean;
  trialDays?: number;
  planId?: string;
}

export interface AdminAiProviderPublic {
  id: string;
  label: string;
  enabled: boolean;
  apiKeySet: boolean;
  model: string;
}

export interface AdminAiConfig {
  providerOrder: string[];
  providers: AdminAiProviderPublic[];
}

export interface AdminSettingsInfo {
  bootstrapNote: string;
  jwt: {
    headerName: string;
    algorithm: string;
    ttlHours: number;
    configured: boolean;
  };
  adminPasswordConfigured?: boolean;
  bootstrapSecretConfigured?: boolean;
}
