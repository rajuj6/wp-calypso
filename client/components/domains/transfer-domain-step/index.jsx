/** @format */

/**
 * External dependencies
 */
import async from 'async';
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { localize } from 'i18n-calypso';
import { endsWith, get, isEmpty, noop } from 'lodash';
import Gridicon from 'gridicons';
import page from 'page';
import qs from 'qs';

/**
 * Internal dependencies
 */
import {
	checkDomainAvailability,
	checkInboundTransferStatus,
	getFixedDomainSearch,
	getTld,
} from 'lib/domains';
import { domainAvailability } from 'lib/domains/constants';
import { getAvailabilityNotice } from 'lib/domains/registration/availability-messages';
import DomainRegistrationSuggestion from 'components/domains/domain-registration-suggestion';
import { getCurrentUser } from 'state/current-user/selectors';
import Notice from 'components/notice';
import Card from 'components/card';
import { composeAnalytics, recordGoogleEvent, recordTracksEvent } from 'state/analytics/actions';
import { getSelectedSite } from 'state/ui/selectors';
import FormTextInputWithAffixes from 'components/forms/form-text-input-with-affixes';
import TransferDomainPrecheck from './transfer-domain-precheck';
import { INCOMING_DOMAIN_TRANSFER, MAP_EXISTING_DOMAIN } from 'lib/url/support';
import HeaderCake from 'components/header-cake';
import Button from 'components/button';
import TransferRestrictionMessage from 'components/domains/transfer-domain-step/transfer-restriction-message';

class TransferDomainStep extends React.Component {
	static propTypes = {
		analyticsSection: PropTypes.string.isRequired,
		cart: PropTypes.object,
		domainsWithPlansOnly: PropTypes.bool.isRequired,
		goBack: PropTypes.func,
		initialQuery: PropTypes.string,
		onRegisterDomain: PropTypes.func.isRequired,
		onTransferDomain: PropTypes.func.isRequired,
		onSave: PropTypes.func,
		products: PropTypes.object.isRequired,
		selectedSite: PropTypes.oneOfType( [ PropTypes.object, PropTypes.bool ] ),
	};

	static defaultProps = {
		analyticsSection: 'domains',
		onSave: noop,
	};

	state = this.getDefaultState();

	getDefaultState() {
		return {
			domain: null,
			inboundTransferStatus: {},
			precheck: false,
			searchQuery: this.props.initialQuery || '',
			submittingAvailability: false,
			submittingWhois: false,
			supportsPrivacy: false,
		};
	}

	componentWillMount() {
		if ( this.props.initialState ) {
			this.setState( Object.assign( {}, this.props.initialState, this.getDefaultState() ) );
		}
	}

	componentWillUnmount() {
		this.props.onSave( this.state );
	}

	notice() {
		if ( this.state.notice ) {
			return (
				<Notice
					text={ this.state.notice }
					status={ `is-${ this.state.noticeSeverity }` }
					showDismiss={ false }
				/>
			);
		}
	}

	getMapDomainUrl() {
		const { basePath, selectedSite } = this.props;
		let mapDomainUrl;

		const basePathForMapping = endsWith( basePath, '/transfer' )
			? basePath.substring( 0, basePath.length - 9 )
			: basePath;

		const query = qs.stringify( { initialQuery: this.state.searchQuery.trim() } );
		mapDomainUrl = `${ basePathForMapping }/mapping`;
		if ( selectedSite ) {
			mapDomainUrl += `/${ selectedSite.slug }?${ query }`;
		}

		return mapDomainUrl;
	}

	goToMapDomainStep = event => {
		event.preventDefault();

		this.props.recordMapDomainButtonClick( this.props.analyticsSection );

		page( this.getMapDomainUrl() );
	};

	addTransfer() {
		const { translate } = this.props;
		const { searchQuery, submittingAvailability, submittingWhois } = this.state;
		const submitting = submittingAvailability || submittingWhois;

		return (
			<div>
				{ this.notice() }
				<form className="transfer-domain-step__form card" onSubmit={ this.handleFormSubmit }>
					<div className="transfer-domain-step__domain-description">
						<img
							className="transfer-domain-step__illustration"
							src={ '/calypso/images/illustrations/migrating-host-diy.svg' }
						/>
						<div className="transfer-domain-step__domain-heading">
							{ translate( 'Manage your domain and site together on WordPress.com.' ) }
						</div>
						<div>
							{ translate(
								'Move your domain from your current provider to WordPress.com so you can update settings, ' +
									"renew your domain, and more right in your dashboard. We'll renew it for another year " +
									'when the transfer is successful. {{a}}Learn More{{/a}}',
								{
									components: {
										a: (
											<a
												href={ INCOMING_DOMAIN_TRANSFER }
												rel="noopener noreferrer"
												target="_blank"
											/>
										),
									},
								}
							) }
						</div>
					</div>

					<div className="transfer-domain-step__add-domain" role="group">
						<FormTextInputWithAffixes
							prefix="http://"
							type="text"
							value={ searchQuery }
							placeholder={ translate( 'example.com' ) }
							onBlur={ this.save }
							onChange={ this.setSearchQuery }
							onFocus={ this.recordInputFocus }
							autoFocus
						/>
					</div>
					<Button
						disabled={ ! getTld( searchQuery ) || submitting }
						busy={ submitting }
						className="transfer-domain-step__go button is-primary"
						onClick={ this.handleFormSubmit }
					>
						{ translate( 'Transfer to WordPress.com' ) }
					</Button>
					{ this.domainRegistrationUpsell() }
				</form>

				<Card className="transfer-domain-step__map-option">
					<strong>{ translate( 'Manage your domain and site separately.' ) }</strong>
					<p>
						{ translate(
							'Leave the domain at your current provider and {{a}}manually connect it{{/a}} to ' +
								"your WordPress.com site. You'll still need to continue paying your current " +
								'provider to renew and manage any domain settings.',
							{
								components: { a: <a href="#" onClick={ this.goToMapDomainStep } /> },
							}
						) }
						<a
							className="transfer-domain-step__map-help"
							href={ MAP_EXISTING_DOMAIN }
							rel="noopener noreferrer"
							target="_blank"
						>
							<Gridicon icon="help" size={ 18 } />
						</a>
					</p>
				</Card>
			</div>
		);
	}

