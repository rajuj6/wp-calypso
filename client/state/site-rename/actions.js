/** @format */
/**
 * External dependencies
 */
import page from 'page';

/**
 * Internal dependencies
 */
import wpcom from 'lib/wp';
import {
	SITE_RENAME_REQUEST,
	SITE_RENAME_REQUEST_FAILURE,
	SITE_RENAME_REQUEST_SUCCESS,
} from 'state/action-types';
import { requestSite } from 'state/sites/actions';
import { domainManagementEdit } from 'my-sites/domains/paths';

export const requestSiteRename = ( siteId, newBlogName, discard ) => dispatch => {
	dispatch( {
		type: SITE_RENAME_REQUEST,
		siteId,
	} );

	return wpcom
		.undocumented()
		.updateSiteName( siteId, newBlogName, discard )
		.then( data => {
			dispatch( requestSite( siteId ) ).then( () => {
				page(
					domainManagementEdit( data.new_slug + '.wordpress.com', data.new_slug + '.wordpress.com' )
				);
			} );

			dispatch( {
				type: SITE_RENAME_REQUEST_SUCCESS,
				newSlug: data.new_slug,
				siteId,
			} );
		} )
		.catch( error => {
			dispatch( {
				type: SITE_RENAME_REQUEST_FAILURE,
				error: error.message,
				siteId,
			} );
		} );
};
