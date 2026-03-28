import { db } from "ponder:api";
import schema, {
  account,
  investment,
  platformStats,
  project,
} from "ponder:schema";
import { and, count, desc, eq, or, sum } from "ponder";
import { Hono } from "hono";
import { client, graphql } from "ponder";

const app = new Hono();

app.use("/sql/*", client({ db, schema }));
app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

function serialize(data: unknown): unknown {
  return JSON.parse(
    JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
}

// GET /api/stats
app.get("/api/stats", async (c) => {
  const [stats] = await db
    .select()
    .from(platformStats)
    .where(eq(platformStats.id, "global"))
    .limit(1);

  if (!stats) {
    return c.json({
      id: "global",
      totalProjects: 0,
      totalInvested: "0",
      totalDistributed: "0",
      totalPlatformFees: "0",
      activeProjects: 0,
      totalInvestors: 0,
      totalCollectors: 0,
      updatedAt: 0,
    });
  }

  return c.json(serialize(stats));
});

// GET /api/projects/open — must be defined before /:id
app.get("/api/projects/open", async (c) => {
  const projects = await db
    .select()
    .from(project)
    .where(eq(project.status, 1))
    .orderBy(desc(project.createdAt))
    .limit(50);

  return c.json(serialize(projects));
});

// GET /api/projects/:id/investors — defined before /:id to avoid ambiguity
app.get("/api/projects/:id/investors", async (c) => {
  let id: bigint;
  try {
    id = BigInt(c.req.param("id"));
  } catch {
    return c.json({ error: "Invalid project id" }, 400);
  }

  const investors = await db
    .select()
    .from(investment)
    .where(eq(investment.projectId, id))
    .orderBy(desc(investment.amount));

  return c.json(serialize(investors));
});

// GET /api/projects/:id
app.get("/api/projects/:id", async (c) => {
  let id: bigint;
  try {
    id = BigInt(c.req.param("id"));
  } catch {
    return c.json({ error: "Invalid project id" }, 400);
  }

  const [projectData] = await db
    .select()
    .from(project)
    .where(eq(project.id, id))
    .limit(1);

  if (!projectData) {
    return c.json({ error: "Project not found" }, 404);
  }

  const investments = await db
    .select()
    .from(investment)
    .where(eq(investment.projectId, id))
    .orderBy(desc(investment.amount));

  return c.json(serialize({ project: projectData, investments }));
});

// GET /api/account/:address
app.get("/api/account/:address", async (c) => {
  const address = c.req.param("address") as `0x${string}`;

  const [accountData] = await db
    .select()
    .from(account)
    .where(eq(account.address, address))
    .limit(1);

  if (!accountData) {
    return c.json({ error: "Account not found" }, 404);
  }

  const isCollector =
    accountData.role === "collector" || accountData.role === "both";
  const isInvestor =
    accountData.role === "investor" || accountData.role === "both";

  const [projects, investments] = await Promise.all([
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

  return c.json(serialize({ account: accountData, projects, investments }));
});

// GET /api/portfolio/:address
app.get("/api/portfolio/:address", async (c) => {
  const address = c.req.param("address") as `0x${string}`;

  const [allInvestments, [activeResult]] = await Promise.all([
    db
      .select()
      .from(investment)
      .where(eq(investment.investor, address))
      .orderBy(desc(investment.timestamp)),
    db
      .select({ cnt: count() })
      .from(investment)
      .where(and(eq(investment.investor, address), eq(investment.claimed, false))),
  ]);

  const activeCount = activeResult?.cnt ?? 0;
  const summary = {
    totalInvested: allInvestments.reduce((acc, inv) => acc + inv.amount, 0n),
    totalClaimed: allInvestments.reduce((acc, inv) => acc + inv.claimedAmount, 0n),
    activeInvestments: activeCount,
    claimedInvestments: allInvestments.length - activeCount,
  };

  return c.json(serialize({ investments: allInvestments, summary }));
});

export default app;
