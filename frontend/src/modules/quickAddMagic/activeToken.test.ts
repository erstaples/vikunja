import {describe, it, expect} from 'vitest'

import {findActiveQuickAddToken, formatQuickAddToken, getActiveLine} from './activeToken'
import {PrefixMode} from './prefixes'

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

const VIKUNJA = PrefixMode.Default
const TODOIST = PrefixMode.Todoist

// Caret defaults to the end of the text, which is where it sits while typing.
function find(text: string, mode: PrefixMode, caret: number = text.length) {
	return findActiveQuickAddToken(text, caret, mode)
}

describe('findActiveQuickAddToken — prefix modes', () => {
	it('detects a label token in Vikunja mode', () => {
		expect(find('Buy boxes *log', VIKUNJA)).toMatchObject({kind: 'label', prefix: '*', query: 'log'})
	})

	it('detects a project token in Vikunja mode', () => {
		expect(find('Buy boxes +wor', VIKUNJA)).toMatchObject({kind: 'project', prefix: '+', query: 'wor'})
	})

	it('detects a label token in Todoist mode', () => {
		expect(find('Call dentist @hea', TODOIST)).toMatchObject({kind: 'label', prefix: '@', query: 'hea'})
	})

	it('detects a project token in Todoist mode', () => {
		expect(find('Plan move #Off', TODOIST)).toMatchObject({kind: 'project', prefix: '#', query: 'Off'})
	})

	it('ignores @ in Vikunja mode because it is the assignee prefix', () => {
		expect(find('Call dentist @hea', VIKUNJA)).toBeNull()
	})

	it('ignores + in Todoist mode because it is the assignee prefix', () => {
		expect(find('Buy boxes +wor', TODOIST)).toBeNull()
	})

	it('returns null when quick add magic is disabled', () => {
		expect(find('Call dentist @hea', PrefixMode.Disabled)).toBeNull()
	})
})

describe('findActiveQuickAddToken — position', () => {
	it('detects a token at the start of the line', () => {
		expect(find('@hea', TODOIST)).toMatchObject({query: 'hea', start: 0, end: 4})
	})

	it('detects a token after leading indentation', () => {
		expect(find('  @hea', TODOIST)).toMatchObject({query: 'hea', start: 2, end: 6})
	})

	it('detects a token in the middle of a line', () => {
		expect(find('Call @hea today', TODOIST, 9)).toMatchObject({query: 'hea', start: 5, end: 9})
	})

	it('ignores a prefix in the middle of a word', () => {
		expect(find('mail foo@bar', TODOIST)).toBeNull()
	})

	it('detects a bare prefix with an empty query', () => {
		expect(find('Call @', TODOIST)).toMatchObject({query: '', start: 5, end: 6})
	})

	it('returns null when the caret is before the prefix', () => {
		expect(find('Call @hea', TODOIST, 5)).toBeNull()
	})

	it('detects the token when the caret is at its end', () => {
		expect(find('Call @hea', TODOIST, 9)).toMatchObject({query: 'hea'})
	})

	it('returns null when the caret has moved past the token', () => {
		expect(find('Call @hea now', TODOIST, 13)).toBeNull()
	})

	it('picks the token nearest the caret when a line has two', () => {
		expect(find('@one @two', TODOIST, 9)).toMatchObject({query: 'two', start: 5})
	})
})

describe('findActiveQuickAddToken — quoting', () => {
	it('detects a double-quoted token', () => {
		expect(find('Plan #"Office Move"', TODOIST)).toMatchObject({query: 'Office Move', quote: '"'})
	})

	it('detects a single-quoted token', () => {
		expect(find('Plan #\'Office Move\'', TODOIST)).toMatchObject({query: 'Office Move', quote: '\''})
	})

	it('keeps filtering inside an unclosed quote', () => {
		expect(find('Plan #"Office', TODOIST)).toMatchObject({query: 'Office', quote: '"', end: 13})
	})

	it('ends a quoted token at the closing quote, not the next space', () => {
		expect(find('Plan #"Office Move" today', TODOIST, 19)).toMatchObject({query: 'Office Move', end: 19})
	})
})

describe('findActiveQuickAddToken — multiline', () => {
	it('uses the line the caret is on', () => {
		const text = 'Call @one\nPlan @two'
		expect(find(text, TODOIST, 19)).toMatchObject({query: 'two', start: 15})
	})

	it('returns null when the caret line is wholly quoted', () => {
		expect(find('"Call @hea"', TODOIST, 10)).toBeNull()
	})

	it('does not let a quoted other line suppress the caret line', () => {
		const text = '"Quoted line"\nCall @hea'
		expect(find(text, TODOIST, 23)).toMatchObject({query: 'hea'})
	})
})

describe('findActiveQuickAddToken — bullet markers', () => {
	// parseSubtasksViaIndention strips a leading "* " as a bullet, and * is also
	// the Vikunja label prefix. The space closes the token, so the popup is only
	// open while the caret sits directly after the bare marker.
	it('opens with an empty query directly after a lone leading asterisk', () => {
		expect(find('* ', VIKUNJA, 1)).toMatchObject({kind: 'label', query: ''})
	})

	it('closes once the space after the bullet is typed', () => {
		expect(find('* ', VIKUNJA, 2)).toBeNull()
	})
})
