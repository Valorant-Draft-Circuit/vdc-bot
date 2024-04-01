/**
 * This file contains the enumerations for the player status codes
 * To compile this, type one of the following commands into the root of the project directory 
 * 
 * @option npm run compile
 * @option tsc ./utils/enums/playerStatusCodes.ts
 */

export const ROLES = process.env.ENVIRONMENT == "DEV" ?
    /** @development */
    {
        LEAGUE: {
            VIEWER: "1062105398108225556",
            LEAGUE: "1057161314201518091",
            INACTIVE: "1060751264088080445",
            DRAFT_ELIGIBLE: "1057161198702952508",
            FREE_AGENT: "1057161311651377183",
            RESTRICTED_FREE_AGENT: "1057163956524949534",
            INACTIVE_RESERVE: "1181457461895495732",
            CAPTAIN: "1082176642329346110",
            FORMER_PLAYER: "1062105226225660005",
        },
        TIER: {
            // Regular tier roles
            MYTHIC: "1057161199659257928",
            EXPERT: "1057161297319440485",
            APPRENTICE: "1057161301102698567",
            PROSPECT: "1057161308535005204",

            // Free agent tier roles
            MYTHIC_FREE_AGENT: "1224023294093561996",
            EXPERT_FREE_AGENT: "1224023492085940225",
            APPRENTICE_FREE_AGENT: "1224023553498939493",
            PROSPECT_FREE_AGENT: "1224023630330204303",
        },
    } :
    /** @production */
    {
        LEAGUE: {
            VIEWER: "963665382873391135",
            LEAGUE: "966901006652833862",
            INACTIVE: "1060750208746668132",
            DRAFT_ELIGIBLE: "963568945959419905",
            FREE_AGENT: "963343035683455007",
            RESTRICTED_FREE_AGENT: "965817407094530068",
            INACTIVE_RESERVE: "976541355625025536",
            CAPTAIN: "963863666464268328",
            FORMER_PLAYER: "966901052626595860",
        },
        TIER: {
            // Regular tier roles
            MYTHIC: "967698140612395018",
            EXPERT: "967697939772354600",
            APPRENTICE: "973344710540271666",
            PROSPECT: "966106018796941392",

            // Free agent tier roles
            MYTHIC_FREE_AGENT: "1224022851112403047",
            EXPERT_FREE_AGENT: "1224022851112403047",
            APPRENTICE_FREE_AGENT: "1224022851112403047",
            PROSPECT_FREE_AGENT: "1224022851112403047",
        },
    };