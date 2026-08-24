import { useState, useCallback } from 'react';
import {
	hydratePreferences,
	getPreferencesSnapshot,
	setPreferences,
	type Preferences,
} from './preferences';

export function usePreferences() {
	const [prefs, setPrefs] = useState<Preferences>(() => {
		hydratePreferences();
		return getPreferencesSnapshot();
	});
	const [pending, setPending] = useState(false);

	const update = useCallback(async (patch: Partial<Preferences>) => {
		setPending(true);
		try {
			await setPreferences(patch);
			setPrefs(getPreferencesSnapshot());
		} finally {
			setPending(false);
		}
	}, []);

	return { prefs, update, pending };
}
