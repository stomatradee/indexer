import { createConfig } from "ponder";
// Ambil http dari viem dan loadBalance dari @ponder/utils
import { http, fallback } from "viem"; 

import { AccessRegistryAbi } from "./abis/AccessRegistryAbi";
import { ProjectNFTAbi } from "./abis/ProjectNFTAbi";
import { TreasuryAbi } from "./abis/TreasuryAbi";
import { LendingPoolAbi } from "./abis/LendingPoolAbi";
import { MockUSDCAbi } from "./abis/MockUSDCAbi";
import { MockUSDTAbi } from "./abis/MockUSDTAbi";

const startBlock = Number(process.env.PONDER_START_BLOCK ?? 252565104);

export default createConfig({
  chains: {
    arbitrumSepolia: {
      id: 421614,
      // Menggunakan loadBalance agar beban terbagi rata antara Infura dan Alchemy
      rpc: fallback([
        http(process.env.PONDER_RPC_URL_ALCHEMY_421614),
        http(process.env.PONDER_RPC_URL_INFURA_421614),
      ]),
      // Pengaturan tambahan untuk menjaga stabilitas di akun gratis
      maxRequestsPerSecond: 2,     // Rem kecepatan agar tidak diblokir
      ethGetLogsBlockRange: 10,   // Sesuai saran Alchemy untuk akun gratis
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