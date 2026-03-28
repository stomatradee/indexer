import { ponder } from "ponder:registry";
import { ProjectNFTAbi } from "../abis/ProjectNFTAbi";
import {
  account,
  investment,
  platformStats,
  project,
  transfer,
} from "ponder:schema";

export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as const;
export const PLATFORM_STATS_ID = "global";

async function upsertPlatformStats(db: any, timestamp: number) {
  const existing = await db.find(platformStats, { id: PLATFORM_STATS_ID });

  if (!existing) {
    await db.insert(platformStats).values({
      id: PLATFORM_STATS_ID,
      totalProjects: 0,
      totalInvested: 0n,
      totalDistributed: 0n,
      totalPlatformFees: 0n,
      activeProjects: 0,
      totalInvestors: 0,
      totalCollectors: 0,
      updatedAt: timestamp,
    });
  } else {
    await db
      .update(platformStats, { id: PLATFORM_STATS_ID })
      .set({ updatedAt: timestamp });
  }

  return db.find(platformStats, { id: PLATFORM_STATS_ID });
}

// ─── AccessRegistry ──────────────────────────────────────────────────────────

ponder.on(
  "AccessRegistry:CollectorRegistered",
  async ({ event, context }) => {
    const { db } = context;
    const timestamp = Number(event.block.timestamp);
    const { collector } = event.args;

    await db
      .insert(account)
      .values({
        address: collector,
        role: "collector",
        totalInvested: 0n,
        totalClaimed: 0n,
        investmentCount: 0,
        projectCount: 0,
        completedProjectCount: 0,
        isBlacklisted: false,
        lastActiveAt: timestamp,
      })
      .onConflictDoUpdate({ role: "collector", lastActiveAt: timestamp });

    const stats = await upsertPlatformStats(db, timestamp);
    await db.update(platformStats, { id: PLATFORM_STATS_ID }).set({
      totalCollectors: (stats?.totalCollectors ?? 0) + 1,
      updatedAt: timestamp,
    });
  },
);

ponder.on("AccessRegistry:CollectorBlacklisted", async ({ event, context }) => {
  const { db } = context;
  const { collector } = event.args;

  const existing = await db.find(account, { address: collector });
  if (existing) {
    await db
      .update(account, { address: collector })
      .set({ isBlacklisted: true });
  }
});

ponder.on(
  "AccessRegistry:CollectorProfileUpdated",
  async ({ event, context }) => {
    const { db } = context;
    const timestamp = Number(event.block.timestamp);
    const { collector } = event.args;

    const existing = await db.find(account, { address: collector });
    if (existing) {
      await db
        .update(account, { address: collector })
        .set({ lastActiveAt: timestamp });
    }
  },
);

// ─── ProjectNFT ──────────────────────────────────────────────────────────────

ponder.on("ProjectNFT:ProjectMinted", async ({ event, context }) => {
  const { db, client, contracts } = context;
  const timestamp = Number(event.block.timestamp);
  const { projectId, collector, acceptedToken, volumeKg, maxFunding } =
    event.args;

  const projectData = await client.readContract({
    abi: ProjectNFTAbi[0],
    address: contracts.ProjectNFT.address,
    functionName: "getProject",
    args: [projectId],
  });

  await db.insert(project).values({
    id: projectId,
    collector,
    acceptedToken,
    commodityType: projectData.commodityType,
    volumeKg,
    collateralValue: projectData.collateralValue,
    maxFunding,
    profitPerKgInvestor: 0n,
    profitPerKgPlatform: 0n,
    fundingDeadline: projectData.fundingDeadline,
    repaymentDeadline: 0n,
    metadataURI: projectData.metadataURI,
    status: 0,
    totalFunded: 0n,
    investorCount: 0,
    buyerPaymentAmount: 0n,
    totalInvestorReturn: 0n,
    platformFee: 0n,
    collectorRemainder: 0n,
    collateralVerified: false,
    createdAt: timestamp,
    fundedAt: null,
    settledAt: null,
  });

  const collectorAccount = await db.find(account, { address: collector });
  if (collectorAccount) {
    await db.update(account, { address: collector }).set({
      projectCount: collectorAccount.projectCount + 1,
      lastActiveAt: timestamp,
    });
  } else {
    await db.insert(account).values({
      address: collector,
      role: "collector",
      totalInvested: 0n,
      totalClaimed: 0n,
      investmentCount: 0,
      projectCount: 1,
      completedProjectCount: 0,
      isBlacklisted: false,
      lastActiveAt: timestamp,
    });
  }

  const stats = await upsertPlatformStats(db, timestamp);
  await db.update(platformStats, { id: PLATFORM_STATS_ID }).set({
    totalProjects: (stats?.totalProjects ?? 0) + 1,
    updatedAt: timestamp,
  });
});

