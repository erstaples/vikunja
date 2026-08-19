import {describe, it, expect} from 'vitest'

import {formatQuickAddToken, getActiveLine} from './activeToken'

describe('getActiveLine', () => {
	it('returns the whole text when there is one line', () => {
		expect(getActiveLine('Call dentist', 4)).toEqual({text: 'Call dentist', start: 0, end: 12})
	})

	it('returns the line the caret is on', () => {
		const text = 'first\nsecond\nthird'
		expect(getActiveLine(text, 8)).toEqual({text: 'second', start: 6, end: 12})
	})

	it('treats a caret on a line break as belonging to the line that break terminates', () => {
		const text = 'first\nsecond'
		expect(getActiveLine(text, 5)).toEqual({text: 'first', start: 0, end: 5})
	})

	it('handles CRLF line breaks', () => {
		const text = 'first\r\nsecond'
		expect(getActiveLine(text, 9)).toEqual({text: 'second', start: 7, end: 13})
	})

	it('handles a caret at the very end', () => {
		const text = 'first\nsecond'
		expect(getActiveLine(text, 12)).toEqual({text: 'second', start: 6, end: 12})
	})

	it('returns an empty line for empty text', () => {
		expect(getActiveLine('', 0)).toEqual({text: '', start: 0, end: 0})
	})
})

describe('formatQuickAddToken', () => {
	it('does not quote a single word', () => {
		expect(formatQuickAddToken('@', 'health')).toBe('@health')
	})

	it('quotes a title containing whitespace', () => {
		expect(formatQuickAddToken('#', 'Office Move')).toBe('#"Office Move"')
	})

	it('preserves the quote style the user opened', () => {
		expect(formatQuickAddToken('#', 'Office Move', '\'')).toBe('#\'Office Move\'')
	})

	it('quotes a title containing a quote character even without whitespace', () => {
		expect(formatQuickAddToken('@', 'it\'s')).toBe('@"it\'s"')
	})

	it('falls back to the other quote style when the title contains the requested one', () => {
		expect(formatQuickAddToken('@', 'it\'s', '\'')).toBe('@"it\'s"')
	})

	it('strips embedded double quotes when the title contains both quote styles', () => {
		// getItemsFromPrefix splits on the quote character and has no escape syntax,
		// so nothing survives a round trip. Stripping is the least-lossy option.
		expect(formatQuickAddToken('@', 'it\'s "big"')).toBe('@"it\'s big"')
	})
})
