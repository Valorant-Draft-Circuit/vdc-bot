export const GUILD = process.env.ENVIRONMENT == "DEV" ?
/**
 * @NOTE If bot needs to join franchises servers, production IDS need to be 
 * updated.
 */
    /** @development */
    `1027754353207033966` :
    /** @production */
    `963274331251671071` ;