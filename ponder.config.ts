import { createConfig } from "ponder";
import { http, fallback } from "viem";

import { AccessRegistryAbi } from "./abis/AccessRegistryAbi";
import { ProjectNFTAbi } from "./abis/ProjectNFTAbi";
import { TreasuryAbi } from "./abis/TreasuryAbi";
import { LendingPoolAbi } from "./abis/LendingPoolAbi";
import { MockUSDCAbi } from "./abis/MockUSDCAbi";
import { MockUSDTAbi } from "./abis/MockUSDTAbi";

const startBlock = Number(process.env.PONDER_START_BLOCK ?? 256563231);

export default createConfig({
  database: {
    kind: "postgres",
    connectionString: process.env.DATABASE_URL,
  },
  chains: {
    arbitrumSepolia: {
      id: 421614,
      rpc: fallback([
        http(process.env.PONDER_RPC_URL_ALCHEMY_421614),
        http(process.env.PONDER_RPC_URL_INFURA_421614),
      ]),
      maxRequestsPerSecond: 50,
      pollingInterval: 5_000,
    },
  },
  contracts: {
    AccessRegistry: {
      chain: "arbitrumSepolia",
      abi: AccessRegistryAbi[0],
      address: process.env.PONDER_CONTRACT_ACCESS_REGISTRY as `0x${string}`,
      startBlock,
    },
    ProjectNFT: {
      chain: "arbitrumSepolia",
      abi: ProjectNFTAbi[0],
      address: process.env.PONDER_CONTRACT_PROJECT_NFT as `0x${string}`,
      startBlock,
    },
    Treasury: {
      chain: "arbitrumSepolia",
      abi: TreasuryAbi[0],
      address: process.env.PONDER_CONTRACT_TREASURY as `0x${string}`,
      startBlock,
    },
    LendingPool: {
      chain: "arbitrumSepolia",
      abi: LendingPoolAbi[0],
      address: process.env.PONDER_CONTRACT_LENDING_POOL as `0x${string}`,
      startBlock,
    },
    MockUSDC: {
      chain: "arbitrumSepolia",
      abi: MockUSDCAbi[0],
      address: process.env.PONDER_CONTRACT_MOCK_USDC as `0x${string}`,
      startBlock,
    },
    MockUSDT: {
      chain: "arbitrumSepolia",
      abi: MockUSDTAbi[0],
      address: process.env.PONDER_CONTRACT_MOCK_USDT as `0x${string}`,
      startBlock,
    },
  },
});