/** @format */
/**
 * External dependencies
 */
import { get } from 'lodash';

/**
 * @param {Object} state Global app state
 * @return {Object} An object that represents the current status for site rename requests.
 */
export default state => get( state, 'siteRename.status', {} );
