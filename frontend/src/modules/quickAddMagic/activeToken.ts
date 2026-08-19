import {PREFIXES, PrefixMode} from './prefixes'

export interface ActiveLine {
	text: string
	start: number
	end: number
}

const LINE_BREAK = /\r\n|\r|\n/g

export function getActiveLine(text: string, caret: number): ActiveLine {
	let start = 0
	LINE_BREAK.lastIndex = 0

	let match: RegExpExecArray | null
	while ((match = LINE_BREAK.exec(text)) !== null) {
		// A caret sitting on the break belongs to the line the break terminates.
		if (match.index >= caret) {
			break
		}
		start = match.index + match[0].length
	}

	const rest = text.slice(start)
	const breakInRest = rest.search(/\r\n|\r|\n/)
	const end = breakInRest === -1 ? text.length : start + breakInRest

	return {text: text.slice(start, end), start, end}
}

export function formatQuickAddToken(prefix: string, title: string, quote: '"' | '\'' | null = null): string {
	if (!/[\s'"]/.test(title)) {
		return prefix + title
	}

	let style = quote ?? '"'
	if (title.includes(style)) {
		const otherStyle = style === '"' ? '\'' : '"'
		if (!title.includes(otherStyle)) {
			style = otherStyle
		}
	}

	// No escape syntax exists in getItemsFromPrefix, so a title containing both
	// styles loses the one that would terminate the token early.
	const safe = title.includes(style) ? title.split(style).join('') : title

	return `${prefix}${style}${safe}${style}`
}

export type QuickAddTokenKind = 'label' | 'project'

export interface ActiveQuickAddToken {
	kind: QuickAddTokenKind
	prefix: string
	query: string
	quote: '"' | '\'' | null
	start: number
	end: number
}

function isWhollyQuoted(line: string): boolean {
	const trimmed = line.trim()
	return trimmed.length >= 2
		&& ((trimmed.startsWith('"') && trimmed.endsWith('"'))
			|| (trimmed.startsWith('\'') && trimmed.endsWith('\'')))
}

export function findActiveQuickAddToken(
	text: string,
	caret: number,
	mode: PrefixMode,
): ActiveQuickAddToken | null {
	const prefixes = PREFIXES[mode]
	if (prefixes === undefined) {
		return null
	}

	const line = getActiveLine(text, caret)
	if (isWhollyQuoted(line.text)) {
		return null
	}

	const caretInLine = caret - line.start
	if (caretInLine < 0 || caretInLine > line.text.length) {
		return null
	}

	const kindByPrefix = new Map<string, QuickAddTokenKind>([
		[prefixes.label, 'label'],
		[prefixes.project, 'project'],
	])

	// Walk back to find a token start. A token starts at the line start or after
	// whitespace. Don't stop at spaces during this walk; quoted tokens may contain them.
	let start = -1
	for (let i = caretInLine - 1; i >= 0; i--) {
		const char = line.text[i]
		if (kindByPrefix.has(char) && (i === 0 || /\s/.test(line.text[i - 1]))) {
			start = i
			break
		}
	}
	if (start === -1) {
		return null
	}

	const prefix = line.text[start]
	const kind = kindByPrefix.get(prefix) as QuickAddTokenKind

	const afterPrefix = line.text[start + 1]
	const quote = afterPrefix === '"' || afterPrefix === '\'' ? afterPrefix : null

	let end: number
	let query: string
	if (quote === null) {
		const rest = line.text.slice(start + 1)
		const space = rest.search(/\s/)
		end = space === -1 ? line.text.length : start + 1 + space
		query = line.text.slice(start + 1, end)

		// For unquoted tokens, check that the caret hasn't moved past a space.
		if (caretInLine < start + 1 || caretInLine > end) {
			return null
		}
	} else {
		const closing = line.text.indexOf(quote, start + 2)
		end = closing === -1 ? line.text.length : closing + 1
		query = line.text.slice(start + 2, closing === -1 ? line.text.length : closing)

		// For quoted tokens, the caret must be within the bounds.
		if (caretInLine < start + 1 || caretInLine > end) {
			return null
		}
	}

	return {kind, prefix, query, quote, start: line.start + start, end: line.start + end}
}
