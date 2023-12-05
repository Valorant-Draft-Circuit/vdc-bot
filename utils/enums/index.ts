/**
 * This file contains the enumerations for the player status codes
 * To compile this, type one of the following commands into the root of the project directory 
 * 
 * @option npm run compile
 * @option tsc ./utils/enums/playerStatusCodes.ts
 */

export { CHANNELS } from "./channels"
export { ROLES } from "./roles"
export { GUILD } from "./guild"


export { PlayerStatusCode, ContractStatus } from "./playerStatusCodes"
export { ButtonOptions } from "./buttonOptions"
export {
    TransactionsSubTypes, TransactionsCutOptions, TransactionsIROptions,
    TransactionsSignOptions, TransactionsDraftSignOptions, TransactionsRenewOptions,
    TransactionsUpdateTierOptions, TransactionsSwapOptions, TransactionsRetireOptions
} from "./transactions"

// export { Channel } from "./channels"
// export { FranchiseEmote } from "./franchiseEmotes"
// export { ContenderTeams, AdvancedTeams, MasterTeams, EliteTeams } from "./franchiseTeams"
// export { Franchise, Status, Tier, Roles } from "./roles"