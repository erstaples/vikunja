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
