import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { analyticsDisabledEnv } from '../utilities/utilities';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});
});

suite('analyticsDisabledEnv', () => {
	test('sets WENDY_ANALYTICS to false', () => {
		assert.strictEqual(analyticsDisabledEnv().WENDY_ANALYTICS, 'false');
	});

	test('preserves the existing environment', () => {
		const originalPath = process.env.PATH;
		assert.strictEqual(analyticsDisabledEnv().PATH, originalPath);
	});

	test('does not mutate process.env', () => {
		analyticsDisabledEnv();
		assert.strictEqual(process.env.WENDY_ANALYTICS, undefined);
	});
});