	getTransferDomainPrecheck() {
		const { inboundTransferStatus, submittingWhois } = this.state;

		return (
			<TransferDomainPrecheck
				domain={ this.state.domain }
				email={ inboundTransferStatus.email }
				loading={ submittingWhois }
				losingRegistrar={ inboundTransferStatus.losingRegistrar }
				losingRegistrarIanaId={ inboundTransferStatus.losingRegistrarIanaId }
				privacy={ inboundTransferStatus.privacy }
				refreshStatus={ this.getInboundTransferStatus }
				selectedSiteSlug={ get( this.props, 'selectedSite.slug', null ) }
				setValid={ this.props.onTransferDomain }
				supportsPrivacy={ this.state.supportsPrivacy }
				unlocked={ inboundTransferStatus.unlocked }
			/>
		);
	}

	transferIsRestricted = () => {
		const { submittingAvailability, submittingWhois } = this.state;
		const submitting = submittingAvailability || submittingWhois;

		return (
			! submitting &&
			'not_restricted' !== this.state.inboundTransferStatus.transferRestrictionStatus
		);
	};

	getTransferRestrictionMessage() {
		const { domain, inboundTransferStatus } = this.state;
		const {
			creationDate,
			termMaximumInYears,
			transferEligibleDate,
			transferRestrictionStatus,
		} = inboundTransferStatus;

		return (
			<TransferRestrictionMessage
				creationDate={ creationDate }
				domain={ domain }
				selectedSiteSlug={ get( this.props, 'selectedSite.slug', null ) }
				termMaximumInYears={ termMaximumInYears }
				transferEligibleDate={ transferEligibleDate }
				transferRestrictionStatus={ transferRestrictionStatus }
			/>
		);
	}

	goBack = () => {
		if ( this.state.domain ) {
			this.setState( { domain: null, precheck: false, supportsPrivacy: false } );
		} else {
			this.props.goBack();
		}
	};

	render() {
		let content;
		const { precheck } = this.state;

		if ( precheck ) {
			if ( this.transferIsRestricted() ) {
				content = this.getTransferRestrictionMessage();
			} else {
				content = this.getTransferDomainPrecheck();
			}
		} else {
			content = this.addTransfer();
		}

		return (
			<div className="transfer-domain-step">
				<HeaderCake onClick={ this.goBack }>
					{ this.props.translate( 'Use My Own Domain' ) }
				</HeaderCake>
				<div>{ content }</div>
			</div>
		);
	}

	domainRegistrationUpsell() {
		const { suggestion } = this.state;
		if ( ! suggestion ) {
			return;
		}

		return (
			<div className={ 'transfer-domain-step__domain-availability' }>
				<Notice status="is-success" showDismiss={ false }>
					{ this.props.translate( '%(domain)s is available!', {
						args: { domain: suggestion.domain_name },
					} ) }
				</Notice>
				<DomainRegistrationSuggestion
					cart={ this.props.cart }
					domainsWithPlansOnly={ this.props.domainsWithPlansOnly }
					key={ suggestion.domain_name }
					onButtonClick={ this.registerSuggestedDomain }
					selectedSite={ this.props.selectedSite }
					suggestion={ suggestion }
				/>
			</div>
		);
	}

	registerSuggestedDomain = () => {
		this.props.recordAddDomainButtonClickInTransferDomain(
			this.state.suggestion.domain_name,
			this.props.analyticsSection
		);

		return this.props.onRegisterDomain( this.state.suggestion );
	};

	recordInputFocus = () => {
		this.props.recordInputFocusInTransferDomain( this.state.searchQuery );
	};

	setSearchQuery = event => {
		this.setState( { searchQuery: event.target.value } );
	};

