/** @format */

/**
 * External dependencies
 */
import debug from 'debug';
import React from 'react';
import { get, isFunction } from 'lodash';

/**
 * Internal dependencies
 */
import userSettings from 'lib/user-settings';

/**
 * Reusing the same namespace as the one used in `client/lib/analytics` since
 * the opt-out information has an impact on how Tracks events are processed.
 */
const tracksDebug = debug( 'calypso:analytics:tracks' );

class TracksOptOut extends React.PureComponent {
	componentDidMount() {
		userSettings.on( 'change', this.userSettingsChanged );

		if ( ! userSettings.hasSettings() ) {
			userSettings.fetchSettings();
		}
	}

	userSettingsChanged = () => {
		this.toggleTracksOptOutCookie( userSettings.isSendingTracksEvents() );
	};

	toggleTracksOptOutCookie( isSendingTracksEvents ) {
		const optOutIframeWindow = get( this.optOutIframe, [ 'contentWindow' ], {} );
		if ( isFunction( optOutIframeWindow.postMessage ) ) {
			tracksDebug( `opt-out iframe avaialble, setting status: \`${ isSendingTracksEvents }\`` );
			optOutIframeWindow.postMessage( isSendingTracksEvents, '*' );
		} else {
			tracksDebug(
				`opt-out iframe not avaialble, bailing out from setting status: \`${ isSendingTracksEvents }\``
			);
		}
	}

	iframeRef = ref => {
		this.optOutIframe = ref;
	};

	render() {
		return (
			<iframe
				ref={ this.iframeRef }
				className="tracks-opt-out"
				frameBorder="0"
				allowtransparency="true"
				scrolling="no"
				src="https://widgets.wp.com/tracks-opt-out"
			/>
		);
	}
}

/**
 * Exports
 */
export default TracksOptOut;