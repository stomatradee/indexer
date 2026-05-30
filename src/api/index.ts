import { db } from "ponder:api";
import schema, {
  account,
  activityFeed,
  investment,
  platformStats,
  portfolioSnapshot,
  project,
} from "ponder:schema";
import { and, asc, count, desc, eq, gte, lte, ne, sql, sum } from "ponder";
import { Hono } from "hono";
import { client, graphql } from "ponder";

const app = new Hono();

app.use("/sql/*", client({ db, schema }));
app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

const TOKEN_DECIMALS = 6;

const STATUS_LABELS: Record<number, string> = {
  0: "PENDING",
  1: "OPEN",
  2: "FUNDED",
  3: "CLOSED",
  4: "DISBURSED",
  5: "SETTLED",
  6: "DEFAULTED",
  7: "COMPLETED",
  8: "REJECTED",
};

const COMMODITY_CATEGORY: Record<string, string> = {
  corn: "Agriculture",
  rice: "Agriculture",
  coffee: "Agriculture",
  wheat: "Agriculture",
  mahogany: "Timber",
  teak: "Timber",
  agave: "Spirits",
};

type ProjectRow = typeof project.$inferSelect;
type InvestmentRow = typeof investment.$inferSelect;

async function fetchMetadata(uri: string): Promise<Record<string, unknown> | null> {
  if (!uri) return null;
  try {
    const res = await fetch(uri, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return await res.json() as Record<string, unknown>;
  } catch (e) {
    console.error("[fetchMetadata] failed:", uri, e);
    return null;
  }
}

async function enrichWithMetadata<T extends { metadataURI: string }>(
  items: T[],
): Promise<(Omit<T, "metadataURI"> & { metadata: Record<string, unknown> | null })[]> {
  const metas = await Promise.all(items.map((item) => fetchMetadata(item.metadataURI)));
  return items.map((item, i) => {
    const { metadataURI: _, ...rest } = item;
    return { ...rest, metadata: metas[i] ?? null };
  });
}

function toUSD(amount: bigint): number {
  return Number(amount) / 10 ** TOKEN_DECIMALS;
}

function calcPercentage(part: bigint, total: bigint): number {
  if (total === 0n) return 0;
  return Math.round((Number(part) / Number(total)) * 1000) / 10;
}

function formatStatus(status: number): string {
  return STATUS_LABELS[status] ?? "UNKNOWN";
}

function projectCalc(p: typeof project.$inferSelect) {
  const fundingProgress = calcPercentage(p.totalFunded, p.maxFunding);
  const maxFundingUSD = toUSD(p.maxFunding);
  const totalFundedUSD = toUSD(p.totalFunded);
  const pricePerKg =
    p.volumeKg > 0n
      ? Math.round((toUSD(p.maxFunding) / Number(p.volumeKg)) * 1000000) / 1000000
      : 0;
  const costPerKg =
    p.volumeKg > 0n ? Number(p.maxFunding) / Number(p.volumeKg) : 0;
  const returnRate =
    costPerKg > 0
      ? Math.round((Number(p.profitPerKgInvestor) / costPerKg) * 100 * 10) / 10
      : 0;
  const estimatedReturnRate =
    p.maxFunding > 0n
      ? Math.round(
          ((Number(p.collateralValue) - Number(p.maxFunding)) / Number(p.maxFunding)) * 100 * 10,
        ) / 10
      : 0;
  return { fundingProgress, maxFundingUSD, totalFundedUSD, pricePerKg, returnRate, estimatedReturnRate };
}

function commodityCategory(type: string): string {
  const key = type.toLowerCase().trim();
  return COMMODITY_CATEGORY[key] ?? "Other";
}

function parseBigIntParam(val: string | undefined): bigint | null {
  if (!val) return null;
  try {
    return BigInt(val);
  } catch {
    return null;
  }
}

app.get("/api/projects/open", async (c) => {
  const rows = await db
    .select()
    .from(project)
    .where(eq(project.status, 1))
    .orderBy(desc(project.createdAt))
    .limit(50);

  const raw = rows.map((p: ProjectRow) => ({
    id: p.id.toString(),
    collector: p.collector,
    acceptedToken: p.acceptedToken,
    commodityType: p.commodityType,
    volumeKg: p.volumeKg.toString(),
    metadataURI: p.metadataURI,
    maxFunding: p.maxFunding.toString(),
    totalFunded: p.totalFunded.toString(),
    investorCount: p.investorCount,
    fundingDeadline: p.fundingDeadline.toString(),
    status: p.status,
    statusLabel: formatStatus(p.status),
    createdAt: p.createdAt,
    ...projectCalc(p),
  }));
  const projects = await enrichWithMetadata(raw);

  return c.json({ projects });
});

app.get("/api/projects/browse", async (c) => {
  const statusParam = c.req.query("status");
  const collectorParam = c.req.query("collector");
  const sort = c.req.query("sort") ?? "newest";
  const limit = Math.min(Number(c.req.query("limit") ?? 20), 100);
  const offset = Number(c.req.query("offset") ?? 0);

  const conditions: ReturnType<typeof eq>[] = [];
  if (statusParam !== undefined) {
    conditions.push(eq(project.status, Number(statusParam)));
  }
  if (collectorParam) {
    conditions.push(eq(project.collector, collectorParam as `0x${string}`));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const orderBy =
    sort === "funding"
      ? desc(project.totalFunded)
      : sort === "investors"
        ? desc(project.investorCount)
        : desc(project.createdAt);

  const [rows, countRows] = await Promise.all([
    db.select().from(project).where(where).orderBy(orderBy).limit(limit).offset(offset),
    db.select({ cnt: count() }).from(project).where(where),
  ]);
  const cnt = countRows[0]?.cnt ?? 0;

  const raw = rows.map((p: ProjectRow) => ({
    id: p.id.toString(),
    collector: p.collector,
    acceptedToken: p.acceptedToken,
    commodityType: p.commodityType,
    volumeKg: p.volumeKg.toString(),
    metadataURI: p.metadataURI,
    status: p.status,
    statusLabel: formatStatus(p.status),
    investorCount: p.investorCount,
    createdAt: p.createdAt,
    ...projectCalc(p),
  }));
  const projects = await enrichWithMetadata(raw);

  return c.json({ projects, total: cnt, limit, offset });
});

app.get("/api/projects/:id/investors", async (c) => {
  const id = parseBigIntParam(c.req.param("id"));
  if (id === null) return c.json({ error: "Invalid project id" }, 400);

  const [projectData, rows] = await Promise.all([
    db.select().from(project).where(eq(project.id, id)).limit(1),
    db
      .select()
      .from(investment)
      .where(eq(investment.projectId, id))
      .orderBy(desc(investment.amount)),
  ]);

  const p = projectData[0];

  const investors = rows.map((inv: InvestmentRow) => ({
    investor: inv.investor,
    token: inv.token,
    amount: inv.amount.toString(),
    amountUSD: toUSD(inv.amount),
    claimed: inv.claimed,
    claimedAmount: inv.claimedAmount.toString(),
    claimedAmountUSD: toUSD(inv.claimedAmount),
    timestamp: inv.timestamp,
    sharePercent: p ? calcPercentage(inv.amount, p.totalFunded) : 0,
  }));

  return c.json({
    investors,
    totalInvestors: investors.length,
    totalFundedUSD: p ? toUSD(p.totalFunded) : 0,
  });
});

app.get("/api/projects/:id/activity", async (c) => {
  const id = parseBigIntParam(c.req.param("id"));
  if (id === null) return c.json({ error: "Invalid project id" }, 400);

  const rows = await db
    .select()
    .from(activityFeed)
    .where(eq(activityFeed.projectId, id))
    .orderBy(desc(activityFeed.timestamp))
    .limit(50);

  const activities = rows.map((a) => ({
    id: a.id,
    type: a.type,
    address: a.address,
    amount: a.amount?.toString() ?? null,
    amountUSD: a.amount !== null ? toUSD(a.amount) : null,
    description: a.description,
    timestamp: a.timestamp,
    transactionHash: a.transactionHash,
  }));

  return c.json({ activities });
});

app.get("/api/projects/:id", async (c) => {
  const id = parseBigIntParam(c.req.param("id"));
  if (id === null) return c.json({ error: "Invalid project id" }, 400);

  const [projectData] = await db
    .select()
    .from(project)
    .where(eq(project.id, id))
    .limit(1);

  if (!projectData) return c.json({ error: "Project not found" }, 404);

  const [investments, collectorData] = await Promise.all([
    db
      .select()
      .from(investment)
      .where(eq(investment.projectId, id))
      .orderBy(desc(investment.amount)),
    db
      .select()
      .from(account)
      .where(eq(account.address, projectData.collector))
      .limit(1),
  ]);

  const calc = projectCalc(projectData);

  const enrichedInvestments = investments.map((inv) => {
    const amountUSD = toUSD(inv.amount);
    const estimatedReturnUSD = Math.round(amountUSD * (calc.estimatedReturnRate / 100) * 1000000) / 1000000;
    return {
      investor: inv.investor,
      amount: inv.amount.toString(),
      amountUSD,
      claimed: inv.claimed,
      claimedAmount: inv.claimedAmount.toString(),
      claimedAmountUSD: toUSD(inv.claimedAmount),
      timestamp: inv.timestamp,
      sharePercent: calcPercentage(inv.amount, projectData.totalFunded),
      estimatedReturnUSD,
      estimatedTotalUSD: Math.round((amountUSD + estimatedReturnUSD) * 1000000) / 1000000,
    };
  });

  const col = collectorData[0];

  return c.json({
    project: {
      id: projectData.id.toString(),
      collector: projectData.collector,
      acceptedToken: projectData.acceptedToken,
      commodityType: projectData.commodityType,
      volumeKg: projectData.volumeKg.toString(),
      collateralValue: projectData.collateralValue.toString(),
      collateralValueUSD: toUSD(projectData.collateralValue),
      maxFunding: projectData.maxFunding.toString(),
      profitPerKgInvestor: projectData.profitPerKgInvestor.toString(),
      profitPerKgInvestorUSD: toUSD(projectData.profitPerKgInvestor),
      profitPerKgPlatform: projectData.profitPerKgPlatform.toString(),
      profitPerKgPlatformUSD: toUSD(projectData.profitPerKgPlatform),
      fundingDeadline: projectData.fundingDeadline.toString(),
      repaymentDeadline: projectData.repaymentDeadline.toString(),
      metadataURI: projectData.metadataURI,
      metadata: await fetchMetadata(projectData.metadataURI),
      status: projectData.status,
      statusLabel: formatStatus(projectData.status),
      totalFunded: projectData.totalFunded.toString(),
      investorCount: projectData.investorCount,
      buyerPaymentAmount: projectData.buyerPaymentAmount.toString(),
      totalInvestorReturn: projectData.totalInvestorReturn.toString(),
      platformFee: projectData.platformFee.toString(),
      collectorRemainder: projectData.collectorRemainder.toString(),
      collateralVerified: projectData.collateralVerified,
      createdAt: projectData.createdAt,
      fundedAt: projectData.fundedAt,
      settledAt: projectData.settledAt,
      ...calc,
    },
    investments: enrichedInvestments,
    collector: col
      ? {
          address: col.address,
          role: col.role,
          profileName: col.profileName ?? null,
          profileLocation: col.profileLocation ?? null,
          projectCount: col.projectCount,
          completedProjectCount: col.completedProjectCount,
          isBlacklisted: col.isBlacklisted,
          profileURI: col.profileURI ?? null,
          profileMetadata: col.profileURI ? await fetchMetadata(col.profileURI) : null,
        }
      : null,
  });
});

app.get("/api/account/:address", async (c) => {
  const address = c.req.param("address") as `0x${string}`;

  const [accountData] = await db
    .select()
    .from(account)
    .where(eq(account.address, address))
    .limit(1);

  if (!accountData) return c.json({ error: "Account not found" }, 404);

  const isCollector =
    accountData.role === "collector" || accountData.role === "both";
  const isInvestor =
    accountData.role === "investor" || accountData.role === "both";

  const [collectorProjects, investorInvestments] = await Promise.all([
    isCollector
      ? db
          .select()
          .from(project)
          .where(eq(project.collector, address))
          .orderBy(desc(project.createdAt))
      : Promise.resolve([]),
    isInvestor
      ? db
          .select()
          .from(investment)
          .where(eq(investment.investor, address))
          .orderBy(desc(investment.timestamp))
      : Promise.resolve([]),
  ]);

  const totalEarnings = accountData.totalClaimed - accountData.totalInvested;
  const earningsPercent = calcPercentage(
    totalEarnings < 0n ? -totalEarnings : totalEarnings,
    accountData.totalInvested,
  ) * (totalEarnings < 0n ? -1 : 1);

  const projectIds = new Set(investorInvestments.map((inv) => inv.projectId));
  const projectDetails: Map<bigint, typeof project.$inferSelect> = new Map();

  if (projectIds.size > 0) {
    const pRows = await db
      .select()
      .from(project)
      .where(
        sql`${project.id} = ANY(ARRAY[${sql.join(
          [...projectIds].map((pid) => sql`${pid}::bigint`),
          sql`, `,
        )}])`,
      );
    pRows.forEach((p: ProjectRow) => projectDetails.set(p.id, p));
  }

  const enrichedInvestments = investorInvestments.map((inv: InvestmentRow) => {
    const pd = projectDetails.get(inv.projectId);
    return {
      id: inv.id,
      projectId: inv.projectId.toString(),
      amount: inv.amount.toString(),
      amountUSD: toUSD(inv.amount),
      claimed: inv.claimed,
      claimedAmount: inv.claimedAmount.toString(),
      claimedAmountUSD: toUSD(inv.claimedAmount),
      timestamp: inv.timestamp,
      project: pd
        ? {
            id: pd.id.toString(),
            commodityType: pd.commodityType,
            status: pd.status,
            statusLabel: formatStatus(pd.status),
            metadataURI: pd.metadataURI,
          }
        : null,
    };
  });

  const enrichedProjects = await enrichWithMetadata(
    collectorProjects.map((p: ProjectRow) => ({
      id: p.id.toString(),
      commodityType: p.commodityType,
      status: p.status,
      statusLabel: formatStatus(p.status),
      metadataURI: p.metadataURI,
      investorCount: p.investorCount,
      createdAt: p.createdAt,
      ...projectCalc(p),
    }))
  );

  return c.json({
    account: {
      address: accountData.address,
      role: accountData.role,
      totalInvested: accountData.totalInvested.toString(),
      totalInvestedUSD: toUSD(accountData.totalInvested),
      totalClaimed: accountData.totalClaimed.toString(),
      totalClaimedUSD: toUSD(accountData.totalClaimed),
      totalEarnings: totalEarnings.toString(),
      totalEarningsUSD: toUSD(totalEarnings < 0n ? -totalEarnings : totalEarnings) * (totalEarnings < 0n ? -1 : 1),
      earningsPercent,
      investmentCount: accountData.investmentCount,
      projectCount: accountData.projectCount,
      completedProjectCount: accountData.completedProjectCount,
      isBlacklisted: accountData.isBlacklisted,
      lastActiveAt: accountData.lastActiveAt,
      profileURI: accountData.profileURI ?? null,
      profileMetadata: accountData.profileURI ? await fetchMetadata(accountData.profileURI) : null,
      profileName: accountData.profileName ?? null,
      profileLocation: accountData.profileLocation ?? null,
    },
    projects: enrichedProjects,
    investments: enrichedInvestments,
  });
});

app.get("/api/stats", async (c) => {
  const [stats] = await db
    .select()
    .from(platformStats)
    .where(eq(platformStats.id, "global"))
    .limit(1);

  if (!stats) {
    return c.json({
      totalProjects: 0,
      activeProjects: 0,
      totalInvestors: 0,
      totalCollectors: 0,
      totalInvestedUSD: 0,
      totalDistributedUSD: 0,
      totalPlatformFeesUSD: 0,
      updatedAt: 0,
    });
  }

  return c.json({
    totalProjects: stats.totalProjects,
    activeProjects: stats.activeProjects,
    totalInvestors: stats.totalInvestors,
    totalCollectors: stats.totalCollectors,
    totalInvestedUSD: toUSD(stats.totalInvested),
    totalDistributedUSD: toUSD(stats.totalDistributed),
    totalPlatformFeesUSD: toUSD(stats.totalPlatformFees),
    updatedAt: stats.updatedAt,
  });
});

app.get("/api/portfolio/:address", async (c) => {
  const address = c.req.param("address") as `0x${string}`;

  const investments = await db
    .select()
    .from(investment)
    .where(eq(investment.investor, address))
    .orderBy(desc(investment.timestamp));

  if (investments.length === 0) {
    return c.json({
      summary: {
        totalInvestedUSD: 0,
        totalClaimedUSD: 0,
        totalEarningsUSD: 0,
        earningsPercent: 0,
        activeInvestments: 0,
        claimedInvestments: 0,
      },
      investments: [],
      portfolioSplit: [],
    });
  }

  const projectIds = [...new Set(investments.map((inv) => inv.projectId))];
  const projectRows = await db
    .select()
    .from(project)
    .where(
      sql`${project.id} = ANY(ARRAY[${sql.join(
        projectIds.map((pid) => sql`${pid}::bigint`),
        sql`, `,
      )}])`,
    );
  const projectMap = new Map(projectRows.map((p) => [p.id, p]));

  const totalInvested = investments.reduce((acc, inv) => acc + inv.amount, 0n);
  const totalClaimed = investments.reduce(
    (acc, inv) => acc + inv.claimedAmount,
    0n,
  );
  const activeCount = investments.filter((inv: InvestmentRow) => !inv.claimed).length;
  const totalEarningsUSD = toUSD(totalClaimed) - toUSD(totalInvested);
  const earningsPercent =
    totalInvested > 0n
      ? Math.round((totalEarningsUSD / toUSD(totalInvested)) * 1000) / 10
      : 0;

  const enrichedInvestments = investments.map((inv: InvestmentRow) => {
    const pd = projectMap.get(inv.projectId);
    const calc = pd ? projectCalc(pd) : null;
    return {
      id: inv.id,
      projectId: inv.projectId.toString(),
      amount: inv.amount.toString(),
      amountUSD: toUSD(inv.amount),
      claimed: inv.claimed,
      claimedAmount: inv.claimedAmount.toString(),
      claimedAmountUSD: toUSD(inv.claimedAmount),
      timestamp: inv.timestamp,
      sharePercent: pd ? calcPercentage(inv.amount, pd.totalFunded) : 0,
      project: pd
        ? {
            id: pd.id.toString(),
            commodityType: pd.commodityType,
            status: pd.status,
            statusLabel: formatStatus(pd.status),
            metadataURI: pd.metadataURI,
            investorCount: pd.investorCount,
            ...calc,
          }
        : null,
    };
  });

  const splitMap = new Map<string, bigint>();
  for (const inv of investments) {
    const pd = projectMap.get(inv.projectId);
    const cat = pd ? commodityCategory(pd.commodityType) : "Other";
    splitMap.set(cat, (splitMap.get(cat) ?? 0n) + inv.amount);
  }

  const portfolioSplit = [...splitMap.entries()]
    .map(([category, amount]) => ({
      category,
      amountUSD: toUSD(amount),
      percentage: calcPercentage(amount, totalInvested),
    }))
    .sort((a, b) => b.percentage - a.percentage);

  return c.json({
    summary: {
      totalInvestedUSD: toUSD(totalInvested),
      totalClaimedUSD: toUSD(totalClaimed),
      totalEarningsUSD,
      earningsPercent,
      activeInvestments: activeCount,
      claimedInvestments: investments.length - activeCount,
    },
    investments: enrichedInvestments,
    portfolioSplit,
  });
});

app.get("/api/portfolio/:address/history", async (c) => {
  const address = c.req.param("address") as `0x${string}`;
  const period = c.req.query("period") ?? "1M";

  const periodDays: Record<string, number> = { "1M": 30, "6M": 180, "1Y": 365 };
  const days = periodDays[period] ?? 30;
  const cutoff = Math.floor(Date.now() / 1000) - days * 86400;

  const snapshots = await db
    .select()
    .from(portfolioSnapshot)
    .where(
      and(
        eq(portfolioSnapshot.address, address),
        gte(portfolioSnapshot.timestamp, cutoff),
      ),
    )
    .orderBy(asc(portfolioSnapshot.timestamp))
    .limit(500);

  return c.json({
    snapshots: snapshots.map((s) => ({
      timestamp: s.timestamp,
      totalInvestedUSD: toUSD(s.totalInvested),
      totalClaimedUSD: toUSD(s.totalClaimed),
      netValueUSD: toUSD(s.netValue < 0n ? -s.netValue : s.netValue) * (s.netValue < 0n ? -1 : 1),
      activeInvestments: s.activeInvestments,
    })),
    period,
  });
});

app.get("/api/activity/:address", async (c) => {
  const address = c.req.param("address") as `0x${string}`;
  const limit = Math.min(Number(c.req.query("limit") ?? 10), 100);
  const typeFilter = c.req.query("type");

  const where = typeFilter
    ? and(eq(activityFeed.address, address), eq(activityFeed.type, typeFilter))
    : eq(activityFeed.address, address);

  const rows = await db
    .select()
    .from(activityFeed)
    .where(where)
    .orderBy(desc(activityFeed.timestamp))
    .limit(limit);

  const activities = rows.map((a) => ({
    id: a.id,
    type: a.type,
    projectId: a.projectId?.toString() ?? null,
    amount: a.amount?.toString() ?? null,
    amountUSD: a.amount !== null ? toUSD(a.amount) : null,
    token: a.token ?? null,
    description: a.description,
    timestamp: a.timestamp,
    transactionHash: a.transactionHash,
  }));

  return c.json({ activities });
});

app.get("/api/collector/:address", async (c) => {
  const address = c.req.param("address") as `0x${string}`;

  const [accountData] = await db
    .select()
    .from(account)
    .where(eq(account.address, address))
    .limit(1);

  if (!accountData) return c.json({ error: "Collector not found" }, 404);

  const collectorProjects = await db
    .select()
    .from(project)
    .where(eq(project.collector, address))
    .orderBy(desc(project.createdAt));

  const totalProjectsValue = collectorProjects.reduce(
    (acc, p) => acc + p.maxFunding,
    0n,
  );

  const openProjects = collectorProjects.filter((p) => p.status === 1);
  const averageFundingProgress =
    openProjects.length > 0
      ? Math.round(
          openProjects.reduce(
            (acc, p: ProjectRow) => acc + calcPercentage(p.totalFunded, p.maxFunding),
            0,
          ) /
            openProjects.length *
            10,
        ) / 10
      : 0;

  const enrichedProjects = await enrichWithMetadata(
    collectorProjects.map((p: ProjectRow) => ({
      id: p.id.toString(),
      commodityType: p.commodityType,
      status: p.status,
      statusLabel: formatStatus(p.status),
      metadataURI: p.metadataURI,
      investorCount: p.investorCount,
      createdAt: p.createdAt,
      ...projectCalc(p),
    }))
  );

  return c.json({
    collector: {
      address: accountData.address,
      role: accountData.role,
      profileName: accountData.profileName ?? null,
      profileLocation: accountData.profileLocation ?? null,
      profileURI: accountData.profileURI ?? null,
      profileMetadata: accountData.profileURI ? await fetchMetadata(accountData.profileURI) : null,
      projectCount: accountData.projectCount,
      completedProjectCount: accountData.completedProjectCount,
      isBlacklisted: accountData.isBlacklisted,
      totalProjectsValue: totalProjectsValue.toString(),
      totalProjectsValueUSD: toUSD(totalProjectsValue),
      averageFundingProgress,
    },
    projects: enrichedProjects,
  });
});

app.get("/api/health", async (c) => {
  const [stats] = await db
    .select()
    .from(platformStats)
    .where(eq(platformStats.id, "global"))
    .limit(1);

  return c.json({
    status: "ok",
    timestamp: Math.floor(Date.now() / 1000),
    stats: {
      totalProjects: stats?.totalProjects ?? 0,
      totalInvestors: stats?.totalInvestors ?? 0,
    },
  });
});

export default app;