ponder.on("ProjectNFT:ProjectVerified", async ({ event, context }) => {
  const { db } = context;
  const { projectId } = event.args;

  const existing = await db.find(project, { id: projectId });
  if (existing) {
    await db
      .update(project, { id: projectId })
      .set({ collateralVerified: true });
  }
});

ponder.on("ProjectNFT:ProjectStatusUpdated", async ({ event, context }) => {
  const { db } = context;
  const timestamp = Number(event.block.timestamp);
  const { projectId, newStatus } = event.args;

  const existing = await db.find(project, { id: projectId });
  if (!existing) return;

  await db.update(project, { id: projectId }).set({ status: newStatus });

  if (newStatus === 1) {
    const stats = await upsertPlatformStats(db, timestamp);
    await db.update(platformStats, { id: PLATFORM_STATS_ID }).set({
      activeProjects: (stats?.activeProjects ?? 0) + 1,
      updatedAt: timestamp,
    });
  }
  // status 6 (DEFAULTED) and 7 (COMPLETED) are decremented by
  // LendingPool:ProjectDefaulted / LendingPool:ProjectCompleted to avoid double-count
});

// ─── LendingPool ─────────────────────────────────────────────────────────────

ponder.on("LendingPool:Invested", async ({ event, context }) => {
  const { db } = context;
  const timestamp = Number(event.block.timestamp);
  const { projectId, investor, amount, totalFunded } = event.args;

  const investmentId = `${projectId.toString()}:${investor}`;
  const existingInvestment = await db.find(investment, { id: investmentId });
  const projectRecord = await db.find(project, { id: projectId });
  const isTopUp = !!existingInvestment;

  if (isTopUp) {
    await db.update(investment, { id: investmentId }).set({
      amount: existingInvestment.amount + amount,
    });
  } else {
    await db.insert(investment).values({
      id: investmentId,
      projectId,
      investor,
      token: projectRecord?.acceptedToken ?? ZERO_ADDRESS,
      amount,
      claimed: false,
      claimedAmount: 0n,
      timestamp,
    });
  }

  if (projectRecord) {
    await db.update(project, { id: projectId }).set({
      totalFunded,
      investorCount: isTopUp
        ? projectRecord.investorCount
        : projectRecord.investorCount + 1,
    });
  }

  const investorAccount = await db.find(account, { address: investor });
  const isFirstInvestment =
    !investorAccount || investorAccount.investmentCount === 0;

  if (investorAccount) {
    await db.update(account, { address: investor }).set({
      role: investorAccount.role === "collector" ? "both" : "investor",
      totalInvested: investorAccount.totalInvested + amount,
      investmentCount: investorAccount.investmentCount + 1,
      lastActiveAt: timestamp,
    });
  } else {
    await db.insert(account).values({
      address: investor,
      role: "investor",
      totalInvested: amount,
      totalClaimed: 0n,
      investmentCount: 1,
      projectCount: 0,
      completedProjectCount: 0,
      isBlacklisted: false,
      lastActiveAt: timestamp,
    });
  }

  const stats = await upsertPlatformStats(db, timestamp);
  await db.update(platformStats, { id: PLATFORM_STATS_ID }).set({
    totalInvested: (stats?.totalInvested ?? 0n) + amount,
    totalInvestors: isFirstInvestment
      ? (stats?.totalInvestors ?? 0) + 1
      : (stats?.totalInvestors ?? 0),
    updatedAt: timestamp,
  });
});

ponder.on("LendingPool:ProjectAutoFunded", async ({ event, context }) => {
  const { db } = context;
  const timestamp = Number(event.block.timestamp);
  const { projectId, totalFunded } = event.args;

  await db.update(project, { id: projectId }).set({
    status: 2,
    totalFunded,
    fundedAt: timestamp,
  });
});

ponder.on("LendingPool:ProjectManuallyClosed", async ({ event, context }) => {
  const { db } = context;
  const { projectId, totalFunded } = event.args;

  await db.update(project, { id: projectId }).set({
    status: 3,
    totalFunded,
  });
});

ponder.on("LendingPool:FundsDisbursed", async ({ event, context }) => {
  const { db } = context;
  const timestamp = Number(event.block.timestamp);
  const { projectId, amount, repaymentDeadline } = event.args;

  await db.update(project, { id: projectId }).set({
    status: 4,
    repaymentDeadline,
  });

  const stats = await upsertPlatformStats(db, timestamp);
  await db.update(platformStats, { id: PLATFORM_STATS_ID }).set({
    totalDistributed: (stats?.totalDistributed ?? 0n) + amount,
    updatedAt: timestamp,
  });
});

