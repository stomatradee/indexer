import { ponder } from "ponder:registry";
import { ProjectNFTAbi } from "../abis/ProjectNFTAbi";
import { LendingPoolAbi } from "../abis/LendingPoolAbi";
import {
  account,
  activityFeed,
  investment,
  platformStats,
  portfolioSnapshot,
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

function formatAmount(amount: bigint, decimals = 6): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  return whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

async function recordPortfolioSnapshot(
  context: { db: any },
  address: `0x${string}`,
  accountData: { totalInvested: bigint; totalClaimed: bigint; activeInvestmentCount: number },
  timestamp: number,
  blockNumber: bigint,
) {
  const { db } = context;
  const id = `${address}:${blockNumber.toString()}`;
  const netValue = accountData.totalInvested - accountData.totalClaimed;

  await db
    .insert(portfolioSnapshot)
    .values({
      id,
      address,
      totalInvested: accountData.totalInvested,
      totalClaimed: accountData.totalClaimed,
      activeInvestments: accountData.activeInvestmentCount,
      netValue,
      timestamp,
      blockNumber,
    })
    .onConflictDoNothing();
}

async function recordActivity(
  context: { db: any },
  params: {
    address: `0x${string}`;
    type: string;
    projectId?: bigint;
    amount?: bigint;
    token?: `0x${string}`;
    description: string;
    timestamp: number;
    blockNumber: bigint;
    transactionHash: `0x${string}`;
    logIndex: number | string;
  },
) {
  const { db } = context;
  const id = `${params.transactionHash}:${params.logIndex}`;

  await db
    .insert(activityFeed)
    .values({
      id,
      address: params.address,
      type: params.type,
      projectId: params.projectId ?? null,
      amount: params.amount ?? null,
      token: params.token ?? null,
      description: params.description,
      timestamp: params.timestamp,
      blockNumber: params.blockNumber,
      transactionHash: params.transactionHash,
    })
    .onConflictDoNothing();
}

ponder.on(
  "AccessRegistry:CollectorRegistered",
  async ({ event, context }) => {
    const { db } = context;
    const timestamp = Number(event.block.timestamp);
    const { collector, profileURI } = event.args;

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
        profileURI,
      })
      .onConflictDoUpdate({ role: "collector", lastActiveAt: timestamp, profileURI });

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
    const { collector, newProfileURI } = event.args;

    const existing = await db.find(account, { address: collector });
    if (existing) {
      await db
        .update(account, { address: collector })
        .set({ lastActiveAt: timestamp, profileURI: newProfileURI });
    }
  },
);

ponder.on(
  "AccessRegistry:CollectorReputationUpdated",
  async ({ event, context }) => {
    const { db } = context;
    const timestamp = Number(event.block.timestamp);
    const { collector, totalProjects, completedProjects } = event.args;

    const existing = await db.find(account, { address: collector });
    if (existing) {
      await db.update(account, { address: collector }).set({
        projectCount: Number(totalProjects),
        completedProjectCount: Number(completedProjects),
        lastActiveAt: timestamp,
      });
    }
  },
);

