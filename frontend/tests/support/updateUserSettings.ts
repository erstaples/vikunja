import {expect, type APIRequestContext} from '@playwright/test'
import {objectToSnakeCase} from '../../src/helpers/case'

export async function updateUserSettings(apiContext: APIRequestContext, token: string, settings: any) {
	// mage test:e2e exports API_URL with a trailing slash; strip it so the
	// literal '/user' joins below don't produce a 404-ing '//user'.
	const apiUrl = (process.env.API_URL || 'http://localhost:3456/api/v1').replace(/\/$/, '')

	const userResponse = await apiContext.get(`${apiUrl}/user`, {
		headers: {
			'Authorization': `Bearer ${token}`,
		},
	})

	const userData = await userResponse.json()
	// GET /user returns { settings: { frontend_settings: ... }, ... }
	// POST /user/settings/general expects { frontend_settings: ... } at the top level
	const oldSettings = userData.settings || {}

	const snakeSettings = objectToSnakeCase(settings)

	// Deep merge frontend_settings if provided
	const mergedSettings = {
		...oldSettings,
		...snakeSettings,
	}

	if (snakeSettings.frontend_settings) {
		mergedSettings.frontend_settings = {
			...(oldSettings.frontend_settings || {}),
			...snakeSettings.frontend_settings,
		}
	}

	const response = await apiContext.post(`${apiUrl}/user/settings/general`, {
		headers: {
			'Authorization': `Bearer ${token}`,
		},
		data: mergedSettings,
	})
	expect(response.ok()).toBe(true)
}