ponder.on("LendingPool:BuyerPaymentRecorded", async ({ event, context }) => {
  const { db } = context;
  const timestamp = Number(event.block.timestamp);
  const { projectId, amount } = event.args;

  await db.update(project, { id: projectId }).set({
    buyerPaymentAmount: amount,
    status: 5,
    settledAt: timestamp,
  });
});

ponder.on("LendingPool:ProfitDistributed", async ({ event, context }) => {
  const { db } = context;
  const timestamp = Number(event.block.timestamp);
  const { projectId, investorFunds, platformFee, collectorFunds } = event.args;

  await db.update(project, { id: projectId }).set({
    totalInvestorReturn: investorFunds,
    platformFee,
    collectorRemainder: collectorFunds,
  });

  const stats = await upsertPlatformStats(db, timestamp);
  await db.update(platformStats, { id: PLATFORM_STATS_ID }).set({
    totalPlatformFees: (stats?.totalPlatformFees ?? 0n) + platformFee,
    updatedAt: timestamp,
  });
});

ponder.on("LendingPool:InvestorFundsClaimed", async ({ event, context }) => {
  const { db } = context;
  const timestamp = Number(event.block.timestamp);
  const { projectId, investor, amount } = event.args;

  const investmentId = `${projectId.toString()}:${investor}`;
  await db.update(investment, { id: investmentId }).set({
    claimed: true,
    claimedAmount: amount,
  });

  const investorAccount = await db.find(account, { address: investor });
  if (investorAccount) {
    await db.update(account, { address: investor }).set({
      totalClaimed: investorAccount.totalClaimed + amount,
      lastActiveAt: timestamp,
    });
  }
});

ponder.on("LendingPool:CollectorFundsClaimed", async ({ event, context }) => {
  const { db } = context;
  const timestamp = Number(event.block.timestamp);
  const { collector } = event.args;

  const collectorAccount = await db.find(account, { address: collector });
  if (collectorAccount) {
    await db.update(account, { address: collector }).set({
      lastActiveAt: timestamp,
    });
  }
});

ponder.on("LendingPool:ProjectDefaulted", async ({ event, context }) => {
  const { db } = context;
  const timestamp = Number(event.block.timestamp);
  const { projectId } = event.args;

  await db.update(project, { id: projectId }).set({ status: 6 });

  const stats = await upsertPlatformStats(db, timestamp);
  await db.update(platformStats, { id: PLATFORM_STATS_ID }).set({
    activeProjects: Math.max(0, (stats?.activeProjects ?? 0) - 1),
    updatedAt: timestamp,
  });
});

ponder.on("LendingPool:ProjectCompleted", async ({ event, context }) => {
  const { db } = context;
  const timestamp = Number(event.block.timestamp);
  const { projectId } = event.args;

  await db.update(project, { id: projectId }).set({ status: 7 });

  const projectRecord = await db.find(project, { id: projectId });
  if (projectRecord) {
    const collectorAccount = await db.find(account, {
      address: projectRecord.collector,
    });
    if (collectorAccount) {
      await db.update(account, { address: projectRecord.collector }).set({
        completedProjectCount: collectorAccount.completedProjectCount + 1,
        lastActiveAt: timestamp,
      });
    }
  }

  const stats = await upsertPlatformStats(db, timestamp);
  await db.update(platformStats, { id: PLATFORM_STATS_ID }).set({
    activeProjects: Math.max(0, (stats?.activeProjects ?? 0) - 1),
    updatedAt: timestamp,
  });
});

// ─── ERC20 Transfers ─────────────────────────────────────────────────────────

async function handleERC20Transfer(
  event: {
    args: { from: `0x${string}`; to: `0x${string}`; value: bigint };
    log: { address: `0x${string}`; logIndex: number };
    block: { timestamp: bigint; number: bigint };
    transaction: { hash: `0x${string}` };
  },
  context: { db: any },
  tokenAddress: `0x${string}`,
) {
  const { db } = context;
  const id = `${event.transaction.hash}:${event.log.logIndex}`;

  await db.insert(transfer).values({
    id,
    from: event.args.from,
    to: event.args.to,
    value: event.args.value,
    token: tokenAddress,
    timestamp: Number(event.block.timestamp),
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });
}

ponder.on("MockUSDC:Transfer", async ({ event, context }) => {
  await handleERC20Transfer(event, context, event.log.address);
});

ponder.on("MockUSDT:Transfer", async ({ event, context }) => {
  await handleERC20Transfer(event, context, event.log.address);
});