ponder.on("ProjectNFT:ProjectMinted", async ({ event, context }) => {
  const { db, client, contracts } = context;
  const timestamp = Number(event.block.timestamp);
  const { projectId, collector, acceptedToken, volumeKg, maxFunding } =
    event.args;

  const [projectData, profitPerKgInvestor, profitPerKgPlatform] = await Promise.all([
    client.readContract({
      abi: ProjectNFTAbi[0],
      address: contracts.ProjectNFT.address,
      functionName: "getProject",
      args: [projectId],
    }),
    client.readContract({
      abi: LendingPoolAbi[0],
      address: contracts.LendingPool.address,
      functionName: "PROFIT_PER_KG_INVESTOR",
      args: [],
    }),
    client.readContract({
      abi: LendingPoolAbi[0],
      address: contracts.LendingPool.address,
      functionName: "PROFIT_PER_KG_PLATFORM",
      args: [],
    }),
  ]);

  await db.insert(project).values({
    id: projectId,
    collector,
    acceptedToken,
    commodityType: projectData.commodityType,
    volumeKg,
    collateralValue: projectData.collateralValue,
    maxFunding,
    profitPerKgInvestor,
    profitPerKgPlatform,
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

  await recordActivity(context, {
    address: collector,
    type: "project_created",
    projectId,
    description: `Created project #${projectId}: ${projectData.commodityType}`,
    timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
  });
});

ponder.on("ProjectNFT:ProjectVerified", async ({ event, context }) => {
  const { db } = context;
  const timestamp = Number(event.block.timestamp);
  const { projectId } = event.args;

  const existing = await db.find(project, { id: projectId });
  if (existing) {
    const wasAlreadyOpen = existing.status === 1;

    await db
      .update(project, { id: projectId })
      .set({ collateralVerified: true, status: 1 });

    // Only increment if not already OPEN — prevents double-count when
    // ProjectStatusUpdated(1) fires in the same tx as ProjectVerified
    if (!wasAlreadyOpen) {
      const stats = await upsertPlatformStats(db, timestamp);
      await db.update(platformStats, { id: PLATFORM_STATS_ID }).set({
        activeProjects: (stats?.activeProjects ?? 0) + 1,
        updatedAt: timestamp,
      });
    }
  }
});

ponder.on("ProjectNFT:ProjectStatusUpdated", async ({ event, context }) => {
  const { db } = context;
  const timestamp = Number(event.block.timestamp);
  const { projectId, newStatus } = event.args;

  const existing = await db.find(project, { id: projectId });
  if (!existing) return;

  const wasAlreadyOpen = existing.status === 1;
  await db.update(project, { id: projectId }).set({ status: newStatus });

  // Only increment if transitioning INTO OPEN for the first time —
  // prevents double-count when ProjectVerified has already set status=1
  if (newStatus === 1 && !wasAlreadyOpen) {
    const stats = await upsertPlatformStats(db, timestamp);
    await db.update(platformStats, { id: PLATFORM_STATS_ID }).set({
      activeProjects: (stats?.activeProjects ?? 0) + 1,
      updatedAt: timestamp,
    });
  }
});

ponder.on("ProjectNFT:ProjectRejected", async ({ event, context }) => {
  const { db } = context;
  const timestamp = Number(event.block.timestamp);
  const { projectId } = event.args;

  const projectRecord = await db.find(project, { id: projectId });
  if (!projectRecord) return;

  // Mark rejected using virtual status 8 (not in Solidity enum, but tracks state)
  await db.update(project, { id: projectId }).set({ status: 8 });

  // Decrement activeProjects if project was OPEN at time of rejection
  if (projectRecord.status === 1) {
    const stats = await upsertPlatformStats(db, timestamp);
    await db.update(platformStats, { id: PLATFORM_STATS_ID }).set({
      activeProjects: Math.max(0, (stats?.activeProjects ?? 0) - 1),
      updatedAt: timestamp,
    });
  }

  await recordActivity(context, {
    address: projectRecord.collector,
    type: "project_rejected",
    projectId,
    description: `Project #${projectId} rejected`,
    timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
  });
});

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
      activeInvestmentCount: isTopUp
        ? investorAccount.activeInvestmentCount
        : investorAccount.activeInvestmentCount + 1,
      lastActiveAt: timestamp,
    });
  } else {
    await db.insert(account).values({
      address: investor,
      role: "investor",
      totalInvested: amount,
      totalClaimed: 0n,
      investmentCount: 1,
      activeInvestmentCount: 1,
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

  const updatedInvestorAccount = await db.find(account, { address: investor });
  if (updatedInvestorAccount) {
    await recordPortfolioSnapshot(
      context,
      investor,
      updatedInvestorAccount,
      timestamp,
      event.block.number,
    );
  }

  await recordActivity(context, {
    address: investor,
    type: "investment",
    projectId,
    amount,
    token: projectRecord?.acceptedToken,
    description: `Invested ${formatAmount(amount)} in Project #${projectId}`,
    timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
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

  const stats = await upsertPlatformStats(db, timestamp);
  await db.update(platformStats, { id: PLATFORM_STATS_ID }).set({
    activeProjects: Math.max(0, (stats?.activeProjects ?? 0) - 1),
    updatedAt: timestamp,
  });

  const projectRecord = await db.find(project, { id: projectId });
  if (projectRecord) {
    await recordActivity(context, {
      address: projectRecord.collector,
      type: "project_funded",
      projectId,
      amount: totalFunded,
      description: `Project #${projectId} fully funded: ${formatAmount(totalFunded)}`,
      timestamp,
      blockNumber: event.block.number,
      transactionHash: event.transaction.hash,
      logIndex: event.log.logIndex,
    });
  }
});

ponder.on("LendingPool:ProjectManuallyClosed", async ({ event, context }) => {
  const { db } = context;
  const timestamp = Number(event.block.timestamp);
  const { projectId, collector, totalFunded } = event.args;

  await db.update(project, { id: projectId }).set({
    status: 3,
    totalFunded,
  });

  const stats = await upsertPlatformStats(db, timestamp);
  await db.update(platformStats, { id: PLATFORM_STATS_ID }).set({
    activeProjects: Math.max(0, (stats?.activeProjects ?? 0) - 1),
    updatedAt: timestamp,
  });

  await recordActivity(context, {
    address: collector,
    type: "project_closed",
    projectId,
    amount: totalFunded,
    description: `Project #${projectId} manually closed with ${formatAmount(totalFunded)} funded`,
    timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
  });
});

ponder.on("LendingPool:FundsDisbursed", async ({ event, context }) => {
  const { db } = context;
  const timestamp = Number(event.block.timestamp);
  const { projectId, collector, amount, repaymentDeadline } = event.args;

  await db.update(project, { id: projectId }).set({
    status: 4,
    repaymentDeadline,
  });

  const stats = await upsertPlatformStats(db, timestamp);
  await db.update(platformStats, { id: PLATFORM_STATS_ID }).set({
    totalDistributed: (stats?.totalDistributed ?? 0n) + amount,
    updatedAt: timestamp,
  });

  await recordActivity(context, {
    address: collector,
    type: "project_disbursed",
    projectId,
    amount,
    description: `Funds disbursed for Project #${projectId}: ${formatAmount(amount)}`,
    timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
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

  const projectRecord = await db.find(project, { id: projectId });
  if (projectRecord) {
    await recordActivity(context, {
      address: projectRecord.collector,
      type: "buyer_payment",
      projectId,
      amount,
      description: `Buyer payment received for Project #${projectId}: ${formatAmount(amount)}`,
      timestamp,
      blockNumber: event.block.number,
      transactionHash: event.transaction.hash,
      logIndex: event.log.logIndex,
    });
  }
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

  const projectRecord = await db.find(project, { id: projectId });
  if (projectRecord) {
    await recordActivity(context, {
      address: projectRecord.collector,
      type: "profit_distributed",
      projectId,
      amount: investorFunds,
      description: `Profit distributed for Project #${projectId}: investors ${formatAmount(investorFunds)}, platform ${formatAmount(platformFee)}`,
      timestamp,
      blockNumber: event.block.number,
      transactionHash: event.transaction.hash,
      logIndex: event.log.logIndex,
    });
  }
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
      activeInvestmentCount: Math.max(0, investorAccount.activeInvestmentCount - 1),
      lastActiveAt: timestamp,
    });

    const updatedAccount = await db.find(account, { address: investor });
    if (updatedAccount) {
      await recordPortfolioSnapshot(
        context,
        investor,
        updatedAccount,
        timestamp,
        event.block.number,
      );
    }
  }

  await recordActivity(context, {
    address: investor,
    type: "claim_investor",
    projectId,
    amount,
    description: `Claimed ${formatAmount(amount)} from Project #${projectId}`,
    timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
  });
});

ponder.on("LendingPool:CollectorFundsClaimed", async ({ event, context }) => {
  const { db } = context;
  const timestamp = Number(event.block.timestamp);
  const { projectId, collector, amount } = event.args;

  const collectorAccount = await db.find(account, { address: collector });
  if (collectorAccount) {
    await db.update(account, { address: collector }).set({
      lastActiveAt: timestamp,
    });
  }

  await recordActivity(context, {
    address: collector,
    type: "claim_collector",
    projectId,
    amount,
    description: `Collector claimed ${formatAmount(amount)} from Project #${projectId}`,
    timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
  });
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

  const projectRecord = await db.find(project, { id: projectId });
  if (projectRecord) {
    await recordActivity(context, {
      address: projectRecord.collector,
      type: "project_defaulted",
      projectId,
      description: `Project #${projectId} defaulted`,
      timestamp,
      blockNumber: event.block.number,
      transactionHash: event.transaction.hash,
      logIndex: event.log.logIndex,
    });
  }
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

  if (projectRecord) {
    await recordActivity(context, {
      address: projectRecord.collector,
      type: "project_completed",
      projectId,
      description: `Project #${projectId} completed`,
      timestamp,
      blockNumber: event.block.number,
      transactionHash: event.transaction.hash,
      logIndex: event.log.logIndex,
    });
  }
});

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
