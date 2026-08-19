import {join, dirname, resolve} from 'path'
import {fileURLToPath} from 'url'

import {test, expect} from '../../support/fixtures'
import {LabelFactory} from '../../factories/labels'
import {ProjectFactory} from '../../factories/project'
import {createDefaultViews} from '../project/prepareProjects'
import {updateUserSettings} from '../../support/updateUserSettings'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const SCREENSHOT_DIR = resolve(
	__dirname,
	'../../../../.superpowers/sdd/feat-quick-add-inline-selectors-implementation/screenshots',
)

function isBulkCreateRequest(url: string, method: string) {
	return method === 'POST' && url.includes('/api/v2/projects/') && url.includes('/tasks/bulk')
}

test.describe('Quick add inline selectors', () => {
	test.describe('Todoist mode', () => {
		test('completes a @label token via Enter without submitting, then submits it with the label attached', async ({
			authenticatedPage: page, apiContext, userToken,
		}) => {
			await updateUserSettings(apiContext, userToken, {
				frontendSettings: {quickAddMagicMode: 'todoist'},
			})
			await LabelFactory.create(1, {id: 1, title: 'health'})
			const project = (await ProjectFactory.create(1, {id: 1, title: 'Project A'}))[0]
			const views = await createDefaultViews(project.id)

			await page.goto(`/projects/${project.id}/${views[0].id}`)

			let bulkCreateRequests = 0
			page.on('request', request => {
				if (isBulkCreateRequest(request.url(), request.method())) {
					bulkCreateRequests++
				}
			})

			const textarea = page.locator('.add-task-textarea')
			await textarea.fill('Call dentist @hea')

			const listbox = page.getByRole('listbox')
			await expect(listbox).toBeVisible()
			await expect(listbox.getByRole('option', {name: /health/})).toBeVisible()

			await page.screenshot({path: join(SCREENSHOT_DIR, '01-todoist-label-popup.png'), fullPage: true})

			// A "create new label" row always trails real matches, so ArrowDown
			// from the top match moves onto it; ArrowUp proves the row is
			// reachable both ways before landing back on the real match.
			await textarea.press('ArrowDown')
			await textarea.press('ArrowUp')
			await textarea.press('Enter')

			// The single most important assertion in this file: Enter on an open
			// popup completes the token, it must not also submit the task.
			await expect(textarea).toHaveValue('Call dentist @health ')
			await expect(listbox).not.toBeVisible()
			expect(bulkCreateRequests).toBe(0)

			await page.screenshot({path: join(SCREENSHOT_DIR, '02-todoist-label-selected.png'), fullPage: true})

			const createResponse = page.waitForResponse(r => isBulkCreateRequest(r.url(), r.request().method()))
			await textarea.press('Enter')
			const response = await createResponse
			const body = await response.json()
			const createdTaskId = body.tasks[0].id

			const taskResponse = await apiContext.get(`tasks/${createdTaskId}`, {
				headers: {Authorization: `Bearer ${userToken}`},
			})
			expect(taskResponse.ok()).toBe(true)
			const task = await taskResponse.json()
			expect((task.labels ?? []).map(l => l.title)).toContain('health')
		})

		test('completes a #project token via Enter, quoting a multi-word project title', async ({
			authenticatedPage: page, apiContext, userToken,
		}) => {
			await updateUserSettings(apiContext, userToken, {
				frontendSettings: {quickAddMagicMode: 'todoist'},
			})
			const project = (await ProjectFactory.create(1, {id: 1, title: 'Project A'}))[0]
			await createDefaultViews(project.id)
			const target = (await ProjectFactory.create(1, {id: 2, title: 'Office Move'}, false))[0]
			await createDefaultViews(target.id, 5)

			await page.goto(`/projects/${project.id}/1`)

			const textarea = page.locator('.add-task-textarea')
			await textarea.fill('Plan move #Off')

			const listbox = page.getByRole('listbox')
			await expect(listbox).toBeVisible()
			await expect(listbox.getByRole('option', {name: /Office Move/})).toBeVisible()

			await page.screenshot({path: join(SCREENSHOT_DIR, '03-todoist-project-popup.png'), fullPage: true})

			await textarea.press('ArrowDown')
			await textarea.press('Enter')

			// Multi-word titles get quoted so the parser can tell where the token ends.
			await expect(textarea).toHaveValue('Plan move #"Office Move" ')
			await expect(listbox).not.toBeVisible()
		})
	})

	test.describe('Vikunja mode', () => {
		test('completes a *label token via Enter', async ({authenticatedPage: page, apiContext, userToken}) => {
			await updateUserSettings(apiContext, userToken, {
				frontendSettings: {quickAddMagicMode: 'vikunja'},
			})
			await LabelFactory.create(1, {id: 1, title: 'health'})
			const project = (await ProjectFactory.create(1, {id: 1, title: 'Project A'}))[0]
			const views = await createDefaultViews(project.id)

			await page.goto(`/projects/${project.id}/${views[0].id}`)

			const textarea = page.locator('.add-task-textarea')
			await textarea.fill('Call dentist *hea')

			const listbox = page.getByRole('listbox')
			await expect(listbox).toBeVisible()
			await expect(listbox.getByRole('option', {name: /health/})).toBeVisible()

			await page.screenshot({path: join(SCREENSHOT_DIR, '04-vikunja-label-popup.png'), fullPage: true})

			// A "create new label" row always trails real matches, so ArrowDown
			// from the top match moves onto it; ArrowUp proves the row is
			// reachable both ways before landing back on the real match.
			await textarea.press('ArrowDown')
			await textarea.press('ArrowUp')
			await textarea.press('Enter')

			await expect(textarea).toHaveValue('Call dentist *health ')
			await expect(listbox).not.toBeVisible()
		})

		test('opens no popup for @, because it is the assignee prefix there, not labels', async ({
			authenticatedPage: page, apiContext, userToken,
		}) => {
			await updateUserSettings(apiContext, userToken, {
				frontendSettings: {quickAddMagicMode: 'vikunja'},
			})
			await LabelFactory.create(1, {id: 1, title: 'health'})
			const project = (await ProjectFactory.create(1, {id: 1, title: 'Project A'}))[0]
			const views = await createDefaultViews(project.id)

			await page.goto(`/projects/${project.id}/${views[0].id}`)

			const textarea = page.locator('.add-task-textarea')
			const listbox = page.getByRole('listbox')

			// Prove the popup and label data work in this mode before relying on
			// its absence below — otherwise a broken locator would pass either way.
			await textarea.fill('Call dentist *hea')
			await expect(listbox).toBeVisible()
			await expect(listbox.getByRole('option', {name: /health/})).toBeVisible()

			await textarea.fill('Call dentist @hea')
			await expect(listbox).not.toBeVisible()

			await page.screenshot({path: join(SCREENSHOT_DIR, '05-vikunja-at-does-nothing.png'), fullPage: true})
		})
	})
})
