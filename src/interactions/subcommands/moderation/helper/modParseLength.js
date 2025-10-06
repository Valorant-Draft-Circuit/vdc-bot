// Ensure that we are working with a valid length string
// A valid length string has the following standard
//      x = int
//         xm, xh, xd, xw
//             m = minutes
//             h = hours
//             d = days
//             w = weeks

// Enable strict mode
"use strict";

// Get the custom error for this helper file

// Create the map to be used for mapping the character 
// in the length to a corresponding time
const timeMultiplier = {
    m: 60 * 1000,         
    h: 60 * 60 * 1000,    
    d: 24 * 60 * 60 * 1000, 
    w: 7 * 24 * 60 * 60 * 1000
};

/** Parse the lengthObject passed in to moderation values
 * @param   {String} length
 * @returns {number} timeToAdd 
 */
function modParseLength(length) {
    // Basic error handles
    if (length == null) return {success: false, value: null };

    // Create a regex pattern for this 
    const standardModLength = /^([1-9][0-9]?)([mhdw])$/

    // Test the passed in length against the regex expression
    const correctStructure = length.match(standardModLength);
    if (correctStructure)
    {
        // Extract number and unit
        const timeIntLength = parseInt(correctStructure[1], 10);
        const timeCharLength = correctStructure[2];

        // Calculate the time difference
        const timeToAdd = timeIntLength * timeMultiplier[timeCharLength];
        return {success: true, value: timeToAdd} ;
    }
    else
    {
        logger.log('DEBUG', 'The value `length` that was passed in is invalid.');
        return {success: false, value: null };
    }
}

// TEST FUNCTION ONCE ABLE TO
module.exports = {
    modParseLength
}