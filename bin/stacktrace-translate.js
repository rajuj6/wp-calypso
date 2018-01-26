#!/usr/bin/env node

/**
 * Script to translate a minified stack trace to a real one.
 *
 * Usage: `stacktrace-translate`
 *
 * Paste stacktrace array from error log into stdin.
 */

const _ = require( 'lodash' );
const readline = require( 'readline' );
const fs = require( 'fs' );
const sourceMap = require( 'source-map' );

const urlRoot = 'https://wordpress.com/calypso/';
const fileRoot = './public/';

const loadedMaps = {};

function findMap( url ) {
	const loadedMap = loadedMaps[ url ];
	return loadedMap || loadMap( url );
}

function loadMap( url ) {
	console.log( 'loading bundle: ', url );

	if ( ! _.startsWith( url, urlRoot ) ) {
		throw new Error( 'Bundle has unexpected url root: ', url );
	}

	const bundle = url.substring( urlRoot.length );
	const fileName = fileRoot + bundle + '.map';

	const mapFile = fs.readFileSync( fileName );
	const map = JSON.parse( mapFile );

	loadedMaps[ url ] = map;
	return map;
}

function readStackTraceText( text ) {
	const stackTrace = JSON.parse( text );
	if ( _.isArray( stackTrace ) ) {
		stackTrace.forEach( readStackTraceObject );
	} else if ( _.isObject( stackTrace ) ) {
		readStackTraceObject( stackTrace );
	} else {
		throw new Error( 'Unrecognized stack trace.' );
	}
}

function readStackTraceObject( stackTrace ) {
	const { url, func, args, line, column } = stackTrace;

	const map = findMap( url );
	translatePosition( map, line, column ).then( ( info ) => {
		console.log( url + ':' + func + '(' + args + ')[' + line + ':' + column + ']' );
		console.log( 'info:', info );
	} );
}

function translatePosition( rawSourceMap, line, column ) {
	const consumerCreate = new sourceMap.SourceMapConsumer( rawSourceMap );

	return consumerCreate.then( ( consumer ) => {
		const info = consumer.originalPositionFor( { line, column } );
		consumer.destroy();
		return info;
	} );
}

function readFromStdin() {
	const rl = readline.createInterface( {
		input: process.stdin,
		output: process.stdout,
		terminal: true,
		prompt: '',
	} );

	console.log( 'Paste stacktrace array from error log: ' );
	rl.on( 'line', ( line ) => {
		readStackTraceText( line );
		rl.close();
	} );
}

const stackTrace = readFromStdin();

