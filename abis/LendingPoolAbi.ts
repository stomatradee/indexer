export const LendingPoolAbi = [
  [
    {
      inputs: [
        { internalType: "address", name: "admin_", type: "address" },
        { internalType: "address", name: "projectNft_", type: "address" },
        { internalType: "address", name: "treasury_", type: "address" },
        { internalType: "address", name: "accessRegistry_", type: "address" },
        { internalType: "address", name: "platformWallet_", type: "address" },
      ],
      stateMutability: "nonpayable",
      type: "constructor",
    },
    { inputs: [], name: "AccessControlBadConfirmation", type: "error" },
    {
      inputs: [
        { internalType: "address", name: "account", type: "address" },
        { internalType: "bytes32", name: "neededRole", type: "bytes32" },
      ],
      name: "AccessControlUnauthorizedAccount",
      type: "error",
    },
    { inputs: [], name: "EnforcedPause", type: "error" },
    { inputs: [], name: "ExpectedPause", type: "error" },
    {
      inputs: [
        { internalType: "uint256", name: "projectId", type: "uint256" },
        { internalType: "address", name: "investor", type: "address" },
      ],
      name: "LendingPool__AlreadyClaimed",
      type: "error",
    },
    {
      inputs: [
        { internalType: "uint256", name: "projectId", type: "uint256" },
        { internalType: "address", name: "investor", type: "address" },
      ],
      name: "LendingPool__AlreadyInvested",
      type: "error",
    },
    {
      inputs: [
        { internalType: "uint256", name: "requested", type: "uint256" },
        { internalType: "uint256", name: "remaining", type: "uint256" },
      ],
      name: "LendingPool__ExceedsCapacity",
      type: "error",
    },
    {
      inputs: [
        { internalType: "uint256", name: "projectId", type: "uint256" },
        { internalType: "uint256", name: "deadline", type: "uint256" },
      ],
      name: "LendingPool__FundingDeadlineExpired",
      type: "error",
    },
    {
      inputs: [
        { internalType: "uint256", name: "projectId", type: "uint256" },
        { internalType: "uint256", name: "gracePeriodEnd", type: "uint256" },
      ],
      name: "LendingPool__GracePeriodNotElapsed",
      type: "error",
    },
    {
      inputs: [
        { internalType: "uint256", name: "projectId", type: "uint256" },
        {
          internalType: "enum DataTypes.ProjectStatus",
          name: "current",
          type: "uint8",
        },
        { internalType: "string", name: "required", type: "string" },
      ],
      name: "LendingPool__InvalidStatus",
      type: "error",
    },
    {
      inputs: [{ internalType: "uint256", name: "projectId", type: "uint256" }],
      name: "LendingPool__NoFundsToClose",
      type: "error",
    },
    {
      inputs: [{ internalType: "uint256", name: "projectId", type: "uint256" }],
      name: "LendingPool__NoRemainderToClaim",
      type: "error",
    },
    {
      inputs: [{ internalType: "uint256", name: "projectId", type: "uint256" }],
      name: "LendingPool__NotDistributed",
      type: "error",
    },
    {
      inputs: [
        { internalType: "uint256", name: "projectId", type: "uint256" },
        { internalType: "address", name: "investor", type: "address" },
      ],
      name: "LendingPool__NotInvestor",
      type: "error",
    },
    {
      inputs: [
        { internalType: "uint256", name: "projectId", type: "uint256" },
        { internalType: "address", name: "caller", type: "address" },
      ],
      name: "LendingPool__NotProjectOwner",
      type: "error",
    },
    {
      inputs: [{ internalType: "uint256", name: "projectId", type: "uint256" }],
      name: "LendingPool__ProjectNotFound",
      type: "error",
    },
    {
      inputs: [{ internalType: "uint256", name: "projectId", type: "uint256" }],
      name: "LendingPool__RemainderAlreadyClaimed",
      type: "error",
    },
    {
      inputs: [{ internalType: "address", name: "token", type: "address" }],
      name: "LendingPool__TokenNotAccepted",
      type: "error",
    },
    { inputs: [], name: "LendingPool__ZeroAddress", type: "error" },
    { inputs: [], name: "LendingPool__ZeroValue", type: "error" },
    { inputs: [], name: "ReentrancyGuardReentrantCall", type: "error" },
    {
      inputs: [{ internalType: "address", name: "token", type: "address" }],
      name: "SafeERC20FailedOperation",
      type: "error",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "token",
          type: "address",
        },
        {
          indexed: false,
          internalType: "bool",
          name: "accepted",
          type: "bool",
        },
      ],
      name: "AcceptedTokenSet",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "uint256",
          name: "projectId",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
      ],
      name: "BuyerPaymentRecorded",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "uint256",
          name: "projectId",
          type: "uint256",
        },
        {
          indexed: true,
          internalType: "address",
          name: "collector",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "repaymentDeadline",
          type: "uint256",
        },
      ],
      name: "FundsDisbursed",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "uint256",
          name: "projectId",
          type: "uint256",
        },
        {
          indexed: true,
          internalType: "address",
          name: "investor",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "totalFunded",
          type: "uint256",
        },
      ],
      name: "Invested",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "address",
          name: "account",
          type: "address",
        },
      ],
      name: "Paused",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "newWallet",
          type: "address",
        },
      ],
      name: "PlatformWalletSet",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "uint256",
          name: "projectId",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "totalInvestorReturn",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "platformFee",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "collectorRemainder",
          type: "uint256",
        },
      ],
      name: "ProfitDistributed",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "uint256",
          name: "projectId",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "totalFunded",
          type: "uint256",
        },
      ],
      name: "ProjectAutoFunded",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "uint256",
          name: "projectId",
          type: "uint256",
        },
      ],
      name: "ProjectCompleted",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "uint256",
          name: "projectId",
          type: "uint256",
        },
      ],
      name: "ProjectDefaulted",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "uint256",
          name: "projectId",
          type: "uint256",
        },
        {
          indexed: true,
          internalType: "address",
          name: "collector",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "totalFunded",
          type: "uint256",
        },
      ],
      name: "ProjectManuallyClosed",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "uint256",
          name: "projectId",
          type: "uint256",
        },
        {
          indexed: true,
          internalType: "address",
          name: "collector",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
      ],
      name: "RemainderClaimed",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "uint256",
          name: "projectId",
          type: "uint256",
        },
        {
          indexed: true,
          internalType: "address",
          name: "investor",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
      ],
      name: "ReturnClaimed",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "bytes32",
          name: "role",
          type: "bytes32",
        },
        {
          indexed: true,
          internalType: "bytes32",
          name: "previousAdminRole",
          type: "bytes32",
        },
        {
          indexed: true,
          internalType: "bytes32",
          name: "newAdminRole",
          type: "bytes32",
        },
      ],
      name: "RoleAdminChanged",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "bytes32",
          name: "role",
          type: "bytes32",
        },
        {
          indexed: true,
          internalType: "address",
          name: "account",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "sender",
          type: "address",
        },
      ],
      name: "RoleGranted",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "bytes32",
          name: "role",
          type: "bytes32",
        },
        {
          indexed: true,
          internalType: "address",
          name: "account",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "sender",
          type: "address",
        },
      ],
      name: "RoleRevoked",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "address",
          name: "account",
          type: "address",
        },
      ],
      name: "Unpaused",
      type: "event",
    },
    {
      inputs: [],
      name: "DEFAULT_ADMIN_ROLE",
      outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "GRACE_PERIOD",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "LTV_RATIO",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "OPERATOR_ROLE",
      outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "PROFIT_PER_KG_INVESTOR",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "PROFIT_PER_KG_PLATFORM",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [{ internalType: "address", name: "", type: "address" }],
      name: "acceptedTokens",
      outputs: [{ internalType: "bool", name: "", type: "bool" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "accessRegistry",
      outputs: [
        { internalType: "contract IAccessRegistry", name: "", type: "address" },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [{ internalType: "uint256", name: "projectId", type: "uint256" }],
      name: "claimRemainder",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [{ internalType: "uint256", name: "projectId", type: "uint256" }],
      name: "claimReturn",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [{ internalType: "uint256", name: "projectId", type: "uint256" }],
      name: "closeFunding",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [{ internalType: "uint256", name: "projectId", type: "uint256" }],
      name: "disburseFunds",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [{ internalType: "uint256", name: "projectId", type: "uint256" }],
      name: "getDistribution",
      outputs: [
        {
          components: [
            {
              internalType: "uint256",
              name: "totalInvestorReturn",
              type: "uint256",
            },
            { internalType: "uint256", name: "platformFee", type: "uint256" },
            {
              internalType: "uint256",
              name: "collectorRemainder",
              type: "uint256",
            },
            {
              internalType: "uint256",
              name: "claimedInvestorCount",
              type: "uint256",
            },
            { internalType: "bool", name: "distributed", type: "bool" },
            { internalType: "bool", name: "collectorClaimed", type: "bool" },
          ],
          internalType: "struct DataTypes.Distribution",
          name: "",
          type: "tuple",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        { internalType: "uint256", name: "projectId", type: "uint256" },
        { internalType: "address", name: "investor", type: "address" },
      ],
      name: "getInvestment",
      outputs: [
        {
          components: [
            { internalType: "address", name: "investor", type: "address" },
            { internalType: "bool", name: "claimed", type: "bool" },
            { internalType: "uint256", name: "amount", type: "uint256" },
            { internalType: "uint256", name: "timestamp", type: "uint256" },
          ],
          internalType: "struct DataTypes.Investment",
          name: "",
          type: "tuple",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [{ internalType: "uint256", name: "projectId", type: "uint256" }],
      name: "getInvestments",
      outputs: [
        {
          components: [
            { internalType: "address", name: "investor", type: "address" },
            { internalType: "bool", name: "claimed", type: "bool" },
            { internalType: "uint256", name: "amount", type: "uint256" },
            { internalType: "uint256", name: "timestamp", type: "uint256" },
          ],
          internalType: "struct DataTypes.Investment[]",
          name: "",
          type: "tuple[]",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [{ internalType: "uint256", name: "projectId", type: "uint256" }],
      name: "getProject",
      outputs: [
        {
          components: [
            { internalType: "address", name: "collector", type: "address" },
            { internalType: "address", name: "acceptedToken", type: "address" },
            { internalType: "string", name: "commodityType", type: "string" },
            { internalType: "uint256", name: "volumeKg", type: "uint256" },
            {
              internalType: "uint256",
              name: "collateralValue",
              type: "uint256",
            },
            { internalType: "uint256", name: "maxFunding", type: "uint256" },
            { internalType: "uint256", name: "totalFunded", type: "uint256" },
            {
              internalType: "uint256",
              name: "fundingDeadline",
              type: "uint256",
            },
            {
              internalType: "uint256",
              name: "repaymentDuration",
              type: "uint256",
            },
            {
              internalType: "uint256",
              name: "repaymentDeadline",
              type: "uint256",
            },
            {
              internalType: "uint256",
              name: "buyerPaymentAmount",
              type: "uint256",
            },
            { internalType: "bool", name: "collateralVerified", type: "bool" },
            {
              internalType: "enum DataTypes.ProjectStatus",
              name: "status",
              type: "uint8",
            },
            { internalType: "string", name: "metadataURI", type: "string" },
          ],
          internalType: "struct DataTypes.Project",
          name: "",
          type: "tuple",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [{ internalType: "bytes32", name: "role", type: "bytes32" }],
      name: "getRoleAdmin",
      outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        { internalType: "bytes32", name: "role", type: "bytes32" },
        { internalType: "address", name: "account", type: "address" },
      ],
      name: "grantRole",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        { internalType: "bytes32", name: "role", type: "bytes32" },
        { internalType: "address", name: "account", type: "address" },
      ],
      name: "hasRole",
      outputs: [{ internalType: "bool", name: "", type: "bool" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        { internalType: "uint256", name: "projectId", type: "uint256" },
        { internalType: "uint256", name: "amount", type: "uint256" },
      ],
      name: "invest",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [{ internalType: "uint256", name: "projectId", type: "uint256" }],
      name: "markDefaulted",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [],
      name: "pause",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [],
      name: "paused",
      outputs: [{ internalType: "bool", name: "", type: "bool" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "platformWallet",
      outputs: [{ internalType: "address", name: "", type: "address" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "projectCount",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "projectNft",
      outputs: [
        { internalType: "contract IProjectNFT", name: "", type: "address" },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        { internalType: "uint256", name: "projectId", type: "uint256" },
        { internalType: "uint256", name: "amount", type: "uint256" },
      ],
      name: "recordBuyerPayment",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        { internalType: "bytes32", name: "role", type: "bytes32" },
        {
          internalType: "address",
          name: "callerConfirmation",
          type: "address",
        },
      ],
      name: "renounceRole",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        { internalType: "bytes32", name: "role", type: "bytes32" },
        { internalType: "address", name: "account", type: "address" },
      ],
      name: "revokeRole",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        { internalType: "address", name: "token", type: "address" },
        { internalType: "bool", name: "accepted", type: "bool" },
      ],
      name: "setAcceptedToken",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [{ internalType: "address", name: "newWallet", type: "address" }],
      name: "setPlatformWallet",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [{ internalType: "bytes4", name: "interfaceId", type: "bytes4" }],
      name: "supportsInterface",
      outputs: [{ internalType: "bool", name: "", type: "bool" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "treasury",
      outputs: [
        { internalType: "contract ITreasury", name: "", type: "address" },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "unpause",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
  ],
] as const;