	handleFormSubmit = event => {
		event.preventDefault();

		this.props.recordFormSubmitInTransferDomain( this.state.searchQuery );
		this.setState( { notice: null, suggestion: null, submittingAvailability: true } );

		this.props.recordGoButtonClickInTransferDomain(
			this.state.searchQuery,
			this.props.analyticsSection
		);

		async.parallel(
			[
				callback => {
					this.getInboundTransferStatus( callback );
				},
				callback => {
					this.getAvailability( callback );
				},
			],
			() => {
				this.setState( prevState => {
					const { submittingAvailability, submittingWhois } = prevState;

					return { precheck: prevState.domain && ! submittingAvailability && ! submittingWhois };
				} );
			}
		);
	};

	getAvailability = callback => {
		const domain = getFixedDomainSearch( this.state.searchQuery );

		checkDomainAvailability(
			{ domainName: domain, blogId: get( this.props, 'selectedSite.ID', null ) },
			( error, result ) => {
				const status = get( result, 'status', error );
				switch ( status ) {
					case domainAvailability.AVAILABLE:
						this.setState( { suggestion: result } );
						break;
					case domainAvailability.TRANSFERRABLE:
					case domainAvailability.MAPPED_SAME_SITE_TRANSFERRABLE:
						this.setState( {
							domain,
							supportsPrivacy: get( result, 'supports_privacy', false ),
						} );
						break;
					case domainAvailability.MAPPABLE:
					case domainAvailability.TLD_NOT_SUPPORTED:
						const tld = getTld( domain );

						this.setState( {
							notice: this.props.translate(
								"We don't support transfers for domains ending with {{strong}}.%(tld)s{{/strong}}, " +
									'but you can {{a}}map it{{/a}} instead.',
								{
									args: { tld },
									components: {
										strong: <strong />,
										a: <a href="#" onClick={ this.goToMapDomainStep } />,
									},
								}
							),
							noticeSeverity: 'info',
						} );
						break;
					case domainAvailability.UNKNOWN:
						const mappableStatus = get( result, 'mappable', error );

						if ( domainAvailability.MAPPABLE === mappableStatus ) {
							this.setState( {
								notice: this.props.translate(
									"{{strong}}%(domain)s{{/strong}} can't be transferred. " +
										'You can {{a}}manually connect it{{/a}} if you still want to use it for your site.',
									{
										args: { domain },
										components: {
											strong: <strong />,
											a: <a href="#" onClick={ this.goToMapDomainStep } />,
										},
									}
								),
								noticeSeverity: 'info',
							} );
							break;
						}
					default:
						let site = get( result, 'other_site_domain', null );
						if ( ! site ) {
							site = get( this.props, 'selectedSite.slug', null );
						}

						const { message, severity } = getAvailabilityNotice( domain, status, site );
						this.setState( { notice: message, noticeSeverity: severity } );
				}

				this.setState( { submittingAvailability: false } );
				callback();
			}
		);
	};

	getInboundTransferStatus = ( callback = null ) => {
		this.setState( { submittingWhois: true } );

		checkInboundTransferStatus(
			getFixedDomainSearch( this.state.searchQuery ),
			( error, result ) => {
				this.setState( { submittingWhois: false } );

				if ( ! isEmpty( error ) ) {
					return;
				}

				this.setState( {
					inboundTransferStatus: {
						creationDate: result.creation_date,
						email: result.admin_email,
						loading: false,
						losingRegistrar: result.registrar,
						losingRegistrarIanaId: result.registrar_iana_id,
						privacy: result.privacy,
						termMaximumInYears: result.term_maximum_in_years,
						transferEligibleDate: result.transfer_eligible_date,
						transferRestrictionStatus: result.transfer_restriction_status,
						unlocked: result.unlocked,
					},
				} );

				if ( callback ) {
					callback();
				}
			}
		);
	};
}

const recordAddDomainButtonClickInTransferDomain = ( domain_name, section ) =>
	recordTracksEvent( 'calypso_transfer_domain_add_suggested_domain_click', {
		domain_name,
		section,
	} );

const recordFormSubmitInTransferDomain = domain_name =>
	recordTracksEvent( 'calypso_transfer_domain_form_submit', { domain_name } );

const recordInputFocusInTransferDomain = domain_name =>
	recordTracksEvent( 'calypso_transfer_domain_input_focus', { domain_name } );

const recordGoButtonClickInTransferDomain = ( domain_name, section ) =>
	recordTracksEvent( 'calypso_transfer_domain_go_click', { domain_name, section } );

const recordMapDomainButtonClick = section =>
	composeAnalytics(
		recordGoogleEvent( 'Transfer Domain', 'Clicked "Map it" Button' ),
		recordTracksEvent( 'calypso_transfer_domain_mapping_button_click', { section } )
	);

export default connect(
	state => ( {
		currentUser: getCurrentUser( state ),
		selectedSite: getSelectedSite( state ),
	} ),
	{
		recordAddDomainButtonClickInTransferDomain,
		recordFormSubmitInTransferDomain,
		recordInputFocusInTransferDomain,
		recordGoButtonClickInTransferDomain,
		recordMapDomainButtonClick,
	}
)( localize( TransferDomainStep ) );
