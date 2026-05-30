import { onchainTable, index } from "ponder";

export const project = onchainTable(
  "project",
  (t) => ({
    id: t.bigint().primaryKey(),
    collector: t.hex().notNull(),
    acceptedToken: t.hex().notNull(),
    commodityType: t.text().notNull(),
    volumeKg: t.bigint().notNull(),
    collateralValue: t.bigint().notNull(),
    maxFunding: t.bigint().notNull(),
    profitPerKgInvestor: t.bigint().notNull(),
    profitPerKgPlatform: t.bigint().notNull(),
    fundingDeadline: t.bigint().notNull(),
    repaymentDeadline: t.bigint().notNull().default(0n),
    metadataURI: t.text().notNull(),
    status: t.integer().notNull().default(0),
    totalFunded: t.bigint().notNull().default(0n),
    investorCount: t.integer().notNull().default(0),
    buyerPaymentAmount: t.bigint().notNull().default(0n),
    totalInvestorReturn: t.bigint().notNull().default(0n),
    platformFee: t.bigint().notNull().default(0n),
    collectorRemainder: t.bigint().notNull().default(0n),
    collateralVerified: t.boolean().notNull().default(false),
    createdAt: t.integer().notNull(),
    fundedAt: t.integer(),
    settledAt: t.integer(),
  }),
  (table) => ({
    collectorIdx: index().on(table.collector),
    statusIdx: index().on(table.status),
    acceptedTokenIdx: index().on(table.acceptedToken),
  }),
);

export const investment = onchainTable(
  "investment",
  (t) => ({
    id: t.text().primaryKey(),
    projectId: t.bigint().notNull(),
    investor: t.hex().notNull(),
    token: t.hex().notNull(),
    amount: t.bigint().notNull(),
    claimed: t.boolean().notNull().default(false),
    claimedAmount: t.bigint().notNull().default(0n),
    timestamp: t.integer().notNull(),
  }),
  (table) => ({
    projectIdIdx: index().on(table.projectId),
    investorIdx: index().on(table.investor),
  }),
);

export const account = onchainTable(
  "account",
  (t) => ({
    address: t.hex().primaryKey(),
    role: t.text().notNull(),
    totalInvested: t.bigint().notNull().default(0n),
    totalClaimed: t.bigint().notNull().default(0n),
    investmentCount: t.integer().notNull().default(0),
    activeInvestmentCount: t.integer().notNull().default(0),
    projectCount: t.integer().notNull().default(0),
    completedProjectCount: t.integer().notNull().default(0),
    isBlacklisted: t.boolean().notNull().default(false),
    lastActiveAt: t.integer().notNull(),
    profileURI: t.text(),
    profileName: t.text(),
    profileLocation: t.text(),
  }),
  (table) => ({
    roleIdx: index().on(table.role),
  }),
);

export const transfer = onchainTable(
  "transfer",
  (t) => ({
    id: t.text().primaryKey(),
    from: t.hex().notNull(),
    to: t.hex().notNull(),
    value: t.bigint().notNull(),
    token: t.hex().notNull(),
    timestamp: t.integer().notNull(),
    blockNumber: t.bigint().notNull(),
    transactionHash: t.hex().notNull(),
  }),
  (table) => ({
    fromIdx: index().on(table.from),
    toIdx: index().on(table.to),
    tokenIdx: index().on(table.token),
  }),
);

export const portfolioSnapshot = onchainTable(
  "portfolio_snapshot",
  (t) => ({
    id: t.text().primaryKey(),
    address: t.hex().notNull(),
    totalInvested: t.bigint().notNull(),
    totalClaimed: t.bigint().notNull(),
    activeInvestments: t.integer().notNull(),
    netValue: t.bigint().notNull(),
    timestamp: t.integer().notNull(),
    blockNumber: t.bigint().notNull(),
  }),
  (table) => ({
    addressIdx: index().on(table.address),
    timestampIdx: index().on(table.timestamp),
  }),
);

export const activityFeed = onchainTable(
  "activity_feed",
  (t) => ({
    id: t.text().primaryKey(),
    address: t.hex().notNull(),
    type: t.text().notNull(),
    projectId: t.bigint(),
    amount: t.bigint(),
    token: t.hex(),
    description: t.text().notNull(),
    timestamp: t.integer().notNull(),
    blockNumber: t.bigint().notNull(),
    transactionHash: t.hex().notNull(),
  }),
  (table) => ({
    addressIdx: index().on(table.address),
    typeIdx: index().on(table.type),
    timestampIdx: index().on(table.timestamp),
    projectIdIdx: index().on(table.projectId),
  }),
);

export const platformStats = onchainTable("platform_stats", (t) => ({
  id: t.text().primaryKey(),
  totalProjects: t.integer().notNull().default(0),
  totalInvested: t.bigint().notNull().default(0n),
  totalDistributed: t.bigint().notNull().default(0n),
  totalPlatformFees: t.bigint().notNull().default(0n),
  activeProjects: t.integer().notNull().default(0),
  totalInvestors: t.integer().notNull().default(0),
  totalCollectors: t.integer().notNull().default(0),
  updatedAt: t.integer().notNull(),
}));
