/**
 * Vitest loads this before specs. English is always in the catalog; other
 * locales are on-demand in the app. Tests that call createT("ja") need the
 * table filled or they silently get English.
 */
import { loadAllLocaleCatalogs } from "@/i18n";

await loadAllLocaleCatalogs();
