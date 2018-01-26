/** @format */
/**
 * External dependencies
 */
import { get } from 'lodash';

/**
 * @param {Object} state Global app state
 * @param {Number} siteId - site ID
 * @return {Object} An object encapsulates the error from requesting for the password reset options.
 */
export default ( state, siteId ) => get( state, [ 'siteRename', 'requesting', siteId ], null );
